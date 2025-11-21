import defaultDb from '../config/dbconfig.js';
import multer from 'multer';
import xlsx from 'xlsx';
import { crearClase } from './clasesController.js';
import { logger } from '../utils/logger.js';

// Configuración de multer para archivos Excel
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no válido. Solo se permiten archivos Excel (.xlsx, .xls) o CSV'));
    }
  }
});

/**
 * Importar horarios desde archivo Excel
 * Formato esperado:
 * - Columna A: Código Ambiente
 * - Columna B: Nombre Instructor (o Cédula)
 * - Columna C: Código Ficha/Grupo
 * - Columna D: Nombre Clase
 * - Columna E: Fecha (YYYY-MM-DD)
 * - Columna F: Hora Inicio (HH:MM)
 * - Columna G: Hora Fin (HH:MM)
 * - Columna H: Descripción (opcional)
 */
export async function importarHorariosExcel(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    if (data.length < 2) {
      return res.status(400).json({ error: 'El archivo está vacío o no tiene datos válidos' });
    }

    // Obtener encabezados (primera fila)
    const headers = data[0].map(h => String(h || '').trim().toLowerCase());
    
    // Mapear índices de columnas
    const colIndices = {
      codigo_ambiente: headers.findIndex(h => h.includes('ambiente') || h.includes('codigo')),
      instructor: headers.findIndex(h => h.includes('instructor') || h.includes('docente')),
      codigo_ficha: headers.findIndex(h => h.includes('ficha') || h.includes('grupo')),
      nombre_clase: headers.findIndex(h => h.includes('clase') || h.includes('nombre')),
      fecha: headers.findIndex(h => h.includes('fecha')),
      hora_inicio: headers.findIndex(h => h.includes('inicio') || h.includes('hora inicio')),
      hora_fin: headers.findIndex(h => h.includes('fin') || h.includes('hora fin')),
      descripcion: headers.findIndex(h => h.includes('descripcion') || h.includes('observacion'))
    };

    // Validar que las columnas requeridas existen
    const required = ['codigo_ambiente', 'instructor', 'fecha', 'hora_inicio', 'hora_fin'];
    const missing = required.filter(col => colIndices[col] === -1);
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Columnas requeridas faltantes',
        detalle: `Faltan las siguientes columnas: ${missing.join(', ')}`,
        columnas_encontradas: headers
      });
    }

    const resultados = {
      exitosos: [],
      errores: [],
      total: data.length - 1
    };

    // Procesar cada fila (empezar desde la fila 2, índice 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every(cell => !cell)) continue; // Saltar filas vacías

      try {
        const codigoAmbiente = String(row[colIndices.codigo_ambiente] || '').trim();
        const instructor = String(row[colIndices.instructor] || '').trim();
        const codigoFicha = colIndices.codigo_ficha >= 0 ? String(row[colIndices.codigo_ficha] || '').trim() : null;
        const nombreClase = colIndices.nombre_clase >= 0 ? String(row[colIndices.nombre_clase] || '').trim() : null;
        const fecha = String(row[colIndices.fecha] || '').trim();
        const horaInicio = String(row[colIndices.hora_inicio] || '').trim();
        const horaFin = String(row[colIndices.hora_fin] || '').trim();
        const descripcion = colIndices.descripcion >= 0 ? String(row[colIndices.descripcion] || '').trim() : null;

        // Validaciones básicas
        if (!codigoAmbiente || !instructor || !fecha || !horaInicio || !horaFin) {
          resultados.errores.push({
            fila: i + 1,
            error: 'Campos requeridos faltantes',
            datos: { codigoAmbiente, instructor, fecha, horaInicio, horaFin }
          });
          continue;
        }

        // Buscar ambiente por código
        const [[ambiente]] = await defaultDb.execute(
          'SELECT id_ambiente FROM Ambientes WHERE codigo_ambiente = ? AND estado_ambiente = "Activo"',
          [codigoAmbiente]
        );

        if (!ambiente) {
          resultados.errores.push({
            fila: i + 1,
            error: `Ambiente no encontrado: ${codigoAmbiente}`,
            datos: { codigoAmbiente }
          });
          continue;
        }

        // Buscar instructor por nombre o cédula
        const [[instructorData]] = await defaultDb.execute(
          `SELECT u.id_usuario 
           FROM Usuarios u
           INNER JOIN Roles r ON u.id_rol = r.id_rol
           WHERE (u.nombre_usuario = ? OR u.cedula = ?)
             AND r.nombre_rol = 'Instructor'
             AND u.estado = 'Activo'
           LIMIT 1`,
          [instructor, instructor]
        );

        if (!instructorData) {
          resultados.errores.push({
            fila: i + 1,
            error: `Instructor no encontrado: ${instructor}`,
            datos: { instructor }
          });
          continue;
        }

        // Normalizar fecha (puede venir en diferentes formatos)
        let fechaNormalizada = fecha;
        if (fecha.includes('/')) {
          const parts = fecha.split('/');
          if (parts.length === 3) {
            fechaNormalizada = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        // Normalizar horas (puede venir sin segundos)
        const horaInicioNormalizada = horaInicio.includes(':') && horaInicio.split(':').length === 2
          ? `${horaInicio}:00`
          : horaInicio;
        const horaFinNormalizada = horaFin.includes(':') && horaFin.split(':').length === 2
          ? `${horaFin}:00`
          : horaFin;

        // Validar formato de fecha
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNormalizada)) {
          resultados.errores.push({
            fila: i + 1,
            error: `Formato de fecha inválido: ${fecha}`,
            datos: { fecha }
          });
          continue;
        }

        // Validar formato de hora
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(horaInicioNormalizada) || !/^\d{2}:\d{2}(:\d{2})?$/.test(horaFinNormalizada)) {
          resultados.errores.push({
            fila: i + 1,
            error: `Formato de hora inválido: ${horaInicio} - ${horaFin}`,
            datos: { horaInicio, horaFin }
          });
          continue;
        }

        // Validar que hora_fin > hora_inicio
        if (horaFinNormalizada <= horaInicioNormalizada) {
          resultados.errores.push({
            fila: i + 1,
            error: 'La hora de fin debe ser mayor que la hora de inicio',
            datos: { horaInicio: horaInicioNormalizada, horaFin: horaFinNormalizada }
          });
          continue;
        }

        // Verificar conflictos de horario
        const [clasesConflictivas] = await defaultDb.execute(
          `SELECT id_clase FROM Clases 
           WHERE id_ambiente = ?
             AND fecha_clase = ?
             AND estado_clase IN ('Programada', 'En Curso')
             AND (
               (hora_inicio < ? AND hora_fin > ?) OR
               (hora_inicio < ? AND hora_fin > ?) OR
               (hora_inicio >= ? AND hora_fin <= ?)
             )`,
          [ambiente.id_ambiente, fechaNormalizada, horaInicioNormalizada, horaInicioNormalizada, horaFinNormalizada, horaFinNormalizada, horaInicioNormalizada, horaFinNormalizada]
        );

        if (clasesConflictivas.length > 0) {
          resultados.errores.push({
            fila: i + 1,
            error: 'Conflicto de horario: ya existe una clase en este ambiente en el horario especificado',
            datos: { codigoAmbiente, fecha: fechaNormalizada, horaInicio: horaInicioNormalizada, horaFin: horaFinNormalizada }
          });
          continue;
        }

        // Crear la clase
        const [result] = await defaultDb.execute(
          `INSERT INTO Clases 
           (id_ambiente, id_instructor, nombre_clase, codigo_ficha, descripcion, fecha_clase, hora_inicio, hora_fin, observaciones, creado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ambiente.id_ambiente,
            instructorData.id_usuario,
            nombreClase || `Clase ${codigoFicha || fechaNormalizada}`,
            codigoFicha,
            descripcion,
            fechaNormalizada,
            horaInicioNormalizada,
            horaFinNormalizada,
            `Importado desde Excel - Fila ${i + 1}`,
            req.user?.id
          ]
        );

        resultados.exitosos.push({
          fila: i + 1,
          id_clase: result.insertId,
          datos: {
            ambiente: codigoAmbiente,
            instructor,
            fecha: fechaNormalizada,
            horaInicio: horaInicioNormalizada,
            horaFin: horaFinNormalizada
          }
        });
      } catch (err) {
        resultados.errores.push({
          fila: i + 1,
          error: err.message,
          datos: row
        });
      }
    }

    return res.json({
      ok: true,
      message: `Importación completada: ${resultados.exitosos.length} exitosos, ${resultados.errores.length} errores`,
      resultados
    });
  } catch (err) {
    logger.error('Error al importar horarios', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al importar horarios',
      detalle: err.message
    });
  }
}

/**
 * Descargar plantilla Excel para importación de horarios
 */
export async function descargarPlantillaHorarios(req, res) {
  try {
    const workbook = xlsx.utils.book_new();
    
    // Crear hoja con encabezados y ejemplo
    const datos = [
      ['Código Ambiente', 'Instructor (Nombre o Cédula)', 'Código Ficha', 'Nombre Clase', 'Fecha (YYYY-MM-DD)', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Descripción'],
      ['LAB-201', 'Juan Pérez', '123456', 'Programación Web', '2024-01-15', '08:00', '10:00', 'Clase de introducción'],
      ['LAB-202', 'María García', '123457', 'Base de Datos', '2024-01-15', '10:00', '12:00', 'SQL básico']
    ];

    const worksheet = xlsx.utils.aoa_to_sheet(datos);
    
    // Ajustar ancho de columnas
    worksheet['!cols'] = [
      { wch: 15 }, // Código Ambiente
      { wch: 25 }, // Instructor
      { wch: 15 }, // Código Ficha
      { wch: 25 }, // Nombre Clase
      { wch: 15 }, // Fecha
      { wch: 12 }, // Hora Inicio
      { wch: 12 }, // Hora Fin
      { wch: 30 }  // Descripción
    ];

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Horarios');

    // Generar buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_horarios.xlsx');
    res.send(buffer);
  } catch (err) {
    logger.error('Error al generar plantilla', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al generar plantilla',
      detalle: err.message
    });
  }
}

