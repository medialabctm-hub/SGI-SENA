import defaultDb from '../config/dbconfig.js';
import { notifyNuevoEquipo } from '../services/notificationService.js';

// Esta función se movió a ambientesController.js
// Se mantiene aquí solo para compatibilidad temporal si hay referencias
// TODO: Eliminar esta función y usar la de ambientesController

export async function listarEquipos(req, res) {
  try {
    const query = `
      SELECT e.codigo_equipo, e.codigo_inventario, e.tipo, e.marca, e.modelo, e.numero_serie, e.descripcion,
             e.fecha_adquisicion, e.costo, e.vida_util_meses, e.estado_fisico,
             e.incluye_mouse, e.incluye_teclado, e.incluye_monitor, e.incluye_torre,
             e.specs_completas,
             a.id_ambiente, a.nombre_ambiente, a.codigo_ambiente
      FROM Elementos e
      LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
      ORDER BY e.codigo_equipo ASC
    `;
    const [rows] = await defaultDb.execute(query);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Error al listar equipos', detalle: err.message });
  }
}

// Controlador para registrar un nuevo equipo
export async function registrarEquipo(req, res) {
  try {
    const {
      codigo_inventario,
      tipo,
      marca,
      modelo,
      numero_serie,
      descripcion,
      fecha_adquisicion,
      costo,
      vida_util_meses,
      estado_fisico,
      incluye_mouse,
      incluye_teclado,
      incluye_monitor,
      incluye_torre,
      specs_completas,
      id_ambiente,
      ambiente
    } = req.body;

    const codigoInventario = (codigo_inventario ?? req.body.codigo_equipo ?? '').toString().trim();

    // Validación básica
    if (!codigoInventario) {
      return res.status(400).json({ error: 'El código de inventario es obligatorio' });
    }
    if (!tipo || !marca || !modelo || !numero_serie || !estado_fisico || !fecha_adquisicion) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Validar código de inventario único
    const [[codigoExistente]] = await defaultDb.execute(
      'SELECT codigo_equipo FROM Elementos WHERE codigo_inventario = ? LIMIT 1',
      [codigoInventario]
    );
    if (codigoExistente) {
      return res.status(409).json({ error: 'El código de inventario ya está registrado' });
    }

    // Resolver id_categoria a partir del nombre de categoria (tipo)
    const [[categoria]] = await defaultDb.execute(
      'SELECT id_categoria, es_componente FROM Categorias_Equipo WHERE nombre_categoria = ? LIMIT 1',
      [tipo]
    );
    if (!categoria?.id_categoria) {
      return res.status(400).json({ error: 'Categoría inválida', detalle: 'El campo tipo no coincide con una categoría registrada' });
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

    // Insertar en la tabla Elementos (con o sin id_tipo)
    let query;
    let params;
    if (usaIdTipo) {
      query = `INSERT INTO Elementos
        (codigo_inventario, id_categoria, id_tipo, id_ambiente, tipo, marca, modelo, numero_serie, descripcion, fecha_adquisicion, costo, vida_util_meses, estado_fisico, incluye_mouse, incluye_teclado, incluye_monitor, incluye_torre, specs_completas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [
        codigoInventario,
        categoria.id_categoria,
        idTipo,
        ambienteId,
        tipo,
        marca,
        modelo,
        numero_serie,
        descripcion || null,
        fecha_adquisicion,
        costo || null,
        vida_util_meses || null,
        estado_fisico,
        !!incluye_mouse,
        !!incluye_teclado,
        !!incluye_monitor,
        !!incluye_torre,
        specs_completas || null
      ];
    } else {
      query = `INSERT INTO Elementos
        (codigo_inventario, id_categoria, id_ambiente, tipo, marca, modelo, numero_serie, descripcion, fecha_adquisicion, costo, vida_util_meses, estado_fisico, incluye_mouse, incluye_teclado, incluye_monitor, incluye_torre, specs_completas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [
        codigoInventario,
        categoria.id_categoria,
        ambienteId,
        tipo,
        marca,
        modelo,
        numero_serie,
        descripcion || null,
        fecha_adquisicion,
        costo || null,
        vida_util_meses || null,
        estado_fisico,
        !!incluye_mouse,
        !!incluye_teclado,
        !!incluye_monitor,
        !!incluye_torre,
        specs_completas || null
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
          codigo_inventario: codigoInventario,
          ambiente_id: ambienteInfo?.id_ambiente ?? ambienteId,
          ambiente_codigo: ambienteInfo?.codigo_ambiente || null,
        },
      });
      if (notifyResult?.skipped) {
        console.warn('[notificaciones] Tabla Notificaciones no existe; se omitió la alerta de nuevo equipo.');
      }
    } catch (notifyErr) {
      console.error('[notificaciones] Error al generar notificación de nuevo equipo:', notifyErr?.message || notifyErr);
    }

    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'El número de serie ya existe' });
    } else {
      res.status(500).json({ error: 'Error al registrar equipo', detalle: err.message });
    }
  }
}

// Consultar equipo por código
export async function obtenerEquipoPorCodigo(req, res) {
  try {
    const { codigo } = req.params;
    if (!codigo) return res.status(400).json({ error: 'codigo requerido' });

    const queryBase = `
      SELECT e.codigo_equipo, e.codigo_inventario, e.tipo, e.marca, e.modelo, e.numero_serie, e.descripcion,
             e.fecha_adquisicion, e.costo, e.vida_util_meses, e.estado_fisico,
             e.incluye_mouse, e.incluye_teclado, e.incluye_monitor, e.incluye_torre,
             e.specs_completas,
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

    const [[rowInventario]] = await defaultDb.execute(
      `${queryBase} WHERE e.codigo_inventario = ?`,
      [codigo]
    );

    if (rowInventario) {
      return res.json(rowInventario);
    }

    const codigoNumerico = Number.parseInt(codigo, 10);
    if (Number.isFinite(codigoNumerico)) {
      const [[rowId]] = await defaultDb.execute(
        `${queryBase} WHERE e.codigo_equipo = ?`,
        [codigoNumerico]
      );
      if (rowId) return res.json(rowId);
    }

    return res.status(404).json({ error: 'Equipo no encontrado' });
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
        'SELECT codigo_equipo FROM Elementos WHERE codigo_inventario = ? LIMIT 1',
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
      'tipo', 'marca', 'modelo', 'numero_serie', 'descripcion', 'fecha_adquisicion',
      'costo', 'vida_util_meses', 'estado_fisico', 'incluye_mouse', 'incluye_teclado',
      'incluye_monitor', 'incluye_torre', 'specs_completas'
    ];

    const sets = [];
    const params = [];

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
        'SELECT codigo_equipo FROM Elementos WHERE codigo_inventario = ? LIMIT 1',
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
 * Asignar equipo a un usuario
 * Admin: puede asignar a cualquier usuario
 * Instructor: solo puede asignar a Aprendices
 */
export async function asignarEquipo(req, res) {
  try {
    const { codigo_equipo, id_usuario, tipo_responsabilidad = 'Principal', observaciones, dias_asignados } = req.body
    const asignadoPor = req.user?.id
    const userRole = req.user?.rol

    if (!codigo_equipo || !id_usuario) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (codigo_equipo, id_usuario)' })
    }

    // Validar que el equipo existe
    const [[equipo]] = await defaultDb.execute(
      'SELECT codigo_equipo, tipo, marca, modelo FROM Elementos WHERE codigo_equipo = ?',
      [codigo_equipo]
    )

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

    // Si es Instructor, solo puede asignar a Aprendices
    if (userRole === 'Instructor' && usuarioReceptor.nombre_rol !== 'Aprendiz') {
      return res.status(403).json({ 
        error: 'Los instructores solo pueden asignar equipos a aprendices' 
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
        error: `Este equipo está actualmente en mantenimiento (${mantenimientoActivo.tipo_mantenimiento}). No se puede asignar hasta que el mantenimiento finalice.` 
      })
    }

    // Verificar si ya existe una asignación activa para este equipo y usuario
    const [[asignacionExistente]] = await defaultDb.execute(
      `SELECT id_responsable FROM Responsables_Equipo 
       WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
      [codigo_equipo, id_usuario]
    )

    if (asignacionExistente) {
      return res.status(409).json({ 
        error: 'Este equipo ya está asignado a este usuario' 
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

    // Insertar la asignación
    const [result] = await defaultDb.execute(
      `INSERT INTO Responsables_Equipo 
       (codigo_equipo, id_usuario, tipo_responsabilidad, observaciones, asignado_por, fecha_asignacion, fecha_desvinculacion) 
       VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [codigo_equipo, id_usuario, tipo_responsabilidad, observaciones || null, asignadoPor, fechaDesvinculacion]
    )

    return res.status(201).json({ 
      ok: true, 
      id: result.insertId,
      message: `Equipo asignado correctamente a ${usuarioReceptor.nombre_usuario}`,
      equipo: {
        codigo: equipo.codigo_equipo,
        descripcion: `${equipo.tipo} ${equipo.marca} ${equipo.modelo}`.trim()
      }
    })
  } catch (err) {
    console.error('Error al asignar equipo:', err)
    return res.status(500).json({ error: 'Error al asignar el equipo', details: err.message })
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
        e.codigo_inventario,
        e.tipo,
        e.marca,
        e.modelo,
        e.numero_serie,
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
    console.error('Error al obtener equipos asignados:', err)
    return res.status(500).json({ error: 'Error al obtener equipos asignados', details: err.message })
  }
}

/**
 * Listar todas las asignaciones de equipos
 * Admin: ve todas las asignaciones
 * Instructor: ve solo asignaciones de aprendices
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
        e.codigo_inventario,
        e.tipo AS equipo_tipo,
        e.marca AS equipo_marca,
        e.modelo AS equipo_modelo,
        e.numero_serie,
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

    // Si es Instructor, solo ver asignaciones de Aprendices
    if (userRole === 'Instructor') {
      query += ` WHERE r.nombre_rol = 'Aprendiz' AND re.estado_responsabilidad = 'Activo'`
    } else {
      // Admin ve todas las asignaciones activas
      query += ` WHERE re.estado_responsabilidad = 'Activo'`
    }

    query += ` ORDER BY re.fecha_asignacion DESC`

    const [rows] = await defaultDb.execute(query, params)

    return res.json(rows)
  } catch (err) {
    console.error('Error al listar asignaciones:', err)
    return res.status(500).json({ error: 'Error al obtener asignaciones', details: err.message })
  }
}

/**
 * Eliminar/Desactivar una asignación de equipo
 * Solo Administrador e Instructor pueden eliminar asignaciones
 * Instructor solo puede eliminar asignaciones de Aprendices
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
      return res.status(404).json({ error: 'Asignación no encontrada o ya está inactiva' })
    }

    // Si es Instructor, solo puede eliminar asignaciones de Aprendices
    if (userRole === 'Instructor' && asignacion.usuario_rol !== 'Aprendiz') {
      return res.status(403).json({ 
        error: 'Solo puedes eliminar asignaciones de aprendices' 
      })
    }

    // Desactivar la asignación (cambiar estado a 'Finalizado' y establecer fecha_desvinculacion)
    await defaultDb.execute(
      `UPDATE Responsables_Equipo 
       SET estado_responsabilidad = 'Finalizado', 
           fecha_desvinculacion = NOW()
       WHERE id_responsable = ?`,
      [id]
    )

    return res.json({ 
      ok: true,
      message: 'Asignación eliminada correctamente' 
    })
  } catch (err) {
    console.error('Error al eliminar asignación:', err)
    return res.status(500).json({ error: 'Error al eliminar la asignación', details: err.message })
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

    // Determinar jornada actual basada en la hora
    const horaActual = new Date().getHours();
    let jornadaActual = 'Mañana'; // Por defecto
    if (horaActual >= 6 && horaActual < 12) {
      jornadaActual = 'Mañana';
    } else if (horaActual >= 12 && horaActual < 18) {
      jornadaActual = 'Tarde';
    } else {
      jornadaActual = 'Noche';
    }

    // Obtener ambientes donde el instructor tiene responsabilidad activa
    // Incluye tanto asignaciones permanentes (id_clase IS NULL) como temporales (con id_clase)
    // Para permanentes, solo muestra las de la jornada actual
    // Para temporales (clases), verifica que la clase esté dentro del rango de tiempo actual
    const [ambientes] = await defaultDb.execute(
      `SELECT DISTINCT
        ra.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        ra.tipo_responsabilidad,
        ra.fecha_inicio,
        ra.fecha_fin,
        ra.jornada,
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
          (ra.id_clase IS NULL AND ra.jornada = ?)
          OR (
            ra.id_clase IS NOT NULL 
            AND c.estado_clase IN ('Programada', 'En Curso')
            AND c.fecha_clase = CURDATE()
            AND CONCAT(c.fecha_clase, ' ', c.hora_inicio) <= NOW()
            AND CONCAT(c.fecha_clase, ' ', c.hora_fin) >= NOW()
          )
        )
      ORDER BY a.nombre_ambiente`,
      [userId, jornadaActual]
    )

    // Log para debug
    console.log(`[Verificación Inventario] Instructor ${userId}, Jornada: ${jornadaActual}, Ambientes encontrados: ${ambientes.length}`)
    if (ambientes.length > 0) {
      console.log(`[Verificación Inventario] Ambientes:`, ambientes.map(a => ({
        ambiente: a.nombre_ambiente,
        tipo: a.tipo_asignacion,
        estado_clase: a.estado_clase,
        id_clase: a.id_clase
      })))
    }

    if (ambientes.length === 0) {
      return res.json({
        ambientes: [],
        equipos: []
      })
    }

    const ambienteIds = ambientes.map(a => a.id_ambiente)

    // Obtener todos los equipos de esos ambientes
    const [equipos] = await defaultDb.execute(
      `SELECT 
        e.codigo_equipo,
        e.codigo_inventario,
        e.tipo,
        e.marca,
        e.modelo,
        e.numero_serie,
        e.estado_fisico,
        e.descripcion,
        e.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        (SELECT MAX(fecha_verificacion) 
         FROM Verificaciones_Inventario 
         WHERE codigo_equipo = e.codigo_equipo 
         AND id_usuario = ?) AS ultima_verificacion
      FROM Elementos e
      INNER JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
      WHERE e.id_ambiente IN (${ambienteIds.map(() => '?').join(',')})
      ORDER BY a.nombre_ambiente, e.codigo_inventario`,
      [userId, ...ambienteIds]
    )

    return res.json({
      ambientes,
      equipos
    })
  } catch (err) {
    console.error('Error al obtener equipos de ambientes del instructor:', err)
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

    // Determinar jornada actual
    const horaActual = new Date().getHours();
    let jornadaActual = 'Mañana';
    if (horaActual >= 6 && horaActual < 12) {
      jornadaActual = 'Mañana';
    } else if (horaActual >= 12 && horaActual < 18) {
      jornadaActual = 'Tarde';
    } else {
      jornadaActual = 'Noche';
    }

    // Validar que el instructor tiene responsabilidad activa en ese ambiente
    // Incluye tanto asignaciones permanentes como temporales
    // Para permanentes, valida que sea de la jornada actual
    // Obtener información completa de la responsabilidad para el historial
    const [[responsabilidad]] = await defaultDb.execute(
      `SELECT 
        ra.id_responsabilidad_ambiente,
        ra.id_clase,
        ra.jornada,
        c.fecha_clase,
        c.hora_inicio,
        c.hora_fin,
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
           ra.id_clase IS NOT NULL 
           OR (ra.id_clase IS NULL AND ra.jornada = ?)
         )
       ORDER BY ra.fecha_inicio DESC
       LIMIT 1`,
      [equipo.id_ambiente, userId, jornadaActual]
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
    console.error('Error al registrar verificación:', err)
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
        e.codigo_inventario,
        e.tipo AS equipo_tipo,
        e.marca AS equipo_marca,
        e.modelo AS equipo_modelo,
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
    console.error('Error al consultar historial de verificaciones:', err)
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
      `SELECT codigo_equipo, codigo_inventario, tipo, marca, modelo, numero_serie
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
    console.error('Error al obtener historial del equipo:', err)
    return res.status(500).json({
      error: 'Error al obtener historial del equipo',
      details: err.message
    })
  }
}
