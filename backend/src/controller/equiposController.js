import defaultDb, { pool } from '../config/dbconfig.js';
import { notifyNuevoEquipo } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';
import { obtenerEquipoPorCodigo as obtenerEquipoPorCodigoUtil, obtenerUsuarioPorCedula } from '../utils/sqlQueries.js';
import { getImagePath, deleteImageFile } from '../middleware/uploadMiddleware.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export async function listarEquipos(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.rol;

    let query = `
      SELECT e.codigo_equipo, e.placa AS codigo_inventario, e.tipo, e.modelo, e.consecutivo, e.descripcion,
             e.fecha_adquisicion, e.valor_ingreso AS costo, e.vida_util_meses, e.estado_fisico,
             e.specs_completas, e.id_cuentadante, e.cuentadante_principal,
             a.id_ambiente, a.nombre_ambiente, a.codigo_ambiente
      FROM Elementos e
      LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
    `;

    const params = [];

    if (userRole === 'Cuentadante') {
      query += ` WHERE e.id_cuentadante = ?`;
      params.push(userId);
    } else if (userRole === 'Instructor') {
      // Los instructores solo ven equipos de sus ambientes asignados
      query += ` WHERE e.id_ambiente IN (
        SELECT DISTINCT ra.id_ambiente
        FROM Responsabilidades_Ambiente ra
        LEFT JOIN Clases c ON ra.id_clase = c.id_clase
        WHERE ra.id_usuario = ?
          AND ra.estado_responsabilidad = 'Activa'
          AND ra.fecha_inicio <= NOW()
          AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
          AND (
            -- Asignaciones permanentes (con días/horarios o jornada)
            (ra.id_clase IS NULL)
            OR
            -- Asignaciones temporales (clases) que estén programadas o en curso
            (ra.id_clase IS NOT NULL 
             AND c.estado_clase IN ('Programada', 'En Curso')
             AND c.fecha_clase >= CURDATE())
          )
      )`;
      params.push(userId);
    }

    query += ` ORDER BY e.codigo_equipo ASC`;

    const [rows] = await defaultDb.execute(query, params);
    return res.json(rows);
  } catch (err) {
    logger.error('Error al listar equipos', { error: err.message });
    return res.status(500).json({ error: 'Error al listar equipos', detalle: err.message });
  }
}

export async function registrarEquipo(req, res) {
  try {
    const {
      codigo_inventario,
      placa,
      r_centro,
      centro,
      consecutivo,
      tipo,
      marca,
      modelo,
      numero_serie,
      descripcion,
      fecha_adquisicion,
      costo,
      valor_ingreso,
      vida_util_meses,
      estado_fisico,
      specs_completas,
      id_ambiente,
      ambiente,
      comentarios
    } = req.body;

    const placaValue = (placa || codigo_inventario || '').toString().trim();
    // r_centro es NOT NULL en la BD, usar '00000' como valor por defecto si no se proporciona
    const rCentroValue = (centro || r_centro || '00000').toString().trim() || '00000';
    const consecutivoValue = (consecutivo || numero_serie || '').toString().trim();
    const valorIngreso = valor_ingreso || costo || null;

    if (!placaValue) {
      return res.status(400).json({ error: 'La placa (código de inventario) es obligatoria' });
    }
    if (!tipo || !modelo || !estado_fisico || !fecha_adquisicion) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: tipo, modelo, estado_fisico o fecha_adquisicion' });
    }

    const [[placaExistente]] = await defaultDb.execute(
      'SELECT codigo_equipo FROM Elementos WHERE placa = ? LIMIT 1',
      [placaValue]
    );
    if (placaExistente) {
      return res.status(409).json({ error: 'La placa ya está registrada' });
    }

    let [[categoria]] = await defaultDb.execute(
      'SELECT id_categoria, es_componente FROM Categorias_Equipo WHERE nombre_categoria = ? LIMIT 1',
      [tipo]
    );
    
    if (!categoria?.id_categoria) {
      try {
        const [result] = await defaultDb.execute(
          'INSERT INTO Categorias_Equipo (nombre_categoria, descripcion, es_componente) VALUES (?, ?, ?)',
          [tipo, `Categoría: ${tipo}`, false]
        );
        categoria = {
          id_categoria: result.insertId,
          es_componente: false
        };
        logger.info(`Categoría "${tipo}" creada automáticamente con ID: ${result.insertId}`);
      } catch (err) {
        // Si falla la inserción (por ejemplo, por duplicado), intentar obtenerla de nuevo
        if (err.code === 'ER_DUP_ENTRY') {
          [[categoria]] = await defaultDb.execute(
            'SELECT id_categoria, es_componente FROM Categorias_Equipo WHERE nombre_categoria = ? LIMIT 1',
            [tipo]
          );
        } else {
          logger.error('Error al crear categoría automáticamente', { error: err.message, tipo });
          return res.status(500).json({ error: 'Error al procesar la categoría', detalle: err.message });
        }
      }
    }

    // Verificar si la columna id_tipo existe en Elementos (compatibilidad con esquemas antiguos)
    const [[col]] = await defaultDb.execute(
      "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Elementos' AND COLUMN_NAME = 'id_tipo'"
    );
    const usaIdTipo = col?.cnt > 0;
    let idTipo = null;
    if (usaIdTipo) {
      const nombreTipo = categoria.es_componente ? 'Componente Individual' : 'Equipo Completo';
      const [[rowTipo]] = await defaultDb.execute(
        'SELECT id_tipo FROM Tipos_Equipo WHERE nombre_tipo = ? LIMIT 1',
        [nombreTipo]
      );
      if (!rowTipo?.id_tipo) {
        return res.status(400).json({ error: 'Tipo de equipo no configurado', detalle: `No existe registro en Tipos_Equipo para ${nombreTipo}` });
      }
      idTipo = rowTipo.id_tipo;
    }

    // Resolver id_ambiente: aceptar id_ambiente directamente o mapear por codigo/nombre
    let ambienteId = id_ambiente || null;
    let ambienteInfo = null;
    if (!ambienteId && ambiente) {
      const [[amb]] = await defaultDb.execute(
        'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE id_ambiente = ? OR codigo_ambiente = ? OR nombre_ambiente = ? LIMIT 1',
        [ambiente, ambiente, ambiente]
      );
      ambienteId = amb?.id_ambiente || null;
      ambienteInfo = amb || null;
    }
    if (!ambienteId) {
      return res.status(400).json({ error: 'Ambiente inválido', detalle: 'Se requiere id_ambiente válido' });
    }
    if (!ambienteInfo) {
      const [[ambRow]] = await defaultDb.execute(
        'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE id_ambiente = ? LIMIT 1',
        [ambienteId]
      );
      ambienteInfo = ambRow || null;
    }
    if (!ambienteInfo) {
      return res.status(400).json({ error: 'Ambiente inválido', detalle: 'El ambiente indicado no existe' });
    }

    // Si es Cuentadante, asignar automáticamente el equipo a su inventario
    const userRole = req.user?.rol;
    const userId = req.user?.id;
    const idCuentadante = userRole === 'Cuentadante' ? userId : null;

    // Verificar si la columna id_cuentadante existe, si no crearla
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
      logger.info('Columna id_cuentadante creada en la tabla Elementos');
    }

    // Combinar descripcion y comentarios si ambos existen
    const descripcionFinal = comentarios 
      ? (descripcion ? `${descripcion}\n\nComentarios: ${comentarios}` : `Comentarios: ${comentarios}`)
      : (descripcion || null);

    // Insertar en la tabla Elementos (con o sin id_tipo)
    let query;
    let params;
    if (usaIdTipo) {
      query = `INSERT INTO Elementos
        (id_categoria, id_tipo, id_ambiente, id_cuentadante, tipo, modelo, descripcion, fecha_adquisicion, valor_ingreso, vida_util_meses, estado_fisico, specs_completas, r_centro, consecutivo, placa, registrado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [
        categoria.id_categoria,
        idTipo,
        ambienteId,
        idCuentadante,
        tipo,
        modelo,
        descripcionFinal,
        fecha_adquisicion,
        valorIngreso ? parseFloat(valorIngreso) : null,
        vida_util_meses || null,
        estado_fisico,
        specs_completas || null,
        rCentroValue,
        consecutivoValue || null,
        placaValue,
        req.user?.id || null
      ];
    } else {
      query = `INSERT INTO Elementos
        (id_categoria, id_ambiente, id_cuentadante, tipo, modelo, descripcion, fecha_adquisicion, valor_ingreso, vida_util_meses, estado_fisico, specs_completas, r_centro, consecutivo, placa, registrado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [
        categoria.id_categoria,
        ambienteId,
        idCuentadante,
        tipo,
        modelo,
        descripcionFinal,
        fecha_adquisicion,
        valorIngreso ? parseFloat(valorIngreso) : null,
        vida_util_meses || null,
        estado_fisico,
        specs_completas || null,
        rCentroValue,
        consecutivoValue || null,
        placaValue,
        req.user?.id || null
      ];
    }
    const [result] = await defaultDb.execute(query, params);

    try {
      const notifyResult = await notifyNuevoEquipo({
        equipoId: result.insertId,
        tipoEquipo: tipo,
        marca,
        modelo,
        ambiente: ambienteInfo?.nombre_ambiente || ambienteInfo?.codigo_ambiente || null,
        creadoPor: req.user?.id ?? null,
        metadataExtra: {
          placa: placaValue,
          r_centro: rCentroValue,
          ambiente_id: ambienteInfo?.id_ambiente ?? ambienteId,
          ambiente_codigo: ambienteInfo?.codigo_ambiente || null,
        },
      });
      if (notifyResult?.skipped) {
        logger.warn('Tabla Notificaciones no existe; se omitió la alerta de nuevo equipo');
      }
    } catch (notifyErr) {
      logger.error('Error al generar notificación de nuevo equipo', { error: notifyErr?.message || notifyErr });
    }

    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    logger.error('Error al registrar equipo', { 
      error: err.message, 
      stack: err.stack,
      code: err.code,
      body: req.body 
    });
    
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'El número de serie ya existe' });
    } else if (err.code === 'ER_BAD_NULL_ERROR') {
      res.status(400).json({ error: 'Error de validación: campo obligatorio faltante', detalle: err.message });
    } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      res.status(400).json({ error: 'Error de referencia: el ambiente o categoría no existe', detalle: err.message });
    } else {
      res.status(500).json({ error: 'Error al registrar equipo', detalle: err.message });
    }
  }
}

// Consultar equipo por código
export async function obtenerEquipoPorCodigo(req, res) {
  try {
    const { codigo } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.rol;
    
    if (!codigo) return res.status(400).json({ error: 'codigo requerido' });

    const queryBase = `
      SELECT e.codigo_equipo, e.placa AS codigo_inventario, e.tipo, e.modelo, e.consecutivo, e.descripcion,
             e.fecha_adquisicion, e.valor_ingreso AS costo, e.vida_util_meses, e.estado_fisico,
             e.specs_completas, e.id_cuentadante,
             a.id_ambiente, a.nombre_ambiente, a.codigo_ambiente,
             (SELECT estado_mantenimiento FROM Mantenimiento 
              WHERE codigo_equipo = e.codigo_equipo AND estado_mantenimiento = 'En Proceso' 
              ORDER BY fecha_mantenimiento DESC LIMIT 1) as estado_mantenimiento_activo,
             (SELECT tipo_mantenimiento FROM Mantenimiento 
              WHERE codigo_equipo = e.codigo_equipo AND estado_mantenimiento = 'En Proceso' 
              ORDER BY fecha_mantenimiento DESC LIMIT 1) as tipo_mantenimiento_activo
      FROM Elementos e
      LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
    `;

    // Construir cláusula WHERE según el rol
    let whereClause = '';
    let params = [codigo];
    
    if (userRole === 'Cuentadante') {
      whereClause = ' AND e.id_cuentadante = ?';
      params.push(userId);
    } else if (userRole === 'Instructor') {
      // Los instructores solo pueden ver equipos de sus ambientes asignados
      whereClause = ` AND e.id_ambiente IN (
        SELECT DISTINCT ra.id_ambiente
        FROM Responsabilidades_Ambiente ra
        LEFT JOIN Clases c ON ra.id_clase = c.id_clase
        WHERE ra.id_usuario = ?
          AND ra.estado_responsabilidad = 'Activa'
          AND ra.fecha_inicio <= NOW()
          AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
          AND (
            -- Asignaciones permanentes (con días/horarios o jornada)
            (ra.id_clase IS NULL)
            OR
            -- Asignaciones temporales (clases) que estén programadas o en curso
            (ra.id_clase IS NOT NULL 
             AND c.estado_clase IN ('Programada', 'En Curso')
             AND c.fecha_clase >= CURDATE())
          )
      )`;
      params.push(userId);
    }

    // Buscar por placa - ahora devuelve TODOS los registros con la misma placa (permite duplicados)
    const [rowsInventario] = await defaultDb.execute(
      `${queryBase} WHERE e.placa = ?${whereClause}`,
      params
    );

    let equipoData = null;
    let codigoEquipoParaResponsables = null;

    if (rowsInventario && rowsInventario.length > 0) {
      // Si hay múltiples registros, tomar el primero para obtener responsables
      equipoData = rowsInventario.length === 1 ? rowsInventario[0] : rowsInventario[0];
      codigoEquipoParaResponsables = equipoData.codigo_equipo;
    } else {
    // Si no se encontró por placa, intentar por código_equipo (ID interno)
    const codigoNumerico = Number.parseInt(codigo, 10);
    if (Number.isFinite(codigoNumerico)) {
      // Reconstruir params para búsqueda por código_equipo
      const paramsId = [codigoNumerico];
      if (userRole === 'Cuentadante') {
        paramsId.push(userId);
      } else if (userRole === 'Instructor') {
        paramsId.push(userId);
      }
      
      const [rowsId] = await defaultDb.execute(
        `${queryBase} WHERE e.codigo_equipo = ?${whereClause}`,
        paramsId
      );
      if (rowsId && rowsId.length > 0) {
          equipoData = rowsId.length === 1 ? rowsId[0] : rowsId[0];
          codigoEquipoParaResponsables = equipoData.codigo_equipo;
        }
      }
    }

    if (!equipoData) {
    return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    // Obtener responsables/usuarios asignados al equipo
    // Usar LEFT JOIN para incluir registros externos incluso si el usuario no existe en Usuarios
    const [responsables] = await defaultDb.execute(
      `SELECT 
        re.id_responsable,
        re.id_usuario,
        re.fecha_asignacion,
        re.tipo_responsabilidad,
        re.observaciones,
        re.ficha,
        re.nombre_externo,
        re.documento_externo,
        CAST(re.dias_semana AS CHAR) AS dias_semana,
        re.hora_inicio,
        re.hora_fin,
        COALESCE(u.nombre_usuario, re.nombre_externo) AS nombre_usuario,
        COALESCE(u.cedula, re.documento_externo) AS cedula,
        r.nombre_rol,
        DATEDIFF(NOW(), re.fecha_asignacion) AS dias_asignado
       FROM Responsables_Equipo re
       LEFT JOIN Usuarios u ON re.id_usuario = u.id_usuario
       LEFT JOIN Roles r ON u.id_rol = r.id_rol
       WHERE re.codigo_equipo = ? AND re.estado_responsabilidad = 'Activo'
       ORDER BY re.fecha_asignacion DESC`,
      [codigoEquipoParaResponsables]
    );

    // Parsear JSON de dias_semana para cada responsable y asegurar campos externos
    const responsablesConDias = responsables.map(resp => {
      // Parsear dias_semana si existe
      if (resp.dias_semana) {
        let documentoOficial = documentoNormalizado;

        try {
          // Si es string, parsearlo; si ya es array, dejarlo como está
          if (typeof resp.dias_semana === 'string') {
            // Intentar parsear como JSON
            const parsed = JSON.parse(resp.dias_semana);
            resp.dias_semana = Array.isArray(parsed) ? parsed : null;
          } else if (!Array.isArray(resp.dias_semana)) {
            resp.dias_semana = null;
          }
        } catch (e) {
          logger.warn('Error al parsear dias_semana', { 
            error: e.message, 
            dias_semana: resp.dias_semana,
            tipo: typeof resp.dias_semana
          });
          resp.dias_semana = null;
        }
      } else {
        resp.dias_semana = null;
      }
      
      // Asegurar que los campos externos estén presentes y tengan prioridad
      // Los datos externos son más confiables porque vienen directamente de la página externa
      if (resp.nombre_externo) {
        resp.nombre_usuario = resp.nombre_externo;
      }
      if (resp.documento_externo) {
        resp.cedula = resp.documento_externo;
      }
      
      // Formatear horas para mostrar (remover segundos si existen)
      if (resp.hora_inicio && typeof resp.hora_inicio === 'string') {
        resp.hora_inicio = resp.hora_inicio.substring(0, 5);
      }
      if (resp.hora_fin && typeof resp.hora_fin === 'string') {
        resp.hora_fin = resp.hora_fin.substring(0, 5);
      }
      
      return resp;
    });
    
    logger.info('Responsables obtenidos para equipo', {
      codigo_equipo: codigoEquipoParaResponsables,
      cantidad: responsablesConDias.length,
      responsables: responsablesConDias.map(r => ({
        id_responsable: r.id_responsable,
        nombre: r.nombre_usuario || r.nombre_externo,
        documento: r.cedula || r.documento_externo,
        ficha: r.ficha,
        tiene_horarios: !!(r.dias_semana || r.hora_inicio || r.hora_fin)
      }))
    });

    // Agregar responsables al objeto del equipo
    const equipoConResponsables = {
      ...equipoData,
      responsables: responsablesConDias || []
    };

    // Si había múltiples registros, devolver array con responsables en cada uno
    if (rowsInventario && rowsInventario.length > 1) {
      return res.json(rowsInventario.map(eq => ({
        ...eq,
        responsables: responsablesConDias || []
      })));
    }

    return res.json(equipoConResponsables);
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar equipo', detalle: err.message });
  }
}

export async function actualizarEquipo(req, res) {
  try {
    const { codigo } = req.params;
    if (!codigo) return res.status(400).json({ error: 'codigo requerido' });

    let codigoEquipo = null;
    const codigoNumerico = Number.parseInt(codigo, 10);
    if (Number.isFinite(codigoNumerico)) {
      codigoEquipo = codigoNumerico;
    } else {
      const [[row]] = await defaultDb.execute(
        'SELECT codigo_equipo FROM Elementos WHERE r_centro = ? LIMIT 1',
        [codigo]
      );
      if (row?.codigo_equipo) {
        codigoEquipo = row.codigo_equipo;
      }
    }

    if (!codigoEquipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const body = req.body || {};

    // Resolver id_ambiente si viene 'ambiente' en texto o codigo
    let ambienteId = body.id_ambiente ?? null;
    if (!ambienteId && body.ambiente) {
      const [[amb]] = await defaultDb.execute(
        'SELECT id_ambiente FROM Ambientes WHERE id_ambiente = ? OR codigo_ambiente = ? OR nombre_ambiente = ? LIMIT 1',
        [body.ambiente, body.ambiente, body.ambiente]
      );
      ambienteId = amb?.id_ambiente || null;
    }

    const allowed = [
      'tipo', 'modelo', 'descripcion', 'fecha_adquisicion',
      'costo', 'valor_ingreso', 'vida_util_meses', 'estado_fisico', 'specs_completas',
      'consecutivo', 'placa', 'r_centro'
    ];

    const sets = [];
    const params = [];

    // Manejar 'centro' como alias de 'r_centro'
    if (Object.prototype.hasOwnProperty.call(body, 'centro') && !Object.prototype.hasOwnProperty.call(body, 'r_centro')) {
      body.r_centro = body.centro;
    }

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        sets.push(`${key} = ?`);
        params.push(body[key]);
      }
    }
    if (ambienteId) {
      sets.push('id_ambiente = ?');
      params.push(ambienteId);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Sin cambios para actualizar' });
    }

    const query = `UPDATE Elementos SET ${sets.join(', ')} WHERE codigo_equipo = ?`;
    params.push(codigoEquipo);
    const [result] = await defaultDb.execute(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Equipo no encontrado' });
    return res.json({ ok: true, updated: result.affectedRows });
  } catch (err) {
    return res.status(500).json({ error: 'Error al actualizar equipo', detalle: err.message });
  }
}

export async function eliminarEquipo(req, res) {
  try {
    const { codigo } = req.params;
    if (!codigo) return res.status(400).json({ error: 'codigo requerido' });

    let codigoEquipo = null;
    const codigoNumerico = Number.parseInt(codigo, 10);
    if (Number.isFinite(codigoNumerico)) {
      codigoEquipo = codigoNumerico;
    } else {
      const [[row]] = await defaultDb.execute(
        'SELECT codigo_equipo FROM Elementos WHERE r_centro = ? LIMIT 1',
        [codigo]
      );
      if (row?.codigo_equipo) {
        codigoEquipo = row.codigo_equipo;
      }
    }

    if (!codigoEquipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const [result] = await defaultDb.execute('DELETE FROM Elementos WHERE codigo_equipo = ?', [codigoEquipo]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Equipo no encontrado' });
    return res.json({ ok: true, deleted: result.affectedRows });
  } catch (err) {
    return res.status(500).json({ error: 'Error al eliminar equipo', detalle: err.message });
  }
}

/**
 * Habilitar equipo para uso de un usuario (aplicación de escritorio)
 * IMPORTANTE: Esto NO asigna inventario, solo habilita el equipo para que el usuario pueda iniciar sesión
 * y desbloquear la máquina. El inventario solo se asigna a ambientes.
 * 
 * Admin: puede habilitar a cualquier usuario
 * Instructor: solo puede habilitar a Aprendices
 */
export async function asignarEquipo(req, res) {
  try {
    const { codigo_equipo, id_usuario, tipo_responsabilidad = 'Principal', observaciones, dias_asignados } = req.body
    const asignadoPor = req.user?.id
    const userRole = req.user?.rol

    if (!codigo_equipo || !id_usuario) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (codigo_equipo, id_usuario)' })
    }

    // Validar que el equipo existe usando utilidad SQL
    const equipo = await obtenerEquipoPorCodigoUtil(defaultDb, codigo_equipo)

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    // Validar que el usuario receptor existe y obtener su rol
    const [[usuarioReceptor]] = await defaultDb.execute(
      `SELECT u.id_usuario, u.nombre_usuario, r.nombre_rol 
       FROM Usuarios u
       LEFT JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ? AND u.estado = 'Activo'`,
      [id_usuario]
    )

    if (!usuarioReceptor) {
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo' })
    }

    // Si es Instructor, solo puede habilitar a Aprendices
    if (userRole === 'Instructor' && usuarioReceptor.nombre_rol !== 'Aprendiz') {
      return res.status(403).json({ 
        error: 'Los instructores solo pueden habilitar equipos a aprendices' 
      })
    }

    // Verificar si el equipo está en mantenimiento (estado "En Proceso")
    const [[mantenimientoActivo]] = await defaultDb.execute(
      `SELECT id_mantenimiento, estado_mantenimiento, tipo_mantenimiento 
       FROM Mantenimiento 
       WHERE codigo_equipo = ? AND estado_mantenimiento = 'En Proceso' 
       ORDER BY fecha_mantenimiento DESC 
       LIMIT 1`,
      [codigo_equipo]
    )

    if (mantenimientoActivo) {
      return res.status(409).json({ 
        error: `Este equipo está actualmente en mantenimiento (${mantenimientoActivo.tipo_mantenimiento}). No se puede habilitar hasta que el mantenimiento finalice.` 
      })
    }

    // Verificar si ya existe una habilitación activa para este equipo y usuario
    // NOTA: Esta es una habilitación para uso, NO una asignación de inventario
    const [[habilitacionExistente]] = await defaultDb.execute(
      `SELECT id_responsable FROM Responsables_Equipo 
       WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
      [codigo_equipo, id_usuario]
    )

    if (habilitacionExistente) {
      return res.status(409).json({ 
        error: 'Este equipo ya está habilitado para este usuario' 
      })
    }

    // Calcular fecha_desvinculacion si se especifican días asignados
    let fechaDesvinculacion = null
    if (dias_asignados && !isNaN(Number(dias_asignados)) && Number(dias_asignados) > 0) {
      const dias = parseInt(dias_asignados, 10)
      const fecha = new Date()
      fecha.setDate(fecha.getDate() + dias)
      // Formatear fecha para MySQL (YYYY-MM-DD HH:MM:SS)
      fechaDesvinculacion = fecha.toISOString().slice(0, 19).replace('T', ' ')
    }

    // Insertar la habilitación (NO es asignación de inventario, solo habilitación para uso)
    // La tabla Responsables_Equipo se usa para habilitaciones de uso, no para asignación de inventario
    const [result] = await defaultDb.execute(
      `INSERT INTO Responsables_Equipo 
       (codigo_equipo, id_usuario, tipo_responsabilidad, observaciones, asignado_por, fecha_asignacion, fecha_desvinculacion) 
       VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [codigo_equipo, id_usuario, tipo_responsabilidad, observaciones || null, asignadoPor, fechaDesvinculacion]
    )

    return res.status(201).json({ 
      ok: true, 
      id: result.insertId,
      message: `Equipo habilitado correctamente para ${usuarioReceptor.nombre_usuario}. El usuario podrá iniciar sesión en la aplicación de escritorio para desbloquear el equipo.`,
      equipo: {
        codigo: equipo.codigo_equipo,
        descripcion: `${equipo.tipo} ${equipo.modelo || ''}`.trim()
      },
      nota: 'Esta habilitación permite el uso del equipo. El inventario permanece asignado al ambiente.'
    })
  } catch (err) {
    logger.error('Error al habilitar equipo', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al habilitar el equipo', details: err.message })
  }
}

/**
 * Obtener equipos asignados al usuario actual
 */
export async function obtenerMisEquipos(req, res) {
  try {
    const userId = req.user?.id

    const [equipos] = await defaultDb.execute(
      `SELECT 
        e.codigo_equipo,
        e.placa AS codigo_inventario,
        e.tipo,
        e.modelo,
        e.consecutivo,
        e.estado_fisico,
        e.descripcion,
        a.nombre_ambiente,
        a.codigo_ambiente,
        re.fecha_asignacion,
        re.tipo_responsabilidad,
        re.observaciones,
        DATEDIFF(NOW(), re.fecha_asignacion) AS dias_asignado,
        u_asignado.nombre_usuario AS asignado_por_nombre
      FROM Responsables_Equipo re
      INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
      LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
      LEFT JOIN Usuarios u_asignado ON re.asignado_por = u_asignado.id_usuario
      WHERE re.id_usuario = ? AND re.estado_responsabilidad = 'Activo'
      ORDER BY re.fecha_asignacion DESC`,
      [userId]
    )

    return res.json(equipos)
  } catch (err) {
    logger.error('Error al obtener equipos asignados', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al obtener equipos asignados', details: err.message })
  }
}

/**
 * Listar todas las habilitaciones de equipos (para uso, no asignación de inventario)
 * Admin: ve todas las habilitaciones
 * Instructor: ve solo habilitaciones de aprendices
 */
export async function listarAsignaciones(req, res) {
  try {
    const userRole = req.user?.rol

    let query = `
      SELECT 
        re.id_responsable,
        re.codigo_equipo,
        re.id_usuario,
        re.fecha_asignacion,
        re.fecha_desvinculacion,
        re.estado_responsabilidad,
        re.tipo_responsabilidad,
        re.observaciones,
        e.placa AS codigo_inventario,
        e.tipo AS equipo_tipo,
        e.modelo AS equipo_modelo,
        e.consecutivo,
        u.nombre_usuario AS usuario_nombre,
        u.cedula AS usuario_cedula,
        r.nombre_rol AS usuario_rol,
        u_asignado.nombre_usuario AS asignado_por_nombre,
        DATEDIFF(COALESCE(re.fecha_desvinculacion, NOW()), re.fecha_asignacion) AS dias_asignado
      FROM Responsables_Equipo re
      INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
      INNER JOIN Usuarios u ON re.id_usuario = u.id_usuario
      LEFT JOIN Roles r ON u.id_rol = r.id_rol
      LEFT JOIN Usuarios u_asignado ON re.asignado_por = u_asignado.id_usuario
    `

    let params = []

    // Si es Instructor, solo ver habilitaciones de Aprendices
    if (userRole === 'Instructor') {
      query += ` WHERE r.nombre_rol = 'Aprendiz' AND re.estado_responsabilidad = 'Activo'`
    } else {
      // Admin ve todas las habilitaciones activas
      query += ` WHERE re.estado_responsabilidad = 'Activo'`
    }

    query += ` ORDER BY re.fecha_asignacion DESC`

    const [rows] = await defaultDb.execute(query, params)

    return res.json(rows)
  } catch (err) {
    logger.error('Error al listar habilitaciones', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al obtener habilitaciones', details: err.message })
  }
}

/**
 * Eliminar/Desactivar una habilitación de equipo
 * Solo Administrador e Instructor pueden eliminar habilitaciones
 * Instructor solo puede eliminar habilitaciones de Aprendices
 */
export async function eliminarAsignacion(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const userRole = req.user?.rol

    // Obtener la asignación
    const [[asignacion]] = await defaultDb.execute(
      `SELECT 
        re.id_responsable,
        re.id_usuario,
        re.codigo_equipo,
        r.nombre_rol AS usuario_rol
      FROM Responsables_Equipo re
      INNER JOIN Usuarios u ON re.id_usuario = u.id_usuario
      LEFT JOIN Roles r ON u.id_rol = r.id_rol
      WHERE re.id_responsable = ? AND re.estado_responsabilidad = 'Activo'`,
      [id]
    )

    if (!asignacion) {
      return res.status(404).json({ error: 'Habilitación no encontrada o ya está inactiva' })
    }

    // Si es Instructor, solo puede eliminar habilitaciones de Aprendices
    if (userRole === 'Instructor' && asignacion.usuario_rol !== 'Aprendiz') {
      return res.status(403).json({ 
        error: 'Solo puedes eliminar habilitaciones de aprendices' 
      })
    }

    // Desactivar la habilitación (cambiar estado a 'Finalizado' y establecer fecha_desvinculacion)
    await defaultDb.execute(
      `UPDATE Responsables_Equipo 
       SET estado_responsabilidad = 'Finalizado', 
           fecha_desvinculacion = NOW()
       WHERE id_responsable = ?`,
      [id]
    )

    return res.json({ 
      ok: true,
      message: 'Habilitación eliminada correctamente' 
    })
  } catch (err) {
    logger.error('Error al eliminar asignación', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al eliminar la asignación', details: err.message })
  }
}

/**
 * Actualizar una asignación de equipo (Responsables_Equipo)
 * Permite actualizar: ficha, nombre_externo, documento_externo, dias_semana, hora_inicio, hora_fin, observaciones
 * Solo Administrador e Instructor pueden actualizar asignaciones
 * Instructor solo puede actualizar asignaciones de Aprendices
 */
export async function actualizarAsignacionEquipo(req, res) {
  try {
    const { id } = req.params;
    const { ficha, nombre_externo, documento_externo, dias_semana, hora_inicio, hora_fin, observaciones } = req.body;
    const userRole = req.user?.rol;

    // Obtener la asignación actual
    const [[asignacion]] = await defaultDb.execute(
      `SELECT 
        re.id_responsable,
        re.id_usuario,
        re.codigo_equipo,
        re.ficha,
        re.nombre_externo,
        re.documento_externo,
        CAST(re.dias_semana AS CHAR) AS dias_semana,
        re.hora_inicio,
        re.hora_fin,
        re.observaciones,
        r.nombre_rol AS usuario_rol
      FROM Responsables_Equipo re
      INNER JOIN Usuarios u ON re.id_usuario = u.id_usuario
      LEFT JOIN Roles r ON u.id_rol = r.id_rol
      WHERE re.id_responsable = ? AND re.estado_responsabilidad = 'Activo'`,
      [id]
    );

    if (!asignacion) {
      return res.status(404).json({ error: 'Asignación no encontrada o ya está inactiva' });
    }

    // Si es Instructor, solo puede actualizar asignaciones de Aprendices
    if (userRole === 'Instructor' && asignacion.usuario_rol !== 'Aprendiz') {
      return res.status(403).json({ 
        error: 'Solo puedes actualizar asignaciones de aprendices' 
      });
    }

    // Verificar columnas disponibles en la tabla
    const [colFicha] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Responsables_Equipo' 
       AND COLUMN_NAME = 'ficha'`
    );
    const tieneFicha = colFicha[0].cnt > 0;

    const [colNombreExterno] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Responsables_Equipo' 
       AND COLUMN_NAME = 'nombre_externo'`
    );
    const tieneNombreExterno = colNombreExterno[0].cnt > 0;

    const [colDocumentoExterno] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Responsables_Equipo' 
       AND COLUMN_NAME = 'documento_externo'`
    );
    const tieneDocumentoExterno = colDocumentoExterno[0].cnt > 0;

    const [colDiasSemana] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Responsables_Equipo' 
       AND COLUMN_NAME = 'dias_semana'`
    );
    const tieneDiasSemana = colDiasSemana[0].cnt > 0;

    const [colHoraInicio] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Responsables_Equipo' 
       AND COLUMN_NAME = 'hora_inicio'`
    );
    const tieneHoraInicio = colHoraInicio[0].cnt > 0;

    const [colHoraFin] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Responsables_Equipo' 
       AND COLUMN_NAME = 'hora_fin'`
    );
    const tieneHoraFin = colHoraFin[0].cnt > 0;

    // Preparar datos de horarios
    let diasSemanaJson = null;
    if (dias_semana !== undefined) {
      if (dias_semana && Array.isArray(dias_semana) && dias_semana.length > 0) {
        diasSemanaJson = JSON.stringify(dias_semana);
      } else {
        diasSemanaJson = null;
      }
    }

    // Convertir horas de string a TIME (formato HH:MM:SS)
    let horaInicioTime = null;
    let horaFinTime = null;
    if (hora_inicio !== undefined) {
      if (hora_inicio) {
        const horaInicioParts = hora_inicio.split(':');
        if (horaInicioParts.length === 2) {
          horaInicioTime = `${horaInicioParts[0].padStart(2, '0')}:${horaInicioParts[1].padStart(2, '0')}:00`;
        } else {
          horaInicioTime = hora_inicio;
        }
      } else {
        horaInicioTime = null;
      }
    }
    if (hora_fin !== undefined) {
      if (hora_fin) {
        const horaFinParts = hora_fin.split(':');
        if (horaFinParts.length === 2) {
          horaFinTime = `${horaFinParts[0].padStart(2, '0')}:${horaFinParts[1].padStart(2, '0')}:00`;
        } else {
          horaFinTime = hora_fin;
        }
      } else {
        horaFinTime = null;
      }
    }

    // Validar conflictos de horario si se están actualizando días y horarios
    if (diasSemanaJson !== null && horaInicioTime !== null && horaFinTime !== null) {
      let conflictQuery = `
        SELECT 
          re.id_responsable,
          re.id_usuario,
          COALESCE(u.nombre_usuario, re.nombre_externo) AS nombre_usuario,
          COALESCE(u.cedula, re.documento_externo) AS cedula,
          re.dias_semana,
          re.hora_inicio,
          re.hora_fin
        FROM Responsables_Equipo re
        LEFT JOIN Usuarios u ON re.id_usuario = u.id_usuario
        WHERE re.codigo_equipo = ?
          AND re.estado_responsabilidad = 'Activo'
          AND re.id_responsable != ?
          AND re.dias_semana IS NOT NULL
          AND re.hora_inicio IS NOT NULL
          AND re.hora_fin IS NOT NULL
          AND JSON_OVERLAPS(re.dias_semana, ?)
          AND (
            (re.hora_inicio < ? AND re.hora_fin > ?) OR
            (re.hora_inicio < ? AND re.hora_fin >= ?) OR
            (re.hora_inicio >= ? AND re.hora_fin <= ?)
          )
      `;
      
      const [conflictos] = await defaultDb.execute(conflictQuery, [
        asignacion.codigo_equipo,
        id,
        diasSemanaJson,
        horaFinTime, horaInicioTime,
        horaFinTime, horaInicioTime,
        horaInicioTime, horaFinTime
      ]);
      
      if (conflictos.length > 0) {
        const conflicto = conflictos[0];
        let diasConflicto = [];
        try {
          if (typeof conflicto.dias_semana === 'string') {
            diasConflicto = JSON.parse(conflicto.dias_semana);
          } else if (Array.isArray(conflicto.dias_semana)) {
            diasConflicto = conflicto.dias_semana;
          }
        } catch (e) {
          // Ignorar error de parseo
        }
        
        return res.status(409).json({
          error: 'Conflicto de horario',
          detalle: `Ya existe otro usuario (${conflicto.nombre_usuario || 'Sin nombre'}, ${conflicto.cedula || 'Sin documento'}) asignado a este equipo en los días ${Array.isArray(diasConflicto) ? diasConflicto.join(', ') : 'N/A'} de ${conflicto.hora_inicio ? conflicto.hora_inicio.substring(0, 5) : 'N/A'} a ${conflicto.hora_fin ? conflicto.hora_fin.substring(0, 5) : 'N/A'}`,
          conflicto_con: {
            id_usuario: conflicto.id_usuario,
            nombre: conflicto.nombre_usuario,
            documento: conflicto.cedula,
            dias: diasConflicto,
            horario: `${conflicto.hora_inicio ? conflicto.hora_inicio.substring(0, 5) : ''} - ${conflicto.hora_fin ? conflicto.hora_fin.substring(0, 5) : ''}`
          }
        });
      }
    }

    // Construir la consulta de actualización
    const updates = [];
    const valores = [];

    if (ficha !== undefined && tieneFicha) {
      updates.push('ficha = ?');
      valores.push(ficha || null);
    }
    if (nombre_externo !== undefined && tieneNombreExterno) {
      updates.push('nombre_externo = ?');
      valores.push(nombre_externo || null);
    }
    if (documento_externo !== undefined && tieneDocumentoExterno) {
      updates.push('documento_externo = ?');
      valores.push(documento_externo || null);
    }
    if (diasSemanaJson !== null && tieneDiasSemana) {
      updates.push('dias_semana = ?');
      valores.push(diasSemanaJson);
    } else if (diasSemanaJson === null && tieneDiasSemana && dias_semana === null) {
      // Permitir establecer a null explícitamente
      updates.push('dias_semana = NULL');
    }
    if (horaInicioTime !== null && tieneHoraInicio) {
      updates.push('hora_inicio = ?');
      valores.push(horaInicioTime);
    } else if (horaInicioTime === null && tieneHoraInicio && hora_inicio === null) {
      updates.push('hora_inicio = NULL');
    }
    if (horaFinTime !== null && tieneHoraFin) {
      updates.push('hora_fin = ?');
      valores.push(horaFinTime);
    } else if (horaFinTime === null && tieneHoraFin && hora_fin === null) {
      updates.push('hora_fin = NULL');
    }
    if (observaciones !== undefined) {
      updates.push('observaciones = ?');
      valores.push(observaciones || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    valores.push(id);
    await defaultDb.execute(
      `UPDATE Responsables_Equipo 
       SET ${updates.join(', ')} 
       WHERE id_responsable = ?`,
      valores
    );

    logger.info('Asignación de equipo actualizada', {
      id_responsable: id,
      codigo_equipo: asignacion.codigo_equipo,
      id_usuario: asignacion.id_usuario,
      campos_actualizados: updates.length
    });

    return res.json({
      ok: true,
      message: 'Asignación actualizada correctamente'
    });
  } catch (err) {
    logger.error('Error al actualizar asignación', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al actualizar la asignación', details: err.message });
  }
}

/**
 * Obtener equipos de ambientes asignados al instructor actual
 * Solo para instructores: muestra equipos de ambientes donde tienen responsabilidad activa
 */
export async function obtenerEquiposAmbientesInstructor(req, res) {
  try {
    const userId = req.user?.id
    const userRole = req.user?.rol

    // Solo instructores pueden acceder a esta funcionalidad
    if (userRole !== 'Instructor') {
      return res.status(403).json({ 
        error: 'Solo los instructores pueden verificar el inventario de sus ambientes' 
      })
    }

    // Obtener ambientes donde el instructor tiene responsabilidad activa
    // IMPORTANTE: Para la verificación de inventario, mostramos TODOS los ambientes asignados activos
    // sin restricción de horario actual. El horario solo se valida al momento de registrar una verificación.
    // Esto permite al instructor ver y verificar el inventario en cualquier momento.
    
    const [ambientes] = await defaultDb.execute(
      `SELECT DISTINCT
        ra.id_responsabilidad_ambiente,
        ra.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        ra.tipo_responsabilidad,
        ra.fecha_inicio,
        ra.fecha_fin,
        ra.jornada,
        CAST(ra.dias_semana AS CHAR) AS dias_semana,
        ra.hora_inicio,
        ra.hora_fin,
        ra.id_clase,
        c.estado_clase,
        CASE WHEN ra.id_clase IS NULL THEN 'Permanente' ELSE 'Temporal' END AS tipo_asignacion
      FROM Responsabilidades_Ambiente ra
      INNER JOIN Ambientes a ON ra.id_ambiente = a.id_ambiente
      LEFT JOIN Clases c ON ra.id_clase = c.id_clase
      WHERE ra.id_usuario = ?
        AND ra.estado_responsabilidad = 'Activa'
        AND ra.fecha_inicio <= NOW()
        AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
        AND (
          -- Asignaciones permanentes (con días/horarios o jornada)
          (ra.id_clase IS NULL)
          OR
          -- Asignaciones temporales (clases) que estén programadas o en curso
          (ra.id_clase IS NOT NULL 
           AND c.estado_clase IN ('Programada', 'En Curso')
           AND c.fecha_clase >= CURDATE())
        )
      ORDER BY a.nombre_ambiente`,
      [userId]
    );

    // Log para debug
    logger.debug('Verificación Inventario', { 
      instructor: userId, 
      ambientesEncontrados: ambientes.length 
    })
    if (ambientes.length > 0) {
      logger.debug('Ambientes encontrados', { 
        ambientes: ambientes.map(a => ({
          ambiente: a.nombre_ambiente,
          tipo: a.tipo_asignacion,
          estado_clase: a.estado_clase,
          id_clase: a.id_clase,
          dias_semana: a.dias_semana,
          hora_inicio: a.hora_inicio,
          hora_fin: a.hora_fin
        }))
      })
    }

    if (ambientes.length === 0) {
      return res.json({
        ambientes: [],
        equipos: []
      })
    }

    const ambienteIds = ambientes.map(a => a.id_ambiente)

    // Obtener todos los equipos de esos ambientes con su última verificación
    const [equipos] = await defaultDb.execute(
      `SELECT 
        e.codigo_equipo,
        e.placa AS codigo_inventario,
        e.tipo,
        e.modelo,
        NULL AS marca,
        e.consecutivo,
        e.estado_fisico,
        e.descripcion,
        e.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        (SELECT MAX(fecha_verificacion) 
         FROM Verificaciones_Inventario 
         WHERE codigo_equipo = e.codigo_equipo 
         AND id_usuario = ?) AS ultima_verificacion,
        (SELECT estado_verificacion 
         FROM Verificaciones_Inventario 
         WHERE codigo_equipo = e.codigo_equipo 
         AND id_usuario = ?
         ORDER BY fecha_verificacion DESC 
         LIMIT 1) AS estado_verificacion_actual,
        (SELECT observaciones 
         FROM Verificaciones_Inventario 
         WHERE codigo_equipo = e.codigo_equipo 
         AND id_usuario = ?
         ORDER BY fecha_verificacion DESC 
         LIMIT 1) AS observaciones_verificacion
      FROM Elementos e
      INNER JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
      WHERE e.id_ambiente IN (${ambienteIds.map(() => '?').join(',')})
      ORDER BY a.nombre_ambiente, e.placa`,
      [userId, userId, userId, ...ambienteIds]
    )

    return res.json({
      ambientes,
      equipos
    })
  } catch (err) {
    logger.error('Error al obtener equipos de ambientes del instructor', {
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
    return res.status(500).json({ 
      error: 'Error al obtener equipos de ambientes', 
      details: err.message 
    })
  }
}

/**
 * Registrar verificación física de un equipo
 * Solo instructores pueden verificar equipos de sus ambientes
 */
export async function registrarVerificacionInventario(req, res) {
  try {
    const { codigo_equipo, estado_verificacion, observaciones } = req.body
    const userId = req.user?.id
    const userRole = req.user?.rol

    if (!codigo_equipo || !estado_verificacion) {
      return res.status(400).json({ 
        error: 'Faltan campos obligatorios (codigo_equipo, estado_verificacion)' 
      })
    }

    // Solo instructores pueden verificar
    if (userRole !== 'Instructor') {
      return res.status(403).json({ 
        error: 'Solo los instructores pueden registrar verificaciones' 
      })
    }

    // Validar que el equipo existe y obtener su ambiente
    const [[equipo]] = await defaultDb.execute(
      `SELECT e.codigo_equipo, e.id_ambiente, a.nombre_ambiente
       FROM Elementos e
       INNER JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
       WHERE e.codigo_equipo = ?`,
      [codigo_equipo]
    )

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    // Validar que el instructor tiene responsabilidad activa en ese ambiente
    // IMPORTANTE: Permitimos verificar si el instructor tiene una asignación activa,
    // sin restricción de horario exacto. Esto permite que el instructor verifique
    // equipos en cualquier momento durante el período de su asignación.
    // Obtener información completa de la responsabilidad para el historial
    const [[responsabilidad]] = await defaultDb.execute(
      `SELECT 
        ra.id_responsabilidad_ambiente,
        ra.id_clase,
        ra.jornada,
        ra.dias_semana,
        ra.hora_inicio,
        ra.hora_fin,
        c.fecha_clase,
        c.hora_inicio AS clase_hora_inicio,
        c.hora_fin AS clase_hora_fin,
        c.nombre_clase,
        c.codigo_ficha
       FROM Responsabilidades_Ambiente ra
       LEFT JOIN Clases c ON ra.id_clase = c.id_clase
       WHERE ra.id_ambiente = ?
         AND ra.id_usuario = ?
         AND ra.estado_responsabilidad = 'Activa'
         AND ra.fecha_inicio <= NOW()
         AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
         AND (
           -- Asignaciones permanentes (con días/horarios o jornada)
           (ra.id_clase IS NULL)
           OR
           -- Asignaciones temporales (clases) que estén programadas o en curso
           (ra.id_clase IS NOT NULL 
            AND c.estado_clase IN ('Programada', 'En Curso')
            AND c.fecha_clase >= CURDATE())
         )
       ORDER BY ra.fecha_inicio DESC
       LIMIT 1`,
      [equipo.id_ambiente, userId]
    )

    if (!responsabilidad) {
      return res.status(403).json({ 
        error: 'No tienes responsabilidad activa en el ambiente de este equipo' 
      })
    }

    // Validar estado_verificacion
    const estadosValidos = ['Verificado', 'Con Novedad', 'No Verificado']
    if (!estadosValidos.includes(estado_verificacion)) {
      return res.status(400).json({ 
        error: `Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}` 
      })
    }

    // Siempre crear un nuevo registro en el historial (no actualizar)
    // Esto permite rastrear todas las verificaciones a lo largo del tiempo
    const [result] = await defaultDb.execute(
      `INSERT INTO Verificaciones_Inventario 
       (codigo_equipo, id_ambiente, id_clase, id_responsabilidad_ambiente, jornada, id_usuario, estado_verificacion, observaciones, fecha_verificacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        codigo_equipo,
        equipo.id_ambiente,
        responsabilidad.id_clase || null,
        responsabilidad.id_responsabilidad_ambiente,
        responsabilidad.jornada || null,
        userId,
        estado_verificacion,
        observaciones || null
      ]
    )

    return res.json({
      ok: true,
      id_verificacion: result.insertId,
      message: 'Verificación registrada correctamente en el historial',
      equipo: {
        codigo: equipo.codigo_equipo,
        ambiente: equipo.nombre_ambiente
      },
      contexto: {
        ambiente: equipo.nombre_ambiente,
        clase: responsabilidad.nombre_clase || null,
        horario: responsabilidad.id_clase 
          ? `${responsabilidad.fecha_clase} ${responsabilidad.hora_inicio} - ${responsabilidad.hora_fin}`
          : null,
        jornada: responsabilidad.jornada || null,
        ficha: responsabilidad.codigo_ficha || null
      }
    })
  } catch (err) {
    logger.error('Error al registrar verificación', { error: err.message, stack: err.stack })
    return res.status(500).json({ 
      error: 'Error al registrar verificación', 
      details: err.message 
    })
  }
}

/**
 * Consultar historial de verificaciones de inventario
 * Permite filtrar por equipo, ambiente, instructor, fecha, etc.
 */
export async function consultarHistorialVerificaciones(req, res) {
  try {
    const { 
      codigo_equipo, 
      id_ambiente, 
      id_instructor, 
      fecha_desde, 
      fecha_hasta,
      estado_verificacion,
      id_clase
    } = req.query

    const userId = req.user?.id
    const userRole = req.user?.rol

    let query = `
      SELECT 
        vi.id_verificacion,
        vi.codigo_equipo,
        e.placa AS codigo_inventario,
        e.tipo AS equipo_tipo,
        e.modelo AS equipo_modelo,
        e.consecutivo,
        vi.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        vi.id_clase,
        c.nombre_clase,
        c.codigo_ficha,
        c.fecha_clase,
        c.hora_inicio,
        c.hora_fin,
        vi.id_responsabilidad_ambiente,
        vi.jornada,
        vi.id_usuario,
        u.nombre_usuario AS instructor_nombre,
        u.cedula AS instructor_cedula,
        vi.estado_verificacion,
        vi.observaciones,
        vi.fecha_verificacion
      FROM Verificaciones_Inventario vi
      INNER JOIN Elementos e ON vi.codigo_equipo = e.codigo_equipo
      LEFT JOIN Ambientes a ON vi.id_ambiente = a.id_ambiente
      LEFT JOIN Clases c ON vi.id_clase = c.id_clase
      INNER JOIN Usuarios u ON vi.id_usuario = u.id_usuario
      WHERE 1=1
    `

    const params = []

    // Si es instructor, solo puede ver sus propias verificaciones
    if (userRole === 'Instructor') {
      query += ' AND vi.id_usuario = ?'
      params.push(userId)
    }

    // Filtros opcionales
    if (codigo_equipo) {
      query += ' AND vi.codigo_equipo = ?'
      params.push(codigo_equipo)
    }

    if (id_ambiente) {
      query += ' AND vi.id_ambiente = ?'
      params.push(id_ambiente)
    }

    if (id_instructor && userRole === 'Administrador') {
      query += ' AND vi.id_usuario = ?'
      params.push(id_instructor)
    }

    if (id_clase) {
      query += ' AND vi.id_clase = ?'
      params.push(id_clase)
    }

    if (estado_verificacion) {
      query += ' AND vi.estado_verificacion = ?'
      params.push(estado_verificacion)
    }

    if (fecha_desde) {
      query += ' AND DATE(vi.fecha_verificacion) >= ?'
      params.push(fecha_desde)
    }

    if (fecha_hasta) {
      query += ' AND DATE(vi.fecha_verificacion) <= ?'
      params.push(fecha_hasta)
    }

    query += ' ORDER BY vi.fecha_verificacion DESC LIMIT 1000'

    const [verificaciones] = await defaultDb.execute(query, params)

    return res.json({
      verificaciones,
      total: verificaciones.length
    })
  } catch (err) {
    logger.error('Error al consultar historial de verificaciones', { error: err.message, stack: err.stack })
    return res.status(500).json({
      error: 'Error al consultar historial',
      details: err.message
    })
  }
}

/**
 * Obtener historial de verificaciones de un equipo específico
 * Útil para rastrear qué instructor estaba a cargo cuando ocurrió un incidente
 */
export async function obtenerHistorialEquipo(req, res) {
  try {
    const { codigo } = req.params
    const { fecha_desde, fecha_hasta } = req.query

    let query = `
      SELECT 
        vi.id_verificacion,
        vi.fecha_verificacion,
        vi.estado_verificacion,
        vi.observaciones,
        vi.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        vi.id_clase,
        c.nombre_clase,
        c.codigo_ficha,
        c.fecha_clase,
        c.hora_inicio,
        c.hora_fin,
        vi.jornada,
        vi.id_usuario,
        u.nombre_usuario AS instructor_nombre,
        u.cedula AS instructor_cedula,
        u.correo AS instructor_correo
      FROM Verificaciones_Inventario vi
      INNER JOIN Elementos e ON vi.codigo_equipo = e.codigo_equipo
      LEFT JOIN Ambientes a ON vi.id_ambiente = a.id_ambiente
      LEFT JOIN Clases c ON vi.id_clase = c.id_clase
      INNER JOIN Usuarios u ON vi.id_usuario = u.id_usuario
      WHERE vi.codigo_equipo = ?
    `

    const params = [codigo]

    if (fecha_desde) {
      query += ' AND DATE(vi.fecha_verificacion) >= ?'
      params.push(fecha_desde)
    }

    if (fecha_hasta) {
      query += ' AND DATE(vi.fecha_verificacion) <= ?'
      params.push(fecha_hasta)
    }

    query += ' ORDER BY vi.fecha_verificacion DESC'

    const [historial] = await defaultDb.execute(query, params)

    // Obtener información del equipo
    const [[equipo]] = await defaultDb.execute(
      `SELECT codigo_equipo, placa AS codigo_inventario, tipo, modelo, consecutivo
       FROM Elementos
       WHERE codigo_equipo = ?`,
      [codigo]
    )

    return res.json({
      equipo,
      historial,
      total: historial.length
    })
  } catch (err) {
    logger.error('Error al obtener historial del equipo', { error: err.message, stack: err.stack })
    return res.status(500).json({
      error: 'Error al obtener historial del equipo',
      details: err.message
    })
  }
}

/**
 * Actualizar cuentadante principal de todos los equipos
 * El cuentadante principal es la persona responsable permanente de todo el inventario
 * Solo puede haber un cuentadante principal y se ingresa después de importar equipos
 */
export async function actualizarCuentadantePrincipal(req, res) {
  try {
    const { cedula } = req.body
    const userId = req.user?.id
    const userRole = req.user?.rol

    // Solo Administrador puede actualizar el cuentadante principal
    if (userRole !== 'Administrador') {
      return res.status(403).json({ 
        error: 'Solo los administradores pueden actualizar el cuentadante principal' 
      })
    }

    if (!cedula || typeof cedula !== 'string' || cedula.trim().length === 0) {
      return res.status(400).json({ 
        error: 'La cédula del cuentadante es obligatoria' 
      })
    }

    // Buscar el usuario por cédula y verificar que sea Cuentadante
    const [[usuario]] = await defaultDb.execute(
      `SELECT u.id_usuario, u.nombre_usuario, u.cedula, r.nombre_rol
       FROM Usuarios u
       INNER JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.cedula = ? AND u.estado = 'Activo'`,
      [cedula.trim()]
    )

    if (!usuario) {
      return res.status(404).json({ 
        error: 'No se encontró un usuario activo con esa cédula' 
      })
    }

    if (usuario.nombre_rol !== 'Cuentadante') {
      return res.status(400).json({ 
        error: 'El usuario debe tener el rol de Cuentadante' 
      })
    }

    const nombreCuentadante = usuario.nombre_usuario

    // Verificar si la columna cuentadante_principal existe en la tabla Elementos
    const [[columnaExiste]] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Elementos' 
       AND COLUMN_NAME = 'cuentadante_principal'`
    )

    // Si no existe, crearla
    if (columnaExiste.cnt === 0) {
      await defaultDb.execute(
        `ALTER TABLE Elementos 
         ADD COLUMN cuentadante_principal VARCHAR(255) NULL 
         COMMENT 'Cuentadante principal permanente de todo el inventario'`
      )
      logger.info('Columna cuentadante_principal creada en la tabla Elementos')
    }

    // Verificar si la columna id_cuentadante existe
    const [[colIdCuentadante]] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Elementos' 
       AND COLUMN_NAME = 'id_cuentadante'`
    )

    // Si no existe, crearla
    if (colIdCuentadante.cnt === 0) {
      await defaultDb.execute(
        `ALTER TABLE Elementos 
         ADD COLUMN id_cuentadante INT NULL,
         ADD INDEX idx_cuentadante (id_cuentadante),
         ADD FOREIGN KEY (id_cuentadante) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL`
      )
      logger.info('Columna id_cuentadante creada en la tabla Elementos')
    }

    // Actualizar el cuentadante principal en todos los equipos
    // IMPORTANTE: Actualizar tanto cuentadante_principal (nombre) como id_cuentadante (FK)
    // Actualizar equipos que no tienen cuentadante o que tienen un cuentadante diferente
    const [result] = await defaultDb.execute(
      `UPDATE Elementos 
       SET cuentadante_principal = ?, 
           id_cuentadante = ?
       WHERE cuentadante_principal IS NULL 
          OR cuentadante_principal != ? 
          OR id_cuentadante IS NULL 
          OR id_cuentadante != ?`,
      [nombreCuentadante, usuario.id_usuario, nombreCuentadante, usuario.id_usuario]
    )
    // (para equipos importados antes de que se implementara id_cuentadante)
    const [resultSync] = await defaultDb.execute(
      `UPDATE Elementos 
       SET id_cuentadante = ?
       WHERE cuentadante_principal = ? 
          AND (id_cuentadante IS NULL OR id_cuentadante != ?)`,
      [usuario.id_usuario, nombreCuentadante, usuario.id_usuario]
    )

    const totalActualizados = result.affectedRows + resultSync.affectedRows

    return res.json({
      ok: true,
      message: `Cuentadante principal actualizado correctamente para ${totalActualizados} equipo(s)`,
      cuentadante_principal: nombreCuentadante,
      cuentadante_cedula: usuario.cedula,
      equipos_actualizados: totalActualizados
    })
  } catch (err) {
    logger.error('Error al actualizar cuentadante principal', { error: err.message, stack: err.stack })
    return res.status(500).json({
      error: 'Error al actualizar el cuentadante principal',
      details: err.message
    })
  }
}

/**
 * Obtener el cuentadante principal actual
 */
export async function obtenerCuentadantePrincipal(req, res) {
  try {
    // Verificar si la columna existe
    const [[columnaExiste]] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Elementos' 
       AND COLUMN_NAME = 'cuentadante_principal'`
    )

    if (columnaExiste.cnt === 0) {
      return res.json({
        cuentadante_principal: null,
        existe_columna: false
      })
    }

    // Obtener el cuentadante principal (debería ser el mismo para todos los equipos)
    const [[cuentadante]] = await defaultDb.execute(
      `SELECT DISTINCT cuentadante_principal 
       FROM Elementos 
       WHERE cuentadante_principal IS NOT NULL 
       LIMIT 1`
    )

    // También obtener la cédula del cuentadante si existe
    let cedulaCuentadante = null
    if (cuentadante?.cuentadante_principal) {
      const [[usuario]] = await defaultDb.execute(
        `SELECT u.cedula
         FROM Usuarios u
         WHERE u.nombre_usuario = ? AND u.estado = 'Activo'
         LIMIT 1`,
        [cuentadante.cuentadante_principal]
      )
      cedulaCuentadante = usuario?.cedula || null
    }

    return res.json({
      cuentadante_principal: cuentadante?.cuentadante_principal || null,
      cuentadante_cedula: cedulaCuentadante,
      existe_columna: true
    })
  } catch (err) {
    logger.error('Error al obtener cuentadante principal', { error: err.message, stack: err.stack })
    return res.status(500).json({
      error: 'Error al obtener el cuentadante principal',
      details: err.message
    })
  }
}

/**
 * Buscar cuentadante por número de documento y obtener su información e inventario
 * Solo Administrador puede acceder
 */
export async function buscarCuentadantePorDocumento(req, res) {
  try {
    const { documento } = req.params
    const userRole = req.user?.rol

    // Solo Administrador puede buscar cuentadantes
    if (userRole !== 'Administrador') {
      return res.status(403).json({ 
        error: 'Solo los administradores pueden buscar cuentadantes' 
      })
    }

    if (!documento || documento.trim().length === 0) {
      return res.status(400).json({ 
        error: 'El número de documento es obligatorio' 
      })
    }

    // Buscar usuario con rol Cuentadante por documento
    const [[cuentadante]] = await defaultDb.execute(
      `SELECT 
        u.id_usuario,
        u.nombre_usuario,
        u.cedula,
        u.correo,
        u.telefono,
        u.estado,
        u.fecha_registro,
        r.nombre_rol
       FROM Usuarios u
       INNER JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.cedula = ? AND r.nombre_rol = 'Cuentadante' AND u.estado = 'Activo'`,
      [documento.trim()]
    )

    if (!cuentadante) {
      return res.status(404).json({ 
        error: 'Cuentadante no encontrado',
        detalle: 'No se encontró un cuentadante activo con ese número de documento'
      })
    }

    // Obtener inventario del cuentadante
    const [inventario] = await defaultDb.execute(
      `SELECT 
        e.codigo_equipo,
        e.placa AS codigo_inventario,
        e.tipo,
        e.modelo,
        e.consecutivo,
        e.descripcion,
        e.fecha_adquisicion,
        e.valor_ingreso AS costo,
        e.vida_util_meses,
        e.estado_fisico,
        e.specs_completas,
        e.cuentadante_principal,
        a.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        COUNT(DISTINCT n.id_novedad) AS total_novedades,
        COUNT(DISTINCT m.id_mantenimiento) AS total_mantenimientos
       FROM Elementos e
       LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
       LEFT JOIN Novedades n ON e.codigo_equipo = n.codigo_equipo
       LEFT JOIN Mantenimiento m ON e.codigo_equipo = m.codigo_equipo
       WHERE e.id_cuentadante = ?
       GROUP BY e.codigo_equipo
       ORDER BY e.codigo_equipo ASC`,
      [cuentadante.id_usuario]
    )

    // Obtener estadísticas del inventario
    const [[estadisticas]] = await defaultDb.execute(
      `SELECT 
        COUNT(*) AS total_equipos,
        COUNT(DISTINCT e.id_ambiente) AS total_ambientes,
        SUM(CASE WHEN e.estado_fisico = 'Bueno' THEN 1 ELSE 0 END) AS equipos_buenos,
        SUM(CASE WHEN e.estado_fisico = 'Regular' THEN 1 ELSE 0 END) AS equipos_regulares,
        SUM(CASE WHEN e.estado_fisico = 'Malo' OR e.estado_fisico = 'Dañado' THEN 1 ELSE 0 END) AS equipos_danados,
        SUM(e.valor_ingreso) AS valor_total_inventario
       FROM Elementos e
       WHERE e.id_cuentadante = ?`,
      [cuentadante.id_usuario]
    )

    return res.json({
      cuentadante: {
        id_usuario: cuentadante.id_usuario,
        nombre_usuario: cuentadante.nombre_usuario,
        cedula: cuentadante.cedula,
        correo: cuentadante.correo,
        telefono: cuentadante.telefono,
        estado: cuentadante.estado,
        fecha_creacion: cuentadante.fecha_registro,
        nombre_rol: cuentadante.nombre_rol
      },
      inventario,
      estadisticas: {
        total_equipos: estadisticas.total_equipos || 0,
        total_ambientes: estadisticas.total_ambientes || 0,
        equipos_buenos: estadisticas.equipos_buenos || 0,
        equipos_regulares: estadisticas.equipos_regulares || 0,
        equipos_danados: estadisticas.equipos_danados || 0,
        valor_total_inventario: estadisticas.valor_total_inventario || 0
      }
    })
  } catch (err) {
    logger.error('Error al buscar cuentadante por documento', { error: err.message, stack: err.stack })
    return res.status(500).json({
      error: 'Error al buscar cuentadante',
      details: err.message
    })
  }
}

/**
 * Listar todas las categorías de equipos disponibles
 */
export async function listarCategorias(req, res) {
  try {
    const [rows] = await defaultDb.execute(
      'SELECT id_categoria, nombre_categoria, descripcion, es_componente FROM Categorias_Equipo ORDER BY nombre_categoria ASC'
    )
    return res.json(rows)
  } catch (err) {
    logger.error('Error al listar categorías', { error: err.message, stack: err.stack })
    return res.status(500).json({
      error: 'Error al listar categorías',
      detalle: err.message
    })
  }
}

/**
 * Crear una nueva categoría de equipo
 */
export async function crearCategoria(req, res) {
  try {
    const { nombre_categoria, descripcion, es_componente } = req.body

    if (!nombre_categoria || !nombre_categoria.trim()) {
      return res.status(400).json({
        error: 'El nombre de la categoría es obligatorio',
        detalle: 'El campo nombre_categoria no puede estar vacío'
      })
    }

    // Verificar si ya existe una categoría con el mismo nombre
    const [[existente]] = await defaultDb.execute(
      'SELECT id_categoria FROM Categorias_Equipo WHERE nombre_categoria = ? LIMIT 1',
      [nombre_categoria.trim()]
    )

    if (existente) {
      return res.status(409).json({
        error: 'Ya existe una categoría con ese nombre',
        detalle: `La categoría "${nombre_categoria}" ya está registrada`
      })
    }

    // Insertar la nueva categoría
    const [result] = await defaultDb.execute(
      'INSERT INTO Categorias_Equipo (nombre_categoria, descripcion, es_componente) VALUES (?, ?, ?)',
      [
        nombre_categoria.trim(),
        descripcion?.trim() || null,
        es_componente === true || es_componente === 1 || es_componente === '1' ? 1 : 0
      ]
    )

    logger.info(`Categoría creada: ${nombre_categoria} (ID: ${result.insertId})`)

    return res.status(201).json({
      message: 'Categoría creada correctamente',
      id_categoria: result.insertId,
      nombre_categoria: nombre_categoria.trim(),
      descripcion: descripcion?.trim() || null,
      es_componente: es_componente === true || es_componente === 1 || es_componente === '1' ? 1 : 0
    })
  } catch (err) {
    logger.error('Error al crear categoría', { error: err.message, stack: err.stack, body: req.body })
    
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Ya existe una categoría con ese nombre',
        detalle: 'El nombre de la categoría debe ser único'
      })
    }

    return res.status(500).json({
      error: 'Error al crear categoría',
      detalle: err.message
    })
  }
}

/**
 * Actualizar una categoría de equipo existente
 */
export async function actualizarCategoria(req, res) {
  try {
    const { id_categoria } = req.params
    const { nombre_categoria, descripcion, es_componente } = req.body

    if (!id_categoria) {
      return res.status(400).json({
        error: 'ID de categoría es obligatorio',
        detalle: 'Debe proporcionar el id_categoria en la URL'
      })
    }

    // Verificar que la categoría existe
    const [[categoria]] = await defaultDb.execute(
      'SELECT id_categoria, nombre_categoria FROM Categorias_Equipo WHERE id_categoria = ? LIMIT 1',
      [id_categoria]
    )

    if (!categoria) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        detalle: `No existe una categoría con ID ${id_categoria}`
      })
    }

    // Si se está cambiando el nombre, verificar que no exista otra con el mismo nombre
    if (nombre_categoria && nombre_categoria.trim() !== categoria.nombre_categoria) {
      const [[existente]] = await defaultDb.execute(
        'SELECT id_categoria FROM Categorias_Equipo WHERE nombre_categoria = ? AND id_categoria != ? LIMIT 1',
        [nombre_categoria.trim(), id_categoria]
      )

      if (existente) {
        return res.status(409).json({
          error: 'Ya existe otra categoría con ese nombre',
          detalle: `La categoría "${nombre_categoria}" ya está registrada`
        })
      }
    }

    // Construir la consulta de actualización dinámicamente
    const updates = []
    const values = []

    if (nombre_categoria !== undefined) {
      updates.push('nombre_categoria = ?')
      values.push(nombre_categoria.trim())
    }

    if (descripcion !== undefined) {
      updates.push('descripcion = ?')
      values.push(descripcion?.trim() || null)
    }

    if (es_componente !== undefined) {
      updates.push('es_componente = ?')
      values.push(es_componente === true || es_componente === 1 || es_componente === '1' ? 1 : 0)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No hay campos para actualizar',
        detalle: 'Debe proporcionar al menos un campo para actualizar'
      })
    }

    values.push(id_categoria)

    await defaultDb.execute(
      `UPDATE Categorias_Equipo SET ${updates.join(', ')} WHERE id_categoria = ?`,
      values
    )

    logger.info(`Categoría actualizada: ID ${id_categoria}`)

    // Obtener la categoría actualizada
    const [[categoriaActualizada]] = await defaultDb.execute(
      'SELECT id_categoria, nombre_categoria, descripcion, es_componente FROM Categorias_Equipo WHERE id_categoria = ? LIMIT 1',
      [id_categoria]
    )

    return res.json({
      message: 'Categoría actualizada correctamente',
      categoria: categoriaActualizada
    })
  } catch (err) {
    logger.error('Error al actualizar categoría', { error: err.message, stack: err.stack, params: req.params, body: req.body })
    
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Ya existe otra categoría con ese nombre',
        detalle: 'El nombre de la categoría debe ser único'
      })
    }

    return res.status(500).json({
      error: 'Error al actualizar categoría',
      detalle: err.message
    })
  }
}

/**
 * Eliminar una categoría de equipo
 */
export async function eliminarCategoria(req, res) {
  try {
    const { id_categoria } = req.params

    if (!id_categoria) {
      return res.status(400).json({
        error: 'ID de categoría es obligatorio',
        detalle: 'Debe proporcionar el id_categoria en la URL'
      })
    }

    // Verificar que la categoría existe
    const [[categoria]] = await defaultDb.execute(
      'SELECT id_categoria, nombre_categoria FROM Categorias_Equipo WHERE id_categoria = ? LIMIT 1',
      [id_categoria]
    )

    if (!categoria) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        detalle: `No existe una categoría con ID ${id_categoria}`
      })
    }

    // Verificar si hay equipos usando esta categoría
    const [[equipos]] = await defaultDb.execute(
      'SELECT COUNT(*) AS total FROM Elementos WHERE id_categoria = ?',
      [id_categoria]
    )

    if (equipos.total > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar la categoría',
        detalle: `Existen ${equipos.total} equipo(s) asociado(s) a esta categoría. Debe reasignar o eliminar los equipos primero.`
      })
    }

    // Eliminar la categoría
    await defaultDb.execute(
      'DELETE FROM Categorias_Equipo WHERE id_categoria = ?',
      [id_categoria]
    )

    logger.info(`Categoría eliminada: ${categoria.nombre_categoria} (ID: ${id_categoria})`)

    return res.json({
      message: 'Categoría eliminada correctamente',
      id_categoria: parseInt(id_categoria)
    })
  } catch (err) {
    logger.error('Error al eliminar categoría', { error: err.message, stack: err.stack, params: req.params })
    
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(409).json({
        error: 'No se puede eliminar la categoría',
        detalle: 'Existen equipos asociados a esta categoría'
      })
    }

    return res.status(500).json({
      error: 'Error al eliminar categoría',
      detalle: err.message
    })
  }
}

/**
 * Registrar inicio de sesión en un equipo (desde app Flutter)
 * Crea un nuevo registro de uso cuando un usuario inicia sesión
 */
export async function registrarInicioUso(req, res) {
  try {
    const { codigo_equipo, nombre_usuario, fecha_hora_inicio, observaciones } = req.body;
    const userId = req.user?.id; // El usuario viene del token JWT

    if (!codigo_equipo) {
      return res.status(400).json({ error: 'El código del equipo es obligatorio' });
    }

    if (!nombre_usuario) {
      return res.status(400).json({ error: 'El nombre del usuario es obligatorio' });
    }

    // Validar que el equipo existe
    const equipo = await obtenerEquipoPorCodigoUtil(defaultDb, codigo_equipo);
    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    // Verificar si el usuario tiene una sesión activa en este equipo
    const [[sesionActiva]] = await defaultDb.execute(
      `SELECT id_historial FROM Historial_Uso_Equipos 
       WHERE codigo_equipo = ? AND id_usuario = ? AND estado = 'En Uso' 
       ORDER BY fecha_hora_inicio DESC LIMIT 1`,
      [codigo_equipo, userId]
    );

    if (sesionActiva) {
      return res.status(409).json({ 
        error: 'Ya existe una sesión activa para este usuario en este equipo',
        id_historial: sesionActiva.id_historial
      });
    }

    // Usar la fecha proporcionada o la fecha actual
    const fechaInicio = fecha_hora_inicio ? new Date(fecha_hora_inicio) : new Date();

    // Verificar si la columna nombre_usuario existe en la tabla
    const [[columnaExiste]] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Historial_Uso_Equipos' 
       AND COLUMN_NAME = 'nombre_usuario'`
    );

    // Insertar nuevo registro de uso (con o sin nombre_usuario según exista la columna)
    let result;
    if (columnaExiste.cnt > 0) {
      // Si la columna existe, incluirla en el INSERT
      [result] = await defaultDb.execute(
        `INSERT INTO Historial_Uso_Equipos 
         (codigo_equipo, id_usuario, nombre_usuario, fecha_hora_inicio, estado, observaciones) 
         VALUES (?, ?, ?, ?, 'En Uso', ?)`,
        [codigo_equipo, userId, nombre_usuario, fechaInicio, observaciones || null]
      );
    } else {
      // Si la columna no existe, insertar sin ella
      [result] = await defaultDb.execute(
        `INSERT INTO Historial_Uso_Equipos 
         (codigo_equipo, id_usuario, fecha_hora_inicio, estado, observaciones) 
         VALUES (?, ?, ?, 'En Uso', ?)`,
        [codigo_equipo, userId, fechaInicio, observaciones || null]
      );
    }

    logger.info('Inicio de uso registrado', {
      id_historial: result.insertId,
      codigo_equipo,
      id_usuario: userId,
      nombre_usuario,
      fecha_hora_inicio: fechaInicio
    });

    return res.status(201).json({
      ok: true,
      id_historial: result.insertId,
      message: 'Inicio de sesión registrado correctamente',
      fecha_hora_inicio: fechaInicio
    });
  } catch (err) {
    logger.error('Error al registrar inicio de uso', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al registrar inicio de uso',
      detalle: err.message
    });
  }
}

/**
 * Registrar cierre de sesión en un equipo (desde app Flutter)
 * Actualiza el registro de uso cuando un usuario cierra sesión
 */
export async function registrarFinUso(req, res) {
  try {
    const { codigo_equipo, fecha_hora_fin, observaciones } = req.body;
    const userId = req.user?.id;

    if (!codigo_equipo) {
      return res.status(400).json({ error: 'El código del equipo es obligatorio' });
    }

    // Buscar la sesión activa más reciente para este usuario y equipo
    const [[sesionActiva]] = await defaultDb.execute(
      `SELECT id_historial, fecha_hora_inicio FROM Historial_Uso_Equipos 
       WHERE codigo_equipo = ? AND id_usuario = ? AND estado = 'En Uso' 
       ORDER BY fecha_hora_inicio DESC LIMIT 1`,
      [codigo_equipo, userId]
    );

    if (!sesionActiva) {
      return res.status(404).json({ 
        error: 'No se encontró una sesión activa para este usuario en este equipo' 
      });
    }

    // Usar la fecha proporcionada o la fecha actual
    const fechaFin = fecha_hora_fin ? new Date(fecha_hora_fin) : new Date();

    // Verificar que la fecha de fin sea posterior a la fecha de inicio
    const fechaInicio = new Date(sesionActiva.fecha_hora_inicio);
    if (fechaFin < fechaInicio) {
      return res.status(400).json({ 
        error: 'La fecha de fin no puede ser anterior a la fecha de inicio' 
      });
    }

    // Actualizar el registro con la fecha de fin
    await defaultDb.execute(
      `UPDATE Historial_Uso_Equipos 
       SET fecha_hora_fin = ?, 
           estado = 'Finalizado',
           observaciones = COALESCE(?, observaciones)
       WHERE id_historial = ?`,
      [fechaFin, observaciones || null, sesionActiva.id_historial]
    );

    // Obtener el registro actualizado con la duración calculada
    const [[registroActualizado]] = await defaultDb.execute(
      `SELECT id_historial, codigo_equipo, id_usuario, fecha_hora_inicio, 
              fecha_hora_fin, estado, duracion_minutos, observaciones
       FROM Historial_Uso_Equipos 
       WHERE id_historial = ?`,
      [sesionActiva.id_historial]
    );

    logger.info('Fin de uso registrado', {
      id_historial: sesionActiva.id_historial,
      codigo_equipo,
      id_usuario: userId,
      fecha_hora_fin: fechaFin,
      duracion_minutos: registroActualizado.duracion_minutos
    });

    return res.json({
      ok: true,
      message: 'Cierre de sesión registrado correctamente',
      historial: registroActualizado
    });
  } catch (err) {
    logger.error('Error al registrar fin de uso', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al registrar fin de uso',
      detalle: err.message
    });
  }
}

/**
 * Consultar historial de uso de equipos
 * Permite filtrar por equipo, usuario, fecha, etc.
 */
export async function consultarHistorialUso(req, res) {
  try {
    const {
      codigo_equipo,
      id_usuario,
      fecha_desde,
      fecha_hasta,
      estado,
      limit = 100,
      offset = 0
    } = req.query;

    const userId = req.user?.id;
    const userRole = req.user?.rol;

    // Verificar si la tabla existe
    try {
      const [[tableExists]] = await defaultDb.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Historial_Uso_Equipos'`
      );
      
      if (!tableExists || tableExists.cnt === 0) {
        logger.warn('Tabla Historial_Uso_Equipos no existe');
        return res.json({
          historial: [],
          total: 0,
          limit: parseInt(limit, 10) || 100,
          offset: parseInt(offset, 10) || 0,
          message: 'La tabla de historial de uso aún no ha sido creada. Ejecuta el script SQL de creación.'
        });
      }
    } catch (tableCheckErr) {
      logger.error('Error al verificar existencia de tabla', { error: tableCheckErr.message });
      // Continuar de todas formas, el error real se mostrará en la consulta
    }

    let query = `
      SELECT 
        hu.id_historial,
        hu.codigo_equipo,
        e.placa AS codigo_inventario,
        e.tipo AS equipo_tipo,
        e.modelo AS equipo_modelo,
        hu.id_usuario,
        u.nombre_usuario,
        u.cedula AS usuario_cedula,
        u.correo AS usuario_correo,
        hu.fecha_hora_inicio,
        hu.fecha_hora_fin,
        hu.estado,
        hu.duracion_minutos,
        hu.observaciones,
        hu.fecha_registro
      FROM Historial_Uso_Equipos hu
      INNER JOIN Elementos e ON hu.codigo_equipo = e.codigo_equipo
      INNER JOIN Usuarios u ON hu.id_usuario = u.id_usuario
      WHERE 1=1
    `;

    const params = [];

    // Si es Aprendiz, solo puede ver su propio historial
    if (userRole === 'Aprendiz') {
      query += ' AND hu.id_usuario = ?';
      params.push(userId);
    }

    // Filtros opcionales
    if (codigo_equipo) {
      const codigoEquipoNum = parseInt(codigo_equipo, 10);
      if (!isNaN(codigoEquipoNum)) {
        query += ' AND hu.codigo_equipo = ?';
        params.push(codigoEquipoNum);
      }
    }

    if (id_usuario && (userRole === 'Administrador' || userRole === 'Instructor')) {
      const idUsuarioNum = parseInt(id_usuario, 10);
      if (!isNaN(idUsuarioNum)) {
        query += ' AND hu.id_usuario = ?';
        params.push(idUsuarioNum);
      }
    }

    if (estado) {
      query += ' AND hu.estado = ?';
      params.push(estado);
    }

    if (fecha_desde) {
      query += ' AND DATE(hu.fecha_hora_inicio) >= ?';
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      query += ' AND DATE(hu.fecha_hora_inicio) <= ?';
      params.push(fecha_hasta);
    }

    // LIMIT y OFFSET deben ser números literales, no parámetros preparados
    const limitNum = parseInt(limit, 10) || 100;
    const offsetNum = parseInt(offset, 10) || 0;
    
    // Validar límites para evitar inyección SQL
    const safeLimit = Math.min(Math.max(limitNum, 1), 1000); // Entre 1 y 1000
    const safeOffset = Math.max(offsetNum, 0); // Mínimo 0
    
    query += ` ORDER BY hu.fecha_hora_inicio DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

    // Validar que los parámetros coincidan con los placeholders (sin contar LIMIT/OFFSET)
    const placeholderCount = (query.match(/\?/g) || []).length;
    if (placeholderCount !== params.length) {
      logger.error('Desajuste de parámetros en consulta', {
        placeholderCount,
        paramsCount: params.length,
        query: query.substring(0, 300),
        params
      });
      return res.status(500).json({
        error: 'Error interno: desajuste de parámetros en la consulta',
        detalle: `Se esperaban ${placeholderCount} parámetros pero se recibieron ${params.length}`
      });
    }

    const [historial] = await defaultDb.execute(query, params);

    // Obtener el total de registros (sin paginación)
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM Historial_Uso_Equipos hu
      WHERE 1=1
    `;
    const countParams = [];

    if (userRole === 'Aprendiz') {
      countQuery += ' AND hu.id_usuario = ?';
      countParams.push(userId);
    }

    if (codigo_equipo) {
      const codigoEquipoNum = parseInt(codigo_equipo, 10);
      if (!isNaN(codigoEquipoNum)) {
        countQuery += ' AND hu.codigo_equipo = ?';
        countParams.push(codigoEquipoNum);
      }
    }

    if (id_usuario && (userRole === 'Administrador' || userRole === 'Instructor')) {
      const idUsuarioNum = parseInt(id_usuario, 10);
      if (!isNaN(idUsuarioNum)) {
        countQuery += ' AND hu.id_usuario = ?';
        countParams.push(idUsuarioNum);
      }
    }

    if (estado) {
      countQuery += ' AND hu.estado = ?';
      countParams.push(estado);
    }

    if (fecha_desde) {
      countQuery += ' AND DATE(hu.fecha_hora_inicio) >= ?';
      countParams.push(fecha_desde);
    }

    if (fecha_hasta) {
      countQuery += ' AND DATE(hu.fecha_hora_inicio) <= ?';
      countParams.push(fecha_hasta);
    }

    const [[{ total }]] = await defaultDb.execute(countQuery, countParams);

    return res.json({
      historial,
      total: total || 0,
      limit: limitNum,
      offset: offsetNum
    });
  } catch (err) {
    logger.error('Error al consultar historial de uso', { 
      error: err.message, 
      stack: err.stack,
      code: err.code,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage
    });
    
    // Si la tabla no existe, retornar un mensaje más claro
    if (err.code === 'ER_NO_SUCH_TABLE' || err.message.includes("doesn't exist") || err.message.includes("Unknown table")) {
      return res.status(404).json({
        error: 'Tabla de historial no encontrada',
        detalle: 'La tabla Historial_Uso_Equipos no existe. Ejecuta el script SQL: BD/historial_uso_equipos.sql',
        historial: [],
        total: 0
      });
    }
    
    return res.status(500).json({
      error: 'Error al consultar historial de uso',
      detalle: err.message,
      code: err.code
    });
  }
}

/**
 * Obtener historial de uso de un equipo específico
 */
export async function obtenerHistorialEquipoUso(req, res) {
  try {
    const { codigo } = req.params;
    const { fecha_desde, fecha_hasta, limit = 50 } = req.query;

    if (!codigo) {
      return res.status(400).json({ error: 'El código del equipo es requerido' });
    }

    // Convertir código a número si es posible, sino buscar por placa
    const codigoNum = parseInt(codigo, 10);
    const buscarPorPlaca = isNaN(codigoNum);

    let query = `
      SELECT 
        hu.id_historial,
        hu.codigo_equipo,
        e.placa AS codigo_inventario,
        e.tipo AS equipo_tipo,
        e.modelo AS equipo_modelo,
        hu.id_usuario,
        u.nombre_usuario,
        u.cedula AS usuario_cedula,
        u.correo AS usuario_correo,
        hu.fecha_hora_inicio,
        hu.fecha_hora_fin,
        hu.estado,
        hu.duracion_minutos,
        hu.observaciones,
        hu.fecha_registro
      FROM Historial_Uso_Equipos hu
      INNER JOIN Elementos e ON hu.codigo_equipo = e.codigo_equipo
      INNER JOIN Usuarios u ON hu.id_usuario = u.id_usuario
      WHERE ${buscarPorPlaca ? 'e.placa = ?' : 'hu.codigo_equipo = ?'}
    `;

    const params = [buscarPorPlaca ? codigo : codigoNum];

    if (fecha_desde) {
      query += ' AND DATE(hu.fecha_hora_inicio) >= ?';
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      query += ' AND DATE(hu.fecha_hora_inicio) <= ?';
      params.push(fecha_hasta);
    }

    // LIMIT debe ser número literal, no parámetro preparado
    const limitNum = parseInt(limit, 10) || 50;
    const safeLimit = Math.min(Math.max(limitNum, 1), 1000); // Entre 1 y 1000
    query += ` ORDER BY hu.fecha_hora_inicio DESC LIMIT ${safeLimit}`;

    const [historial] = await defaultDb.execute(query, params);

    // Obtener información del equipo
    const equipoQuery = buscarPorPlaca
      ? `SELECT codigo_equipo, placa AS codigo_inventario, tipo, modelo, consecutivo
         FROM Elementos
         WHERE placa = ?`
      : `SELECT codigo_equipo, placa AS codigo_inventario, tipo, modelo, consecutivo
         FROM Elementos
         WHERE codigo_equipo = ?`;
    const [[equipo]] = await defaultDb.execute(equipoQuery, [buscarPorPlaca ? codigo : codigoNum]);

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    return res.json({
      equipo,
      historial,
      total: historial.length
    });
  } catch (err) {
    logger.error('Error al obtener historial del equipo', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al obtener historial del equipo',
      detalle: err.message
    });
  }
}

/**
 * Obtener sesiones activas (en uso) de equipos
 */
export async function obtenerSesionesActivas(req, res) {
  try {
    const { codigo_equipo } = req.query;
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    let query = `
      SELECT 
        hu.id_historial,
        hu.codigo_equipo,
        e.placa AS codigo_inventario,
        e.tipo AS equipo_tipo,
        e.modelo AS equipo_modelo,
        hu.id_usuario,
        u.nombre_usuario,
        u.cedula AS usuario_cedula,
        u.correo AS usuario_correo,
        hu.fecha_hora_inicio,
        hu.estado,
        TIMESTAMPDIFF(MINUTE, hu.fecha_hora_inicio, NOW()) AS minutos_transcurridos,
        hu.observaciones
      FROM Historial_Uso_Equipos hu
      INNER JOIN Elementos e ON hu.codigo_equipo = e.codigo_equipo
      INNER JOIN Usuarios u ON hu.id_usuario = u.id_usuario
      WHERE hu.estado = 'En Uso'
    `;

    const params = [];

    // Si es Aprendiz, solo puede ver sus propias sesiones activas
    if (userRole === 'Aprendiz') {
      query += ' AND hu.id_usuario = ?';
      params.push(userId);
    }

    if (codigo_equipo) {
      const codigoEquipoNum = parseInt(codigo_equipo, 10);
      if (!isNaN(codigoEquipoNum)) {
        query += ' AND hu.codigo_equipo = ?';
        params.push(codigoEquipoNum);
      }
    }

    query += ' ORDER BY hu.fecha_hora_inicio DESC';

    const [sesiones] = await defaultDb.execute(query, params);

    return res.json({
      sesiones,
      total: sesiones.length
    });
  } catch (err) {
    logger.error('Error al obtener sesiones activas', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al obtener sesiones activas',
      detalle: err.message
    });
  }
}

/**
 * Registrar uso de equipo desde página externa (público)
 * Recibe: documento, placa, ambiente, imagenes (opcional)
 * No requiere autenticación, pero valida que el usuario y equipo existan
 * 
 * Acciones:
 * 1. Busca el usuario por documento en la base de datos y obtiene todos sus datos
 * 2. Actualiza el ambiente del equipo en el inventario (tabla Elementos)
 * 3. Asigna el equipo al usuario en Responsables_Equipo con los datos oficiales del sistema (no desde la página externa)
 * 4. Registra el uso en Historial_Uso_Equipos
 * 5. Si hay imágenes, las guarda en Imagenes_Equipo asociadas al equipo
 */
export async function registrarUsoEquipoExterno(req, res) {
  const uploadedFiles = []; // Para limpiar archivos en caso de error
  
  try {
    const { placa, ambiente, usuarios } = req.body;
    const files = req.files || (req.file ? [req.file] : []);

    // Log de los datos recibidos para debugging
    logger.info('Datos recibidos en registro externo', {
      placa: placa?.substring(0, 20),
      ambiente: ambiente,
      cantidad_usuarios: usuarios?.length || 0,
      tiene_ambiente: !!ambiente,
      tiene_usuarios: !!usuarios && Array.isArray(usuarios)
    });

    // Validar que el equipo existe por placa
    const [[equipo]] = await defaultDb.execute(
      `SELECT codigo_equipo, placa, tipo, modelo, id_ambiente 
       FROM Elementos 
       WHERE placa = ? LIMIT 1`,
      [placa.trim()]
    );

    if (!equipo) {
      // Eliminar archivos subidos si el equipo no existe
      if (files && files.length > 0) {
        files.forEach((file) => {
          deleteImageFile(file.filename);
        });
      }
      return res.status(404).json({ 
        success: false,
        error: 'Equipo no encontrado',
        message: `No se encontró un equipo con la placa "${placa}"` 
      });
    }

    const codigoEquipo = equipo.codigo_equipo;
    
    // Procesar imágenes si se enviaron
    const imagenesSubidas = [];
    if (files && files.length > 0) {
      try {
        // Renombrar archivos con el codigo_equipo correcto
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const uploadsDir = path.join(__dirname, '../../uploads/equipos');
        
        for (const file of files) {
          if (!file || !file.filename) {
            logger.warn('Archivo inválido en registro externo', { file });
            continue;
          }

          // Generar nuevo nombre con codigo_equipo
          const timestamp = Date.now();
          const ext = path.extname(file.originalname);
          const nameWithoutExt = path.basename(file.originalname, ext);
          const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
          const nuevoFilename = `${timestamp}-${codigoEquipo}-${sanitizedName}${ext}`;
          
          // Renombrar archivo físico
          const oldPath = path.join(uploadsDir, file.filename);
          const newPath = path.join(uploadsDir, nuevoFilename);
          
          if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            file.filename = nuevoFilename;
            uploadedFiles.push(nuevoFilename);
          } else {
            logger.warn('Archivo no encontrado para renombrar', { filename: file.filename });
            continue;
          }

          // Guardar en la base de datos
          const rutaImagen = getImagePath(nuevoFilename);
          const tipoImagen = 'Detalle'; // Por defecto
          const descripcion = `Imagen subida desde registro externo - Placa: ${placa}`;

          const [resultImagen] = await defaultDb.execute(
            `INSERT INTO Imagenes_Equipo 
             (codigo_equipo, ruta_imagen, nombre_archivo, tipo_imagen, descripcion, subida_por, es_principal)
             VALUES (?, ?, ?, ?, ?, NULL, FALSE)`,
            [codigoEquipo, rutaImagen, nuevoFilename, tipoImagen, descripcion]
          );

          imagenesSubidas.push({
            id_imagen_equipo: resultImagen.insertId,
            codigo_equipo: codigoEquipo,
            ruta_imagen: rutaImagen,
            nombre_archivo: nuevoFilename,
            tipo_imagen: tipoImagen,
            descripcion: descripcion,
            es_principal: false,
          });

          logger.info('Imagen guardada desde registro externo', {
            id_imagen: resultImagen.insertId,
            codigo_equipo: codigoEquipo,
            placa: placa,
            filename: nuevoFilename
          });
        }
      } catch (imagenError) {
        logger.error('Error al procesar imágenes en registro externo', {
          error: imagenError.message,
          stack: imagenError.stack,
          codigo_equipo: codigoEquipo
        });
        // Continuar con el proceso aunque haya error en las imágenes
        // Las imágenes ya subidas se mantendrán
      }
    }

    // Buscar ambiente por código
    // Los usuarios pueden enviar:
    // - Solo el número: "101", "102", etc.
    // - Con prefijo: "Ambiente 101", "Ambiente 102", etc. (como se muestra en la interfaz)
    let ambienteId = null;
    let ambienteInfo = null;
    
    if (ambiente) {
      const ambienteTrimmed = ambiente.trim();
      
      // Extraer el número del código si viene con prefijo "Ambiente "
      let codigoBusqueda = ambienteTrimmed;
      if (ambienteTrimmed.toLowerCase().startsWith('ambiente ')) {
        codigoBusqueda = ambienteTrimmed.substring(9).trim(); // Remover "Ambiente "
      }
      
      logger.info('Buscando ambiente', {
        ambiente_recibido: ambienteTrimmed,
        codigo_busqueda: codigoBusqueda
      });
      
      // Intentar buscar primero por codigo_ambiente (lo que los usuarios conocen: "101", "102", etc.)
      const [[amb]] = await defaultDb.execute(
        `SELECT id_ambiente, nombre_ambiente, codigo_ambiente 
         FROM Ambientes 
         WHERE codigo_ambiente = ? OR codigo_ambiente = CAST(? AS UNSIGNED)
         LIMIT 1`,
        [codigoBusqueda, codigoBusqueda]
      );
      
      ambienteInfo = amb || null;
      ambienteId = amb?.id_ambiente || null;

      // Si no se encontró por codigo_ambiente, intentar por nombre_ambiente (ej: "Ambiente 101")
      if (!ambienteId) {
        const [[ambPorNombre]] = await defaultDb.execute(
          `SELECT id_ambiente, nombre_ambiente, codigo_ambiente 
           FROM Ambientes 
           WHERE nombre_ambiente = ? OR nombre_ambiente LIKE ? 
           LIMIT 1`,
          [ambienteTrimmed, `%${codigoBusqueda}%`]
        );
        ambienteInfo = ambPorNombre || null;
        ambienteId = ambPorNombre?.id_ambiente || null;
      }

      // Si aún no se encontró y el código es numérico, intentar por id_ambiente
      if (!ambienteId) {
        const ambienteNumerico = Number.parseInt(codigoBusqueda, 10);
        if (Number.isFinite(ambienteNumerico) && ambienteNumerico > 0) {
          const [[ambPorId]] = await defaultDb.execute(
            `SELECT id_ambiente, nombre_ambiente, codigo_ambiente 
             FROM Ambientes 
             WHERE id_ambiente = ? 
             LIMIT 1`,
            [ambienteNumerico]
          );
          ambienteInfo = ambPorId || null;
          ambienteId = ambPorId?.id_ambiente || null;
        }
      }

      if (!ambienteId) {
        logger.warn('Ambiente no encontrado', {
          ambiente_recibido: ambienteTrimmed,
          codigo_busqueda: codigoBusqueda
        });
        return res.status(404).json({ 
          success: false,
          error: 'Ambiente no encontrado',
          message: `No se encontró un ambiente con el código "${ambiente}". Puedes usar el código numérico (ej: "101", "102") o el nombre completo (ej: "Ambiente 101").` 
        });
      }
      
      logger.info('Ambiente encontrado', {
        id_ambiente: ambienteId,
        codigo_ambiente: ambienteInfo?.codigo_ambiente,
        nombre_ambiente: ambienteInfo?.nombre_ambiente
      });
    }

    // Validar que hay usuarios
    if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Usuarios requeridos',
        message: 'Debe proporcionar al menos un usuario con documento' 
      });
    }

    // Obtener conexión del pool para transacción
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Actualizar el ambiente del equipo en el inventario (una sola vez para todos los usuarios)
      const ambienteAnterior = equipo.id_ambiente ? Number(equipo.id_ambiente) : null;
      const ambienteNuevo = ambienteId ? Number(ambienteId) : null;
      
      logger.info('Verificando actualización de ambiente', {
        codigo_equipo: equipo.codigo_equipo,
        placa: equipo.placa,
        ambiente_anterior: ambienteAnterior,
        ambiente_nuevo: ambienteNuevo,
        ambiente_recibido: ambiente,
        ambienteId_encontrado: ambienteId,
        debe_actualizar: ambienteId && ambienteNuevo !== ambienteAnterior
      });
      
      if (ambienteId && ambienteNuevo !== ambienteAnterior) {
        const [updateResult] = await connection.execute(
          `UPDATE Elementos 
           SET id_ambiente = ? 
           WHERE codigo_equipo = ?`,
          [ambienteId, equipo.codigo_equipo]
        );
        
        logger.info('Ambiente actualizado para equipo', {
          codigo_equipo: equipo.codigo_equipo,
          placa: equipo.placa,
          ambiente_anterior: ambienteAnterior,
          ambiente_nuevo: ambienteNuevo,
          filas_afectadas: updateResult.affectedRows
        });
      }

      // Verificar si las columnas adicionales existen en Responsables_Equipo (una sola vez)
      const [[colFicha]] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Responsables_Equipo' 
         AND COLUMN_NAME = 'ficha'`
      );
      const [[colNombreExterno]] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Responsables_Equipo' 
         AND COLUMN_NAME = 'nombre_externo'`
      );
      const [[colDocumentoExterno]] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Responsables_Equipo' 
         AND COLUMN_NAME = 'documento_externo'`
      );
      const [[colDiasSemana]] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Responsables_Equipo' 
         AND COLUMN_NAME = 'dias_semana'`
      );
      const [[colHoraInicio]] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Responsables_Equipo' 
         AND COLUMN_NAME = 'hora_inicio'`
      );
      const [[colHoraFin]] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Responsables_Equipo' 
         AND COLUMN_NAME = 'hora_fin'`
      );
      const [[columnaNombreUsuario]] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Historial_Uso_Equipos' 
         AND COLUMN_NAME = 'nombre_usuario'`
      );

      const tieneFicha = colFicha.cnt > 0;
      const tieneNombreExterno = colNombreExterno.cnt > 0;
      const tieneDocumentoExterno = colDocumentoExterno.cnt > 0;
      const tieneDiasSemana = colDiasSemana.cnt > 0;
      const tieneHoraInicio = colHoraInicio.cnt > 0;
      const tieneHoraFin = colHoraFin.cnt > 0;
      const tieneNombreUsuarioHistorial = columnaNombreUsuario.cnt > 0;

      // 2. Procesar cada usuario del array
      const resultados = [];
      const errores = [];

      for (const usuarioData of usuarios) {
        const { ficha, documento, dias_semana, hora_inicio, hora_fin } = usuarioData || {};
        const documentoNormalizado = typeof documento === 'string' ? documento.trim() : '';
        const fichaNormalizada = typeof ficha === 'string' && ficha.trim().length > 0 ? ficha.trim() : null;

        if (!documentoNormalizado) {
          errores.push({
            documento: 'N/A',
            ficha: fichaNormalizada || 'N/A',
            error: 'El documento del usuario es obligatorio'
          });
          continue;
        }

        try {
          // Buscar usuario por documento
          const [[usuarioRow]] = await connection.execute(
            `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, u.telefono,
                    r.nombre_rol, r.id_rol
             FROM Usuarios u
             LEFT JOIN Roles r ON r.id_rol = u.id_rol
             WHERE u.cedula = ? AND u.estado = 'Activo'`,
            [documentoNormalizado]
          );
          const usuario = usuarioRow || null;

          if (!usuario) {
            errores.push({
              documento: documentoNormalizado,
              ficha: fichaNormalizada || 'N/A',
              error: `Usuario no encontrado con documento "${documentoNormalizado}". Debe registrarse primero en SGI-SENA.`
            });
            continue;
          }

          const usuarioDetalle = {
            id_usuario: usuario.id_usuario,
            nombre: usuario.nombre_usuario,
            documento: usuario.cedula,
            correo: usuario.correo,
            telefono: usuario.telefono,
            rol: usuario.nombre_rol
          };

          const nombreUsuario = usuario.nombre_usuario || null;
          documentoOficial = usuarioDetalle.documento || documentoOficial;

          // Verificar si ya existe una asignación activa para este equipo y usuario
          const [[asignacionExistente]] = await connection.execute(
            `SELECT id_responsable FROM Responsables_Equipo 
             WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo' 
             LIMIT 1`,
            [equipo.codigo_equipo, usuario.id_usuario]
          );

          // Preparar datos de horarios
          let diasSemanaJson = null;
          if (dias_semana && Array.isArray(dias_semana) && dias_semana.length > 0) {
            diasSemanaJson = JSON.stringify(dias_semana);
          }

          // Convertir horas de string a TIME (formato HH:MM:SS)
          let horaInicioTime = null;
          let horaFinTime = null;
          if (hora_inicio) {
            const horaInicioParts = hora_inicio.split(':');
            if (horaInicioParts.length === 2) {
              horaInicioTime = `${horaInicioParts[0].padStart(2, '0')}:${horaInicioParts[1].padStart(2, '0')}:00`;
            } else {
              horaInicioTime = hora_inicio;
            }
          }
          if (hora_fin) {
            const horaFinParts = hora_fin.split(':');
            if (horaFinParts.length === 2) {
              horaFinTime = `${horaFinParts[0].padStart(2, '0')}:${horaFinParts[1].padStart(2, '0')}:00`;
            } else {
              horaFinTime = hora_fin;
            }
          }

          // Validar conflictos de horario: no puede haber dos usuarios con el mismo equipo
          if (diasSemanaJson && horaInicioTime && horaFinTime) {
            let conflictQuery = `
              SELECT 
                re.id_responsable,
                re.id_usuario,
                COALESCE(u.nombre_usuario, re.nombre_externo) AS nombre_usuario,
                COALESCE(u.cedula, re.documento_externo) AS cedula,
                re.dias_semana,
                re.hora_inicio,
                re.hora_fin
              FROM Responsables_Equipo re
              LEFT JOIN Usuarios u ON re.id_usuario = u.id_usuario
              WHERE re.codigo_equipo = ?
                AND re.estado_responsabilidad = 'Activo'
                AND re.dias_semana IS NOT NULL
                AND re.hora_inicio IS NOT NULL
                AND re.hora_fin IS NOT NULL
            `;

            const conflictParams = [equipo.codigo_equipo];

            if (asignacionExistente) {
              conflictQuery += ` AND re.id_responsable != ?`;
              conflictParams.push(asignacionExistente.id_responsable);
            }

            conflictQuery += ` AND JSON_OVERLAPS(re.dias_semana, ?)`;
            conflictParams.push(diasSemanaJson);

            conflictQuery += ` AND (
              (re.hora_inicio < ? AND re.hora_fin > ?) OR
              (re.hora_inicio < ? AND re.hora_fin >= ?) OR
              (re.hora_inicio >= ? AND re.hora_fin <= ?)
            )`;
            conflictParams.push(
              horaFinTime, horaInicioTime,
              horaFinTime, horaInicioTime,
              horaInicioTime, horaFinTime
            );

            const [conflictos] = await connection.execute(conflictQuery, conflictParams);

            if (conflictos.length > 0) {
              const conflicto = conflictos[0];
              let diasConflicto = [];
              try {
                if (typeof conflicto.dias_semana === 'string') {
                  diasConflicto = JSON.parse(conflicto.dias_semana);
                } else if (Array.isArray(conflicto.dias_semana)) {
                  diasConflicto = conflicto.dias_semana;
                }
              } catch (e) {}

              errores.push({
                documento: documentoOficial,
                nombre: nombreUsuario,
                ficha: fichaNormalizada || 'N/A',
                error: `Conflicto de horario: Ya existe otro usuario (${conflicto.nombre_usuario || 'Sin nombre'}, ${conflicto.cedula || 'Sin documento'}) asignado a este equipo en los días ${Array.isArray(diasConflicto) ? diasConflicto.join(', ') : 'N/A'} de ${conflicto.hora_inicio ? conflicto.hora_inicio.substring(0, 5) : 'N/A'} a ${conflicto.hora_fin ? conflicto.hora_fin.substring(0, 5) : 'N/A'}`,
                conflicto_con: {
                  id_usuario: conflicto.id_usuario,
                  nombre: conflicto.nombre_usuario,
                  documento: conflicto.cedula,
                  dias: diasConflicto,
                  horario: `${conflicto.hora_inicio ? conflicto.hora_inicio.substring(0, 5) : ''} - ${conflicto.hora_fin ? conflicto.hora_fin.substring(0, 5) : ''}`
                }
              });

              logger.warn('Conflicto de horario detectado', {
                codigo_equipo: equipo.codigo_equipo,
                usuario_nuevo: {
                  documento: documentoOficial,
                  nombre: nombreUsuario,
                  dias: dias_semana,
                  horario: `${horaInicioTime} - ${horaFinTime}`
                },
                conflicto_con: {
                  id_usuario: conflicto.id_usuario,
                  nombre: conflicto.nombre_usuario,
                  documento: conflicto.cedula,
                  dias: diasConflicto,
                  horario: `${conflicto.hora_inicio} - ${conflicto.hora_fin}`
                }
              });

              continue;
            }
          }

          const observacionesPartes = [
            `Nombre: ${nombreUsuario || 'N/A'}`,
            `Documento: ${documentoOficial}`
          ];
          if (fichaNormalizada) {
            observacionesPartes.unshift(`Ficha: ${fichaNormalizada}`);
          }
          const observaciones = observacionesPartes.join(', ');

          if (!asignacionExistente) {
            let campos = ['codigo_equipo', 'id_usuario', 'tipo_responsabilidad', 'observaciones', 'fecha_asignacion'];
            let valores = [equipo.codigo_equipo, usuario.id_usuario, 'Principal', observaciones];
            let placeholders = ['?', '?', '?', '?', 'NOW()'];

            if (tieneFicha) {
              campos.push('ficha');
              valores.push(fichaNormalizada);
              placeholders.push('?');
            }
            if (tieneNombreExterno && nombreUsuario) {
              campos.push('nombre_externo');
              valores.push(nombreUsuario.trim());
              placeholders.push('?');
            }
            if (tieneDocumentoExterno) {
              campos.push('documento_externo');
              valores.push(documentoOficial);
              placeholders.push('?');
            }
            if (tieneDiasSemana && diasSemanaJson) {
              campos.push('dias_semana');
              valores.push(diasSemanaJson);
              placeholders.push('?');
            }
            if (tieneHoraInicio && horaInicioTime) {
              campos.push('hora_inicio');
              valores.push(horaInicioTime);
              placeholders.push('?');
            }
            if (tieneHoraFin && horaFinTime) {
              campos.push('hora_fin');
              valores.push(horaFinTime);
              placeholders.push('?');
            }

            const [resultAsignacion] = await connection.execute(
              `INSERT INTO Responsables_Equipo (${campos.join(', ')}) 
               VALUES (${placeholders.join(', ')})`,
              valores
            );

            logger.info('Equipo asignado al usuario desde página externa', {
              id_responsable: resultAsignacion.insertId,
              codigo_equipo: equipo.codigo_equipo,
              id_usuario: usuario.id_usuario,
              ficha: fichaNormalizada,
              nombre: nombreUsuario,
              documento: documentoOficial
            });
          } else {
            let updates = [];
            let valoresUpdate = [];

            if (tieneFicha) {
              updates.push('ficha = ?');
              valoresUpdate.push(fichaNormalizada);
            }
            if (tieneNombreExterno && nombreUsuario) {
              updates.push('nombre_externo = ?');
              valoresUpdate.push(nombreUsuario.trim());
            }
            if (tieneDocumentoExterno) {
              updates.push('documento_externo = ?');
              valoresUpdate.push(documentoOficial);
            }
            if (tieneDiasSemana) {
              updates.push('dias_semana = ?');
              valoresUpdate.push(diasSemanaJson);
            }
            if (tieneHoraInicio) {
              updates.push('hora_inicio = ?');
              valoresUpdate.push(horaInicioTime);
            }
            if (tieneHoraFin) {
              updates.push('hora_fin = ?');
              valoresUpdate.push(horaFinTime);
            }

            updates.push('observaciones = ?');
            valoresUpdate.push(observaciones);

            if (updates.length > 0) {
              valoresUpdate.push(asignacionExistente.id_responsable);
              const [updateResult] = await connection.execute(
                `UPDATE Responsables_Equipo 
                 SET ${updates.join(', ')} 
                 WHERE id_responsable = ?`,
                valoresUpdate
              );

              logger.info('Asignación actualizada desde página externa', {
                id_responsable: asignacionExistente.id_responsable,
                codigo_equipo: equipo.codigo_equipo,
                id_usuario: usuario.id_usuario,
                ficha: fichaNormalizada,
                nombre: nombreUsuario,
                documento: documentoOficial,
                filas_afectadas: updateResult.affectedRows,
                campos_actualizados: updates.length
              });
            } else {
              logger.warn('No se actualizó la asignación - no hay campos para actualizar', {
                id_responsable: asignacionExistente.id_responsable,
                codigo_equipo: equipo.codigo_equipo,
                id_usuario: usuario.id_usuario
              });
            }
          }

          const [[sesionActiva]] = await connection.execute(
            `SELECT id_historial FROM Historial_Uso_Equipos 
             WHERE codigo_equipo = ? AND id_usuario = ? AND estado = 'En Uso' 
             ORDER BY fecha_hora_inicio DESC LIMIT 1`,
            [equipo.codigo_equipo, usuario.id_usuario]
          );

          if (sesionActiva) {
            logger.info('Sesión activa existente - actualizando asignación con nuevos datos', {
              id_historial: sesionActiva.id_historial,
              codigo_equipo: equipo.codigo_equipo,
              id_usuario: usuario.id_usuario,
              documento: documentoOficial,
              tiene_asignacion: !!asignacionExistente
            });

            resultados.push({
              id_historial: sesionActiva.id_historial,
              usuario: usuarioDetalle,
              nombre: usuarioDetalle.nombre,
              documento: documentoOficial,
              correo: usuarioDetalle.correo,
              telefono: usuarioDetalle.telefono,
              rol: usuarioDetalle.rol,
              ficha: fichaNormalizada,
              fecha_hora_inicio: new Date(),
              dias_semana: diasSemanaJson ? (typeof diasSemanaJson === 'string' ? JSON.parse(diasSemanaJson) : diasSemanaJson) : null,
              hora_inicio: horaInicioTime,
              hora_fin: horaFinTime,
              sesion_existente: true
            });

            continue;
          }

          const observacionesHistorial = fichaNormalizada
            ? `Ficha: ${fichaNormalizada}, Documento: ${documentoOficial}`
            : `Documento: ${documentoOficial}`;
          const fechaInicio = new Date();
          let resultHistorial;

          try {
            if (tieneNombreUsuarioHistorial) {
              [resultHistorial] = await connection.execute(
                `INSERT INTO Historial_Uso_Equipos 
                 (codigo_equipo, id_usuario, nombre_usuario, fecha_hora_inicio, estado, observaciones) 
                 VALUES (?, ?, ?, ?, 'En Uso', ?)`,
                [equipo.codigo_equipo, usuario.id_usuario, nombreUsuario || 'N/A', fechaInicio, observacionesHistorial]
              );
            } else {
              [resultHistorial] = await connection.execute(
                `INSERT INTO Historial_Uso_Equipos 
                 (codigo_equipo, id_usuario, fecha_hora_inicio, estado, observaciones) 
                 VALUES (?, ?, ?, 'En Uso', ?)`,
                [equipo.codigo_equipo, usuario.id_usuario, fechaInicio, observacionesHistorial]
              );
            }

            logger.info('Historial de uso creado exitosamente', {
              id_historial: resultHistorial.insertId,
              codigo_equipo: equipo.codigo_equipo,
              id_usuario: usuario.id_usuario
            });
          } catch (historialError) {
            logger.error('Error al crear historial de uso', {
              error: historialError.message,
              stack: historialError.stack,
              codigo_equipo: equipo.codigo_equipo,
              id_usuario: usuario.id_usuario
            });
            throw historialError;
          }

          let diasSemanaParsed = null;
          if (diasSemanaJson) {
            try {
              diasSemanaParsed = typeof diasSemanaJson === 'string' ? JSON.parse(diasSemanaJson) : diasSemanaJson;
            } catch (e) {
              logger.warn('Error al parsear diasSemanaJson en resultados', { error: e.message });
              diasSemanaParsed = null;
            }
          }

          resultados.push({
            id_historial: resultHistorial.insertId,
            usuario: usuarioDetalle,
            nombre: usuarioDetalle.nombre,
            documento: documentoOficial,
            correo: usuarioDetalle.correo,
            telefono: usuarioDetalle.telefono,
            rol: usuarioDetalle.rol,
            ficha: fichaNormalizada,
            fecha_hora_inicio: fechaInicio,
            dias_semana: diasSemanaParsed,
            hora_inicio: horaInicioTime,
            hora_fin: horaFinTime
          });

          logger.info('Uso de equipo registrado para usuario', {
            id_historial: resultHistorial.insertId,
            codigo_equipo: equipo.codigo_equipo,
            id_usuario: usuario.id_usuario,
            documento: documentoOficial,
            nombre: nombreUsuario,
            ficha: fichaNormalizada
          });

        } catch (usuarioError) {
          logger.error('Error al procesar usuario', {
            error: usuarioError.message,
            stack: usuarioError.stack,
            documento: documentoOficial,
            ficha: fichaNormalizada
          });
          errores.push({
            documento: documentoOficial || 'N/A',
            ficha: fichaNormalizada || 'N/A',
            error: usuarioError.message || 'Error al procesar usuario'
          });
        }
      }

      // Si no se procesó ningún usuario exitosamente, hacer rollback
      if (resultados.length === 0 && errores.length > 0) {
        logger.warn('No se procesó ningún usuario exitosamente', {
          codigo_equipo: equipo.codigo_equipo,
          cantidad_errores: errores.length,
          errores: errores
        });
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          error: 'No se pudo procesar ningún usuario',
          message: 'Todos los usuarios tuvieron errores',
          errores: errores
        });
      }
      
      // Log antes de commit para verificar estado
      logger.info('Estado antes de commit', {
        codigo_equipo: equipo.codigo_equipo,
        resultados_count: resultados.length,
        errores_count: errores.length
      });

      // Confirmar transacción
      await connection.commit();

      logger.info('Registro de múltiples usuarios completado', {
        codigo_equipo: equipo.codigo_equipo,
        placa: equipo.placa,
        usuarios_procesados: resultados.length,
        usuarios_con_error: errores.length,
        ambiente_id: ambienteId
      });

      connection.release();

      return res.status(201).json({
        success: true,
        message: resultados.length > 0 
          ? `${resultados.length} usuario(s) registrado(s) correctamente${errores.length > 0 ? `, ${errores.length} con errores` : ''}${imagenesSubidas.length > 0 ? `, ${imagenesSubidas.length} imagen(es) guardada(s)` : ''}`
          : 'Procesamiento completado con errores',
        data: {
          codigo_equipo: equipo.codigo_equipo,
          placa: equipo.placa,
          tipo: equipo.tipo,
          modelo: equipo.modelo,
          ambiente: ambienteInfo ? {
            id: ambienteInfo.id_ambiente,
            nombre: ambienteInfo.nombre_ambiente,
            codigo: ambienteInfo.codigo_ambiente
          } : null,
          usuarios_procesados: resultados.length,
          usuarios: resultados,
          imagenes_subidas: imagenesSubidas.length > 0 ? imagenesSubidas : undefined,
          errores: errores.length > 0 ? errores : undefined
        }
      });
    } catch (transactionError) {
      await connection.rollback();
      connection.release();
      throw transactionError;
    }
  } catch (err) {
    // Limpiar archivos subidos en caso de error
    if (uploadedFiles.length > 0) {
      uploadedFiles.forEach((filename) => {
        deleteImageFile(filename);
      });
    }
    
    logger.error('Error al registrar uso de equipo externo', { 
      error: err.message, 
      stack: err.stack,
      body: req.body 
    });
    return res.status(500).json({
      success: false,
      error: 'Error al registrar el uso del equipo',
      message: 'Ocurrió un error interno. Por favor intenta nuevamente más tarde.',
      detalle: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}