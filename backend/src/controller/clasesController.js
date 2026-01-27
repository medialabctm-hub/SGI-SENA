import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import schedulerService from '../services/schedulerService.js';
import { obtenerFechasPorRangoYDias } from './horariosController.js';
import { getColombiaDateTimeString, toColombiaDateTimeString } from '../utils/timezone.js';

function normalizarHora(hora) {
  const horaStr = String(hora);
  if (horaStr.split(':').length === 2) {
    return `${horaStr}:00`;
  }
  return horaStr;
}

function crearDateTime(fecha, hora) {
  const horaNormalizada = normalizarHora(hora);
  return new Date(`${fecha}T${horaNormalizada}`);
}

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

        // Normalizar nombre_clase a mayúsculas sostenidas antes de guardar
        const nombreClaseNormalizado = nombre_clase ? normalizarNombreClase(nombre_clase) : null;
        
        // Insertar la clase
        const [result] = await defaultDb.execute(
          `INSERT INTO Clases 
           (id_ambiente, id_instructor, nombre_clase, codigo_ficha, descripcion, fecha_clase, hora_inicio, hora_fin, observaciones, estado_clase, creado_por)
           VALUES (?, ?, ?, ?, ?, DATE(?), ?, ?, ?, 'Programada', ?)`,
          [id_ambiente, instructorId, nombreClaseNormalizado, codigo_ficha || null, descripcion || null, fechaNormalizada, horaInicioNormalizada, horaFinNormalizada, observaciones || null, creadoPor]
        );

        const idClase = result.insertId;

        // LOG: Verificar que la clase se creó con el estado correcto
        const [[claseVerificada]] = await defaultDb.execute(
          'SELECT estado_clase, fecha_clase, hora_inicio, hora_fin FROM Clases WHERE id_clase = ?',
          [idClase]
        );
        logger.info('🔵 CLASE CREADA', {
          id_clase: idClase,
          estado_clase_esperado: 'Programada',
          estado_clase_bd: claseVerificada?.estado_clase,
          fecha_clase: claseVerificada?.fecha_clase,
          hora_inicio: claseVerificada?.hora_inicio,
          hora_fin: claseVerificada?.hora_fin,
          creado_por: creadoPor,
          usuario_actual: req.user?.id,
          timestamp: new Date().toISOString()
        });
        
        if (claseVerificada?.estado_clase !== 'Programada') {
          logger.error('❌ ERROR CRÍTICO: Clase creada con estado incorrecto', {
            id_clase: idClase,
            estado_esperado: 'Programada',
            estado_obtenido: claseVerificada?.estado_clase,
            stack: new Error().stack
          });
        }

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

    // Emitir eventos WebSocket para actualización en tiempo real
    try {
      const socketService = (await import('../services/socketService.js')).default;
      for (const claseCreada of clasesCreadas) {
        socketService.emitToAll('clase:updated', {
          id_clase: claseCreada.id_clase,
          estado_clase: 'Programada',
          action: 'created',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (socketErr) {
      logger.warn('Error al emitir evento Socket.io', { error: socketErr.message });
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

    // OPTIMIZACIÓN: Agregar paginación para evitar cargar todas las clases
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Máximo 100 por página
    const offset = (page - 1) * limit;

    query += ' GROUP BY c.id_clase ORDER BY c.fecha_clase DESC, c.hora_inicio DESC';
    query += ` LIMIT ${limit} OFFSET ${offset}`;

    // Obtener total para paginación
    let countQuery = `
      SELECT COUNT(DISTINCT c.id_clase) AS total
      FROM Clases c
      INNER JOIN Ambientes a ON c.id_ambiente = a.id_ambiente
      INNER JOIN Usuarios u_instructor ON c.id_instructor = u_instructor.id_usuario
      WHERE 1=1
    `;
    const countParams = [];
    
    if (userRole === 'Instructor') {
      countQuery += ' AND c.id_instructor = ?';
      countParams.push(userId);
    } else if (id_instructor) {
      countQuery += ' AND c.id_instructor = ?';
      countParams.push(id_instructor);
    }
    if (id_ambiente) {
      countQuery += ' AND c.id_ambiente = ?';
      countParams.push(id_ambiente);
    }
    if (fecha) {
      countQuery += ' AND c.fecha_clase = ?';
      countParams.push(fecha);
    }
    if (estado_clase) {
      countQuery += ' AND c.estado_clase = ?';
      countParams.push(estado_clase);
    }

    const [rows] = await defaultDb.execute(query, params);
    const [[{ total }]] = await defaultDb.execute(countQuery, countParams);
    
    return res.json({
      clases: rows,
      paginacion: {
        pagina: page,
        limite: limit,
        total: total,
        totalPaginas: Math.ceil(total / limit)
      }
    });
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

    // LOG: Intentar iniciar clase
    logger.info('🟢 INICIAR CLASE - INTENTO', {
      id_clase: id,
      usuario: req.user?.id,
      rol: req.user?.rol,
      fecha_inicio_real_provista: fecha_inicio_real,
      timestamp: new Date().toISOString(),
      stack: new Error().stack
    });

    // Validar que la clase existe y está en estado "Programada"
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase, id_ambiente, id_instructor FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      logger.warn('⚠️ INICIAR CLASE - Clase no encontrada', { id_clase: id });
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    logger.info('🟢 INICIAR CLASE - Estado actual', {
      id_clase: id,
      estado_clase_actual: clase.estado_clase,
      estado_esperado: 'Programada'
    });

    if (clase.estado_clase !== 'Programada') {
      logger.warn('⚠️ INICIAR CLASE - Estado incorrecto', {
        id_clase: id,
        estado_clase_actual: clase.estado_clase,
        estado_esperado: 'Programada'
      });
      return res.status(400).json({ 
        error: 'La clase no puede ser iniciada',
        detalle: `La clase está en estado "${clase.estado_clase}". Solo se pueden iniciar clases programadas.`
      });
    }

    // Usar fecha_inicio_real proporcionada o la fecha/hora de Colombia actual
    const fechaInicio = fecha_inicio_real
      ? toColombiaDateTimeString(fecha_inicio_real)
      : getColombiaDateTimeString();

    logger.info('🟢 INICIAR CLASE - Ejecutando sp_iniciar_clase', {
      id_clase: id,
      fecha_inicio: fechaInicio
    });

    // Llamar al procedimiento almacenado
    await defaultDb.execute(
      'CALL sp_iniciar_clase(?, ?)',
      [id, fechaInicio]
    );

    // LOG: Verificar que el estado cambió correctamente
    const [[claseActualizada]] = await defaultDb.execute(
      'SELECT estado_clase, fecha_inicio_real FROM Clases WHERE id_clase = ?',
      [id]
    );
    logger.info('🟢 INICIAR CLASE - COMPLETADO', {
      id_clase: id,
      estado_clase_esperado: 'En Curso',
      estado_clase_bd: claseActualizada?.estado_clase,
      fecha_inicio_real: claseActualizada?.fecha_inicio_real,
      timestamp: new Date().toISOString()
    });
    
    if (claseActualizada?.estado_clase !== 'En Curso') {
      logger.error('❌ ERROR CRÍTICO: Estado no cambió a En Curso después de iniciar', {
        id_clase: id,
        estado_esperado: 'En Curso',
        estado_obtenido: claseActualizada?.estado_clase
      });
    }

    // Obtener inventario del ambiente para retornarlo
    const [inventario] = await defaultDb.execute(
      `SELECT 
        e.codigo_equipo,
        e.tipo,
        e.modelo,
        e.placa,
        e.consecutivo,
        e.r_centro,
        e.descripcion,
        e.estado_fisico,
        ee.estado_operativo,
        ce.nombre_categoria
       FROM Elementos e
       INNER JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
       LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
       LEFT JOIN Categorias_Equipo ce ON e.id_categoria = ce.id_categoria
       WHERE a.id_ambiente = ?
         AND e.estado_fisico != 'Baja'
       ORDER BY e.tipo, e.modelo, e.placa`,
      [clase.id_ambiente]
    );

    // Emitir evento WebSocket para actualización en tiempo real
    const socketService = (await import('../services/socketService.js')).default;
    socketService.emitToAll('clase:updated', {
      id_clase: id,
      estado_clase: 'En Curso',
      action: 'iniciada',
      timestamp: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      message: 'Clase iniciada correctamente. Responsabilidades asignadas.',
      fecha_inicio: fechaInicio,
      inventario: inventario || []
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

    // LOG CRÍTICO: Detectar llamadas inesperadas a finalizarClase
    logger.warn('🔴 FINALIZAR CLASE - LLAMADA DETECTADA', {
      id_clase: id,
      usuario: req.user?.id,
      rol: req.user?.rol,
      nombre_usuario: req.user?.nombre_usuario,
      fecha_fin_real_provista: fecha_fin_real,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      user_agent: req.get('user-agent'),
      stack: new Error().stack // Stack trace completo para identificar el origen
    });

    // Validar que la clase existe y está en estado "En Curso"
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase, fecha_clase, hora_inicio, hora_fin, fecha_inicio_real FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      logger.warn('⚠️ FINALIZAR CLASE - Clase no encontrada', { id_clase: id });
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    logger.warn('🔴 FINALIZAR CLASE - Estado actual de la clase', {
      id_clase: id,
      estado_clase_actual: clase.estado_clase,
      estado_esperado: 'En Curso',
      fecha_clase: clase.fecha_clase,
      hora_inicio: clase.hora_inicio,
      hora_fin: clase.hora_fin,
      fecha_inicio_real: clase.fecha_inicio_real
    });

    if (clase.estado_clase !== 'En Curso') {
      logger.error('❌ FINALIZAR CLASE - Estado incorrecto. NO DEBE FINALIZARSE', {
        id_clase: id,
        estado_clase_actual: clase.estado_clase,
        estado_esperado: 'En Curso',
        usuario: req.user?.id,
        stack: new Error().stack
      });
      return res.status(400).json({ 
        error: 'La clase no puede ser finalizada',
        detalle: `La clase está en estado "${clase.estado_clase}". Solo se pueden finalizar clases en curso.`
      });
    }

    // NOTA: No validamos tiempo aquí - el horario es solo informativo
    // El instructor puede finalizar la clase cuando lo considere necesario

    // Usar fecha_fin_real proporcionada o la fecha/hora de Colombia actual
    const fechaFin = fecha_fin_real
      ? toColombiaDateTimeString(fecha_fin_real)
      : getColombiaDateTimeString();

    logger.warn('🔴 FINALIZAR CLASE - Ejecutando sp_finalizar_clase', {
      id_clase: id,
      fecha_fin: fechaFin,
      usuario: req.user?.id
    });

    // Llamar al procedimiento almacenado
    try {
      await defaultDb.execute(
        'CALL sp_finalizar_clase(?, ?)',
        [id, fechaFin]
      );
    } catch (dbError) {
      // Log detallado del error para debugging
      logger.error('❌ Error al ejecutar sp_finalizar_clase', {
        id_clase: id,
        fecha_fin: fechaFin,
        error_code: dbError.code,
        error_message: dbError.message,
        error_sql_state: dbError.sqlState,
        error_sql_message: dbError.sqlMessage,
        usuario: req.user?.id,
        stack: new Error().stack
      });
      throw dbError;
    }

    // LOG: Verificar que el estado cambió correctamente
    const [[claseFinalizada]] = await defaultDb.execute(
      'SELECT estado_clase, fecha_fin_real FROM Clases WHERE id_clase = ?',
      [id]
    );
    logger.warn('🔴 FINALIZAR CLASE - COMPLETADO', {
      id_clase: id,
      estado_clase_esperado: 'Finalizada',
      estado_clase_bd: claseFinalizada?.estado_clase,
      fecha_fin_real: claseFinalizada?.fecha_fin_real,
      usuario: req.user?.id,
      timestamp: new Date().toISOString()
    });

    if (claseFinalizada?.estado_clase !== 'Finalizada') {
      logger.error('❌ ERROR CRÍTICO: Estado no cambió a Finalizada después de finalizar', {
        id_clase: id,
        estado_esperado: 'Finalizada',
        estado_obtenido: claseFinalizada?.estado_clase
      });
    }

    // Emitir evento WebSocket para actualización en tiempo real
    const socketService = (await import('../services/socketService.js')).default;
    socketService.emitToAll('clase:updated', {
      id_clase: id,
      estado_clase: 'Finalizada',
      action: 'finalizada',
      timestamp: new Date().toISOString(),
    });

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

    // LOG: Verificar si se intenta cambiar estado_clase (NO DEBE PERMITIRSE)
    if (req.body.estado_clase !== undefined) {
      logger.error('❌ ACTUALIZAR CLASE - Intento de cambiar estado_clase directamente', {
        id_clase: id,
        estado_clase_intentado: req.body.estado_clase,
        usuario: userId,
        rol: userRole,
        stack: new Error().stack
      });
      return res.status(400).json({ 
        error: 'No se puede cambiar el estado directamente',
        detalle: 'El estado de la clase solo puede cambiarse mediante las acciones Iniciar/Finalizar/Cancelar'
      });
    }

    const allowed = ['nombre_clase', 'codigo_ficha', 'descripcion', 'fecha_clase', 'hora_inicio', 'hora_fin', 'observaciones'];
    const sets = [];
    const params = [];

    logger.info('🟦 ACTUALIZAR CLASE - Campos a actualizar', {
      id_clase: id,
      campos: Object.keys(req.body).filter(k => allowed.includes(k)),
      usuario: userId
    });

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
        } else if (key === 'nombre_clase' && value) {
          // Normalizar nombre_clase a mayúsculas sostenidas
          value = normalizarNombreClase(value);
          sets.push(`${key} = ?`);
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

    // Emitir evento WebSocket para actualización en tiempo real
    try {
      const socketService = (await import('../services/socketService.js')).default;
      socketService.emitToAll('clase:updated', {
        id_clase: id,
        action: 'updated',
        timestamp: new Date().toISOString(),
      });
    } catch (socketErr) {
      logger.warn('Error al emitir evento Socket.io', { error: socketErr.message });
    }

    return res.json({ ok: true, message: 'Clase actualizada correctamente' });
  } catch (err) {
    logger.error('Error al actualizar clase', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al actualizar la clase', detalle: err.message });
  }
}

/**
 * Manejar consentimiento para iniciar clase - Aceptar
 */
export async function aceptarConsentimiento(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    logger.info('✅ ACEPTAR CONSENTIMIENTO - INTENTO', {
      id_clase: id,
      usuario: userId,
      timestamp: new Date().toISOString()
    });

    // Validar que la clase existe y está en estado "Programada"
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase, id_instructor FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Verificar que el usuario es el instructor de la clase
    if (clase.id_instructor !== userId) {
      return res.status(403).json({ 
        error: 'No autorizado',
        detalle: 'Solo el instructor de la clase puede aceptar el consentimiento'
      });
    }

    if (clase.estado_clase !== 'Programada') {
      return res.status(400).json({ 
        error: 'La clase no puede ser iniciada',
        detalle: `La clase está en estado "${clase.estado_clase}". Solo se pueden iniciar clases programadas.`
      });
    }

    // Iniciar la clase
    const fechaInicio = getColombiaDateTimeString();

    await defaultDb.execute(
      'CALL sp_iniciar_clase(?, ?)',
      [id, fechaInicio]
    );

    logger.info('✅ CONSENTIMIENTO ACEPTADO - Clase iniciada', {
      id_clase: id,
      usuario: userId,
      fecha_inicio: fechaInicio
    });

    // Emitir evento WebSocket
    const socketService = (await import('../services/socketService.js')).default;
    socketService.emitToAll('clase:updated', {
      id_clase: id,
      estado_clase: 'En Curso',
      action: 'iniciada',
      timestamp: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      message: 'Consentimiento aceptado. Clase iniciada correctamente.',
      fecha_inicio: fechaInicio
    });
  } catch (err) {
    logger.error('Error al aceptar consentimiento', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al aceptar consentimiento', detalle: err.message });
  }
}

/**
 * Manejar consentimiento para iniciar clase - Rechazar
 */
export async function rechazarConsentimiento(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    logger.info('❌ RECHAZAR CONSENTIMIENTO - INTENTO', {
      id_clase: id,
      usuario: userId,
      timestamp: new Date().toISOString()
    });

    // Validar que la clase existe y está en estado "Programada"
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase, id_instructor FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Verificar que el usuario es el instructor de la clase
    if (clase.id_instructor !== userId) {
      return res.status(403).json({ 
        error: 'No autorizado',
        detalle: 'Solo el instructor de la clase puede rechazar el consentimiento'
      });
    }

    if (clase.estado_clase !== 'Programada') {
      return res.status(400).json({ 
        error: 'La clase no puede ser cancelada',
        detalle: `La clase está en estado "${clase.estado_clase}". Solo se pueden cancelar clases programadas.`
      });
    }

    // Cancelar la clase y agregar descripción "Consentimiento Rechazado"
    const observaciones = 'Consentimiento Rechazado';
    
    await defaultDb.execute(
      'UPDATE Clases SET estado_clase = "Cancelada", observaciones = CONCAT(COALESCE(observaciones, ""), IF(observaciones IS NULL OR observaciones = "", "", " - "), ?) WHERE id_clase = ?',
      [observaciones, id]
    );

    logger.info('❌ CONSENTIMIENTO RECHAZADO - Clase cancelada', {
      id_clase: id,
      usuario: userId,
      observaciones: observaciones
    });

    // Emitir evento WebSocket
    const socketService = (await import('../services/socketService.js')).default;
    socketService.emitToAll('clase:updated', {
      id_clase: id,
      estado_clase: 'Cancelada',
      action: 'cancelada',
      motivo: 'Consentimiento Rechazado',
      timestamp: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      message: 'Consentimiento rechazado. Clase cancelada.',
      observaciones: observaciones
    });
  } catch (err) {
    logger.error('Error al rechazar consentimiento', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al rechazar consentimiento', detalle: err.message });
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

    // LOG: Intentar cancelar clase
    logger.info('🟡 CANCELAR CLASE - INTENTO', {
      id_clase: id,
      usuario: userId,
      rol: userRole,
      timestamp: new Date().toISOString(),
      stack: new Error().stack
    });

    // Validar que la clase existe
    const [[clase]] = await defaultDb.execute(
      'SELECT id_clase, estado_clase, id_instructor FROM Clases WHERE id_clase = ?',
      [id]
    );

    if (!clase) {
      logger.warn('⚠️ CANCELAR CLASE - Clase no encontrada', { id_clase: id });
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    logger.info('🟡 CANCELAR CLASE - Estado actual', {
      id_clase: id,
      estado_clase_actual: clase.estado_clase
    });

    // Si es instructor, solo puede cancelar sus propias clases
    if (userRole === 'Instructor' && clase.id_instructor !== userId) {
      logger.warn('⚠️ CANCELAR CLASE - No autorizado', {
        id_clase: id,
        usuario: userId,
        instructor_clase: clase.id_instructor
      });
      return res.status(403).json({ 
        error: 'No autorizado',
        detalle: 'Solo puedes cancelar tus propias clases'
      });
    }

    if (clase.estado_clase === 'Finalizada') {
      logger.warn('⚠️ CANCELAR CLASE - Clase ya finalizada', {
        id_clase: id,
        estado_clase: clase.estado_clase
      });
      return res.status(400).json({ error: 'No se puede cancelar una clase finalizada' });
    }

    // Si está en curso, finalizar responsabilidades primero
    if (clase.estado_clase === 'En Curso') {
      logger.warn('🟡 CANCELAR CLASE - Clase en curso, finalizando responsabilidades primero', {
        id_clase: id,
        usuario: userId
      });
      const fechaFin = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await defaultDb.execute(
        'CALL sp_finalizar_clase(?, ?)',
        [id, fechaFin]
      );
      logger.warn('🟡 CANCELAR CLASE - Responsabilidades finalizadas', {
        id_clase: id,
        fecha_fin: fechaFin
      });
    }

    // Obtener descripción adicional del body si existe (para casos como "Consentimiento Rechazado")
    const { descripcion_adicional } = req.body || {};
    let observaciones = '';
    
    if (descripcion_adicional) {
      observaciones = descripcion_adicional;
    }

    // Cambiar estado a Cancelada y actualizar observaciones si hay descripción adicional
    if (observaciones) {
      await defaultDb.execute(
        'UPDATE Clases SET estado_clase = "Cancelada", observaciones = CONCAT(COALESCE(observaciones, ""), IF(observaciones IS NULL OR observaciones = "", "", " - "), ?) WHERE id_clase = ?',
        [observaciones, id]
      );
    } else {
      await defaultDb.execute(
        'UPDATE Clases SET estado_clase = "Cancelada" WHERE id_clase = ?',
        [id]
      );
    }

    logger.info('🟡 CANCELAR CLASE - COMPLETADO', {
      id_clase: id,
      estado_final: 'Cancelada',
      usuario: userId,
      observaciones: observaciones || null,
      timestamp: new Date().toISOString()
    });

    return res.json({ ok: true, message: 'Clase cancelada correctamente' });
  } catch (err) {
    logger.error('Error al cancelar clase', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al cancelar la clase', detalle: err.message });
  }
}

/**
 * Consultar responsables de un ambiente (SISTEMA 100% MANUAL - CONSULTA INFORMATIVA)
 * 
 * IMPORTANTE: Esta función es SOLO para consultas informativas.
 * El tiempo (fecha/hora) es SOLO INFORMATIVO para mostrar qué clase está programada.
 * NO afecta la lógica de negocio.
 * NO cambia estados.
 * 
 * Las responsabilidades activas se determinan por estado_responsabilidad = 'Activa',
 * no por comparaciones de tiempo.
 * 
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

    // Construir datetime para la consulta (SOLO INFORMATIVO)
    const fechaHoraConsulta = `${fecha} ${hora}:00`;

    // SISTEMA 100% MANUAL: Buscar clase activa (estado 'En Curso') o programada
    // El tiempo es SOLO INFORMATIVO para mostrar qué clase está programada en ese horario
    // NO se usa para determinar si la clase está activa
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
         -- NOTA: Comparaciones de tiempo SOLO INFORMATIVAS para mostrar qué clase está programada
         -- NO afectan la lógica de negocio. El estado 'En Curso' se activa manualmente.
         AND TIME(?) >= TIME(c.hora_inicio)
         AND TIME(?) <= TIME(c.hora_fin)`,
      [id_ambiente, fecha, fechaHoraConsulta, fechaHoraConsulta]
    );

    if (!claseActiva) {
      // Si no hay clase activa, buscar responsabilidades permanentes por jornada
      // SISTEMA 100% MANUAL: Solo usar estado_responsabilidad = 'Activa'
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
           -- SISTEMA 100% MANUAL: Eliminadas comparaciones de tiempo
           -- El estado_responsabilidad = 'Activa' es suficiente
           -- AND ra.fecha_inicio <= ?
           -- AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= ?)`,
        [id_ambiente, jornada]
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
 * Ejecutar automatización de clases manualmente (endpoint de sincronización)
 * 
 * Este endpoint ejecuta el scheduler que AUTOMÁTICAMENTE:
 * - Inicia clases cuando llega la hora de inicio programada (margen ±2 min)
 * - Finaliza clases cuando pasa la hora de fin programada (margen ±2 min)
 * - Envía notificaciones de advertencia 5 minutos antes del inicio/fin
 * 
 * Nota: El scheduler también se ejecuta automáticamente cada 1 minuto en segundo plano.
 * Este endpoint permite ejecutarlo manualmente cuando sea necesario.
 */
export async function sincronizarResponsabilidadesHorarios(req, res) {
  try {
    const resultado = await schedulerService.executeSync();

    return res.json({
      ok: true,
      message: 'Automatización de clases ejecutada',
      clases_iniciadas: resultado.clasesIniciadas || 0,
      clases_finalizadas: resultado.clasesFinalizadas || 0,
      notificaciones: resultado.notificaciones || 0,
      errores: resultado?.errores?.length ? resultado.errores : undefined
    });
  } catch (err) {
    logger.error('Error al monitorear clases', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al monitorear clases',
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
 * Combina nombres de la tabla Clases y de Nombres_Clases validados
 * Retorna lista de nombres únicos ordenados alfabéticamente
 */
export async function obtenerNombresClases(req, res) {
  try {
    const { busqueda } = req.query; // Opcional: filtrar por búsqueda
    
    // Obtener nombres de clases existentes
    let queryClases = `
      SELECT DISTINCT nombre_clase
      FROM Clases
      WHERE nombre_clase IS NOT NULL 
        AND nombre_clase != ''
    `;
    
    // Obtener nombres validados de la tabla Nombres_Clases
    let queryNombres = `
      SELECT DISTINCT nombre_clase
      FROM Nombres_Clases
      WHERE activo = TRUE
        AND nombre_clase IS NOT NULL 
        AND nombre_clase != ''
    `;
    
    const params = [];
    
    if (busqueda && busqueda.trim()) {
      queryClases += ' AND nombre_clase LIKE ?';
      queryNombres += ' AND nombre_clase LIKE ?';
      params.push(`%${busqueda.trim()}%`);
    }
    
    queryClases += ' ORDER BY nombre_clase ASC';
    queryNombres += ' ORDER BY nombre_clase ASC';
    
    // Ejecutar ambas consultas
    const [rowsClases] = await defaultDb.execute(queryClases, busqueda && busqueda.trim() ? params : []);
    const [rowsNombres] = await defaultDb.execute(queryNombres, busqueda && busqueda.trim() ? params : []);
    
    // Combinar y eliminar duplicados
    const nombresSet = new Set();
    rowsClases.forEach(row => {
      if (row.nombre_clase) nombresSet.add(row.nombre_clase);
    });
    rowsNombres.forEach(row => {
      if (row.nombre_clase) nombresSet.add(row.nombre_clase);
    });
    
    const nombres = Array.from(nombresSet).sort();
    
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
 * Guarda el nombre en la tabla Nombres_Clases para que aparezca en autocompletado
 * Valida duplicados mediante normalización
 */
export async function crearNombreClase(req, res) {
  try {
    const { nombre_clase } = req.body;
    const userId = req.user?.id;
    
    if (!nombre_clase || typeof nombre_clase !== 'string' || !nombre_clase.trim()) {
      return res.status(400).json({
        error: 'Campo obligatorio',
        detalle: 'El nombre de la clase es obligatorio'
      });
    }
    
    if (!userId) {
      return res.status(401).json({
        error: 'No autorizado',
        detalle: 'Usuario no identificado'
      });
    }
    
    const nombreNormalizado = normalizarNombreClase(nombre_clase);
    
    if (nombreNormalizado.length === 0) {
      return res.status(400).json({
        error: 'Nombre inválido',
        detalle: 'El nombre de la clase no puede estar vacío'
      });
    }
    
    // Verificar si ya existe un nombre similar (normalizado) en Nombres_Clases
    const [existentesNombres] = await defaultDb.execute(
      `SELECT id_nombre_clase, nombre_clase 
       FROM Nombres_Clases 
       WHERE nombre_normalizado = ? 
         AND activo = TRUE
       LIMIT 1`,
      [nombreNormalizado]
    );
    
    if (existentesNombres.length > 0) {
      return res.status(409).json({
        error: 'Nombre duplicado',
        detalle: `Ya existe un nombre validado: "${existentesNombres[0].nombre_clase}"`,
        nombre_existente: existentesNombres[0].nombre_clase
      });
    }
    
    // Verificar si ya existe en la tabla Clases
    const [existentesClases] = await defaultDb.execute(
      `SELECT DISTINCT nombre_clase 
       FROM Clases 
       WHERE UPPER(TRIM(REPLACE(REPLACE(nombre_clase, '  ', ' '), CHAR(9), ' '))) = ? 
       LIMIT 1`,
      [nombreNormalizado]
    );
    
    if (existentesClases.length > 0) {
      return res.status(409).json({
        error: 'Nombre duplicado',
        detalle: `Ya existe una clase con el nombre "${existentesClases[0].nombre_clase}"`,
        nombre_existente: existentesClases[0].nombre_clase
      });
    }
    
    // Insertar el nuevo nombre en Nombres_Clases
    // Guardar siempre en mayúsculas sostenidas
    const [result] = await defaultDb.execute(
      `INSERT INTO Nombres_Clases (nombre_clase, nombre_normalizado, creado_por) 
       VALUES (?, ?, ?)`,
      [nombreNormalizado, nombreNormalizado, userId]
    );
    
    return res.status(200).json({
      ok: true,
      message: 'Nombre de clase guardado correctamente',
      nombre_clase: nombreNormalizado,
      nombre_normalizado: nombreNormalizado,
      id: result.insertId
    });
  } catch (err) {
    logger.error('Error al crear nombre de clase', { error: err.message, stack: err.stack });
    return res.status(500).json({ 
      error: 'Error al guardar nombre de clase', 
      detalle: err.message 
    });
  }
}

