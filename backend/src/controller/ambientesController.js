import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';

/**
 * Listar todos los ambientes con filtros opcionales
 */
export async function listarAmbientes(req, res) {
  try {
    const { estado_ambiente, tipo_ambiente, edificio, piso } = req.query;

    let query = `
      SELECT 
        a.id_ambiente,
        a.codigo_ambiente,
        a.nombre_ambiente,
        a.tipo_ambiente,
        a.capacidad_personas,
        a.piso,
        a.edificio,
        a.descripcion,
        a.estado_ambiente,
        a.fecha_creacion,
        COUNT(DISTINCT e.codigo_equipo) AS total_equipos,
        COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'Disponible' THEN e.codigo_equipo END) AS equipos_disponibles
      FROM Ambientes a
      LEFT JOIN Elementos e ON a.id_ambiente = e.id_ambiente
      LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
      WHERE 1=1
    `;

    const params = [];

    if (estado_ambiente) {
      query += ' AND a.estado_ambiente = ?';
      params.push(estado_ambiente);
    }

    if (tipo_ambiente) {
      query += ' AND a.tipo_ambiente = ?';
      params.push(tipo_ambiente);
    }

    if (edificio) {
      query += ' AND a.edificio = ?';
      params.push(edificio);
    }

    if (piso) {
      query += ' AND a.piso = ?';
      params.push(piso);
    }

    query += ' GROUP BY a.id_ambiente ORDER BY a.codigo_ambiente ASC';

    const [rows] = await defaultDb.execute(query, params);
    return res.json(rows);
  } catch (err) {
    logger.error('Error al listar ambientes', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al listar ambientes', detalle: err.message });
  }
}

/**
 * Obtener un ambiente específico por ID
 */
export async function obtenerAmbiente(req, res) {
  try {
    const { id } = req.params;

    const [[ambiente]] = await defaultDb.execute(
      `SELECT 
        a.*,
        COUNT(DISTINCT e.codigo_equipo) AS total_equipos,
        COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'Disponible' THEN e.codigo_equipo END) AS equipos_disponibles,
        COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'En Uso' THEN e.codigo_equipo END) AS equipos_en_uso,
        COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'En Mantenimiento' THEN e.codigo_equipo END) AS equipos_en_mantenimiento
       FROM Ambientes a
       LEFT JOIN Elementos e ON a.id_ambiente = e.id_ambiente
       LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
       WHERE a.id_ambiente = ?
       GROUP BY a.id_ambiente`,
      [id]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    // Obtener equipos del ambiente
    const [equipos] = await defaultDb.execute(
      `SELECT 
        e.codigo_equipo,
        e.codigo_inventario,
        e.tipo,
        e.marca,
        e.modelo,
        e.numero_serie,
        ee.estado_operativo,
        e.estado_fisico
       FROM Elementos e
       LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
       WHERE e.id_ambiente = ?
       ORDER BY e.tipo, e.marca, e.modelo`,
      [id]
    );

    // Obtener responsables actuales del ambiente (si hay clases activas)
    const [responsables] = await defaultDb.execute(
      `SELECT 
        ra.id_responsabilidad_ambiente,
        ra.id_usuario,
        u.nombre_usuario,
        r.nombre_rol,
        ra.tipo_responsabilidad,
        ra.fecha_inicio,
        ra.fecha_fin,
        c.nombre_clase,
        c.id_clase
       FROM Responsabilidades_Ambiente ra
       INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
       LEFT JOIN Roles r ON u.id_rol = r.id_rol
       LEFT JOIN Clases c ON ra.id_clase = c.id_clase
       WHERE ra.id_ambiente = ?
       AND ra.estado_responsabilidad = 'Activa'
       AND ra.fecha_inicio <= NOW()
       AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
       ORDER BY ra.tipo_responsabilidad DESC, ra.fecha_inicio DESC`,
      [id]
    );

    return res.json({
      ...ambiente,
      equipos,
      responsables_actuales: responsables
    });
  } catch (err) {
    logger.error('Error al obtener ambiente', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al obtener el ambiente', detalle: err.message });
  }
}

/**
 * Crear un nuevo ambiente
 */
export async function crearAmbiente(req, res) {
  try {
    const {
      codigo_ambiente,
      nombre_ambiente,
      tipo_ambiente,
      capacidad_personas,
      piso,
      edificio,
      descripcion,
      estado_ambiente = 'Activo'
    } = req.body;

    // Validaciones
    if (!codigo_ambiente || !nombre_ambiente || !tipo_ambiente) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: codigo_ambiente, nombre_ambiente, tipo_ambiente'
      });
    }

    // Validar que el código de ambiente sea único
    const [[codigoExistente]] = await defaultDb.execute(
      'SELECT id_ambiente FROM Ambientes WHERE codigo_ambiente = ? LIMIT 1',
      [codigo_ambiente]
    );

    if (codigoExistente) {
      return res.status(409).json({ error: 'El código de ambiente ya existe' });
    }

    // Validar tipo_ambiente
    const tiposValidos = ['Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega'];
    if (!tiposValidos.includes(tipo_ambiente)) {
      return res.status(400).json({
        error: 'Tipo de ambiente inválido',
        detalle: `Los tipos válidos son: ${tiposValidos.join(', ')}`
      });
    }

    // Validar estado_ambiente
    const estadosValidos = ['Activo', 'Inactivo', 'En Mantenimiento'];
    if (!estadosValidos.includes(estado_ambiente)) {
      return res.status(400).json({
        error: 'Estado de ambiente inválido',
        detalle: `Los estados válidos son: ${estadosValidos.join(', ')}`
      });
    }

    // Insertar el ambiente
    const [result] = await defaultDb.execute(
      `INSERT INTO Ambientes 
       (codigo_ambiente, nombre_ambiente, tipo_ambiente, capacidad_personas, piso, edificio, descripcion, estado_ambiente)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo_ambiente,
        nombre_ambiente,
        tipo_ambiente,
        capacidad_personas || null,
        piso || null,
        edificio || null,
        descripcion || null,
        estado_ambiente
      ]
    );

    return res.status(201).json({
      ok: true,
      id_ambiente: result.insertId,
      message: 'Ambiente creado correctamente',
      ambiente: {
        id_ambiente: result.insertId,
        codigo_ambiente,
        nombre_ambiente,
        tipo_ambiente,
        estado_ambiente
      }
    });
  } catch (err) {
    logger.error('Error al crear ambiente', { error: err.message, stack: err.stack });
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El código de ambiente ya existe' });
    }
    return res.status(500).json({ error: 'Error al crear el ambiente', detalle: err.message });
  }
}

/**
 * Actualizar un ambiente existente
 */
export async function actualizarAmbiente(req, res) {
  try {
    const { id } = req.params;
    const {
      codigo_ambiente,
      nombre_ambiente,
      tipo_ambiente,
      capacidad_personas,
      piso,
      edificio,
      descripcion,
      estado_ambiente
    } = req.body;

    // Validar que el ambiente existe
    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [id]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    // Validar código único si se está cambiando
    if (codigo_ambiente) {
      const [[codigoExistente]] = await defaultDb.execute(
        'SELECT id_ambiente FROM Ambientes WHERE codigo_ambiente = ? AND id_ambiente != ? LIMIT 1',
        [codigo_ambiente, id]
      );

      if (codigoExistente) {
        return res.status(409).json({ error: 'El código de ambiente ya está en uso' });
      }
    }

    // Validar tipo_ambiente si se proporciona
    if (tipo_ambiente) {
      const tiposValidos = ['Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega'];
      if (!tiposValidos.includes(tipo_ambiente)) {
        return res.status(400).json({
          error: 'Tipo de ambiente inválido',
          detalle: `Los tipos válidos son: ${tiposValidos.join(', ')}`
        });
      }
    }

    // Validar estado_ambiente si se proporciona
    if (estado_ambiente) {
      const estadosValidos = ['Activo', 'Inactivo', 'En Mantenimiento'];
      if (!estadosValidos.includes(estado_ambiente)) {
        return res.status(400).json({
          error: 'Estado de ambiente inválido',
          detalle: `Los estados válidos son: ${estadosValidos.join(', ')}`
        });
      }
    }

    // Construir query de actualización
    const allowed = [
      'codigo_ambiente',
      'nombre_ambiente',
      'tipo_ambiente',
      'capacidad_personas',
      'piso',
      'edificio',
      'descripcion',
      'estado_ambiente'
    ];

    const sets = [];
    const params = [];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        sets.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Sin cambios para actualizar' });
    }

    params.push(id);
    const query = `UPDATE Ambientes SET ${sets.join(', ')} WHERE id_ambiente = ?`;
    const [result] = await defaultDb.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    return res.json({ ok: true, message: 'Ambiente actualizado correctamente' });
  } catch (err) {
    logger.error('Error al actualizar ambiente', { error: err.message, stack: err.stack });
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El código de ambiente ya está en uso' });
    }
    return res.status(500).json({ error: 'Error al actualizar el ambiente', detalle: err.message });
  }
}

/**
 * Eliminar un ambiente (solo si no tiene equipos asignados)
 */
export async function eliminarAmbiente(req, res) {
  try {
    const { id } = req.params;

    // Validar que el ambiente existe
    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente, codigo_ambiente, nombre_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [id]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    // Verificar si tiene equipos asignados
    const [[equiposCount]] = await defaultDb.execute(
      'SELECT COUNT(*) AS total FROM Elementos WHERE id_ambiente = ?',
      [id]
    );

    if (equiposCount.total > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar el ambiente',
        detalle: `El ambiente tiene ${equiposCount.total} equipo(s) asignado(s). Debe mover o eliminar los equipos primero.`
      });
    }

    // Verificar si tiene clases programadas o en curso
    const [[clasesCount]] = await defaultDb.execute(
      `SELECT COUNT(*) AS total FROM Clases 
       WHERE id_ambiente = ? 
       AND estado_clase IN ('Programada', 'En Curso')`,
      [id]
    );

    if (clasesCount.total > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar el ambiente',
        detalle: `El ambiente tiene ${clasesCount.total} clase(s) programada(s) o en curso. Debe cancelar o finalizar las clases primero.`
      });
    }

    // Eliminar el ambiente
    const [result] = await defaultDb.execute(
      'DELETE FROM Ambientes WHERE id_ambiente = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    return res.json({
      ok: true,
      message: 'Ambiente eliminado correctamente'
    });
  } catch (err) {
    logger.error('Error al eliminar ambiente', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al eliminar el ambiente', detalle: err.message });
  }
}

/**
 * Listar ambientes activos (versión simplificada para formularios)
 */
export async function listarAmbientesActivos(req, res) {
  try {
    const [rows] = await defaultDb.execute(
      'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE estado_ambiente = "Activo" ORDER BY codigo_ambiente ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ambientes', detalle: err.message });
  }
}

/**
 * Asignar ambiente a instructor (asignación permanente)
 * Solo Administrador puede asignar ambientes
 */
export async function asignarAmbienteInstructor(req, res) {
  try {
    const { id_ambiente, id_instructor, jornada, observaciones } = req.body;
    const asignadoPor = req.user?.id;

    if (!id_ambiente || !id_instructor || !jornada) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: id_ambiente, id_instructor, jornada'
      });
    }

    // Validar jornada
    const jornadasValidas = ['Mañana', 'Tarde', 'Noche'];
    if (!jornadasValidas.includes(jornada)) {
      return res.status(400).json({
        error: 'Jornada inválida',
        detalle: `La jornada debe ser una de: ${jornadasValidas.join(', ')}`
      });
    }

    // Validar que el ambiente existe
    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [id_ambiente]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    // Validar que el usuario es instructor
    const [[instructor]] = await defaultDb.execute(
      `SELECT u.id_usuario, u.nombre_usuario, r.nombre_rol
       FROM Usuarios u
       INNER JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ? AND u.estado = 'Activo' AND r.nombre_rol = 'Instructor'`,
      [id_instructor]
    );

    if (!instructor) {
      return res.status(404).json({
        error: 'Instructor no encontrado',
        detalle: 'El usuario debe ser un Instructor activo'
      });
    }

    // Verificar si ya existe una asignación permanente activa para este instructor en esta jornada
    // Permitimos múltiples instructores en la misma jornada, pero no duplicados del mismo instructor
    const [[asignacionExistente]] = await defaultDb.execute(
      `SELECT id_responsabilidad_ambiente
       FROM Responsabilidades_Ambiente
       WHERE id_ambiente = ?
         AND id_usuario = ?
         AND jornada = ?
         AND id_clase IS NULL
         AND estado_responsabilidad = 'Activa'
         AND (fecha_fin IS NULL OR fecha_fin >= NOW())`,
      [id_ambiente, id_instructor, jornada]
    );

    if (asignacionExistente) {
      return res.status(409).json({
        error: 'Asignación existente',
        detalle: 'Este instructor ya está asignado a este ambiente en la jornada ' + jornada
      });
    }

    // Crear nueva asignación permanente (id_clase = NULL indica asignación permanente)
    const [result] = await defaultDb.execute(
      `INSERT INTO Responsabilidades_Ambiente
       (id_ambiente, id_clase, jornada, id_usuario, tipo_responsabilidad, fecha_inicio, fecha_fin, estado_responsabilidad, observaciones, creado_por)
       VALUES (?, NULL, ?, ?, 'Principal', NOW(), NULL, 'Activa', ?, ?)`,
      [id_ambiente, jornada, id_instructor, observaciones || null, asignadoPor]
    );

    return res.status(201).json({
      ok: true,
      id: result.insertId,
      message: `Ambiente "${ambiente.nombre_ambiente}" asignado correctamente a ${instructor.nombre_usuario} en jornada ${jornada}`,
      asignacion: {
        id_responsabilidad: result.insertId,
        ambiente: ambiente.nombre_ambiente,
        instructor: instructor.nombre_usuario,
        jornada: jornada
      }
    });
  } catch (err) {
    logger.error('Error al asignar ambiente a instructor', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al asignar ambiente',
      detalle: err.message
    });
  }
}

/**
 * Desasignar ambiente de instructor (finalizar asignación permanente)
 */
export async function desasignarAmbienteInstructor(req, res) {
  try {
    const { id_responsabilidad } = req.params;

    // Validar que la asignación existe y es permanente
    const [[asignacion]] = await defaultDb.execute(
      `SELECT ra.id_responsabilidad_ambiente, ra.id_ambiente, ra.id_usuario,
              a.nombre_ambiente, u.nombre_usuario AS instructor_nombre
       FROM Responsabilidades_Ambiente ra
       INNER JOIN Ambientes a ON ra.id_ambiente = a.id_ambiente
       INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
       WHERE ra.id_responsabilidad_ambiente = ?
         AND ra.id_clase IS NULL
         AND ra.estado_responsabilidad = 'Activa'`,
      [id_responsabilidad]
    );

    if (!asignacion) {
      return res.status(404).json({
        error: 'Asignación no encontrada',
        detalle: 'La asignación no existe o no es una asignación permanente activa'
      });
    }

    // Finalizar la asignación
    await defaultDb.execute(
      `UPDATE Responsabilidades_Ambiente
       SET estado_responsabilidad = 'Finalizada',
           fecha_fin = NOW()
       WHERE id_responsabilidad_ambiente = ?`,
      [id_responsabilidad]
    );

    return res.json({
      ok: true,
      message: `Asignación del ambiente "${asignacion.nombre_ambiente}" a ${asignacion.instructor_nombre} finalizada correctamente`
    });
  } catch (err) {
    logger.error('Error al desasignar ambiente', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al desasignar ambiente',
      detalle: err.message
    });
  }
}

/**
 * Listar asignaciones permanentes de ambientes a instructores
 */
export async function listarAsignacionesAmbientes(req, res) {
  try {
    const { id_ambiente, id_instructor } = req.query;

    let query = `
      SELECT 
        ra.id_responsabilidad_ambiente,
        ra.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        a.tipo_ambiente,
        ra.jornada,
        ra.id_usuario,
        u.nombre_usuario AS instructor_nombre,
        u.cedula AS instructor_cedula,
        ra.tipo_responsabilidad,
        ra.fecha_inicio,
        ra.fecha_fin,
        ra.estado_responsabilidad,
        ra.observaciones,
        COUNT(DISTINCT e.codigo_equipo) AS total_equipos,
        u_asignador.nombre_usuario AS asignado_por_nombre
      FROM Responsabilidades_Ambiente ra
      INNER JOIN Ambientes a ON ra.id_ambiente = a.id_ambiente
      INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
      LEFT JOIN Usuarios u_asignador ON ra.creado_por = u_asignador.id_usuario
      LEFT JOIN Elementos e ON a.id_ambiente = e.id_ambiente
      WHERE ra.id_clase IS NULL
    `;

    const params = [];

    if (id_ambiente) {
      query += ' AND ra.id_ambiente = ?';
      params.push(id_ambiente);
    }

    if (id_instructor) {
      query += ' AND ra.id_usuario = ?';
      params.push(id_instructor);
    }

    query += `
      GROUP BY ra.id_responsabilidad_ambiente
      ORDER BY ra.fecha_inicio DESC, a.nombre_ambiente ASC
    `;

    const [rows] = await defaultDb.execute(query, params);
    return res.json(rows);
  } catch (err) {
    logger.error('Error al listar asignaciones de ambientes', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al listar asignaciones',
      detalle: err.message
    });
  }
}

