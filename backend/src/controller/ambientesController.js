import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import {
  expandirAsignacionesPorFechas,
  convertirNombresDiasANumeros,
  validarRangoHoras,
  validarRangoFechas,
  calcularCantidadAsignaciones,
  obtenerNombreDia
} from '../services/ambientesService.js';

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
       -- SISTEMA 100% MANUAL: Eliminadas comparaciones con NOW()
       -- El estado_responsabilidad = 'Activa' es suficiente
       -- AND ra.fecha_inicio <= NOW()
       -- AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
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

/**
 * Asignar ambiente a instructor con rango de fechas y días de la semana
 * 
 * Parámetros esperados:
 * - id_ambiente: ID del ambiente
 * - id_instructor: ID del instructor
 * - fecha_inicio: Fecha de inicio del rango (YYYY-MM-DD)
 * - fecha_fin: Fecha de fin del rango (YYYY-MM-DD)
 * - dias_semana: Array de nombres de días (["Lunes", "Viernes"])
 * - hora_inicio: Hora de inicio (HH:mm)
 * - hora_fin: Hora de fin (HH:mm)
 * - observaciones: Observaciones opcionales
 */
export async function asignarAmbienteInstructor(req, res) {
  try {
    const {
      id_ambiente,
      id_instructor,
      fecha_inicio,
      fecha_fin,
      dias_semana,
      hora_inicio,
      hora_fin,
      observaciones
    } = req.body;

    const asignadoPor = req.user?.id;

    // Validar campos obligatorios
    if (!id_ambiente || !id_instructor || !fecha_inicio || !fecha_fin || !dias_semana || !hora_inicio || !hora_fin) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: id_ambiente, id_instructor, fecha_inicio, fecha_fin, dias_semana, hora_inicio, hora_fin'
      });
    }

    // Validar que dias_semana es un array no vacío
    if (!Array.isArray(dias_semana) || dias_semana.length === 0) {
      return res.status(400).json({
        error: 'Días de la semana inválidos',
        detalle: 'Debes seleccionar al menos un día de la semana'
      });
    }

    // Validar rango de fechas
    const validacionFechas = validarRangoFechas(fecha_inicio, fecha_fin);
    if (!validacionFechas.valid) {
      return res.status(400).json({
        error: 'Rango de fechas inválido',
        detalle: validacionFechas.error
      });
    }

    // Validar rango de horas
    const validacionHoras = validarRangoHoras(hora_inicio, hora_fin);
    if (!validacionHoras.valid) {
      return res.status(400).json({
        error: 'Rango de horas inválido',
        detalle: validacionHoras.error
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

    // Convertir nombres de días a números
    const numeroDias = convertirNombresDiasANumeros(dias_semana);
    if (numeroDias.length === 0) {
      return res.status(400).json({
        error: 'Días de la semana inválidos',
        detalle: 'Los días seleccionados no son válidos'
      });
    }

    // Expandir asignaciones por fecha y días
    const asignacionesExpandidas = expandirAsignacionesPorFechas(
      fecha_inicio,
      fecha_fin,
      numeroDias,
      hora_inicio,
      hora_fin
    );

    if (asignacionesExpandidas.length === 0) {
      return res.status(400).json({
        error: 'Sin asignaciones generadas',
        detalle: 'No hay fechas dentro del rango seleccionado para los días especificados'
      });
    }

    // Verificar conflictos: no permitir asignaciones solapadas para el mismo instructor y ambiente
    const fechasConflicto = [];
    for (const asignacion of asignacionesExpandidas) {
      const [[conflicto]] = await defaultDb.execute(
        `SELECT ra.id_responsabilidad_ambiente
         FROM Responsabilidades_Ambiente ra
         WHERE ra.id_ambiente = ?
           AND ra.id_usuario = ?
           AND ra.estado_responsabilidad = 'Activa'
           AND DATE(ra.fecha_inicio) = ?
           AND ra.id_clase IS NULL`,
        [id_ambiente, id_instructor, asignacion.fecha_asignacion.toISOString().split('T')[0]]
      );

      if (conflicto) {
        fechasConflicto.push(asignacion.fecha_asignacion.toISOString().split('T')[0]);
      }
    }

    if (fechasConflicto.length > 0) {
      return res.status(409).json({
        error: 'Conflicto de asignaciones',
        detalle: `Este instructor ya tiene asignaciones en los siguientes días: ${fechasConflicto.join(', ')}`
      });
    }

    // Crear todas las asignaciones
    const asignacionesCreadas = [];
    const connection = await defaultDb.pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const asignacion of asignacionesExpandidas) {
        const fechaAsignacion = asignacion.fecha_asignacion.toISOString().split('T')[0];
        const [result] = await connection.execute(
          `INSERT INTO Responsabilidades_Ambiente
           (id_ambiente, id_usuario, tipo_responsabilidad, fecha_inicio, hora_inicio, hora_fin, estado_responsabilidad, observaciones, creado_por, asignacion_automatica)
           VALUES (?, ?, 'Principal', ?, ?, ?, 'Activa', ?, ?, TRUE)`,
          [
            id_ambiente,
            id_instructor,
            `${fechaAsignacion} ${hora_inicio}`,
            hora_inicio,
            hora_fin,
            observaciones || null,
            asignadoPor
          ]
        );

        asignacionesCreadas.push({
          id: result.insertId,
          fecha: fechaAsignacion,
          dia: asignacion.nombre_dia,
          hora_inicio,
          hora_fin
        });
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return res.status(201).json({
      ok: true,
      message: `Ambiente "${ambiente.nombre_ambiente}" asignado correctamente a ${instructor.nombre_usuario} para ${asignacionesCreadas.length} fechas`,
      cantidad_asignaciones: asignacionesCreadas.length,
      fecha_inicio,
      fecha_fin,
      dias_semana,
      hora_inicio,
      hora_fin,
      asignaciones: asignacionesCreadas
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

    // SISTEMA 100% MANUAL: Usar fecha/hora actual del servidor para fecha_fin
    // pero el cambio de estado es manual, no automático
    const fechaFin = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await defaultDb.execute(
      `UPDATE Responsabilidades_Ambiente
       SET estado_responsabilidad = 'Finalizada',
           fecha_fin = ?
       WHERE id_responsabilidad_ambiente = ?`,
      [fechaFin, id_responsabilidad]
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
 * Listar asignaciones de ambientes a instructores
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
        CAST(ra.dias_semana AS CHAR) AS dias_semana,
        ra.hora_inicio,
        ra.hora_fin,
        ra.id_usuario,
        u.nombre_usuario AS instructor_nombre,
        u.cedula AS instructor_cedula,
        ra.tipo_responsabilidad,
        ra.fecha_inicio,
        ra.fecha_fin,
        ra.hora_inicio,
        ra.hora_fin,
        ra.estado_responsabilidad,
        ra.observaciones,
        ra.asignacion_automatica,
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

/**
 * Obtener instructores asignados a un ambiente específico
 * Incluye información sobre si son cuentadantes secundarios
 */
export async function obtenerInstructoresAmbiente(req, res) {
  try {
    const { id } = req.params;
    const { fecha_consulta } = req.query;

    // Validar que el ambiente existe
    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [id]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    // Obtener instructores asignados al ambiente
    let query = `
      SELECT DISTINCT
        u.id_usuario,
        u.nombre_usuario,
        u.cedula,
        u.correo,
        r.nombre_rol,
        ra.tipo_responsabilidad,
        ra.fecha_inicio,
        ra.fecha_fin,
        ra.estado_responsabilidad,
        COUNT(DISTINCT ra2.id_ambiente) AS total_ambientes_asignados
      FROM Responsabilidades_Ambiente ra
      INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
      INNER JOIN Roles r ON u.id_rol = r.id_rol
      LEFT JOIN Responsabilidades_Ambiente ra2 ON ra2.id_usuario = u.id_usuario 
        AND ra2.estado_responsabilidad = 'Activa'
        -- SISTEMA 100% MANUAL: Eliminada comparación con NOW()
        -- AND (ra2.fecha_fin IS NULL OR ra2.fecha_fin >= NOW())
      WHERE ra.id_ambiente = ?
        AND r.nombre_rol = 'Instructor'
        AND ra.estado_responsabilidad = 'Activa'
    `;
    const params = [id];

    // SISTEMA 100% MANUAL: fecha_consulta es solo informativa
    // Las responsabilidades activas se determinan por estado_responsabilidad = 'Activa'
    // if (fecha_consulta) {
    //   const fechaConsulta = new Date(fecha_consulta).toISOString().slice(0, 19).replace('T', ' ');
    //   query += ' AND ra.fecha_inicio <= ? AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= ?)';
    //   params.push(fechaConsulta, fechaConsulta);
    // } else {
    //   query += ' AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())';
    // }

    // OPTIMIZACIÓN: Usar subconsulta en lugar de LEFT JOIN con GROUP BY para mejor rendimiento
    query = `
      SELECT 
        u.id_usuario,
        u.nombre_usuario,
        u.cedula,
        u.correo,
        r.nombre_rol,
        ra.tipo_responsabilidad,
        ra.fecha_inicio,
        ra.fecha_fin,
        ra.estado_responsabilidad,
        (SELECT COUNT(DISTINCT ra2.id_ambiente) 
         FROM Responsabilidades_Ambiente ra2 
         WHERE ra2.id_usuario = u.id_usuario 
           AND ra2.estado_responsabilidad = 'Activa') AS total_ambientes_asignados
      FROM Responsabilidades_Ambiente ra
      INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
      INNER JOIN Roles r ON u.id_rol = r.id_rol
      WHERE ra.id_ambiente = ?
        AND r.nombre_rol = 'Instructor'
        AND ra.estado_responsabilidad = 'Activa'
    `;

    const [instructores] = await defaultDb.execute(query, params);

    // Estandarizar respuesta: id_instructor, nombre, rol (PRINCIPAL/SECUNDARIO)
    const instructoresConInfo = instructores.map(instructor => {
      const esSecundario = instructor.total_ambientes_asignados >= 1;
      return {
        id_instructor: instructor.id_usuario, // Campo estandarizado para frontend
        id_usuario: instructor.id_usuario, // Mantener para compatibilidad
        nombre: instructor.nombre_usuario, // Campo estandarizado
        nombre_usuario: instructor.nombre_usuario, // Mantener para compatibilidad
        nombre_instructor: instructor.nombre_usuario, // Mantener para compatibilidad con frontend
        cedula: instructor.cedula,
        correo: instructor.correo,
        rol: esSecundario ? 'SECUNDARIO' : 'PRINCIPAL', // Campo estandarizado PRINCIPAL/SECUNDARIO
        tipo_responsabilidad: instructor.tipo_responsabilidad,
        es_cuentadante_secundario: esSecundario, // Mantener para compatibilidad
        total_ambientes: instructor.total_ambientes_asignados,
        fecha_inicio: instructor.fecha_inicio,
        fecha_fin: instructor.fecha_fin,
        estado_responsabilidad: instructor.estado_responsabilidad
      };
    });

    // Retornar array directamente para compatibilidad con frontend
    // El frontend espera: Array.isArray(data) ? data : []
    // Mantener campos estandarizados: id_instructor, nombre, rol (PRINCIPAL/SECUNDARIO)
    return res.json(instructoresConInfo);
  } catch (err) {
    logger.error('Error al obtener instructores del ambiente', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al obtener instructores del ambiente',
      detalle: err.message
    });
  }
}

/**
 * Cambiar instructor a cuentadante secundario de un ambiente
 * Solo el cuentadante principal del inventario del ambiente puede hacer este cambio
 */
export async function cambiarInstructorACuentadanteSecundario(req, res) {
  try {
    const { id_ambiente, id_instructor } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.rol;

    // Validar campos obligatorios
    if (!id_ambiente || !id_instructor) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: id_ambiente, id_instructor'
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

    // Validar que el instructor existe y es instructor
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

    // Validar permisos: Solo el cuentadante principal del inventario del ambiente puede hacer cambios
    // Un cuentadante principal es aquel que tiene equipos asignados en el ambiente
    const [[esCuentadantePrincipal]] = await defaultDb.execute(
      `SELECT COUNT(*) AS total
       FROM Elementos e
       WHERE e.id_ambiente = ?
         AND e.id_cuentadante = ?
         AND e.id_cuentadante IS NOT NULL`,
      [id_ambiente, userId]
    );

    // También permitir a Administradores
    if (userRole !== 'Administrador' && (!esCuentadantePrincipal || esCuentadantePrincipal.total === 0)) {
      return res.status(403).json({
        error: 'No autorizado',
        detalle: 'Solo el cuentadante principal del inventario del ambiente o un Administrador puede cambiar instructores a cuentadantes secundarios'
      });
    }

    // Verificar que el instructor tiene responsabilidades activas en el ambiente
    const [responsabilidades] = await defaultDb.execute(
      `SELECT id_responsabilidad_ambiente, tipo_responsabilidad
       FROM Responsabilidades_Ambiente
       WHERE id_ambiente = ?
         AND id_usuario = ?
         AND estado_responsabilidad = 'Activa'
         -- SISTEMA 100% MANUAL: Eliminada comparación con NOW()
         -- AND (fecha_fin IS NULL OR fecha_fin >= NOW())`,
      [id_ambiente, id_instructor]
    );

    if (responsabilidades.length === 0) {
      return res.status(404).json({
        error: 'Instructor no asignado',
        detalle: 'El instructor no tiene responsabilidades activas en este ambiente'
      });
    }

    // Verificar si ya es cuentadante secundario (tiene uno o más ambientes asignados)
    const [ambientesAsignados] = await defaultDb.execute(
      `SELECT COUNT(DISTINCT id_ambiente) AS total
       FROM Responsabilidades_Ambiente
       WHERE id_usuario = ?
         AND estado_responsabilidad = 'Activa'
         -- SISTEMA 100% MANUAL: Eliminada comparación con NOW()
         -- AND (fecha_fin IS NULL OR fecha_fin >= NOW())`,
      [id_instructor]
    );

    const yaEsSecundario = ambientesAsignados[0]?.total >= 1;

    if (yaEsSecundario) {
      return res.status(200).json({
        ok: true,
        message: 'El instructor ya es cuentadante secundario',
        instructor: {
          id_instructor: instructor.id_usuario, // Campo estandarizado
          id_usuario: instructor.id_usuario, // Mantener para compatibilidad
          nombre: instructor.nombre_usuario, // Campo estandarizado
          nombre_usuario: instructor.nombre_usuario, // Mantener para compatibilidad
          rol: 'SECUNDARIO', // Campo estandarizado
          total_ambientes: ambientesAsignados[0].total,
          es_cuentadante_secundario: true // Mantener para compatibilidad
        }
      });
    }

    // El instructor se convierte automáticamente en cuentadante secundario cuando tiene ambientes asignados
    // No necesitamos hacer cambios en la BD, solo confirmar el estado
    return res.json({
      ok: true,
      message: `El instructor "${instructor.nombre_usuario}" es ahora cuentadante secundario del ambiente "${ambiente.nombre_ambiente}"`,
      instructor: {
        id_instructor: instructor.id_usuario, // Campo estandarizado
        id_usuario: instructor.id_usuario, // Mantener para compatibilidad
        nombre: instructor.nombre_usuario, // Campo estandarizado
        nombre_usuario: instructor.nombre_usuario, // Mantener para compatibilidad
        rol: 'SECUNDARIO', // Campo estandarizado
        total_ambientes: ambientesAsignados[0]?.total || 1,
        es_cuentadante_secundario: true // Mantener para compatibilidad
      },
      ambiente: {
        id_ambiente: ambiente.id_ambiente,
        nombre_ambiente: ambiente.nombre_ambiente,
        codigo_ambiente: ambiente.codigo_ambiente
      }
    });
  } catch (err) {
    logger.error('Error al cambiar instructor a cuentadante secundario', { error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Error al cambiar instructor a cuentadante secundario',
      detalle: err.message
    });
  }
}

