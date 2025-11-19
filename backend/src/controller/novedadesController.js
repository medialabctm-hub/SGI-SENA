import defaultDb from '../config/dbconfig.js'
import { createForUsers, createForRole } from '../services/notificationService.js'

/**
 * Crear una nueva novedad
 * Admin e Instructor: pueden crear novedades para cualquier equipo
 * Aprendiz: solo puede crear novedades para equipos que tiene asignados
 */
export async function crearNovedad(req, res) {
  try {
    const { codigo_equipo, tipo_novedad, descripcion } = req.body
    const userId = req.user?.id

    if (!codigo_equipo || !tipo_novedad || !descripcion) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' })
    }

    // Validar que el equipo existe
    const [[equipo]] = await defaultDb.execute(
      'SELECT codigo_equipo, tipo, marca, modelo FROM Elementos WHERE codigo_equipo = ?',
      [codigo_equipo]
    )

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
    const [result] = await defaultDb.execute(
      `INSERT INTO Novedades (codigo_equipo, tipo_novedad, descripcion, reportado_por) 
       VALUES (?, ?, ?, ?)`,
      [codigo_equipo, tipo_novedad, descripcion, userId]
    )

    const equipoDesc = `${equipo.tipo} ${equipo.marca} ${equipo.modelo}`.trim()
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
        console.error('Error al notificar a administradores:', notifyErr)
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
      console.error('Error al notificar a responsables:', notifyErr)
    }

    return res.status(201).json({ 
      ok: true, 
      id: result.insertId,
      message: 'Novedad registrada correctamente',
      equipo: {
        codigo: equipo.codigo_equipo,
        descripcion: `${equipo.tipo} ${equipo.marca} ${equipo.modelo}`.trim()
      }
    })
  } catch (err) {
    console.error('Error al crear novedad:', err)
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
        e.marca AS equipo_marca,
        e.modelo AS equipo_modelo,
        e.numero_serie,
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
    console.error('Error al listar novedades:', err)
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
        e.marca AS equipo_marca,
        e.modelo AS equipo_modelo,
        e.numero_serie,
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
    console.error('Error al obtener novedad:', err)
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
    console.error('Error al actualizar estado de novedad:', err)
    return res.status(500).json({ error: 'Error al actualizar el estado de la novedad', details: err.message })
  }
}

