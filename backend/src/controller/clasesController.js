import defaultDb from '../config/dbconfig.js';

/**
 * Crear una nueva clase/programación
 */
export async function crearClase(req, res) {
  try {
    const {
      id_ambiente,
      id_instructor,
      nombre_clase,
      descripcion,
      fecha_clase,
      hora_inicio,
      hora_fin,
      observaciones,
      participantes = [] // Array de id_aprendiz
    } = req.body;

    const creadoPor = req.user?.id;

    // Validaciones
    if (!id_ambiente || !id_instructor || !fecha_clase || !hora_inicio || !hora_fin) {
      return res.status(400).json({ 
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: id_ambiente, id_instructor, fecha_clase, hora_inicio, hora_fin'
      });
    }

    // Validar que el ambiente existe
    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente, nombre_ambiente FROM Ambientes WHERE id_ambiente = ? AND estado_ambiente = "Activo"',
      [id_ambiente]
    );
    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado o inactivo' });
    }

    // Validar que el instructor existe y es instructor
    const [[instructor]] = await defaultDb.execute(
      `SELECT u.id_usuario, u.nombre_usuario, r.nombre_rol 
       FROM Usuarios u
       INNER JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ? AND u.estado = 'Activo' AND r.nombre_rol = 'Instructor'`,
      [id_instructor]
    );
    if (!instructor) {
      return res.status(404).json({ error: 'Instructor no encontrado o no tiene rol de Instructor' });
    }

    // Validar formato de fecha y hora
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_clase)) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
    }
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora_inicio) || !/^\d{2}:\d{2}(:\d{2})?$/.test(hora_fin)) {
      return res.status(400).json({ error: 'Formato de hora inválido. Use HH:MM o HH:MM:SS' });
    }

    // Validar que hora_fin sea mayor que hora_inicio
    if (hora_fin <= hora_inicio) {
      return res.status(400).json({ error: 'La hora de fin debe ser mayor que la hora de inicio' });
    }

    // Verificar conflictos de horario en el mismo ambiente
    const [clasesConflictivas] = await defaultDb.execute(
      `SELECT id_clase, nombre_clase, hora_inicio, hora_fin 
       FROM Clases 
       WHERE id_ambiente = ? 
       AND fecha_clase = ? 
       AND estado_clase IN ('Programada', 'En Curso')
       AND (
         (hora_inicio <= ? AND hora_fin > ?) OR
         (hora_inicio < ? AND hora_fin >= ?) OR
         (hora_inicio >= ? AND hora_fin <= ?)
       )`,
      [id_ambiente, fecha_clase, hora_inicio, hora_inicio, hora_fin, hora_fin, hora_inicio, hora_fin]
    );

    if (clasesConflictivas.length > 0) {
      return res.status(409).json({ 
        error: 'Conflicto de horario',
        detalle: 'Ya existe una clase programada en este ambiente en el horario especificado',
        clases_conflictivas: clasesConflictivas
      });
    }

    // Insertar la clase
    const [result] = await defaultDb.execute(
      `INSERT INTO Clases 
       (id_ambiente, id_instructor, nombre_clase, descripcion, fecha_clase, hora_inicio, hora_fin, observaciones, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_ambiente, id_instructor, nombre_clase || null, descripcion || null, fecha_clase, hora_inicio, hora_fin, observaciones || null, creadoPor]
    );

    const idClase = result.insertId;

    // Insertar participantes si se proporcionaron
    if (Array.isArray(participantes) && participantes.length > 0) {
      // Validar que todos los participantes sean aprendices
      const placeholders = participantes.map(() => '?').join(',');
      const [aprendices] = await defaultDb.execute(
        `SELECT u.id_usuario 
         FROM Usuarios u
         INNER JOIN Roles r ON u.id_rol = r.id_rol
         WHERE u.id_usuario IN (${placeholders}) 
         AND u.estado = 'Activo' 
         AND r.nombre_rol = 'Aprendiz'`,
        participantes
      );

      const idsAprendicesValidos = aprendices.map(a => a.id_usuario);
      const idsInvalidos = participantes.filter(id => !idsAprendicesValidos.includes(id));

      if (idsInvalidos.length > 0) {
        // Continuar con los válidos, pero registrar el warning
        console.warn(`Algunos participantes no son aprendices válidos: ${idsInvalidos.join(', ')}`);
      }

      // Insertar participantes válidos
      if (idsAprendicesValidos.length > 0) {
        const values = idsAprendicesValidos.map(id => `(${idClase}, ${id})`).join(',');
        await defaultDb.execute(
          `INSERT INTO Participantes_Clase (id_clase, id_aprendiz) VALUES ${values}`
        );
      }
    }

    return res.status(201).json({
      ok: true,
      id_clase: idClase,
      message: 'Clase creada correctamente',
      clase: {
        id_clase: idClase,
        id_ambiente,
        ambiente: ambiente.nombre_ambiente,
        id_instructor,
        instructor: instructor.nombre_usuario,
        nombre_clase,
        fecha_clase,
        hora_inicio,
        hora_fin,
        estado_clase: 'Programada'
      }
    });
  } catch (err) {
    console.error('Error al crear clase:', err);
    return res.status(500).json({ error: 'Error al crear la clase', detalle: err.message });
  }
}

/**
 * Listar clases con filtros opcionales
 */
export async function listarClases(req, res) {
  try {
    const { id_ambiente, id_instructor, fecha, estado_clase } = req.query;

    let query = `
      SELECT 
        c.id_clase,
        c.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        c.id_instructor,
        u_instructor.nombre_usuario AS instructor_nombre,
        c.nombre_clase,
        c.descripcion,
        c.fecha_clase,
        c.hora_inicio,
        c.hora_fin,
        c.estado_clase,
        c.fecha_inicio_real,
        c.fecha_fin_real,
        c.observaciones,
        c.fecha_creacion,
        COUNT(DISTINCT pc.id_participante) AS total_participantes
      FROM Clases c
      INNER JOIN Ambientes a ON c.id_ambiente = a.id_ambiente
      INNER JOIN Usuarios u_instructor ON c.id_instructor = u_instructor.id_usuario
      LEFT JOIN Participantes_Clase pc ON c.id_clase = pc.id_clase AND pc.presente = TRUE
      WHERE 1=1
    `;

    const params = [];

    if (id_ambiente) {
      query += ' AND c.id_ambiente = ?';
      params.push(id_ambiente);
    }

    if (id_instructor) {
      query += ' AND c.id_instructor = ?';
      params.push(id_instructor);
    }

    if (fecha) {
      query += ' AND c.fecha_clase = ?';
      params.push(fecha);
    }

    if (estado_clase) {
      query += ' AND c.estado_clase = ?';
      params.push(estado_clase);
    }

    query += ' GROUP BY c.id_clase ORDER BY c.fecha_clase DESC, c.hora_inicio DESC';

    const [rows] = await defaultDb.execute(query, params);
    return res.json(rows);
  } catch (err) {
    console.error('Error al listar clases:', err);
    return res.status(500).json({ error: 'Error al listar clases', detalle: err.message });
  }
}

/**
 * Obtener una clase por ID con detalles
 */
export async function obtenerClase(req, res) {
  try {
    const { id } = req.params;

    // Obtener información de la clase
    const [[clase]] = await defaultDb.execute(
      `SELECT 
        c.*,
        a.nombre_ambiente,
        a.codigo_ambiente,
        u_instructor.nombre_usuario AS instructor_nombre,
        u_instructor.cedula AS instructor_cedula
       FROM Clases c
       INNER JOIN Ambientes a ON c.id_ambiente = a.id_ambiente
       INNER JOIN Usuarios u_instructor ON c.id_instructor = u_instructor.id_usuario
       WHERE c.id_clase = ?`,
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Obtener participantes
    const [participantes] = await defaultDb.execute(
      `SELECT 
        pc.id_participante,
        pc.id_aprendiz,
        u.nombre_usuario AS aprendiz_nombre,
        u.cedula AS aprendiz_cedula,
        pc.presente,
        pc.fecha_registro
       FROM Participantes_Clase pc
       INNER JOIN Usuarios u ON pc.id_aprendiz = u.id_usuario
       WHERE pc.id_clase = ?`,
      [id]
    );

    // Obtener responsabilidades activas
    const [responsabilidades] = await defaultDb.execute(
      `SELECT 
        ra.id_responsabilidad_ambiente,
        ra.id_usuario,
        u.nombre_usuario,
        r.nombre_rol,
        ra.tipo_responsabilidad,
        ra.fecha_inicio,
        ra.fecha_fin,
        ra.estado_responsabilidad
       FROM Responsabilidades_Ambiente ra
       INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
       LEFT JOIN Roles r ON u.id_rol = r.id_rol
       WHERE ra.id_clase = ? AND ra.estado_responsabilidad = 'Activa'`,
      [id]
    );

    return res.json({
      ...clase,
      participantes,
      responsabilidades
    });
  } catch (err) {
    console.error('Error al obtener clase:', err);
    return res.status(500).json({ error: 'Error al obtener la clase', detalle: err.message });
  }
}

/**
 * Iniciar una clase (cambiar estado a "En Curso" y asignar responsabilidades)
 */
export async function iniciarClase(req, res) {
  try {
    const { id } = req.params;
    const { fecha_inicio_real } = req.body;

    // Validar que la clase existe y está en estado "Programada"
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase, id_ambiente, id_instructor FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    if (clase.estado_clase !== 'Programada') {
      return res.status(400).json({ 
        error: 'La clase no puede ser iniciada',
        detalle: `La clase está en estado "${clase.estado_clase}". Solo se pueden iniciar clases programadas.`
      });
    }

    // Usar fecha_inicio_real proporcionada o la fecha/hora actual
    const fechaInicio = fecha_inicio_real 
      ? new Date(fecha_inicio_real).toISOString().slice(0, 19).replace('T', ' ')
      : new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Llamar al procedimiento almacenado
    const [result] = await defaultDb.execute(
      'CALL sp_iniciar_clase(?, ?)',
      [id, fechaInicio]
    );

    return res.json({
      ok: true,
      message: 'Clase iniciada correctamente. Responsabilidades asignadas.',
      fecha_inicio: fechaInicio
    });
  } catch (err) {
    console.error('Error al iniciar clase:', err);
    return res.status(500).json({ error: 'Error al iniciar la clase', detalle: err.message });
  }
}

/**
 * Finalizar una clase (cambiar estado a "Finalizada" y cerrar responsabilidades)
 */
export async function finalizarClase(req, res) {
  try {
    const { id } = req.params;
    const { fecha_fin_real } = req.body;

    // Validar que la clase existe y está en estado "En Curso"
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    if (clase.estado_clase !== 'En Curso') {
      return res.status(400).json({ 
        error: 'La clase no puede ser finalizada',
        detalle: `La clase está en estado "${clase.estado_clase}". Solo se pueden finalizar clases en curso.`
      });
    }

    // Usar fecha_fin_real proporcionada o la fecha/hora actual
    const fechaFin = fecha_fin_real 
      ? new Date(fecha_fin_real).toISOString().slice(0, 19).replace('T', ' ')
      : new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Llamar al procedimiento almacenado
    await defaultDb.execute(
      'CALL sp_finalizar_clase(?, ?)',
      [id, fechaFin]
    );

    return res.json({
      ok: true,
      message: 'Clase finalizada correctamente. Responsabilidades cerradas.',
      fecha_fin: fechaFin
    });
  } catch (err) {
    console.error('Error al finalizar clase:', err);
    return res.status(500).json({ error: 'Error al finalizar la clase', detalle: err.message });
  }
}

/**
 * Agregar participantes a una clase
 */
export async function agregarParticipantes(req, res) {
  try {
    const { id } = req.params;
    const { participantes } = req.body; // Array de id_aprendiz

    if (!Array.isArray(participantes) || participantes.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de participantes (id_aprendiz)' });
    }

    // Validar que la clase existe
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Validar que todos los participantes sean aprendices válidos
    const placeholders = participantes.map(() => '?').join(',');
    const [aprendices] = await defaultDb.execute(
      `SELECT u.id_usuario 
       FROM Usuarios u
       INNER JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario IN (${placeholders}) 
       AND u.estado = 'Activo' 
       AND r.nombre_rol = 'Aprendiz'`,
      participantes
    );

    const idsAprendicesValidos = aprendices.map(a => a.id_usuario);
    const idsInvalidos = participantes.filter(id => !idsAprendicesValidos.includes(id));

    if (idsInvalidos.length > 0) {
      return res.status(400).json({ 
        error: 'Algunos participantes no son aprendices válidos',
        ids_invalidos: idsInvalidos
      });
    }

    // Verificar participantes duplicados
    const [existentes] = await defaultDb.execute(
      `SELECT id_aprendiz FROM Participantes_Clase WHERE id_clase = ? AND id_aprendiz IN (${placeholders})`,
      [id, ...participantes]
    );

    const idsExistentes = existentes.map(e => e.id_aprendiz);
    const idsNuevos = participantes.filter(id => !idsExistentes.includes(id));

    if (idsNuevos.length === 0) {
      return res.status(409).json({ error: 'Todos los participantes ya están registrados en esta clase' });
    }

    // Insertar nuevos participantes
    const values = idsNuevos.map(idAprendiz => `(${id}, ${idAprendiz})`).join(',');
    await defaultDb.execute(
      `INSERT INTO Participantes_Clase (id_clase, id_aprendiz) VALUES ${values}`
    );

    return res.json({
      ok: true,
      message: `${idsNuevos.length} participante(s) agregado(s) correctamente`,
      agregados: idsNuevos.length,
      duplicados: idsExistentes.length
    });
  } catch (err) {
    console.error('Error al agregar participantes:', err);
    return res.status(500).json({ error: 'Error al agregar participantes', detalle: err.message });
  }
}

/**
 * Obtener responsables actuales de un ambiente
 */
export async function obtenerResponsablesAmbiente(req, res) {
  try {
    const { id_ambiente } = req.params;
    const { fecha_consulta } = req.query;

    const fechaConsulta = fecha_consulta 
      ? new Date(fecha_consulta).toISOString().slice(0, 19).replace('T', ' ')
      : null;

    const [rows] = await defaultDb.execute(
      'CALL sp_responsables_ambiente_actual(?, ?)',
      [id_ambiente, fechaConsulta]
    );

    // MySQL devuelve múltiples result sets, tomar el primero
    const responsables = Array.isArray(rows[0]) ? rows[0] : rows;

    return res.json(responsables);
  } catch (err) {
    console.error('Error al obtener responsables:', err);
    return res.status(500).json({ error: 'Error al obtener responsables del ambiente', detalle: err.message });
  }
}

/**
 * Actualizar una clase
 */
export async function actualizarClase(req, res) {
  try {
    const { id } = req.params;
    const {
      nombre_clase,
      descripcion,
      fecha_clase,
      hora_inicio,
      hora_fin,
      observaciones
    } = req.body;

    // Validar que la clase existe
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Solo permitir actualizar clases programadas
    if (clase.estado_clase !== 'Programada') {
      return res.status(400).json({ 
        error: 'No se puede actualizar la clase',
        detalle: `Solo se pueden actualizar clases en estado "Programada". La clase actual está en estado "${clase.estado_clase}".`
      });
    }

    const allowed = ['nombre_clase', 'descripcion', 'fecha_clase', 'hora_inicio', 'hora_fin', 'observaciones'];
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
    const query = `UPDATE Clases SET ${sets.join(', ')} WHERE id_clase = ?`;
    const [result] = await defaultDb.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    return res.json({ ok: true, message: 'Clase actualizada correctamente' });
  } catch (err) {
    console.error('Error al actualizar clase:', err);
    return res.status(500).json({ error: 'Error al actualizar la clase', detalle: err.message });
  }
}

/**
 * Cancelar una clase
 */
export async function cancelarClase(req, res) {
  try {
    const { id } = req.params;

    // Validar que la clase existe
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    if (clase.estado_clase === 'Finalizada') {
      return res.status(400).json({ error: 'No se puede cancelar una clase finalizada' });
    }

    // Si está en curso, finalizar responsabilidades primero
    if (clase.estado_clase === 'En Curso') {
      await defaultDb.execute(
        'CALL sp_finalizar_clase(?, ?)',
        [id, new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
    }

    // Cambiar estado a Cancelada
    await defaultDb.execute(
      'UPDATE Clases SET estado_clase = "Cancelada" WHERE id_clase = ?',
      [id]
    );

    return res.json({ ok: true, message: 'Clase cancelada correctamente' });
  } catch (err) {
    console.error('Error al cancelar clase:', err);
    return res.status(500).json({ error: 'Error al cancelar la clase', detalle: err.message });
  }
}

