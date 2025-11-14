import defaultDb from '../config/dbconfig.js';
import { notifyNuevoEquipo } from '../services/notificationService.js';

// Listar ambientes para el formulario
export async function listarAmbientes(req, res) {
  try {
    const [rows] = await defaultDb.execute(
      'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE estado_ambiente = "Activo"'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ambientes', detalle: err.message });
  }
}

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
             a.id_ambiente, a.nombre_ambiente, a.codigo_ambiente
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
