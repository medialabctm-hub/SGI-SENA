import defaultDb from '../config/dbconfig.js'
import { createForUsers, createForRole } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'
import { obtenerEquipoPorCodigo } from '../utils/sqlQueries.js'

/**
 * Crear una nueva novedad
 * Admin e Instructor: pueden crear novedades para cualquier equipo
 * Aprendiz: solo puede crear novedades para equipos que tiene asignados
 */
export async function crearNovedad(req, res) {
  try {
    const { codigo_equipo, tipo_novedad, descripcion } = req.body
    const userId = req.user?.id

    logger.debug('Crear novedad - Datos recibidos', { codigo_equipo, tipo_novedad, descripcion: descripcion?.substring(0, 50), userId })

    if (!codigo_equipo || !tipo_novedad || !descripcion) {
      return res.status(400).json({ 
        error: 'Faltan campos obligatorios',
        recibido: { codigo_equipo: !!codigo_equipo, tipo_novedad: !!tipo_novedad, descripcion: !!descripcion }
      })
    }

    // Validar y normalizar tipo_novedad
    const tiposValidos = ['Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Daño Físico', 'Falta de Componente', 'Otro']
    let tipoNovedadNormalizado = tipo_novedad.trim()
    
    // Validar tipo de novedad (las asignaciones redundantes fueron eliminadas)
    
    if (!tiposValidos.includes(tipoNovedadNormalizado)) {
      return res.status(400).json({ 
        error: 'Tipo de novedad inválido',
        tipo_recibido: tipo_novedad,
        tipos_validos: tiposValidos
      })
    }

    // Validar que el equipo existe usando utilidad SQL
    const equipo = await obtenerEquipoPorCodigo(defaultDb, codigo_equipo)

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    // Si es Aprendiz, validar que el equipo le esté asignado
    if (req.user?.rol === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [codigo_equipo, userId]
      )

      if (!asignacion) {
        return res.status(403).json({ 
          error: 'No tienes permiso para reportar novedades en este equipo. Solo puedes reportar novedades en equipos asignados a ti.' 
        })
      }
    }

    // Insertar la novedad
    let result
    try {
      [result] = await defaultDb.execute(
        `INSERT INTO Novedades (codigo_equipo, tipo_novedad, descripcion, reportado_por) 
         VALUES (?, ?, ?, ?)`,
        [codigo_equipo, tipoNovedadNormalizado, descripcion.trim(), userId]
      )
      logger.info('Novedad insertada correctamente', { id: result.insertId })
    } catch (insertErr) {
      logger.error('Error al insertar novedad en BD', { error: insertErr.message, stack: insertErr.stack })
      // Si el error es por tipo_novedad, dar un mensaje más claro
      if (insertErr.message && insertErr.message.includes('tipo_novedad')) {
        return res.status(400).json({
          error: 'Tipo de novedad no válido para la base de datos',
          details: 'Ejecuta el script BD/actualizar_tipo_novedad.sql para actualizar los tipos permitidos',
          tipo_intentado: tipoNovedadNormalizado
        })
      }
      throw insertErr
    }

    const equipoDesc = `${equipo.tipo} ${equipo.placa || ''} ${equipo.modelo}`.trim()
    const userRole = req.user?.rol

    // Si es Instructor o Aprendiz, notificar al Administrador
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      try {
        await createForRole({
          rolNombre: 'Administrador',
          titulo: {
            key: 'nueva_novedad_reportada',
            params: {}
          },
          cuerpo: {
            key: 'nueva_novedad_reportada_cuerpo',
            params: {
              rol: userRole,
              nombre: req.user?.nombre || 'usuario',
              tipo_novedad,
              equipo: equipoDesc
            }
          },
          tipo: 'alerta',
          metadata: {
            id_novedad: result.insertId,
            codigo_equipo,
            tipo_novedad,
            reportado_por: userId,
            ruta: `/novedades`
          },
          creadoPor: userId
        })
      } catch (notifyErr) {
        logger.error('Error al notificar a administradores', { error: notifyErr.message })
      }
    }

    // Notificar a los responsables del equipo (excluyendo al que reportó)
    try {
      const [responsables] = await defaultDb.execute(
        `SELECT DISTINCT id_usuario 
         FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND estado_responsabilidad = 'Activo' AND id_usuario != ?`,
        [codigo_equipo, userId]
      )

      if (responsables.length > 0) {
        const userIds = responsables.map(r => r.id_usuario)
        await createForUsers({
          userIds,
          titulo: {
            key: 'nueva_novedad_en_tu_equipo',
            params: {}
          },
          cuerpo: {
            key: 'nueva_novedad_en_tu_equipo_cuerpo',
            params: {
              tipo_novedad,
              equipo: equipoDesc
            }
          },
          tipo: 'aviso',
          metadata: {
            id_novedad: result.insertId,
            codigo_equipo,
            tipo_novedad,
            ruta: `/novedades`
          },
          creadoPor: userId
        })
      }
    } catch (notifyErr) {
      logger.error('Error al notificar a responsables', { error: notifyErr.message })
    }

    return res.status(201).json({ 
      ok: true, 
      id: result.insertId,
      message: 'Novedad registrada correctamente',
      equipo: {
        codigo: equipo.codigo_equipo,
        descripcion: `${equipo.tipo} ${equipo.placa || ''} ${equipo.modelo}`.trim()
      }
    })
  } catch (err) {
    logger.error('Error al crear novedad', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al registrar la novedad', details: err.message })
  }
}

/**
 * Listar novedades
 * Admin: ve todas las novedades
 * Instructor y Aprendiz: solo ven novedades de equipos asignados
 */
export async function listarNovedades(req, res) {
  try {
    const userId = req.user?.id
    const userRole = req.user?.rol

    let query = `
      SELECT 
        n.id_novedad,
        n.codigo_equipo,
        n.tipo_novedad,
        n.descripcion,
        n.fecha_novedad,
        n.estado_resolucion,
        n.fecha_resolucion,
        n.observaciones_resolucion,
        e.tipo AS equipo_tipo,
        e.placa AS equipo_placa,
        e.modelo AS equipo_modelo,
        e.consecutivo,
        e.r_centro,
        u.nombre_usuario AS reportado_por_nombre,
        r.nombre_usuario AS resuelto_por_nombre
      FROM Novedades n
      INNER JOIN Elementos e ON n.codigo_equipo = e.codigo_equipo
      INNER JOIN Usuarios u ON n.reportado_por = u.id_usuario
      LEFT JOIN Usuarios r ON n.resuelto_por = r.id_usuario
    `

    let params = []

    // Si es Instructor o Aprendiz, filtrar solo novedades de equipos asignados
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      query += `
        INNER JOIN Responsables_Equipo re 
          ON e.codigo_equipo = re.codigo_equipo
        WHERE re.id_usuario = ? AND re.estado_responsabilidad = 'Activo'
      `
      params.push(userId)
    }

    query += ` ORDER BY n.fecha_novedad DESC`

    const [rows] = await defaultDb.execute(query, params)

    return res.json(rows)
  } catch (err) {
    logger.error('Error al listar novedades', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al obtener novedades', details: err.message })
  }
}

/**
 * Obtener detalle de una novedad
 */
export async function obtenerNovedadPorId(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const userRole = req.user?.rol

    const [[novedad]] = await defaultDb.execute(
      `SELECT 
        n.*,
        e.tipo AS equipo_tipo,
        e.placa AS equipo_placa,
        e.modelo AS equipo_modelo,
        e.consecutivo,
        e.r_centro,
        u.nombre_usuario AS reportado_por_nombre,
        r.nombre_usuario AS resuelto_por_nombre
      FROM Novedades n
      INNER JOIN Elementos e ON n.codigo_equipo = e.codigo_equipo
      INNER JOIN Usuarios u ON n.reportado_por = u.id_usuario
      LEFT JOIN Usuarios r ON n.resuelto_por = r.id_usuario
      WHERE n.id_novedad = ?`,
      [id]
    )

    if (!novedad) {
      return res.status(404).json({ error: 'Novedad no encontrada' })
    }

    // Si es Instructor o Aprendiz, validar que el equipo le esté asignado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [novedad.codigo_equipo, userId]
      )

      if (!asignacion) {
        return res.status(403).json({ error: 'No tienes permiso para ver esta novedad' })
      }
    }

    return res.json(novedad)
  } catch (err) {
    logger.error('Error al obtener novedad', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al obtener detalle de la novedad', details: err.message })
  }
}

/**
 * Actualizar estado de una novedad
 * Admin e Instructor: pueden actualizar cualquier novedad
 * Aprendiz: solo puede actualizar novedades de equipos asignados
 */
export async function actualizarEstadoNovedad(req, res) {
  try {
    const { id } = req.params
    const { estado_resolucion, observaciones_resolucion } = req.body
    const userId = req.user?.id
    const userRole = req.user?.rol

    if (!estado_resolucion) {
      return res.status(400).json({ error: 'El estado de resolución es obligatorio' })
    }

    const estadosValidos = ['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto']
    if (!estadosValidos.includes(estado_resolucion)) {
      return res.status(400).json({ error: 'Estado de resolución inválido' })
    }

    // Obtener la novedad
    const [[novedad]] = await defaultDb.execute(
      'SELECT codigo_equipo, estado_resolucion FROM Novedades WHERE id_novedad = ?',
      [id]
    )

    if (!novedad) {
      return res.status(404).json({ error: 'Novedad no encontrada' })
    }

    // Si es Instructor o Aprendiz, validar que el equipo le esté asignado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [novedad.codigo_equipo, userId]
      )

      if (!asignacion) {
        return res.status(403).json({ error: 'No tienes permiso para actualizar esta novedad' })
      }
    }

    // Actualizar el estado
    const fechaResolucion = (estado_resolucion === 'Resuelto' || estado_resolucion === 'No Resuelto') 
      ? new Date() 
      : null
    const resueltoPor = (estado_resolucion === 'Resuelto' || estado_resolucion === 'No Resuelto') 
      ? userId 
      : null

    await defaultDb.execute(
      `UPDATE Novedades 
       SET estado_resolucion = ?, 
           fecha_resolucion = ?, 
           resuelto_por = ?, 
           observaciones_resolucion = ?
       WHERE id_novedad = ?`,
      [estado_resolucion, fechaResolucion, resueltoPor, observaciones_resolucion || null, id]
    )

    return res.json({ 
      message: 'Estado de novedad actualizado correctamente',
      estado_resolucion,
      fecha_resolucion: fechaResolucion
    })
  } catch (err) {
    logger.error('Error al actualizar estado de novedad', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al actualizar el estado de la novedad', details: err.message })
  }
}

