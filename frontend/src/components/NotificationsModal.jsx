import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCircle } from 'react-icons/fi'

function formatRelativeTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  if (diffMinutes < 1) return 'Justo ahora'
  if (diffMinutes === 1) return 'Hace 1 minuto'
  if (diffMinutes < 60) return `Hace ${diffMinutes} minutos`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours === 1) return 'Hace 1 hora'
  if (diffHours < 24) return `Hace ${diffHours} horas`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Hace 1 día'
  if (diffDays < 7) return `Hace ${diffDays} días`
  return date.toLocaleDateString()
}

function NotificationsModal({
  notifications = [],
  loading = false,
  unreadCount = 0,
  lastSync = null,
  onMarkAllRead,
  onMarkAsRead,
  onClose,
}) {
  const navigate = useNavigate()

  function handleNotificationClick(notification) {
    // Si tiene metadata con ruta, navegar allí
    if (notification.metadata && notification.metadata.ruta) {
      navigate(notification.metadata.ruta)
      if (onClose) onClose()
      // Marcar como leída si no lo está
      if (!notification.leida && onMarkAsRead) {
        onMarkAsRead(notification.id)
      }
    }
  }
  const footerLabel = useMemo(() => {
    if (!lastSync) return 'Sincroniza para ver nuevas notificaciones'
    return `Actualizado ${formatRelativeTime(lastSync)}`
  }, [lastSync])

  return (
    <div className="notifications-popover" role="dialog" aria-label="Notificaciones">
      <div className="notifications-header">
        <h4>Notificaciones</h4>
        {unreadCount > 0 && (
          <button className="notifications-mark" onClick={onMarkAllRead} type="button">
            Marcar como leídas
          </button>
        )}
      </div>

      {loading ? (
        <div className="notifications-loading">Cargando notificaciones...</div>
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">
          No tienes notificaciones pendientes.
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => {
            const hasRoute = notification.metadata && notification.metadata.ruta
            return (
              <div
                key={notification.id}
                className={`notifications-item${notification.leida ? '' : ' is-unread'}${hasRoute ? ' clickable' : ''}`}
                onClick={hasRoute ? () => handleNotificationClick(notification) : undefined}
                style={hasRoute ? { cursor: 'pointer' } : {}}
              >
                <div className="notifications-status">
                  <FiCircle style={{ color: notification.leida ? '#bbb' : '#28a745', fontSize: '18px' }} />
                </div>
                <div className="notifications-body">
                  <div className="notif-title">{notification.titulo}</div>
                  <div className="notif-text">{notification.cuerpo}</div>
                </div>
                <div className="notifications-actions">
                  <span>{formatRelativeTime(notification.fecha_creacion)}</span>
                  {!notification.leida && (
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onMarkAsRead) onMarkAsRead(notification.id)
                      }}
                    >
                      Marcar leída
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="notifications-footer">{footerLabel}</div>
    </div>
  )
}

export default NotificationsModal