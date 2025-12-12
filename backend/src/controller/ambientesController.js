import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';

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

    const [equipos] = await defaultDb.execute(
      `SELECT 
        e.codigo_equipo,
        e.r_centro,
        e.tipo,
        e.placa,
        e.modelo,
        e.consecutivo,
        ee.estado_operativo,
        e.estado_fisico
       FROM Elementos e
       LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
       WHERE e.id_ambiente = ?
       ORDER BY e.tipo, e.placa, e.modelo`,
      [id]
    );

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

    const [imagenes] = await defaultDb.execute(
      `SELECT 
        id_imagen_ambiente,
        ruta_imagen,
        nombre_archivo,
        tipo_imagen,
        descripcion,
        es_principal,
        fecha_subida
       FROM Imagenes_Ambiente
       WHERE id_ambiente = ?
       ORDER BY es_principal DESC, fecha_subida DESC`,
      [id]
    );

    return res.json({
      ...ambiente,
      equipos,
      responsables_actuales: responsables,
      imagenes: imagenes || []
    });
  } catch (err) {
    logger.error('Error al obtener ambiente', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al obtener el ambiente', detalle: err.message });
  }
}

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

    if (!codigo_ambiente || !nombre_ambiente || !tipo_ambiente) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: codigo_ambiente, nombre_ambiente, tipo_ambiente'
      });
    }

    const [[codigoExistente]] = await defaultDb.execute(
      'SELECT id_ambiente FROM Ambientes WHERE codigo_ambiente = ? LIMIT 1',
      [codigo_ambiente]
    );

    if (codigoExistente) {
      return res.status(409).json({ error: 'El código de ambiente ya existe' });
    }

    const tiposValidos = ['Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega'];
    if (!tiposValidos.includes(tipo_ambiente)) {
      return res.status(400).json({
        error: 'Tipo de ambiente inválido',
        detalle: `Los tipos válidos son: ${tiposValidos.join(', ')}`
      });
    }

    const estadosValidos = ['Activo', 'Inactivo', 'En Mantenimiento'];
    if (!estadosValidos.includes(estado_ambiente)) {
      return res.status(400).json({
        error: 'Estado de ambiente inválido',
        detalle: `Los estados válidos son: ${estadosValidos.join(', ')}`
      });
    }

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

    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [id]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    if (codigo_ambiente) {
      const [[codigoExistente]] = await defaultDb.execute(
        'SELECT id_ambiente FROM Ambientes WHERE codigo_ambiente = ? AND id_ambiente != ? LIMIT 1',
        [codigo_ambiente, id]
      );

      if (codigoExistente) {
        return res.status(409).json({ error: 'El código de ambiente ya está en uso' });
      }
    }

    if (tipo_ambiente) {
      const tiposValidos = ['Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega'];
      if (!tiposValidos.includes(tipo_ambiente)) {
        return res.status(400).json({
          error: 'Tipo de ambiente inválido',
          detalle: `Los tipos válidos son: ${tiposValidos.join(', ')}`
        });
      }
    }

    if (estado_ambiente) {
      const estadosValidos = ['Activo', 'Inactivo', 'En Mantenimiento'];
      if (!estadosValidos.includes(estado_ambiente)) {
        return res.status(400).json({
          error: 'Estado de ambiente inválido',
          detalle: `Los estados válidos son: ${estadosValidos.join(', ')}`
        });
      }
    }

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

export async function eliminarAmbiente(req, res) {
  try {
    const { id } = req.params;

    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente, codigo_ambiente, nombre_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [id]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

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

export async function asignarAmbienteInstructor(req, res) {
  try {
    const { id_ambiente, id_instructor, dias_semana, hora_inicio, hora_fin, observaciones } = req.body;
    const asignadoPor = req.user?.id;

    // Validar campos obligatorios
    if (!id_ambiente || !id_instructor) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: id_ambiente, id_instructor'
      });
    }

    // Validar días de la semana
    const diasValidos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    if (!dias_semana || !Array.isArray(dias_semana) || dias_semana.length === 0) {
      return res.status(400).json({
        error: 'Días de la semana inválidos',
        detalle: 'Debe seleccionar al menos un día de la semana'
      });
    }

    const diasInvalidos = dias_semana.filter(dia => !diasValidos.includes(dia));
    if (diasInvalidos.length > 0) {
      return res.status(400).json({
        error: 'Días de la semana inválidos',
        detalle: `Días inválidos: ${diasInvalidos.join(', ')}. Días válidos: ${diasValidos.join(', ')}`
      });
    }

    // Validar horarios
    if (!hora_inicio || !hora_fin) {
      return res.status(400).json({
        error: 'Horarios requeridos',
        detalle: 'Se requieren hora_inicio y hora_fin (formato HH:MM)'
      });
    }

    // Validar formato de hora (HH:MM)
    const horaRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(hora_inicio) || !horaRegex.test(hora_fin)) {
      return res.status(400).json({
        error: 'Formato de hora inválido',
        detalle: 'Las horas deben estar en formato HH:MM (ej: 08:00, 14:30)'
      });
    }

    // Validar que hora_inicio < hora_fin
    const [horaInicioH, horaInicioM] = hora_inicio.split(':').map(Number);
    const [horaFinH, horaFinM] = hora_fin.split(':').map(Number);
    const minutosInicio = horaInicioH * 60 + horaInicioM;
    const minutosFin = horaFinH * 60 + horaFinM;

    if (minutosInicio >= minutosFin) {
      return res.status(400).json({
        error: 'Horario inválido',
        detalle: 'La hora de inicio debe ser menor que la hora de fin'
      });
    }

    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [id_ambiente]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

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

    // Verificar si existe una asignación que se solape (mismo ambiente, instructor, días y horarios)
    const diasSemanaJson = JSON.stringify(dias_semana);
    const horaInicioTime = `${hora_inicio}:00`;
    const horaFinTime = `${hora_fin}:00`;

    const [asignacionesExistentes] = await defaultDb.execute(
      `SELECT id_responsabilidad_ambiente
       FROM Responsabilidades_Ambiente
       WHERE id_ambiente = ?
         AND id_usuario = ?
         AND id_clase IS NULL
         AND estado_responsabilidad = 'Activa'
         AND (fecha_fin IS NULL OR fecha_fin >= NOW())
         AND dias_semana IS NOT NULL
         AND JSON_OVERLAPS(dias_semana, ?)
         AND (
           (hora_inicio <= ? AND hora_fin > ?) OR
           (hora_inicio < ? AND hora_fin >= ?) OR
           (hora_inicio >= ? AND hora_fin <= ?)
         )`,
      [
        id_ambiente,
        id_instructor,
        diasSemanaJson,
        horaInicioTime, horaInicioTime,
        horaFinTime, horaFinTime,
        horaInicioTime, horaFinTime
      ]
    );

    if (asignacionesExistentes.length > 0) {
      return res.status(409).json({
        error: 'Asignación existente',
        detalle: 'Este instructor ya tiene una asignación activa para este ambiente en los días y horarios seleccionados'
      });
    }

    const [result] = await defaultDb.execute(
      `INSERT INTO Responsabilidades_Ambiente
       (id_ambiente, id_clase, jornada, dias_semana, hora_inicio, hora_fin, id_usuario, tipo_responsabilidad, fecha_inicio, fecha_fin, estado_responsabilidad, observaciones, creado_por)
       VALUES (?, NULL, NULL, ?, ?, ?, ?, 'Principal', NOW(), NULL, 'Activa', ?, ?)`,
      [id_ambiente, diasSemanaJson, horaInicioTime, horaFinTime, id_instructor, observaciones || null, asignadoPor]
    );

    return res.status(201).json({
      ok: true,
      id: result.insertId,
      message: `Ambiente "${ambiente.nombre_ambiente}" asignado correctamente a ${instructor.nombre_usuario}`,
      asignacion: {
        id_responsabilidad: result.insertId,
        ambiente: ambiente.nombre_ambiente,
        instructor: instructor.nombre_usuario,
        dias_semana: dias_semana,
        hora_inicio: hora_inicio,
        hora_fin: hora_fin
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

export async function desasignarAmbienteInstructor(req, res) {
  try {
    const { id_responsabilidad } = req.params;

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
        CAST(ra.dias_semana AS CHAR) AS dias_semana,
        ra.hora_inicio,
        ra.hora_fin,
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
    
    // Parsear JSON de dias_semana y formatear horas
    const rowsFormateados = rows.map(row => {
      let diasSemanaParsed = null;
      
      // Manejar diferentes formatos de dias_semana
      if (row.dias_semana) {
        if (Array.isArray(row.dias_semana)) {
          // Ya es un array (puede venir parseado del driver)
          diasSemanaParsed = row.dias_semana;
        } else if (typeof row.dias_semana === 'string') {
          try {
            // Intentar parsear como JSON
            diasSemanaParsed = JSON.parse(row.dias_semana);
          } catch (parseError) {
            // Si falla el parse, intentar como string simple
            logger.warn('Error al parsear dias_semana', { 
              valor: row.dias_semana, 
              error: parseError.message 
            });
            diasSemanaParsed = null;
          }
        }
      }
      
      return {
        ...row,
        dias_semana: diasSemanaParsed,
        hora_inicio: row.hora_inicio ? (typeof row.hora_inicio === 'string' ? row.hora_inicio.substring(0, 5) : row.hora_inicio) : null, // HH:MM
        hora_fin: row.hora_fin ? (typeof row.hora_fin === 'string' ? row.hora_fin.substring(0, 5) : row.hora_fin) : null // HH:MM
      };
    });
    
    return res.json(rowsFormateados);
  } catch (err) {
    logger.error('Error al listar asignaciones de ambientes', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al listar asignaciones',
      detalle: err.message
    });
  }
}

