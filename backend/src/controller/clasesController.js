import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';

/**
 * Crear una nueva clase/programación
 */
export async function crearClase(req, res) {
  try {
    const {
      id_ambiente,
      id_instructor,
      nombre_clase,
      codigo_ficha,
      descripcion,
      fecha_clase,
      hora_inicio,
      hora_fin,
      observaciones,
      participantes = [] // Array de id_aprendiz
    } = req.body;

    const creadoPor = req.user?.id;
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    // Si el usuario es instructor, automáticamente se asigna a sí mismo
    let instructorId = id_instructor;
    if (userRole === 'Instructor') {
      instructorId = userId;
    }

    // Si no es instructor, debe proporcionar id_instructor
    if (userRole !== 'Instructor' && !id_instructor) {
      return res.status(400).json({ 
        error: 'Falta campo obligatorio',
        detalle: 'Se requiere: id_instructor'
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
      [instructorId]
    );
    if (!instructor) {
      return res.status(404).json({ error: 'Instructor no encontrado o no tiene rol de Instructor' });
    }

    // Validar y normalizar formato de fecha (asegurar YYYY-MM-DD sin conversión de zona horaria)
    let fechaNormalizada = fecha_clase;
    if (typeof fecha_clase === 'string') {
      // Extraer solo la parte de fecha si viene con hora
      fechaNormalizada = fecha_clase.split('T')[0].split(' ')[0];
    }
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNormalizada)) {
      logger.error('Formato de fecha inválido recibido', { fecha_clase, fechaNormalizada });
      return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
    }
    
    // Log para debugging
    logger.info('Creando clase con fecha', { 
      fecha_recibida: fecha_clase, 
      fecha_normalizada: fechaNormalizada,
      hora_inicio,
      hora_fin
    });
    
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora_inicio) || !/^\d{2}:\d{2}(:\d{2})?$/.test(hora_fin)) {
      return res.status(400).json({ error: 'Formato de hora inválido. Use HH:MM o HH:MM:SS' });
    }

    // Validar que hora_fin sea mayor que hora_inicio
    if (hora_fin <= hora_inicio) {
      return res.status(400).json({ error: 'La hora de fin debe ser mayor que la hora de inicio' });
    }

    // Validar conflictos de horario en el mismo ambiente
    // No puede haber dos clases en el mismo ambiente al mismo tiempo
    const [clasesConflictivas] = await defaultDb.execute(
      `SELECT 
        c.id_clase, 
        c.nombre_clase, 
        c.hora_inicio, 
        c.hora_fin,
        u.nombre_usuario AS instructor_nombre,
        c.codigo_ficha
       FROM Clases c
       INNER JOIN Usuarios u ON c.id_instructor = u.id_usuario
       WHERE c.id_ambiente = ?
         AND c.fecha_clase = ?
         AND c.estado_clase IN ('Programada', 'En Curso')
         AND (
           (c.hora_inicio < ? AND c.hora_fin > ?) OR
           (c.hora_inicio < ? AND c.hora_fin > ?) OR
           (c.hora_inicio >= ? AND c.hora_fin <= ?)
         )`,
      [id_ambiente, fecha_clase, hora_inicio, hora_inicio, hora_fin, hora_fin, hora_inicio, hora_fin]
    );

    if (clasesConflictivas.length > 0) {
      return res.status(409).json({ 
        error: 'Conflicto de horario',
        detalle: 'Ya existe una clase programada en este ambiente durante el horario especificado. No se pueden asignar dos instructores al mismo ambiente al mismo tiempo.',
        clases_conflictivas: clasesConflictivas
      });
    }

    // Insertar la clase con estado explícito
    // Usar fechaNormalizada para evitar problemas de zona horaria en MySQL
    const [result] = await defaultDb.execute(
      `INSERT INTO Clases 
       (id_ambiente, id_instructor, nombre_clase, codigo_ficha, descripcion, fecha_clase, hora_inicio, hora_fin, observaciones, estado_clase, creado_por)
       VALUES (?, ?, ?, ?, ?, DATE(?), ?, ?, ?, 'Programada', ?)`,
      [id_ambiente, instructorId, nombre_clase || null, codigo_ficha || null, descripcion || null, fechaNormalizada, hora_inicio, hora_fin, observaciones || null, creadoPor]
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
        logger.warn('Algunos participantes no son aprendices válidos', { idsInvalidos });
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
        id_instructor: instructorId,
        instructor: instructor.nombre_usuario,
        nombre_clase,
        codigo_ficha: codigo_ficha || null,
        fecha_clase,
        hora_inicio,
        hora_fin,
        estado_clase: 'Programada'
      }
    });
  } catch (err) {
    logger.error('Error al crear clase', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al crear la clase', detalle: err.message });
  }
}

/**
 * Listar clases con filtros opcionales
 * Si el usuario es instructor, solo muestra sus propias clases
 */
export async function listarClases(req, res) {
  try {
    const { id_ambiente, id_instructor, fecha, estado_clase } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.rol;

    let query = `
      SELECT 
        c.id_clase,
        c.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        c.id_instructor,
        u_instructor.nombre_usuario AS instructor_nombre,
        c.nombre_clase,
        c.codigo_ficha,
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

    // Si es instructor, solo puede ver sus propias clases
    if (userRole === 'Instructor') {
      query += ' AND c.id_instructor = ?';
      params.push(userId);
    } else if (id_instructor) {
      // Los administradores pueden filtrar por instructor
      query += ' AND c.id_instructor = ?';
      params.push(id_instructor);
    }

    if (id_ambiente) {
      query += ' AND c.id_ambiente = ?';
      params.push(id_ambiente);
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
    logger.error('Error al listar clases', { error: err.message, stack: err.stack });
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
    logger.error('Error al obtener clase', { error: err.message, stack: err.stack });
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
    await defaultDb.execute(
      'CALL sp_iniciar_clase(?, ?)',
      [id, fechaInicio]
    );

    return res.json({
      ok: true,
      message: 'Clase iniciada correctamente. Responsabilidades asignadas.',
      fecha_inicio: fechaInicio
    });
  } catch (err) {
    logger.error('Error al iniciar clase', { error: err.message, stack: err.stack });
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
    logger.error('Error al finalizar clase', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al finalizar la clase', detalle: err.message });
  }
}

/**
 * Agregar participantes a una clase
 */
export async function agregarParticipantes(req, res) {
  try {
    // Los datos ya están validados por el middleware de validación Zod
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

    // Insertar nuevos participantes usando prepared statements (seguro)
    const insertPromises = idsNuevos.map(idAprendiz => 
      defaultDb.execute(
        'INSERT INTO Participantes_Clase (id_clase, id_aprendiz) VALUES (?, ?)',
        [id, idAprendiz]
      )
    );
    await Promise.all(insertPromises);

    return res.json({
      ok: true,
      message: `${idsNuevos.length} participante(s) agregado(s) correctamente`,
      agregados: idsNuevos.length,
      duplicados: idsExistentes.length
    });
  } catch (err) {
    logger.error('Error al agregar participantes', { error: err.message, stack: err.stack });
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
    logger.error('Error al obtener responsables', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al obtener responsables del ambiente', detalle: err.message });
  }
}

/**
 * Actualizar una clase
 */
export async function actualizarClase(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.rol;

    // Validar que la clase existe
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase, id_instructor FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Si es instructor, solo puede actualizar sus propias clases
    if (userRole === 'Instructor' && clase.id_instructor !== userId) {
      return res.status(403).json({ 
        error: 'No autorizado',
        detalle: 'Solo puedes actualizar tus propias clases'
      });
    }

    // Solo permitir actualizar clases programadas
    if (clase.estado_clase !== 'Programada') {
      return res.status(400).json({ 
        error: 'No se puede actualizar la clase',
        detalle: `Solo se pueden actualizar clases en estado "Programada". La clase actual está en estado "${clase.estado_clase}".`
      });
    }

    // Si se está cambiando fecha, hora o ambiente, validar conflictos
    if (req.body.fecha_clase || req.body.hora_inicio || req.body.hora_fin || req.body.id_ambiente) {
      const fechaClase = req.body.fecha_clase || clase.fecha_clase;
      const horaInicio = req.body.hora_inicio || clase.hora_inicio;
      const horaFin = req.body.hora_fin || clase.hora_fin;
      const idAmbiente = req.body.id_ambiente || clase.id_ambiente;

      const [clasesConflictivas] = await defaultDb.execute(
        `SELECT id_clase, nombre_clase, hora_inicio, hora_fin 
         FROM Clases 
         WHERE id_ambiente = ?
           AND fecha_clase = ?
           AND id_clase != ?
           AND estado_clase IN ('Programada', 'En Curso')
           AND (
             (hora_inicio < ? AND hora_fin > ?) OR
             (hora_inicio < ? AND hora_fin > ?) OR
             (hora_inicio >= ? AND hora_fin <= ?)
           )`,
        [idAmbiente, fechaClase, id, horaInicio, horaInicio, horaFin, horaFin, horaInicio, horaFin]
      );

      if (clasesConflictivas.length > 0) {
        return res.status(409).json({ 
          error: 'Conflicto de horario',
          detalle: 'El cambio generaría un conflicto de horario con otra clase programada',
          clases_conflictivas: clasesConflictivas
        });
      }
    }

    const allowed = ['nombre_clase', 'codigo_ficha', 'descripcion', 'fecha_clase', 'hora_inicio', 'hora_fin', 'observaciones'];
    const sets = [];
    const params = [];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        let value = req.body[key];
        
        // Normalizar fecha_clase para evitar problemas de zona horaria
        if (key === 'fecha_clase' && value) {
          if (typeof value === 'string') {
            value = value.split('T')[0].split(' ')[0];
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
              return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
            }
          }
          // Usar DATE() en MySQL para asegurar que se almacene correctamente
          sets.push(`${key} = DATE(?)`);
        } else {
          sets.push(`${key} = ?`);
        }
        params.push(value);
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
    logger.error('Error al actualizar clase', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al actualizar la clase', detalle: err.message });
  }
}

/**
 * Cancelar una clase
 */
export async function cancelarClase(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.rol;

    // Validar que la clase existe
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase, id_instructor FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Si es instructor, solo puede cancelar sus propias clases
    if (userRole === 'Instructor' && clase.id_instructor !== userId) {
      return res.status(403).json({ 
        error: 'No autorizado',
        detalle: 'Solo puedes cancelar tus propias clases'
      });
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
    logger.error('Error al cancelar clase', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al cancelar la clase', detalle: err.message });
  }
}

/**
 * Consultar responsables de un ambiente en una fecha y hora específicas
 * Retorna el responsable principal (instructor) y los responsables secundarios (aprendices)
 */
export async function consultarResponsablesTiempoReal(req, res) {
  try {
    const { id_ambiente } = req.params;
    const { fecha, hora } = req.query;

    if (!fecha || !hora) {
      return res.status(400).json({
        error: 'Faltan parámetros',
        detalle: 'Se requieren: fecha (YYYY-MM-DD) y hora (HH:MM)'
      });
    }

    // Validar formato
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
    }
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
      return res.status(400).json({ error: 'Formato de hora inválido. Use HH:MM o HH:MM:SS' });
    }

    // Construir datetime para la consulta
    const fechaHoraConsulta = `${fecha} ${hora}:00`;

    // Buscar clase activa en ese momento
    const [[claseActiva]] = await defaultDb.execute(
      `SELECT 
        c.id_clase,
        c.nombre_clase,
        c.codigo_ficha,
        c.fecha_clase,
        c.hora_inicio,
        c.hora_fin,
        c.id_instructor,
        u_instructor.nombre_usuario AS instructor_nombre,
        u_instructor.cedula AS instructor_cedula
       FROM Clases c
       INNER JOIN Usuarios u_instructor ON c.id_instructor = u_instructor.id_usuario
       WHERE c.id_ambiente = ?
         AND c.fecha_clase = ?
         AND c.estado_clase IN ('Programada', 'En Curso')
         AND TIME(?) >= TIME(c.hora_inicio)
         AND TIME(?) <= TIME(c.hora_fin)`,
      [id_ambiente, fecha, fechaHoraConsulta, fechaHoraConsulta]
    );

    if (!claseActiva) {
      // Si no hay clase activa, buscar responsabilidades permanentes por jornada
      const horaNum = parseInt(hora.split(':')[0]);
      let jornada = 'Mañana';
      if (horaNum >= 6 && horaNum < 12) jornada = 'Mañana';
      else if (horaNum >= 12 && horaNum < 18) jornada = 'Tarde';
      else jornada = 'Noche';

      const [responsablesPermanentes] = await defaultDb.execute(
        `SELECT 
          ra.id_responsabilidad_ambiente,
          ra.id_usuario,
          u.nombre_usuario,
          u.cedula,
          r.nombre_rol,
          ra.tipo_responsabilidad,
          ra.jornada
         FROM Responsabilidades_Ambiente ra
         INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
         LEFT JOIN Roles r ON u.id_rol = r.id_rol
         WHERE ra.id_ambiente = ?
           AND ra.id_clase IS NULL
           AND ra.jornada = ?
           AND ra.estado_responsabilidad = 'Activa'
           AND ra.fecha_inicio <= ?
           AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= ?)`,
        [id_ambiente, jornada, fechaHoraConsulta, fechaHoraConsulta]
      );

      return res.json({
        fecha_consulta: fecha,
        hora_consulta: hora,
        tiene_clase_activa: false,
        clase: null,
        responsable_principal: responsablesPermanentes.find(r => r.tipo_responsabilidad === 'Principal') || null,
        responsables_secundarios: responsablesPermanentes.filter(r => r.tipo_responsabilidad === 'Secundario'),
        tipo: 'Permanente'
      });
    }

    // Obtener responsables secundarios (aprendices) de la clase
    const [aprendices] = await defaultDb.execute(
      `SELECT 
        u.id_usuario,
        u.nombre_usuario,
        u.cedula,
        pc.presente
       FROM Participantes_Clase pc
       INNER JOIN Usuarios u ON pc.id_aprendiz = u.id_usuario
       WHERE pc.id_clase = ?
         AND pc.presente = TRUE`,
      [claseActiva.id_clase]
    );

    return res.json({
      fecha_consulta: fecha,
      hora_consulta: hora,
      tiene_clase_activa: true,
      clase: {
        id_clase: claseActiva.id_clase,
        nombre_clase: claseActiva.nombre_clase,
        codigo_ficha: claseActiva.codigo_ficha,
        fecha_clase: claseActiva.fecha_clase,
        hora_inicio: claseActiva.hora_inicio,
        hora_fin: claseActiva.hora_fin
      },
      responsable_principal: {
        id_usuario: claseActiva.id_instructor,
        nombre_usuario: claseActiva.instructor_nombre,
        cedula: claseActiva.instructor_cedula,
        tipo_responsabilidad: 'Principal'
      },
      responsables_secundarios: aprendices.map(a => ({
        id_usuario: a.id_usuario,
        nombre_usuario: a.nombre_usuario,
        cedula: a.cedula,
        tipo_responsabilidad: 'Secundario',
        presente: a.presente
      })),
      tipo: 'Temporal'
    });
  } catch (err) {
    logger.error('Error al consultar responsables en tiempo real', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al consultar responsables',
      detalle: err.message
    });
  }
}

/**
 * Asignar automáticamente responsabilidades basándose en horarios programados
 * Se ejecuta cuando una clase inicia o cuando se necesita sincronizar
 */
export async function sincronizarResponsabilidadesHorarios(req, res) {
  try {
    const ahora = new Date();
    const fechaActual = ahora.toISOString().split('T')[0];

    // Buscar clases que deberían estar activas pero no tienen responsabilidades asignadas
    // Buscar clases del día actual y también clases pasadas que no se iniciaron
    // Usar TIMESTAMP para comparar correctamente fecha y hora
    // Cambiar >= por > para hora_fin para evitar iniciar clases que ya terminaron
    const [clasesSinResponsabilidades] = await defaultDb.execute(
      `SELECT 
        c.id_clase,
        c.id_ambiente,
        c.id_instructor,
        c.fecha_clase,
        c.hora_inicio,
        c.hora_fin,
        c.estado_clase
       FROM Clases c
       WHERE c.estado_clase = 'Programada'
         AND TIMESTAMP(c.fecha_clase, c.hora_inicio) <= NOW()
         AND TIMESTAMP(c.fecha_clase, c.hora_fin) > NOW()
         AND NOT EXISTS (
           SELECT 1 FROM Responsabilidades_Ambiente ra
           WHERE ra.id_clase = c.id_clase
             AND ra.estado_responsabilidad = 'Activa'
             AND ra.tipo_responsabilidad = 'Principal'
         )`,
      []
    );

    let asignadas = 0;
    const errores = [];

    logger.info(`Sincronizando responsabilidades: ${clasesSinResponsabilidades.length} clases encontradas para iniciar`);

    // eslint-disable-next-line no-await-in-loop
    for (const clase of clasesSinResponsabilidades) {
      try {
        logger.info(`Procesando clase ${clase.id_clase} - Estado: ${clase.estado_clase}`);
        
        // Finalizar responsabilidades anteriores del ambiente que se solapen
        // Convertir fecha_clase a string en formato YYYY-MM-DD
        const fechaClaseStr = clase.fecha_clase instanceof Date
          ? clase.fecha_clase.toISOString().split('T')[0]
          : String(clase.fecha_clase).split('T')[0];
        
        // Asegurar formato correcto de hora (puede venir con o sin segundos)
        let horaInicio = String(clase.hora_inicio);
        if (horaInicio.split(':').length === 2) {
          horaInicio = `${horaInicio}:00`;
        }
        
        let horaFin = String(clase.hora_fin);
        if (horaFin.split(':').length === 2) {
          horaFin = `${horaFin}:00`;
        }
        
        // Construir fecha/hora de inicio y fin usando la fecha y hora programadas
        const fechaInicioClase = `${fechaClaseStr} ${horaInicio}`;
        const fechaFinClase = `${fechaClaseStr} ${horaFin}`;
        
        logger.info(`Clase ${clase.id_clase}: Inicio programado=${fechaInicioClase}, Fin programado=${fechaFinClase}`);

        await defaultDb.execute(
          `UPDATE Responsabilidades_Ambiente
           SET estado_responsabilidad = 'Finalizada',
               fecha_fin = ?
           WHERE id_ambiente = ?
             AND estado_responsabilidad = 'Activa'
             AND (
               (fecha_inicio < ? AND fecha_fin > ?) OR
               (fecha_inicio < ? AND fecha_fin > ?) OR
               (fecha_inicio >= ? AND fecha_fin <= ?)
             )`,
          [fechaInicioClase, clase.id_ambiente, fechaInicioClase, fechaInicioClase, fechaFinClase, fechaFinClase, fechaInicioClase, fechaFinClase]
        );

        // Asignar responsabilidad principal al instructor
        await defaultDb.execute(
          `INSERT INTO Responsabilidades_Ambiente
           (id_ambiente, id_clase, id_usuario, tipo_responsabilidad, fecha_inicio, fecha_fin, estado_responsabilidad, asignacion_automatica, creado_por)
           VALUES (?, ?, ?, 'Principal', ?, ?, 'Activa', TRUE, ?)`,
          [clase.id_ambiente, clase.id_clase, clase.id_instructor, fechaInicioClase, fechaFinClase, clase.id_instructor]
        );

        // Obtener aprendices de la clase y asignar responsabilidades secundarias
        const [aprendices] = await defaultDb.execute(
          `SELECT id_aprendiz FROM Participantes_Clase WHERE id_clase = ? AND presente = TRUE`,
          [clase.id_clase]
        );

        // eslint-disable-next-line no-await-in-loop
        for (const aprendiz of aprendices) {
          // eslint-disable-next-line no-await-in-loop
          await defaultDb.execute(
            `INSERT INTO Responsabilidades_Ambiente
             (id_ambiente, id_clase, id_usuario, tipo_responsabilidad, fecha_inicio, fecha_fin, estado_responsabilidad, asignacion_automatica, creado_por)
             VALUES (?, ?, ?, 'Secundario', ?, ?, 'Activa', TRUE, ?)`,
            [clase.id_ambiente, clase.id_clase, aprendiz.id_aprendiz, fechaInicioClase, fechaFinClase, clase.id_instructor]
          );
        }

        // Actualizar estado de la clase a "En Curso" si estaba programada
        if (clase.estado_clase === 'Programada') {
          await defaultDb.execute(
            `UPDATE Clases SET estado_clase = 'En Curso', fecha_inicio_real = ? WHERE id_clase = ?`,
            [fechaInicioClase, clase.id_clase]
          );
        }

        asignadas++;
      } catch (err) {
        logger.error('Error al asignar responsabilidades para clase', { id_clase: clase.id_clase, error: err.message });
        errores.push({ id_clase: clase.id_clase, error: err.message });
      }
    }

    // Finalizar responsabilidades de clases que ya terminaron
    // Buscar clases de cualquier fecha que hayan terminado (no solo del día actual)
    const [clasesFinalizadas] = await defaultDb.execute(
      `SELECT DISTINCT c.id_clase
       FROM Clases c
       INNER JOIN Responsabilidades_Ambiente ra ON c.id_clase = ra.id_clase
       WHERE TIMESTAMP(c.fecha_clase, c.hora_fin) < NOW()
         AND c.estado_clase = 'En Curso'
         AND ra.estado_responsabilidad = 'Activa'`,
      []
    );

    let finalizadas = 0;
    // eslint-disable-next-line no-await-in-loop
    for (const clase of clasesFinalizadas) {
      try {
        const ahora = new Date();
        const fechaFin = ahora.toISOString().slice(0, 19).replace('T', ' ');
        await defaultDb.execute(
          `UPDATE Responsabilidades_Ambiente
           SET estado_responsabilidad = 'Finalizada',
               fecha_fin = ?
           WHERE id_clase = ? AND estado_responsabilidad = 'Activa'`,
          [fechaFin, clase.id_clase]
        );

        await defaultDb.execute(
          `UPDATE Clases SET estado_clase = 'Finalizada', fecha_fin_real = ? WHERE id_clase = ?`,
          [fechaFin, clase.id_clase]
        );

        finalizadas++;
      } catch (err) {
        logger.error('Error al finalizar clase', { id_clase: clase.id_clase, error: err.message });
        errores.push({ id_clase: clase.id_clase, error: err.message });
      }
    }

    return res.json({
      ok: true,
      message: 'Sincronización completada',
      asignadas,
      finalizadas,
      errores: errores.length > 0 ? errores : undefined
    });
  } catch (err) {
    logger.error('Error al sincronizar responsabilidades', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al sincronizar responsabilidades',
      detalle: err.message
    });
  }
}

