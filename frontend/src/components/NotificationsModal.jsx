import React, { useEffect, useState } from 'react'
import { FiCircle } from 'react-icons/fi'

export default function NotificationsModal({ onClose }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [hoveredId, setHoveredId] = useState(null)

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/notifications', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (!res.ok) throw new Error('Error fetching')
        const data = await res.json()
        setNotifications(data || [])
      } catch (err) {
        console.warn('No se pudieron cargar notificaciones', err)
      } finally {
        setLoading(false)
      }
    }
    fetchNotifications()
  }, [])

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      })
      if (!res.ok) throw new Error('Error')
      setNotifications((prev) => prev.map((n) => (n.id_notification === id ? { ...n, leido: 1 } : n)))
      // notify listeners (Header) to refresh counts
      try { window.dispatchEvent(new CustomEvent('notifications-updated')) } catch {}
    } catch (err) {
      console.warn('No se pudo marcar como leída', err)
    }
  }

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      })
      if (!res.ok) throw new Error('Error')
      setNotifications((prev) => prev.map((n) => ({ ...n, leido: 1 })))
      try { window.dispatchEvent(new CustomEvent('notifications-updated')) } catch {}
    } catch (err) {
      console.warn('No se pudieron marcar todas como leídas', err)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>Notificaciones</h4>
          <button className="lect_btn" onClick={markAllRead} disabled={loading}>Marcar como leídas</button>
        </div>
        <div className="modal-list">
          {loading && <div className="notif-item">Cargando...</div>}
          {!loading && notifications.length === 0 && <div className="notif-item">Sin notificaciones</div>}
          {notifications.map((n) => (
            <div
              key={n.id_notification}
              className={`notif-item ${n.leido ? 'read' : 'unread'}`}
              onMouseEnter={() => setHoveredId(n.id_notification)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer' }}
            >
              <div className="notif-left">
                {!n.leido ? (
                  <FiCircle style={{ color: '#28a745', fontSize: '18px' }} />
                ) : (
                  <span style={{ width: 18, display: 'inline-block' }} />
                )}
              </div>
              <div className="notif-body">
                <div className="notif-title">{n.titulo || n.title}</div>
                <div className="notif-text">{n.mensaje || n.body}</div>
              </div>
              <div className="notif-time">
                {!n.leido && <button className="small" onClick={(e) => { e.stopPropagation(); markAsRead(n.id_notification) }}>Marcar</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
