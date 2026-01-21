import defaultDb from '../config/dbconfig.js';
import multer from 'multer';
import xlsx from 'xlsx';
import { crearClase } from './clasesController.js';
import { logger } from '../utils/logger.js';

/**
 * Mapeo de días de la semana en español a números (0=Domingo, 1=Lunes, etc.)
 */
const DIAS_SEMANA_MAP = {
  'lunes': 1,
  'martes': 2,
  'miércoles': 3,
  'miercoles': 3,
  'jueves': 4,
  'viernes': 5,
  'sábado': 6,
  'sabado': 6,
  'domingo': 0
};

/**
 * Función helper para parsear días de la semana desde string
 * Acepta formatos: "Lunes,Martes,Miércoles" o "Lunes; Martes" o "Lunes Martes"
 */
function parsearDiasSemana(diasStr) {
  if (!diasStr || typeof diasStr !== 'string') return [];
  
  const dias = diasStr
    .split(/[,;]/)
    .map(d => d.trim().toLowerCase())
    .filter(d => d.length > 0)
    .map(d => DIAS_SEMANA_MAP[d])
    .filter(d => d !== undefined);
  
  return [...new Set(dias)]; // Eliminar duplicados
}

/**
 * Función helper reutilizable para obtener fechas dentro de un rango que coincidan con días de semana
 * @param {string} fecha_inicio - Fecha de inicio en formato YYYY-MM-DD
 * @param {string} fecha_fin - Fecha de fin en formato YYYY-MM-DD
 * @param {number[]} dias_semana - Array de números de días de semana (0=Domingo, 1=Lunes, etc.)
 * @returns {Date[]} Array de fechas válidas dentro del rango
 */
export function obtenerFechasPorRangoYDias(fecha_inicio, fecha_fin, dias_semana) {
  if (!fecha_inicio || !fecha_fin || !Array.isArray(dias_semana) || dias_semana.length === 0) {
    return [];
  }

  const fechaInicio = new Date(fecha_inicio + 'T00:00:00');
  const fechaFin = new Date(fecha_fin + 'T23:59:59');
  
  // Validar que fecha_inicio <= fecha_fin
  if (fechaInicio > fechaFin) {
    return [];
  }

  const fechas = [];
  
  // Iterar día por día dentro del rango
  for (let fecha = new Date(fechaInicio); fecha <= fechaFin; fecha.setDate(fecha.getDate() + 1)) {
    const diaSemana = fecha.getDay();
    if (dias_semana.includes(diaSemana)) {
      fechas.push(new Date(fecha));
    }
  }
  
  return fechas;
}

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
 * - Columna E: Fecha (YYYY-MM-DD) o Días de Semana (Lunes,Martes,Miércoles...)
 * - Columna F: Hora Inicio (HH:MM)
 * - Columna G: Hora Fin (HH:MM)
 * - Columna H: Descripción (opcional)
 * 
 * NOTA: Si se proporciona "Días de Semana", se crearán clases recurrentes para cada día.
 * Si se proporciona "Fecha", se crea una clase única para esa fecha.
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
      fecha: headers.findIndex(h => h.includes('fecha') && !h.includes('día') && !h.includes('inicio') && !h.includes('fin')),
      fecha_inicio: headers.findIndex(h => (h.includes('fecha') && h.includes('inicio')) || h.includes('fecha inicio')),
      fecha_fin: headers.findIndex(h => (h.includes('fecha') && h.includes('fin')) || h.includes('fecha fin')),
      dias_semana: headers.findIndex(h => (h.includes('día') || h.includes('dia') || h.includes('semana')) && !h.includes('fecha')),
      hora_inicio: headers.findIndex(h => h.includes('hora') && h.includes('inicio') && !h.includes('fecha')),
      hora_fin: headers.findIndex(h => h.includes('hora') && h.includes('fin') && !h.includes('fecha')),
      descripcion: headers.findIndex(h => h.includes('descripcion') || h.includes('observacion'))
    };

    // Validar que las columnas requeridas existen
    // Se requiere: ambiente, instructor, hora_inicio, hora_fin
    // Y al menos uno de: fecha O dias_semana
    const required = ['codigo_ambiente', 'instructor', 'hora_inicio', 'hora_fin'];
    const missing = required.filter(col => colIndices[col] === -1);
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Columnas requeridas faltantes',
        detalle: `Faltan las siguientes columnas: ${missing.join(', ')}`,
        columnas_encontradas: headers
      });
    }
    
    // Validar que al menos fecha única O (fecha_inicio + fecha_fin + dias_semana) esté presente
    const tieneFechaUnica = colIndices.fecha >= 0;
    const tieneRangoConDias = colIndices.fecha_inicio >= 0 && colIndices.fecha_fin >= 0 && colIndices.dias_semana >= 0;
    
    if (!tieneFechaUnica && !tieneRangoConDias) {
      return res.status(400).json({
        error: 'Faltan columnas requeridas',
        detalle: 'Debe proporcionar: "Fecha" (para clase única) O "Fecha Inicio" + "Fecha Fin" + "Días de Semana" (para clases recurrentes)',
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
        const fechaRaw = colIndices.fecha >= 0 ? String(row[colIndices.fecha] || '').trim() : '';
        const fechaInicioRaw = colIndices.fecha_inicio >= 0 ? String(row[colIndices.fecha_inicio] || '').trim() : '';
        const fechaFinRaw = colIndices.fecha_fin >= 0 ? String(row[colIndices.fecha_fin] || '').trim() : '';
        const diasSemanaRaw = colIndices.dias_semana >= 0 ? String(row[colIndices.dias_semana] || '').trim() : '';
        const horaInicio = String(row[colIndices.hora_inicio] || '').trim();
        const horaFin = String(row[colIndices.hora_fin] || '').trim();
        const descripcion = colIndices.descripcion >= 0 ? String(row[colIndices.descripcion] || '').trim() : null;

        // Validaciones básicas
        if (!codigoAmbiente || !instructor || !horaInicio || !horaFin) {
          resultados.errores.push({
            fila: i + 1,
            error: 'Campos requeridos faltantes',
            datos: { codigoAmbiente, instructor, horaInicio, horaFin }
          });
          continue;
        }
        
        // Validar que al menos fecha única O (fecha_inicio + fecha_fin + dias_semana) esté presente
        const tieneFechaUnica = fechaRaw && fechaRaw.length > 0;
        const tieneRangoConDias = fechaInicioRaw && fechaFinRaw && diasSemanaRaw;
        
        if (!tieneFechaUnica && !tieneRangoConDias) {
          resultados.errores.push({
            fila: i + 1,
            error: 'Debe proporcionar: Fecha (clase única) O Fecha Inicio + Fecha Fin + Días de Semana (clases recurrentes)',
            datos: { fecha: fechaRaw, fechaInicio: fechaInicioRaw, fechaFin: fechaFinRaw, diasSemana: diasSemanaRaw }
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

        // Normalizar horas (puede venir sin segundos)
        const horaInicioNormalizada = horaInicio.includes(':') && horaInicio.split(':').length === 2
          ? `${horaInicio}:00`
          : horaInicio;
        const horaFinNormalizada = horaFin.includes(':') && horaFin.split(':').length === 2
          ? `${horaFin}:00`
          : horaFin;

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

        // Determinar fechas a procesar: fecha única o días de semana recurrentes
        let fechasAProcesar = [];
        
        if (fechaRaw) {
          // Procesar fecha única
          let fechaNormalizada = fechaRaw;
          if (fechaRaw.includes('/')) {
            const parts = fechaRaw.split('/');
            if (parts.length === 3) {
              fechaNormalizada = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          
          if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNormalizada)) {
            resultados.errores.push({
              fila: i + 1,
              error: `Formato de fecha inválido: ${fechaRaw}`,
              datos: { fecha: fechaRaw }
            });
            continue;
          }
          
          fechasAProcesar = [new Date(fechaNormalizada + 'T00:00:00')];
        } else if (diasSemanaRaw && fechaInicioRaw && fechaFinRaw) {
          // Procesar días de semana recurrentes dentro de un rango
          const diasSemana = parsearDiasSemana(diasSemanaRaw);
          if (diasSemana.length === 0) {
            resultados.errores.push({
              fila: i + 1,
              error: `Días de semana inválidos: ${diasSemanaRaw}. Use: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo`,
              datos: { diasSemana: diasSemanaRaw }
            });
            continue;
          }
          
          // Normalizar fechas de rango
          let fechaInicioNormalizada = fechaInicioRaw;
          let fechaFinNormalizada = fechaFinRaw;
          
          if (fechaInicioRaw.includes('/')) {
            const parts = fechaInicioRaw.split('/');
            if (parts.length === 3) {
              fechaInicioNormalizada = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          
          if (fechaFinRaw.includes('/')) {
            const parts = fechaFinRaw.split('/');
            if (parts.length === 3) {
              fechaFinNormalizada = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          
          if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicioNormalizada) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFinNormalizada)) {
            resultados.errores.push({
              fila: i + 1,
              error: `Formato de fecha de rango inválido: ${fechaInicioRaw} - ${fechaFinRaw}`,
              datos: { fechaInicio: fechaInicioRaw, fechaFin: fechaFinRaw }
            });
            continue;
          }
          
          if (fechaInicioNormalizada > fechaFinNormalizada) {
            resultados.errores.push({
              fila: i + 1,
              error: 'La fecha de inicio debe ser menor o igual a la fecha de fin',
              datos: { fechaInicio: fechaInicioNormalizada, fechaFin: fechaFinNormalizada }
            });
            continue;
          }
          
          // Obtener fechas dentro del rango
          fechasAProcesar = obtenerFechasPorRangoYDias(fechaInicioNormalizada, fechaFinNormalizada, diasSemana);
          
          if (fechasAProcesar.length === 0) {
            resultados.errores.push({
              fila: i + 1,
              error: `No se encontraron fechas válidas en el rango ${fechaInicioNormalizada} a ${fechaFinNormalizada} para los días especificados`,
              datos: { fechaInicio: fechaInicioNormalizada, fechaFin: fechaFinNormalizada, diasSemana: diasSemanaRaw }
            });
            continue;
          }
        }

        // Procesar cada fecha
        let clasesCreadas = 0;
        let erroresFechas = [];
        
        for (const fechaObj of fechasAProcesar) {
          const fechaNormalizada = fechaObj.toISOString().split('T')[0];
          
          try {
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
              erroresFechas.push({
                fecha: fechaNormalizada,
                error: 'Conflicto de horario existente'
              });
              continue;
            }

            // Crear la clase
            // IMPORTANTE: Establecer explícitamente estado_clase = 'Programada'
            // El sistema es 100% manual, las clases siempre se crean como Programadas
            const [result] = await defaultDb.execute(
              `INSERT INTO Clases 
               (id_ambiente, id_instructor, nombre_clase, codigo_ficha, descripcion, fecha_clase, hora_inicio, hora_fin, observaciones, estado_clase, creado_por)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Programada', ?)`,
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

            clasesCreadas++;
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
            erroresFechas.push({
              fecha: fechaNormalizada,
              error: err.message
            });
          }
        }
        
        // Si hubo errores en algunas fechas pero se crearon otras, registrar advertencia
        if (erroresFechas.length > 0 && clasesCreadas > 0) {
          logger.warn(`Fila ${i + 1}: Se crearon ${clasesCreadas} clases pero ${erroresFechas.length} fallaron`, { erroresFechas });
        } else if (erroresFechas.length > 0 && clasesCreadas === 0) {
          // Si todas fallaron, registrar como error
          resultados.errores.push({
            fila: i + 1,
            error: `No se pudo crear ninguna clase: ${erroresFechas.map(e => `${e.fecha}: ${e.error}`).join('; ')}`,
            datos: { ambiente: codigoAmbiente, instructor, erroresFechas }
          });
        }
      } catch (err) {
        resultados.errores.push({
          fila: i + 1,
          error: err.message,
          datos: row
        });
      }
    }

    // Determinar código de respuesta HTTP
    const totalExitosos = resultados.exitosos.length;
    const totalErrores = resultados.errores.length;
    const tieneExitoParcial = totalExitosos > 0 && totalErrores > 0;
    
    if (tieneExitoParcial) {
      // HTTP 207 Multi-Status para éxito parcial
      return res.status(207).json({
        ok: true,
        message: `Importación completada con advertencias: ${totalExitosos} clases creadas, ${totalErrores} errores`,
        creadas: totalExitosos,
        errores: totalErrores,
        resultados
      });
    } else if (totalExitosos > 0) {
      return res.json({
        ok: true,
        message: `Importación completada: ${totalExitosos} clases creadas correctamente`,
        creadas: totalExitosos,
        resultados
      });
    } else {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo crear ninguna clase',
        resultados
      });
    }
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
    
    // Crear hoja con encabezados y ejemplos
    const datos = [
      ['Código Ambiente', 'Instructor (Nombre o Cédula)', 'Código Ficha', 'Nombre Clase', 'Fecha (YYYY-MM-DD) O Días de Semana', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Descripción'],
      ['LAB-201', 'Juan Pérez', '123456', 'Programación Web', '2024-01-15', '08:00', '10:00', 'Clase única'],
      ['LAB-202', 'María García', '123457', 'Base de Datos', 'Lunes,Martes,Miércoles', '10:00', '12:00', 'Clase recurrente'],
      ['LAB-203', 'Carlos López', '123458', 'Redes', 'Jueves,Viernes', '14:00', '16:00', 'Clase semanal']
    ];

    const worksheet = xlsx.utils.aoa_to_sheet(datos);
    
    // Ajustar ancho de columnas
    worksheet['!cols'] = [
      { wch: 15 }, // Código Ambiente
      { wch: 25 }, // Instructor
      { wch: 15 }, // Código Ficha
      { wch: 25 }, // Nombre Clase
      { wch: 15 }, // Fecha (clase única)
      { wch: 18 }, // Fecha Inicio
      { wch: 18 }, // Fecha Fin
      { wch: 25 }, // Días de Semana
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

