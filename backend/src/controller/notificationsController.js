import defaultDb from '../config/dbconfig.js'
import { createForUsers } from '../services/notificationService.js'

const MAX_LIMIT = 50

export async function listNotifications(req, res) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' })
    }

    const limitParam = Number.parseInt(req.query.limit, 10)
    const offsetParam = Number.parseInt(req.query.offset, 10)
    const limitValue = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, MAX_LIMIT)) : 15
    const offsetValue = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0

    const [countRows] = await defaultDb.execute(
      `SELECT
        SUM(CASE WHEN leida = 0 THEN 1 ELSE 0 END) AS unreadCount,
        COUNT(*) AS totalCount
       FROM Notificaciones
       WHERE id_usuario = ?`,
      [userId]
    )
    const aggregates = countRows?.[0] || { unreadCount: 0, totalCount: 0 }

    const [rows] = await defaultDb.execute(
      `SELECT
         id_notificacion AS id,
         titulo,
         cuerpo,
         tipo,
         leida,
         fecha_creacion,
         fecha_lectura,
         metadata
       FROM Notificaciones
       WHERE id_usuario = ?
       ORDER BY fecha_creacion DESC
       LIMIT ${limitValue} OFFSET ${offsetValue}`,
      [userId]
    )

    return res.json({
      notifications: rows,
      unreadCount: Number(aggregates.unreadCount) || 0,
      total: Number(aggregates.totalCount) || rows.length,
      limit: limitValue,
      offset: offsetValue,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        notifications: [],
        unreadCount: 0,
        total: 0,
        limit: 15,
        offset: 0,
        generatedAt: new Date().toISOString(),
      })
    }
    return res.status(500).json({ error: 'Error al obtener notificaciones', details: err.message })
  }
}

export async function markNotificationRead(req, res) {
  try {
    const userId = req.user?.id
    const { id } = req.params
    const notificationId = Number.parseInt(id, 10)
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' })
    }
    if (!Number.isFinite(notificationId)) {
      return res.status(400).json({ error: 'Identificador inválido' })
    }

    const [result] = await defaultDb.execute(
      `UPDATE Notificaciones
       SET leida = 1,
           fecha_lectura = IFNULL(fecha_lectura, NOW())
       WHERE id_notificacion = ? AND id_usuario = ?`,
      [notificationId, userId]
    )

    if (!result?.affectedRows) {
      return res.status(404).json({ error: 'Notificación no encontrada' })
    }

    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Error al actualizar notificación', details: err.message })
  }
}

export async function markAllNotificationsRead(req, res) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' })
    }

    const [result] = await defaultDb.execute(
      `UPDATE Notificaciones
       SET leida = 1,
           fecha_lectura = IF(fecha_lectura IS NULL, NOW(), fecha_lectura)
       WHERE id_usuario = ? AND leida = 0`,
      [userId]
    )

    return res.json({ ok: true, updated: result?.affectedRows ?? 0 })
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ ok: true, updated: 0 })
    }
    return res.status(500).json({ error: 'Error al actualizar notificaciones', details: err.message })
  }
}

export async function createNotification(req, res) {
  try {
    const { id_usuario, titulo, cuerpo, tipo, metadata } = req.body || {}
    const ownerId = req.user?.id
    const userTarget = Number.isFinite(Number(id_usuario)) ? Number(id_usuario) : ownerId
    const title = (titulo || '').toString().trim()

    if (!userTarget) {
      return res.status(400).json({ error: 'Usuario objetivo requerido' })
    }

    if (!title) {
      return res.status(400).json({ error: 'El título es obligatorio' })
    }

    const body = (cuerpo || '').toString().trim()
    const creation = await createForUsers({
      userIds: [userTarget],
      titulo: title,
      cuerpo: body,
      tipo,
      metadata,
      creadoPor: ownerId ?? null,
    })

    if (creation.skipped) {
      return res.status(400).json({ error: 'Tabla Notificaciones no creada aún' })
    }

    if (!creation.inserted) {
      return res.status(404).json({ error: 'Usuario no disponible para notificaciones' })
    }

    return res.status(201).json({ ok: true, id: creation.insertId })
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(400).json({ error: 'Tabla Notificaciones no creada aún' })
    }
    return res.status(500).json({ error: 'Error al crear la notificación', details: err.message })
  }
}

