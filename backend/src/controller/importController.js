import defaultDb from '../config/dbconfig.js';
import XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import emailService from '../services/emailService.js';
import { ensureAprendicesTable } from './aprendicesController.js';
import { logger } from '../utils/logger.js';

/**
 * Inicializar tabla de duplicados pendientes si no existe
 */
async function inicializarTablaDuplicados() {
  try {
    const [[tablaExiste]] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Importaciones_Duplicados'`
    );

    if (tablaExiste.cnt === 0) {
      await defaultDb.execute(`
        CREATE TABLE Importaciones_Duplicados (
          id_duplicado INT PRIMARY KEY AUTO_INCREMENT,
          id_importacion VARCHAR(100) NOT NULL COMMENT 'ID único de la sesión de importación',
          fila_excel INT NOT NULL COMMENT 'Número de fila en el Excel',
          placa VARCHAR(100) NOT NULL,
          codigo_equipo_existente INT NOT NULL COMMENT 'ID del equipo que ya existe en BD',
          datos_excel JSON NOT NULL COMMENT 'Todos los datos del registro del Excel',
          datos_bd JSON NOT NULL COMMENT 'Todos los datos del registro existente en BD',
          estado ENUM('Pendiente', 'Aprobado', 'Rechazado') DEFAULT 'Pendiente',
          decidido_por INT NULL COMMENT 'Usuario que tomó la decisión',
          fecha_decision DATETIME NULL,
          fecha_creacion DATETIME DEFAULT NOW(),
          INDEX idx_importacion (id_importacion),
          INDEX idx_estado (estado),
          INDEX idx_placa (placa),
          FOREIGN KEY (codigo_equipo_existente) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
          FOREIGN KEY (decidido_por) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL
        ) COMMENT = 'Registros duplicados pendientes de revisión manual'
      `);
      logger.info('Tabla Importaciones_Duplicados creada');
    }
  } catch (error) {
    logger.error('Error al inicializar tabla de duplicados', { error: error.message });
    throw error;
  }
}

/**
 * Importar equipos desde archivo Excel
 * 
 * FORMATO DE EXCEL ESPERADO:
 * Los nombres de las columnas deben ser EXACTAMENTE iguales a los campos de la BD:
 * 
 * OBLIGATORIAS:
 * - placa: Código de inventario único del equipo
 * 
 * OPCIONALES (nombres exactos):
 * - tipo: Tipo de equipo (campo libre, no es categoría)
 * - categoria: Nombre o ID de la categoría (debe existir en Categorias_Equipo)
 * - modelo: Modelo del equipo
 * - consecutivo: Número de serie o consecutivo
 * - descripcion: Descripción del equipo
 * - fecha_adquisicion: Fecha de adquisición (formato: YYYY-MM-DD)
 * - valor_ingreso: Valor de adquisición del equipo
 * - r_centro: Código del centro
 * - atributos: Especificaciones técnicas del equipo
 * - ambiente: Código o ID del ambiente (si no se especifica, se usa "Neutral" por defecto)
 * 
 * NOTA: Los campos estado_fisico y vida_util_meses se manejan en el aplicativo, no en el Excel
 */
export async function importarEquipos(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const dataRaw = XLSX.utils.sheet_to_json(worksheet);

    if (!dataRaw || dataRaw.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    // Normalizar nombres de columnas para que coincidan con los nombres de BD
    // Esto permite que el Excel tenga "Placa", "R Centro", "Fecha Adquisición", etc.
    const normalizeColumnName = (name) => {
      if (!name) return '';
      // Convertir a minúsculas
      let normalized = String(name).toLowerCase().trim();
      // Eliminar tildes y caracteres especiales
      normalized = normalized
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos
        .replace(/[^a-z0-9_]/g, '_') // Reemplazar caracteres especiales con guión bajo
        .replace(/_+/g, '_') // Reemplazar múltiples guiones bajos con uno solo
        .replace(/^_|_$/g, ''); // Eliminar guiones bajos al inicio y final
      return normalized;
    };

    // Mapeo de nombres comunes del Excel (normalizados) a nombres de BD
    const columnMapping = {
      'r_centro': 'r_centro',
      'rcentro': 'r_centro',
      'centro': 'r_centro',
      'codigo_centro': 'r_centro',
      'fecha_adquisicion': 'fecha_adquisicion',
      'fechaadquisicion': 'fecha_adquisicion',
      'valor_ingreso': 'valor_ingreso',
      'valoringreso': 'valor_ingreso',
      'valor': 'valor_ingreso',
      'costo': 'valor_ingreso',
      'descripcion': 'descripcion',
      // NO mapear descripcion_actual a descripcion, es un campo diferente
      'descripcion_actual': 'descripcion_actual',
      'placa': 'placa',
      'codigo_inventario': 'placa',
      'tipo': 'tipo',
      'categoria': 'categoria',
      'modelo': 'modelo',
      'consecutivo': 'consecutivo',
      'numero_serie': 'consecutivo',
      'numeroserie': 'consecutivo',
      'atributos': 'atributos',
      'especificaciones': 'atributos',
      'specs': 'atributos',
      'specs_completas': 'atributos',
      'ambiente': 'ambiente',
      'codigo_ambiente': 'ambiente',
      'codigoambiente': 'ambiente'
    };

    const data = dataRaw.map(row => {
      const normalizedRow = {};
      // Procesar columnas, priorizando "descripcion" sobre "descripcion_actual"
      const processedKeys = new Set();
      
      // Primera pasada: procesar "descripcion" primero
      for (const key in row) {
        if (row.hasOwnProperty(key)) {
          const normalizedKey = normalizeColumnName(key);
          if (normalizedKey === 'descripcion') {
            const finalKey = columnMapping[normalizedKey] || normalizedKey;
            normalizedRow[finalKey] = row[key];
            processedKeys.add(key);
          }
        }
      }
      
      // Segunda pasada: procesar el resto de columnas
      for (const key in row) {
        if (row.hasOwnProperty(key) && !processedKeys.has(key)) {
          const normalizedKey = normalizeColumnName(key);
          const finalKey = columnMapping[normalizedKey] || normalizedKey;
          // Solo asignar si la clave final no existe (evitar sobrescribir "descripcion")
          if (!normalizedRow[finalKey]) {
            normalizedRow[finalKey] = row[key];
          }
        }
      }
      
      return normalizedRow;
    });

    const resultados = {
      total: data.length,
      exitosos: 0,
      fallidos: 0,
      errores: [],
      duplicados: 0
    };

    const userId = req.user?.id || null;
    const userRole = req.user?.rol || null;
    
    // Generar ID único para esta importación
    const idImportacion = `import_${Date.now()}_${userId}`;
    
    // Inicializar tabla de duplicados
    await inicializarTablaDuplicados();

    // Procesar cada fila
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const numeroFila = i + 2; // +2 porque la fila 1 es el encabezado y empezamos desde 0

      try {
        // Mapear columnas del Excel usando nombres EXACTOS (iguales a BD)
        const placa = String(row['placa'] || '').trim();
        const tipo = String(row['tipo'] || '').trim();
        const categoria = String(row['categoria'] || '').trim();
        const modelo = String(row['modelo'] || '').trim();
        const consecutivo = String(row['consecutivo'] || '').trim();
        const descripcion = row['descripcion'] || null;
        const fecha_adquisicion = row['fecha_adquisicion'] || null;
        
        // Procesar valor_ingreso (manejar formatos de moneda)
        let valor_ingreso = row['valor_ingreso'] || null;
        if (valor_ingreso && typeof valor_ingreso === 'string') {
          // Eliminar símbolos de moneda, puntos de miles y espacios
          valor_ingreso = valor_ingreso.replace(/[^\d.,-]/g, ''); 
          if (valor_ingreso.includes('.') && valor_ingreso.includes(',')) {
             // Formato: 1.234,56 → eliminar puntos y reemplazar coma por punto
             valor_ingreso = valor_ingreso.replace(/\./g, '').replace(',', '.');
          } else if (valor_ingreso.includes(',')) {
             // Formato: 1234,56 → reemplazar coma por punto
             valor_ingreso = valor_ingreso.replace(',', '.');
          }
        }

        const r_centro = String(row['r_centro'] || '').trim() || null;
        const atributos = row['atributos'] || null;
        const ambiente = String(row['ambiente'] || '').trim();

        // Validaciones básicas
        // AHORA: Validamos 'placa' en lugar de 'codigoInventario'
        if (!placa) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: placa || 'N/A',
            error: 'La placa es obligatoria'
          });
          resultados.fallidos++;
          continue;
        }

        // Validaciones básicas
        if (!tipo || !modelo || !consecutivo) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: placa,
            error: 'Faltan campos obligatorios: tipo, modelo o consecutivo'
          });
          resultados.fallidos++;
          continue;
        }

        // Resolver categoría usando columna "categoria" del Excel
        // Si no está presente, intentar usar "descripcion" como fallback
        let categoriaId = null;
        let categoriaNombre = categoria;
        
        // Si no hay categoria, intentar usar descripcion
        // PERO ignorar si descripcion parece ser "Descripción Actual" (texto muy largo o contiene "TIPO ELEMENTO")
        if (!categoriaNombre && descripcion) {
          const descripcionStr = String(descripcion).trim();
          // Si la descripción es muy larga (>50 caracteres) o contiene "TIPO ELEMENTO", 
          // probablemente es "Descripción Actual" y no debe usarse para buscar categoría
          if (descripcionStr.length <= 50 && !descripcionStr.includes('TIPO ELEMENTO')) {
            categoriaNombre = descripcionStr;
          }
        }
        
        if (categoriaNombre) {
          // Buscar por nombre o por ID (si el dato es numérico)
          const [[cat]] = await defaultDb.execute(
            'SELECT id_categoria, nombre_categoria FROM Categorias_Equipo WHERE nombre_categoria = ? OR id_categoria = ? LIMIT 1',
            [categoriaNombre, categoriaNombre]
          );
          
          if (!cat?.id_categoria) {
            resultados.errores.push({
              fila: numeroFila,
              codigo: placa,
              error: `Categoría "${categoriaNombre}" no encontrada. Debe existir en Categorias_Equipo (por nombre o ID). Intenta usar la columna "categoria" o asegúrate de que "descripcion" coincida con un nombre de categoría.`
            });
            resultados.fallidos++;
            continue;
          }
          categoriaId = cat.id_categoria;
          // Actualizar categoriaNombre con el nombre real de la BD para la comparación
          categoriaNombre = cat.nombre_categoria;
        } else {
          resultados.errores.push({
            fila: numeroFila,
            codigo: placa,
            error: 'El campo "categoria" es obligatorio. Agrega una columna "categoria" al Excel o asegúrate de que "descripcion" coincida con un nombre de categoría válido.'
          });
          resultados.fallidos++;
          continue;
        }

        // Resolver ambiente usando columna "ambiente" del Excel
        // Si no se especifica, usar "Neutral" por defecto
        let ambienteId = null;
        const ambienteABuscar = ambiente || 'Neutral';
        
        const [[amb]] = await defaultDb.execute(
          'SELECT id_ambiente FROM Ambientes WHERE id_ambiente = ? OR codigo_ambiente = ? OR nombre_ambiente = ? LIMIT 1',
          [ambienteABuscar, ambienteABuscar, ambienteABuscar]
        );
        ambienteId = amb?.id_ambiente || null;
        
        if (!ambienteId) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: placa,
            error: `Ambiente "${ambienteABuscar}" no encontrado. Verifique que existe en la base de datos.`
          });
          resultados.fallidos++;
          continue;
        }

        // Estado físico y vida útil se manejan en el aplicativo, usar valores por defecto
        const estado_fisico = 'Bueno'; // Valor por defecto, se actualiza en el aplicativo
        const vida_util_meses = null; // Se actualiza en el aplicativo

        // Convertir fecha_adquisicion
        let fecha_adquisicion_final = null;
        if (fecha_adquisicion) {
          if (typeof fecha_adquisicion === 'number') {
            // Excel almacena fechas como números (días desde 1900-01-01)
            const excelEpoch = new Date(1899, 11, 30); // 30 de diciembre de 1899
            const date = new Date(excelEpoch.getTime() + fecha_adquisicion * 24 * 60 * 60 * 1000);
            fecha_adquisicion_final = date.toISOString().split('T')[0];
          } else {
            // Si es string, intentar parsearlo
            const dateStr = String(fecha_adquisicion);
            if (dateStr.includes('T')) {
              fecha_adquisicion_final = dateStr.split('T')[0];
            } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              fecha_adquisicion_final = dateStr;
            } else {
              // Intentar parsear otros formatos
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) {
                fecha_adquisicion_final = parsed.toISOString().split('T')[0];
              }
            }
          }
        }
        // Validar placa única - Si existe, guardar como duplicado pendiente
        // IMPORTANTE: Esta validación debe ir DESPUÉS de inicializar todas las variables necesarias
        if (placa) {
          const [equiposExistentes] = await defaultDb.execute(
            `SELECT e.*, 
                    c.nombre_categoria,
                    a.nombre_ambiente,
                    a.codigo_ambiente,
                    u.nombre_usuario as cuentadante_nombre
             FROM Elementos e
             LEFT JOIN Categorias_Equipo c ON e.id_categoria = c.id_categoria
             LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
             LEFT JOIN Usuarios u ON e.id_cuentadante = u.id_usuario
             WHERE e.placa = ? 
             LIMIT 1`,
            [placa]
          );
          
          if (equiposExistentes.length > 0) {
            const equipoExistente = equiposExistentes[0];
            
            // Preparar datos del Excel para comparación (usando nombres exactos)
            const datosExcel = {
              placa,
              tipo,
              categoria: categoriaNombre,
              modelo,
              consecutivo: consecutivo || null,
              descripcion: descripcion || null,
              fecha_adquisicion: fecha_adquisicion_final || null,
              valor_ingreso: valor_ingreso ? parseFloat(valor_ingreso) : null,
              r_centro: r_centro || null,
              atributos: atributos || null,
              ambiente: ambiente || 'Neutral',
              categoria_id: categoriaId,
              ambiente_id: ambienteId
            };
            
            // Preparar datos de BD para comparación (usando nombres exactos)
            const datosBD = {
              codigo_equipo: equipoExistente.codigo_equipo,
              placa: equipoExistente.placa,
              tipo: equipoExistente.tipo,
              categoria: equipoExistente.nombre_categoria || null,
              modelo: equipoExistente.modelo,
              consecutivo: equipoExistente.consecutivo || null,
              descripcion: equipoExistente.descripcion || null,
              fecha_adquisicion: equipoExistente.fecha_adquisicion ? 
                new Date(equipoExistente.fecha_adquisicion).toISOString().split('T')[0] : null,
              valor_ingreso: equipoExistente.valor_ingreso ? parseFloat(equipoExistente.valor_ingreso) : 
                           (equipoExistente.costo ? parseFloat(equipoExistente.costo) : null),
              r_centro: equipoExistente.r_centro || null,
              atributos: equipoExistente.atributos || null,
              ambiente: equipoExistente.nombre_ambiente || equipoExistente.codigo_ambiente || null,
              categoria_id: equipoExistente.id_categoria,
              ambiente_id: equipoExistente.id_ambiente
            };
            
            // Guardar como duplicado pendiente
            await defaultDb.execute(
              `INSERT INTO Importaciones_Duplicados 
               (id_importacion, fila_excel, placa, codigo_equipo_existente, datos_excel, datos_bd, estado)
               VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')`,
              [
                idImportacion,
                numeroFila,
                placa,
                equipoExistente.codigo_equipo,
                JSON.stringify(datosExcel),
                JSON.stringify(datosBD)
              ]
            );
            
            resultados.duplicados++;
            resultados.fallidos++;
            continue;
          }
        }

        // Verificar si la columna id_cuentadante existe
        const [[colCuentadante]] = await defaultDb.execute(
          "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Elementos' AND COLUMN_NAME = 'id_cuentadante'"
        );
        if (colCuentadante.cnt === 0) {
          await defaultDb.execute(
            `ALTER TABLE Elementos 
             ADD COLUMN id_cuentadante INT NULL,
             ADD INDEX idx_cuentadante (id_cuentadante),
             ADD FOREIGN KEY (id_cuentadante) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL`
          );
        }

        // Si el usuario que importa es Cuentadante, asignar automáticamente el equipo a su inventario
        const [[userRole]] = await defaultDb.execute(
          `SELECT r.nombre_rol FROM Usuarios u
           INNER JOIN Roles r ON u.id_rol = r.id_rol
           WHERE u.id_usuario = ?`,
          [userId]
        );
        const id_cuentadante = userRole?.nombre_rol === 'Cuentadante' ? userId : null;

        // Insertar equipo usando nombres exactos de campos
        const query = `INSERT INTO Elementos
          (id_categoria, id_ambiente, id_cuentadante, tipo, modelo, descripcion, 
           fecha_adquisicion, valor_ingreso, vida_util_meses, estado_fisico, registrado_por,
           r_centro, consecutivo, placa, atributos)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await defaultDb.execute(query, [
          categoriaId,
          ambienteId,
          id_cuentadante,
          tipo,
          modelo,
          descripcion || null,
          fecha_adquisicion_final || null,
          valor_ingreso ? parseFloat(valor_ingreso) : null,
          vida_util_meses,
          estado_fisico,
          userId,
          r_centro,
          consecutivo || null,
          placa || null,
          atributos || null
        ]);

        resultados.exitosos++;
      } catch (error) {
        resultados.errores.push({
          fila: numeroFila,
          codigo: placa || 'N/A',
          error: error.message || 'Error desconocido'
        });
        resultados.fallidos++;
      }
    }

    let mensaje = `Importación completada: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`;
    if (resultados.duplicados > 0) {
      mensaje += `. ${resultados.duplicados} registro(s) con placas duplicadas pendientes de revisión`;
    }

    return res.json({
      message: mensaje,
      resultados,
      id_importacion: idImportacion,
      tiene_duplicados: resultados.duplicados > 0
    });
  } catch (error) {
    logger.error('Error en importarEquipos', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Error al procesar el archivo Excel', detalle: error.message });
  }
}

/**
 * Obtener duplicados pendientes de revisión
 */
export async function obtenerDuplicadosPendientes(req, res) {
  try {
    const { id_importacion } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.rol;

    // Solo Administrador y Cuentadante pueden ver duplicados
    if (userRole !== 'Administrador' && userRole !== 'Cuentadante') {
      return res.status(403).json({
        error: 'Solo Administradores y Cuentadantes pueden revisar duplicados'
      });
    }

    // Asegurar que la tabla existe
    await inicializarTablaDuplicados();

    let query = `
      SELECT 
        d.id_duplicado,
        d.id_importacion,
        d.fila_excel,
        d.placa,
        d.codigo_equipo_existente,
        d.datos_excel,
        d.datos_bd,
        d.estado,
        d.fecha_creacion,
        e.codigo_equipo,
        e.tipo,
        e.modelo
      FROM Importaciones_Duplicados d
      INNER JOIN Elementos e ON d.codigo_equipo_existente = e.codigo_equipo
      WHERE d.estado = 'Pendiente'
    `;
    const params = [];

    if (id_importacion) {
      query += ' AND d.id_importacion = ?';
      params.push(id_importacion);
    }

    query += ' ORDER BY d.fecha_creacion DESC';

    const [duplicados] = await defaultDb.execute(query, params);

    // Parsear JSON de datos
    const duplicadosParseados = duplicados.map(dup => ({
      ...dup,
      datos_excel: typeof dup.datos_excel === 'string' ? JSON.parse(dup.datos_excel) : dup.datos_excel,
      datos_bd: typeof dup.datos_bd === 'string' ? JSON.parse(dup.datos_bd) : dup.datos_bd
    }));

    return res.json({
      ok: true,
      duplicados: duplicadosParseados,
      total: duplicadosParseados.length
    });
  } catch (error) {
    logger.error('Error al obtener duplicados pendientes', { error: error.message, stack: error.stack });
    return res.status(500).json({
      error: 'Error al obtener duplicados pendientes',
      detalle: error.message
    });
  }
}

/**
 * Procesar decisión sobre un duplicado (Aprobar o Rechazar)
 */
export async function procesarDuplicado(req, res) {
  try {
    const { id_duplicado, accion } = req.body; // accion: 'aprobar' o 'rechazar'
    const userId = req.user?.id;
    const userRole = req.user?.rol;

    // Solo Administrador y Cuentadante pueden procesar duplicados
    if (userRole !== 'Administrador' && userRole !== 'Cuentadante') {
      return res.status(403).json({
        error: 'Solo Administradores y Cuentadantes pueden procesar duplicados'
      });
    }

    // Asegurar que la tabla existe
    await inicializarTablaDuplicados();

    if (!id_duplicado || !accion) {
      return res.status(400).json({
        error: 'Se requiere id_duplicado y accion (aprobar o rechazar)'
      });
    }

    if (accion !== 'aprobar' && accion !== 'rechazar') {
      return res.status(400).json({
        error: 'La accion debe ser "aprobar" o "rechazar"'
      });
    }

    // Obtener el duplicado
    const [duplicados] = await defaultDb.execute(
      `SELECT * FROM Importaciones_Duplicados 
       WHERE id_duplicado = ? AND estado = 'Pendiente'`,
      [id_duplicado]
    );

    if (duplicados.length === 0) {
      return res.status(404).json({
        error: 'Duplicado no encontrado o ya procesado'
      });
    }

    const duplicado = duplicados[0];
    const datosExcel = typeof duplicado.datos_excel === 'string' 
      ? JSON.parse(duplicado.datos_excel) 
      : duplicado.datos_excel;

    if (accion === 'aprobar') {
      // Insertar el equipo duplicado en la base de datos
      const [[userRoleInfo]] = await defaultDb.execute(
        `SELECT r.nombre_rol FROM Usuarios u
         INNER JOIN Roles r ON u.id_rol = r.id_rol
         WHERE u.id_usuario = ?`,
        [userId]
      );
      const idCuentadante = userRoleInfo?.nombre_rol === 'Cuentadante' ? userId : null;

      const query = `INSERT INTO Elementos
        (id_categoria, id_ambiente, id_cuentadante, tipo, modelo, descripcion, 
         fecha_adquisicion, valor_ingreso, vida_util_meses, estado_fisico, registrado_por,
         r_centro, consecutivo, placa, atributos)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      await defaultDb.execute(query, [
        datosExcel.categoria_id,
        datosExcel.ambiente_id,
        idCuentadante,
        datosExcel.tipo,
        datosExcel.modelo,
        datosExcel.descripcion || null,
        datosExcel.fecha_adquisicion || null,
        datosExcel.valor_ingreso ? parseFloat(datosExcel.valor_ingreso) : null,
        null, // vida_util_meses se maneja en el aplicativo
        'Bueno', // estado_fisico se maneja en el aplicativo (valor por defecto)
        userId,
        datosExcel.r_centro || null,
        datosExcel.consecutivo || null,
        datosExcel.placa || null,
        datosExcel.atributos || null
      ]);

      // Actualizar estado del duplicado
      await defaultDb.execute(
        `UPDATE Importaciones_Duplicados 
         SET estado = 'Aprobado', decidido_por = ?, fecha_decision = NOW()
         WHERE id_duplicado = ?`,
        [userId, id_duplicado]
      );

      return res.json({
        ok: true,
        message: 'Duplicado aprobado y registrado exitosamente',
        accion: 'aprobar'
      });
    } else {
      // Rechazar: solo actualizar estado
      await defaultDb.execute(
        `UPDATE Importaciones_Duplicados 
         SET estado = 'Rechazado', decidido_por = ?, fecha_decision = NOW()
         WHERE id_duplicado = ?`,
        [userId, id_duplicado]
      );

      return res.json({
        ok: true,
        message: 'Duplicado rechazado',
        accion: 'rechazar'
      });
    }
  } catch (error) {
    logger.error('Error al procesar duplicado', { error: error.message, stack: error.stack });
    return res.status(500).json({
      error: 'Error al procesar duplicado',
      detalle: error.message
    });
  }
}

/**
 * Procesar múltiples duplicados a la vez
 */
export async function procesarDuplicadosMasivo(req, res) {
  try {
    const { decisiones } = req.body; // Array de { id_duplicado, accion }
    const userId = req.user?.id;
    const userRole = req.user?.rol;

    // Solo Administrador y Cuentadante pueden procesar duplicados
    if (userRole !== 'Administrador' && userRole !== 'Cuentadante') {
      return res.status(403).json({
        error: 'Solo Administradores y Cuentadantes pueden procesar duplicados'
      });
    }

    // Asegurar que la tabla existe
    await inicializarTablaDuplicados();

    if (!Array.isArray(decisiones) || decisiones.length === 0) {
      return res.status(400).json({
        error: 'Se requiere un array de decisiones'
      });
    }

    const resultados = {
      aprobados: 0,
      rechazados: 0,
      errores: []
    };

    // Obtener rol del usuario para asignar cuentadante si es necesario
    const [[userRoleInfo]] = await defaultDb.execute(
      `SELECT r.nombre_rol FROM Usuarios u
       INNER JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ?`,
      [userId]
    );
    const idCuentadante = userRoleInfo?.nombre_rol === 'Cuentadante' ? userId : null;

    for (const decision of decisiones) {
      const { id_duplicado, accion } = decision;

      try {
        if (accion !== 'aprobar' && accion !== 'rechazar') {
          resultados.errores.push({
            id_duplicado,
            error: 'Acción inválida'
          });
          continue;
        }

        // Obtener el duplicado
        const [duplicados] = await defaultDb.execute(
          `SELECT * FROM Importaciones_Duplicados 
           WHERE id_duplicado = ? AND estado = 'Pendiente'`,
          [id_duplicado]
        );

        if (duplicados.length === 0) {
          resultados.errores.push({
            id_duplicado,
            error: 'Duplicado no encontrado o ya procesado'
          });
          continue;
        }

        const duplicado = duplicados[0];
        const datosExcel = typeof duplicado.datos_excel === 'string' 
          ? JSON.parse(duplicado.datos_excel) 
          : duplicado.datos_excel;

        if (accion === 'aprobar') {
          // Insertar el equipo
          const query = `INSERT INTO Elementos
            (id_categoria, id_ambiente, id_cuentadante, tipo, modelo, descripcion, 
             fecha_adquisicion, valor_ingreso, vida_util_meses, estado_fisico, registrado_por,
             r_centro, consecutivo, placa, atributos)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          await defaultDb.execute(query, [
            datosExcel.categoria_id,
            datosExcel.ambiente_id,
            idCuentadante,
            datosExcel.tipo,
            datosExcel.modelo,
            datosExcel.descripcion || null,
            datosExcel.fecha_adquisicion || null,
            datosExcel.valor_ingreso ? parseFloat(datosExcel.valor_ingreso) : null,
            null, // vida_util_meses se maneja en el aplicativo
            'Bueno', // estado_fisico se maneja en el aplicativo (valor por defecto)
            userId,
            datosExcel.r_centro || null,
            datosExcel.consecutivo || null,
            datosExcel.placa || null,
            datosExcel.atributos || null
          ]);

          await defaultDb.execute(
            `UPDATE Importaciones_Duplicados 
             SET estado = 'Aprobado', decidido_por = ?, fecha_decision = NOW()
             WHERE id_duplicado = ?`,
            [userId, id_duplicado]
          );

          resultados.aprobados++;
        } else {
          await defaultDb.execute(
            `UPDATE Importaciones_Duplicados 
             SET estado = 'Rechazado', decidido_por = ?, fecha_decision = NOW()
             WHERE id_duplicado = ?`,
            [userId, id_duplicado]
          );

          resultados.rechazados++;
        }
      } catch (error) {
        resultados.errores.push({
          id_duplicado,
          error: error.message
        });
      }
    }

    return res.json({
      ok: true,
      message: `Procesados: ${resultados.aprobados} aprobados, ${resultados.rechazados} rechazados`,
      resultados
    });
  } catch (error) {
    logger.error('Error al procesar duplicados masivo', { error: error.message, stack: error.stack });
    return res.status(500).json({
      error: 'Error al procesar duplicados',
      detalle: error.message
    });
  }
}

/**
 * Importar usuarios desde archivo Excel
 */
export async function importarUsuarios(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    const resultados = {
      total: data.length,
      exitosos: 0,
      fallidos: 0,
      errores: [],
      correosEnviados: 0,
      correosFallidos: 0
    };

    const userId = req.user?.id || null;
    const usuariosParaEnviarCorreo = []; // Almacenar usuarios con contraseñas generadas

    // Procesar cada fila
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const numeroFila = i + 2;

      try {
        // Mapear columnas del Excel
        const nombreUsuario = String(row['nombre_usuario'] || row['Nombre'] || row['NOMBRE_USUARIO'] || '').trim();
        const cedula = String(row['cedula'] || row['Cédula'] || row['CEDULA'] || '').trim();
        const tipoDocumento = String(row['tipo_documento'] || row['Tipo Documento'] || row['TIPO_DOCUMENTO'] || 'CC').trim();
        const tipoDocumentoOtro = row['tipo_documento_otro'] || row['Tipo Documento Otro'] || row['TIPO_DOCUMENTO_OTRO'] || null;
        const telefono = row['telefono'] || row['Teléfono'] || row['TELEFONO'] || null;
        const correo = row['correo'] || row['Correo'] || row['CORREO'] || row['email'] || row['Email'] || null;
        const rol = String(row['rol'] || row['Rol'] || row['ROL'] || 'Aprendiz').trim();
        const contrasena = row['contrasena'] || row['Contraseña'] || row['CONTRASENA'] || row['password'] || null;
        const estado = String(row['estado'] || row['Estado'] || row['ESTADO'] || 'Activo').trim();

        // Validaciones básicas
        if (!nombreUsuario || !cedula) {
          resultados.errores.push({
            fila: numeroFila,
            cedula: cedula || 'N/A',
            error: 'Nombre y cédula son obligatorios'
          });
          resultados.fallidos++;
          continue;
        }

        // Validar cédula única
        const [[cedulaExistente]] = await defaultDb.execute(
          'SELECT id_usuario FROM Usuarios WHERE cedula = ? LIMIT 1',
          [cedula]
        );
        if (cedulaExistente) {
          resultados.errores.push({
            fila: numeroFila,
            cedula: cedula,
            error: 'La cédula ya está registrada'
          });
          resultados.fallidos++;
          continue;
        }

        // Validar correo único (si se proporciona)
        if (correo) {
          const [[correoExistente]] = await defaultDb.execute(
            'SELECT id_usuario FROM Usuarios WHERE correo = ? LIMIT 1',
            [correo]
          );
          if (correoExistente) {
            resultados.errores.push({
              fila: numeroFila,
              cedula: cedula,
              error: 'El correo ya está registrado'
            });
            resultados.fallidos++;
            continue;
          }
        }

        // Resolver rol
        const [[rolRow]] = await defaultDb.execute(
          'SELECT id_rol FROM Roles WHERE nombre_rol = ? LIMIT 1',
          [rol]
        );
        if (!rolRow?.id_rol) {
          resultados.errores.push({
            fila: numeroFila,
            cedula: cedula,
            error: `Rol "${rol}" no encontrado. Debe ser: Administrador, Instructor o Aprendiz`
          });
          resultados.fallidos++;
          continue;
        }

        // Validar estado
        const estadosValidos = ['Activo', 'Inactivo'];
        const estadoValido = estadosValidos.includes(estado) ? estado : 'Activo';

        // Generar contraseña si no se proporciona
        let contrasenaHash = null;
        let contrasenaPlana = null; // Guardar contraseña en texto plano para enviar por correo
        
        if (contrasena && contrasena.trim()) {
          // Si se proporciona contraseña, usarla
          contrasenaPlana = contrasena.trim();
          contrasenaHash = await bcrypt.hash(contrasenaPlana, 10);
        } else {
          // Generar contraseña única y segura
          contrasenaPlana = emailService.generatePassword(12);
          contrasenaHash = await bcrypt.hash(contrasenaPlana, 10);
        }

        // Determinar si requiere cambio de contraseña (si fue generada automáticamente)
        const requiereCambio = !contrasena || !contrasena.trim();

        // Validar tipo de documento
        const tiposValidos = ['TI', 'CC', 'CE', 'PPT', 'Otro'];
        const tipoDocValido = tiposValidos.includes(tipoDocumento) ? tipoDocumento : 'CC';
        const tipoDocOtroValido = tipoDocValido === 'Otro' ? (tipoDocumentoOtro || null) : null;

        // Insertar usuario
        const query = `INSERT INTO Usuarios
          (nombre_usuario, cedula, tipo_documento, tipo_documento_otro, telefono, correo, contrasena, id_rol, estado, requiere_cambio_contrasena, creado_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await defaultDb.execute(query, [
          nombreUsuario,
          cedula,
          tipoDocValido,
          tipoDocOtroValido,
          telefono || null,
          correo || null,
          contrasenaHash,
          rolRow.id_rol,
          estadoValido,
          requiereCambio ? 1 : 0,
          userId
        ]);

        // Si no se proporcionó contraseña y hay correo, agregar a la lista para enviar
        if (!contrasena && correo && correo.trim()) {
          usuariosParaEnviarCorreo.push({
            correo: correo.trim(),
            nombreUsuario,
            cedula,
            password: contrasenaPlana
          });
        }

        resultados.exitosos++;
      } catch (error) {
        resultados.errores.push({
          fila: numeroFila,
          cedula: row['cedula'] || 'N/A',
          error: error.message || 'Error desconocido'
        });
        resultados.fallidos++;
      }
    }

    // Enviar correos con contraseñas generadas
    if (usuariosParaEnviarCorreo.length > 0) {
      logger.info(`Iniciando envío de ${usuariosParaEnviarCorreo.length} correo(s) con contraseñas`);
      const correosResultado = await emailService.enviarContrasenasMasivo(usuariosParaEnviarCorreo);
      resultados.correosEnviados = correosResultado.exitosos;
      resultados.correosFallidos = correosResultado.fallidos;
      
      logger.info(`Resultado de envío de correos: ${correosResultado.exitosos} exitosos, ${correosResultado.fallidos} fallidos`);
      
      // Agregar errores de correos a los errores generales (solo como información)
      if (correosResultado.errores.length > 0) {
        logger.warn(`Errores al enviar correos:`, correosResultado.errores);
        correosResultado.errores.forEach(error => {
          resultados.errores.push({
            fila: 'N/A',
            cedula: error.nombre || 'N/A',
            error: `Usuario creado pero no se pudo enviar correo: ${error.razon}`
          });
        });
      }
    }

    let mensaje = `Importación completada: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`;
    if (resultados.correosEnviados > 0) {
      mensaje += `. ${resultados.correosEnviados} correo(s) con contraseñas enviado(s)`;
    }
    if (resultados.correosFallidos > 0) {
      mensaje += `. ${resultados.correosFallidos} correo(s) no pudo(eron) enviarse`;
    }

    return res.json({
      message: mensaje,
      resultados
    });
  } catch (error) {
    logger.error('Error en importarUsuarios', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Error al procesar el archivo Excel', detalle: error.message });
  }
}

/**
 * Importar aprendices desde archivo Excel
 * Columnas esperadas: Ficha, Nombre, Documento, Jornada
 */
export async function importarAprendices(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    const resultados = {
      total: data.length,
      exitosos: 0,
      fallidos: 0,
      errores: []
    };

    const userId = req.user?.id || null;

    await ensureAprendicesTable();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const numeroFila = i + 2;

      try {
        const ficha = String(row['Ficha'] || row['ficha'] || row['FICHA'] || '').trim() || null;
        const nombre = String(row['Nombre'] || row['nombre'] || row['NOMBRE'] || '').trim();
        const documento = String(row['Documento'] || row['documento'] || row['CEDULA'] || row['Documento Identidad'] || '').trim();
        let tipoDocumento = String(row['Tipo Documento'] || row['tipo_documento'] || row['TIPO_DOCUMENTO'] || row['Tipo de Documento'] || 'CC').trim();
        const tipoDocumentoOtro = String(row['Tipo Documento Otro'] || row['tipo_documento_otro'] || row['TIPO_DOCUMENTO_OTRO'] || '').trim() || null;
        let jornada = String(row['Jornada'] || row['jornada'] || '').trim() || null;

        if (!nombre || !documento) {
          resultados.errores.push({ fila: numeroFila, documento: documento || 'N/A', error: 'Nombre y documento son obligatorios' });
          resultados.fallidos++;
          continue;
        }

        // Normalizar tipo de documento
        const TIPOS_DOCUMENTO_VALIDOS = ['TI', 'CC', 'CE', 'PPT', 'Otro'];
        tipoDocumento = tipoDocumento.toUpperCase();
        if (!TIPOS_DOCUMENTO_VALIDOS.includes(tipoDocumento)) {
          tipoDocumento = 'CC'; // Valor por defecto
        }

        // Validar que si es "Otro", tenga especificación
        if (tipoDocumento === 'Otro' && (!tipoDocumentoOtro || tipoDocumentoOtro.trim().length === 0)) {
          resultados.errores.push({ fila: numeroFila, documento, error: 'Debe especificar el tipo de documento cuando selecciona "Otro"' });
          resultados.fallidos++;
          continue;
        }

        // Normalizar jornada a valores válidos
        if (jornada) {
          const j = jornada.toLowerCase();
          if (j.startsWith('m')) jornada = 'Mañana';
          else if (j.startsWith('t')) jornada = 'Tarde';
          else if (j.startsWith('n')) jornada = 'Noche';
          else jornada = null;
        }

        // Verificar documento único dentro de Aprendices
        const [[existAprendiz]] = await defaultDb.execute(
          'SELECT id_aprendiz FROM Aprendices WHERE documento = ? LIMIT 1',
          [documento]
        );
        if (existAprendiz) {
          resultados.errores.push({ fila: numeroFila, documento, error: 'El documento ya está registrado en aprendices' });
          resultados.fallidos++;
          continue;
        }

        // Insertar registro de aprendiz (sin crear cuenta de usuario)
        await defaultDb.execute(
          'INSERT INTO Aprendices (ficha, nombre, documento, tipo_documento, tipo_documento_otro, jornada, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [ficha, nombre, documento, tipoDocumento, tipoDocumento === 'Otro' ? tipoDocumentoOtro : null, jornada, userId]
        );

        resultados.exitosos++;
      } catch (error) {
        resultados.errores.push({ fila: numeroFila, documento: row['Documento'] || 'N/A', error: error.message || 'Error desconocido' });
        resultados.fallidos++;
      }
    }

    const mensaje = `Importación aprendices: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`;
    return res.json({ message: mensaje, resultados });
  } catch (error) {
    logger.error('Error en importarAprendices', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Error al procesar el archivo Excel', detalle: error.message });
  }
}

