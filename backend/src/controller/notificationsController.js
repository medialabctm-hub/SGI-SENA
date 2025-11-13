import db from '../config/dbconfig.js'
import jwt from 'jsonwebtoken'
import process from 'process'

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS Notifications (
      id_notification INT AUTO_INCREMENT PRIMARY KEY,
      tipo VARCHAR(100),
      titulo VARCHAR(255),
      mensaje TEXT,
      id_usuario INT NULL,
      data JSON NULL,
      leido TINYINT(1) DEFAULT 0,
      creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
}

export async function createNotification({ tipo = null, titulo = null, mensaje = null, id_usuario = null, data = null }) {
  try {
    await ensureTable()
    const [result] = await db.execute(
      'INSERT INTO Notifications (tipo, titulo, mensaje, id_usuario, data) VALUES (?, ?, ?, ?, ?)',
      [tipo, titulo, mensaje, id_usuario || null, data ? JSON.stringify(data) : null]
    )
    return result.insertId
  } catch (err) {
    console.error('Error creating notification', err)
    throw err
  }
}

function getTokenUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  try {
    const payload = jwt.verify(token, secret)
    return payload
  } catch {
    return null
  }
}

export async function listNotifications(req, res) {
  try {
    await ensureTable()
    const user = getTokenUser(req)
    let rows
    if (user) {
      const [r] = await db.execute(
        `SELECT * FROM Notifications WHERE id_usuario IS NULL OR id_usuario = ? ORDER BY creado_at DESC LIMIT 200`,
        [user.id]
      )
      rows = r
    } else {
      const [r] = await db.execute(`SELECT * FROM Notifications ORDER BY creado_at DESC LIMIT 200`)
      rows = r
    }
    return res.json(rows)
  } catch (err) {
    return res.status(500).json({ error: 'Error al listar notificaciones', details: err.message })
  }
}

export async function markAsRead(req, res) {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'ID requerido' })
    const user = getTokenUser(req)
    if (!user) return res.status(401).json({ error: 'No autorizado' })
    // verify notification belongs to user or is global
    const [[notif]] = await db.execute('SELECT * FROM Notifications WHERE id_notification = ?', [id])
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' })
    if (notif.id_usuario && notif.id_usuario !== user.id) return res.status(403).json({ error: 'No permitido' })
    await db.execute('UPDATE Notifications SET leido = 1 WHERE id_notification = ?', [id])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Error al marcar leída', details: err.message })
  }
}

export async function markAllRead(req, res) {
  try {
    const user = getTokenUser(req)
    if (!user) return res.status(401).json({ error: 'No autorizado' })
    await ensureTable()
    await db.execute('UPDATE Notifications SET leido = 1 WHERE id_usuario = ? OR id_usuario IS NULL', [user.id])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Error al marcar todas', details: err.message })
  }
}
