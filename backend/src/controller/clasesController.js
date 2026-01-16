import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import { obtenerFechasPorRangoYDias } from './horariosController.js';

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
      fecha_inicio,
      fecha_fin,
      dias_semana,
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

    // Validar formato de hora
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora_inicio) || !/^\d{2}:\d{2}(:\d{2})?$/.test(hora_fin)) {
      return res.status(400).json({ error: 'Formato de hora inválido. Use HH:MM o HH:MM:SS' });
    }

    // Validar que hora_fin sea mayor que hora_inicio
    if (hora_fin <= hora_inicio) {
      return res.status(400).json({ error: 'La hora de fin debe ser mayor que la hora de inicio' });
    }

    // Determinar si se crea clase única o múltiples clases con días de semana
    const tieneDiasSemana = Array.isArray(dias_semana) && dias_semana.length > 0;
    const tieneRango = fecha_inicio && fecha_fin;
    
    // Si hay días de semana, fecha_inicio y fecha_fin son obligatorias
    if (tieneDiasSemana && (!fecha_inicio || !fecha_fin)) {
      return res.status(400).json({ 
        error: 'Faltan campos obligatorios',
        detalle: 'Para usar días de semana, debe proporcionar fecha_inicio y fecha_fin'
      });
    }
    
    // Si hay días de semana, validar rango
    if (tieneDiasSemana && tieneRango) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) {
        return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
      }
      
      if (fecha_inicio > fecha_fin) {
        return res.status(400).json({ error: 'La fecha de inicio debe ser menor o igual a la fecha de fin' });
      }
    }
    
    // Si NO hay días de semana, fecha_clase es obligatoria
    if (!tieneDiasSemana && !fecha_clase) {
      return res.status(400).json({ 
        error: 'Falta campo obligatorio',
        detalle: 'Debe proporcionar fecha_clase (clase única) o fecha_inicio + fecha_fin + dias_semana (clases recurrentes)'
      });
    }

    // Determinar fechas a procesar
    let fechasAProcesar = [];
    
    if (tieneDiasSemana && tieneRango) {
      // Generar fechas dentro del rango para los días especificados
      fechasAProcesar = obtenerFechasPorRangoYDias(fecha_inicio, fecha_fin, dias_semana);
      
      if (fechasAProcesar.length === 0) {
        return res.status(400).json({ 
          error: 'No se encontraron fechas válidas',
          detalle: `No hay fechas dentro del rango ${fecha_inicio} a ${fecha_fin} que coincidan con los días especificados`
        });
      }
    } else {
      // Clase única con fecha_clase
      let fechaNormalizada = fecha_clase;
      if (typeof fecha_clase === 'string') {
        fechaNormalizada = fecha_clase.split('T')[0].split(' ')[0];
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNormalizada)) {
        return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
      }
      
      fechasAProcesar = [new Date(fechaNormalizada + 'T00:00:00')];
    }

    // Normalizar horas
    const horaInicioNormalizada = hora_inicio.includes(':') && hora_inicio.split(':').length === 2
      ? `${hora_inicio}:00`
      : hora_inicio;
    const horaFinNormalizada = hora_fin.includes(':') && hora_fin.split(':').length === 2
      ? `${hora_fin}:00`
      : hora_fin;

    // Procesar cada fecha
    const clasesCreadas = [];
    const erroresFechas = [];
    
    for (const fechaObj of fechasAProcesar) {
      const fechaNormalizada = fechaObj.toISOString().split('T')[0];
      
      try {
        // Validar conflictos de horario para esta fecha
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
          [id_ambiente, fechaNormalizada, horaInicioNormalizada, horaInicioNormalizada, horaFinNormalizada, horaFinNormalizada, horaInicioNormalizada, horaFinNormalizada]
        );

        if (clasesConflictivas.length > 0) {
          erroresFechas.push({
            fecha: fechaNormalizada,
            error: 'Conflicto de horario existente',
            clases_conflictivas: clasesConflictivas
          });
          continue;
        }

        // Insertar la clase
        const [result] = await defaultDb.execute(
          `INSERT INTO Clases 
           (id_ambiente, id_instructor, nombre_clase, codigo_ficha, descripcion, fecha_clase, hora_inicio, hora_fin, observaciones, estado_clase, creado_por)
           VALUES (?, ?, ?, ?, ?, DATE(?), ?, ?, ?, 'Programada', ?)`,
          [id_ambiente, instructorId, nombre_clase || null, codigo_ficha || null, descripcion || null, fechaNormalizada, horaInicioNormalizada, horaFinNormalizada, observaciones || null, creadoPor]
        );

        const idClase = result.insertId;

        // Insertar participantes si se proporcionaron (solo para la primera clase si hay múltiples)
        if (Array.isArray(participantes) && participantes.length > 0 && clasesCreadas.length === 0) {
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
            logger.warn('Algunos participantes no son aprendices válidos', { idsInvalidos });
          }

          // Insertar participantes válidos para todas las clases creadas
          if (idsAprendicesValidos.length > 0) {
            // Se insertarán después de crear todas las clases
            for (const claseCreada of clasesCreadas) {
              const values = idsAprendicesValidos.map(id => `(${claseCreada.id_clase}, ${id})`).join(',');
              await defaultDb.execute(
                `INSERT INTO Participantes_Clase (id_clase, id_aprendiz) VALUES ${values}`
              );
            }
          }
        }

        clasesCreadas.push({
          id_clase: idClase,
          fecha_clase: fechaNormalizada
        });
      } catch (err) {
        logger.error('Error al crear clase para fecha', { fecha: fechaNormalizada, error: err.message });
        erroresFechas.push({
          fecha: fechaNormalizada,
          error: err.message
        });
      }
    }

    // Insertar participantes para todas las clases creadas
    if (Array.isArray(participantes) && participantes.length > 0 && clasesCreadas.length > 0) {
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
      
      if (idsAprendicesValidos.length > 0) {
        for (const claseCreada of clasesCreadas) {
          for (const idAprendiz of idsAprendicesValidos) {
            await defaultDb.execute(
              'INSERT INTO Participantes_Clase (id_clase, id_aprendiz) VALUES (?, ?)',
              [claseCreada.id_clase, idAprendiz]
            );
          }
        }
      }
    }

    // Determinar respuesta según resultado
    if (clasesCreadas.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo crear ninguna clase',
        errores: erroresFechas
      });
    }

    if (erroresFechas.length > 0) {
      // Éxito parcial - HTTP 207
      return res.status(207).json({
        ok: true,
        creadas: clasesCreadas.length,
        message: `Se crearon ${clasesCreadas.length} clases, ${erroresFechas.length} fallaron`,
        clases: clasesCreadas,
        errores: erroresFechas
      });
    }

    // Éxito total
    if (clasesCreadas.length === 1) {
      return res.status(201).json({
        ok: true,
        id_clase: clasesCreadas[0].id_clase,
        message: 'Clase creada correctamente',
        clase: {
          id_clase: clasesCreadas[0].id_clase,
          id_ambiente,
          ambiente: ambiente.nombre_ambiente,
          id_instructor: instructorId,
          instructor: instructor.nombre_usuario,
          nombre_clase,
          codigo_ficha: codigo_ficha || null,
          fecha_clase: clasesCreadas[0].fecha_clase,
          hora_inicio,
          hora_fin,
          estado_clase: 'Programada'
        }
      });
    } else {
      return res.status(201).json({
        ok: true,
        creadas: clasesCreadas.length,
        message: `Se crearon ${clasesCreadas.length} clases correctamente dentro del rango`,
        clases: clasesCreadas.map(c => ({
          id_clase: c.id_clase,
          fecha_clase: c.fecha_clase
        }))
      });
    }
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
    const getLocalDateString = (date = new Date()) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const getLocalDateTimeString = (date = new Date()) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    const fechaActual = getLocalDateString(ahora);
    const horaActual = ahora.toTimeString().slice(0, 8); // HH:MM:SS

    // Buscar clases programadas que NO tienen responsabilidades asignadas
    // IMPORTANTE: NO filtrar por tiempo en SQL - hacerlo en JavaScript con hora local
    // La BD solo guarda datos, JavaScript decide el tiempo actual
    const [clasesProgramadas] = await defaultDb.execute(
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
         AND NOT EXISTS (
           SELECT 1 FROM Responsabilidades_Ambiente ra
           WHERE ra.id_clase = c.id_clase
             AND ra.estado_responsabilidad = 'Activa'
             AND ra.tipo_responsabilidad = 'Principal'
         )`,
      []
    );

    // Filtrar en JavaScript usando hora local
    const clasesSinResponsabilidades = clasesProgramadas.filter(clase => {
      // Convertir fecha_clase a string
      const fechaClaseStr = clase.fecha_clase instanceof Date
        ? getLocalDateString(clase.fecha_clase)
        : String(clase.fecha_clase).split('T')[0];
      
      // Solo procesar clases del día actual
      if (fechaClaseStr !== fechaActual) {
        return false;
      }
      
      // Normalizar hora_inicio y hora_fin a formato HH:MM:SS
      let horaInicio = String(clase.hora_inicio);
      if (horaInicio.split(':').length === 2) {
        horaInicio = `${horaInicio}:00`;
      }
      let horaFin = String(clase.hora_fin);
      if (horaFin.split(':').length === 2) {
        horaFin = `${horaFin}:00`;
      }
      
      // Comparar usando hora local de JavaScript
      const debeIniciar = horaActual >= horaInicio;
      const aunNoTermina = horaActual < horaFin;
      
      return debeIniciar && aunNoTermina;
    });

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
    // IMPORTANTE: NO filtrar por tiempo en SQL - hacerlo en JavaScript con hora local
    const [clasesEnCurso] = await defaultDb.execute(
      `SELECT DISTINCT 
        c.id_clase, 
        c.fecha_clase, 
        c.hora_inicio,
        c.hora_fin, 
        c.fecha_inicio_real
       FROM Clases c
       INNER JOIN Responsabilidades_Ambiente ra ON c.id_clase = ra.id_clase
       WHERE c.estado_clase = 'En Curso'
         AND ra.estado_responsabilidad = 'Activa'`,
      []
    );

    // Filtrar en JavaScript usando hora local
    const clasesFinalizadas = clasesEnCurso.filter(clase => {
      const fechaClaseStr = clase.fecha_clase instanceof Date
        ? getLocalDateString(clase.fecha_clase)
        : String(clase.fecha_clase).split('T')[0];
      
      // Normalizar hora_fin
      let horaFin = String(clase.hora_fin);
      if (horaFin.split(':').length === 2) {
        horaFin = `${horaFin}:00`;
      }
      
      // Construir datetime de fin de clase
      const datetimeFinClase = `${fechaClaseStr} ${horaFin}`;
      const datetimeFinClaseObj = new Date(datetimeFinClase.replace(' ', 'T'));
      
      // Verificar que la hora de fin ya pasó (con margen de 1 minuto)
      const ahoraObj = new Date();
      const unMinutoAtras = new Date(ahoraObj.getTime() - 60000);
      
      if (datetimeFinClaseObj > unMinutoAtras) {
        return false; // Aún no ha terminado
      }
      
      // Verificar que la clase fue iniciada hace al menos 1 minuto
      if (clase.fecha_inicio_real) {
        const fechaInicioReal = new Date(clase.fecha_inicio_real);
        const minutosDesdeInicio = Math.floor((ahoraObj - fechaInicioReal) / 60000);
        if (minutosDesdeInicio < 1) {
          return false; // Iniciada hace menos de 1 minuto
        }
      }
      
      return true;
    });

    let finalizadas = 0;
    // eslint-disable-next-line no-await-in-loop
    for (const clase of clasesFinalizadas) {
      try {
        // Calcular minutos desde inicio usando JavaScript
        let minutosDesdeInicio = 0;
        if (clase.fecha_inicio_real) {
          const fechaInicioReal = new Date(clase.fecha_inicio_real);
          const ahoraObj = new Date();
          minutosDesdeInicio = Math.floor((ahoraObj - fechaInicioReal) / 60000);
        } else {
          // Si no hay fecha_inicio_real, usar hora_inicio programada
          const fechaClaseStr = clase.fecha_clase instanceof Date
            ? getLocalDateString(clase.fecha_clase)
            : String(clase.fecha_clase).split('T')[0];
          let horaInicio = String(clase.hora_inicio);
          if (horaInicio.split(':').length === 2) {
            horaInicio = `${horaInicio}:00`;
          }
          const datetimeInicio = `${fechaClaseStr} ${horaInicio}`;
          const fechaInicioObj = new Date(datetimeInicio.replace(' ', 'T'));
          const ahoraObj = new Date();
          minutosDesdeInicio = Math.floor((ahoraObj - fechaInicioObj) / 60000);
        }
        
        if (minutosDesdeInicio < 1) {
          logger.debug(`Clase ${clase.id_clase} iniciada hace menos de 1 minuto, no se finaliza automáticamente`, {
            minutos_desde_inicio: minutosDesdeInicio,
            hora_fin: clase.hora_fin
          });
          continue;
        }

        // IMPORTANTE: Usar hora local, NO UTC
        const fechaFin = getLocalDateTimeString(new Date());
        
        logger.info(`Finalizando clase ${clase.id_clase} automáticamente - Hora fin: ${clase.hora_fin}, Minutos desde inicio: ${minutosDesdeInicio}`, {
          fecha_fin_local: fechaFin,
          minutos_desde_inicio: minutosDesdeInicio
        });
        
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

/**
 * Normalizar nombre de clase para evitar duplicados
 * - Convertir a mayúsculas
 * - Eliminar espacios extras
 * - Trim
 */
function normalizarNombreClase(nombre) {
  if (!nombre || typeof nombre !== 'string') {
    return '';
  }
  return nombre.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Obtener nombres únicos de clases de formación para autocompletado
 * Retorna lista de nombres únicos ordenados alfabéticamente
 */
export async function obtenerNombresClases(req, res) {
  try {
    const { busqueda } = req.query; // Opcional: filtrar por búsqueda
    
    let query = `
      SELECT DISTINCT nombre_clase
      FROM Clases
      WHERE nombre_clase IS NOT NULL 
        AND nombre_clase != ''
    `;
    
    const params = [];
    
    if (busqueda && busqueda.trim()) {
      query += ' AND nombre_clase LIKE ?';
      params.push(`%${busqueda.trim()}%`);
    }
    
    query += ' ORDER BY nombre_clase ASC';
    
    const [rows] = await defaultDb.execute(query, params);
    
    const nombres = rows.map(row => row.nombre_clase).filter(n => n);
    
    return res.json({
      ok: true,
      nombres,
      total: nombres.length
    });
  } catch (err) {
    logger.error('Error al obtener nombres de clases', { error: err.message, stack: err.stack });
    return res.status(500).json({ 
      error: 'Error al obtener nombres de clases', 
      detalle: err.message 
    });
  }
}

/**
 * Crear un nuevo nombre de clase desde el frontend
 * Valida duplicados mediante normalización
 */
export async function crearNombreClase(req, res) {
  try {
    const { nombre_clase } = req.body;
    
    if (!nombre_clase || typeof nombre_clase !== 'string' || !nombre_clase.trim()) {
      return res.status(400).json({
        error: 'Campo obligatorio',
        detalle: 'El nombre de la clase es obligatorio'
      });
    }
    
    const nombreNormalizado = normalizarNombreClase(nombre_clase);
    
    if (nombreNormalizado.length === 0) {
      return res.status(400).json({
        error: 'Nombre inválido',
        detalle: 'El nombre de la clase no puede estar vacío'
      });
    }
    
    // Verificar si ya existe un nombre similar (normalizado)
    const [existentes] = await defaultDb.execute(
      `SELECT DISTINCT nombre_clase 
       FROM Clases 
       WHERE UPPER(TRIM(REPLACE(REPLACE(nombre_clase, '  ', ' '), CHAR(9), ' '))) = ? 
       LIMIT 1`,
      [nombreNormalizado]
    );
    
    if (existentes.length > 0) {
      return res.status(409).json({
        error: 'Nombre duplicado',
        detalle: `Ya existe una clase con el nombre "${existentes[0].nombre_clase}". Los nombres se normalizan para evitar duplicados.`,
        nombre_existente: existentes[0].nombre_clase
      });
    }
    
    // El nombre se creará automáticamente cuando se cree la primera clase con ese nombre
    // Por ahora, solo validamos y retornamos éxito
    return res.status(200).json({
      ok: true,
      message: 'Nombre de clase validado correctamente',
      nombre_clase: nombre_clase.trim(),
      nombre_normalizado: nombreNormalizado
    });
  } catch (err) {
    logger.error('Error al crear nombre de clase', { error: err.message, stack: err.stack });
    return res.status(500).json({ 
      error: 'Error al validar nombre de clase', 
      detalle: err.message 
    });
  }
}

