import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCircle, FiPlay, FiSquare } from 'react-icons/fi'

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
  const [procesandoAccion, setProcesandoAccion] = useState(null)

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

  async function handleAccion(notification, accion) {
    if (!accion || !accion.endpoint) return

    setProcesandoAccion(notification.id)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        alert('No hay sesión activa')
        return
      }

      const res = await fetch(accion.endpoint, {
        method: accion.metodo || 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: accion.metodo !== 'GET' ? JSON.stringify({}) : undefined,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.detalle || 'Error al ejecutar acción')
      }

      // Marcar notificación como leída después de la acción
      if (onMarkAsRead) {
        onMarkAsRead(notification.id)
      }

      // Mostrar mensaje de éxito
      alert(data.message || data.ok ? 'Acción ejecutada correctamente' : 'Acción completada')

      // Cerrar modal si está abierto
      if (onClose) {
        onClose()
      }

      // Recargar la página para actualizar el estado
      window.location.reload()
    } catch (err) {
      alert(err.message || 'Error al ejecutar la acción')
    } finally {
      setProcesandoAccion(null)
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
        <div className="notifications-loading">Cargando</div>
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">
          No tienes notificaciones pendientes.
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => {
            const hasRoute = notification.metadata && notification.metadata.ruta
            const hasAcciones = notification.metadata && 
                               notification.metadata.acciones && 
                               Array.isArray(notification.metadata.acciones) &&
                               notification.metadata.acciones.length > 0
            const estaProcesando = procesandoAccion === notification.id

            return (
              <div
                key={notification.id}
                className={`notifications-item${notification.leida ? '' : ' is-unread'}${hasRoute && !hasAcciones ? ' clickable' : ''}`}
                onClick={hasRoute && !hasAcciones ? () => handleNotificationClick(notification) : undefined}
              >
                <div className="notifications-status">
                  <FiCircle className={notification.leida ? 'notifications-circle-read' : 'notifications-circle-unread'} />
                </div>
                <div className="notifications-body">
                  <div className="notif-title">{notification.titulo}</div>
                  <div className="notif-text">{notification.cuerpo}</div>
                  
                  {/* Botones de acción */}
                  {hasAcciones && (
                    <div className="notifications-actions-buttons">
                      {notification.metadata.acciones.map((accion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`notification-action-btn ${
                            accion.tipo === 'iniciar_clase' ? 'btn-iniciar' : 
                            accion.tipo === 'finalizar_clase' ? 'btn-finalizar' : 
                            'btn-default'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAccion(notification, accion)
                          }}
                          disabled={estaProcesando}
                        >
                          {estaProcesando ? (
                            <div className="loading-spinner notification-action-spinner"></div>
                          ) : (
                            <>
                              {accion.tipo === 'iniciar_clase' && <FiPlay size={14} />}
                              {accion.tipo === 'finalizar_clase' && <FiSquare size={14} />}
                              {accion.label}
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="notifications-actions">
                  <span>{formatRelativeTime(notification.fecha_creacion)}</span>
                  {!notification.leida && !hasAcciones && (
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