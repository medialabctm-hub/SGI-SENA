import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCircle, FiPlay, FiSquare, FiX } from 'react-icons/fi'
import Toast from './Toast'

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
  const [estadosClases, setEstadosClases] = useState({}) // { id_clase: 'estado_clase' }
  const [toast, setToast] = useState(null)

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

  // Verificar estados de clases para notificaciones de consentimiento
  useEffect(() => {
    async function verificarEstadosClases() {
      const notificacionesConsentimiento = notifications.filter(
        notif => 
          notif.metadata?.tipo === 'consentimiento_inicio' && 
          notif.metadata?.id_clase
      )

      if (notificacionesConsentimiento.length === 0) return

      const nuevosEstados = {}
      const token = localStorage.getItem('token')
      if (!token) return

      await Promise.all(
        notificacionesConsentimiento.map(async (notif) => {
          try {
            const res = await fetch(`/api/clases/${notif.metadata.id_clase}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
              const clase = await res.json()
              nuevosEstados[notif.metadata.id_clase] = clase.estado_clase
            }
          } catch (err) {
            console.error(`Error al verificar clase ${notif.metadata.id_clase}:`, err)
          }
        })
      )

      setEstadosClases(prev => ({ ...prev, ...nuevosEstados }))
    }

    if (notifications.length > 0) {
      verificarEstadosClases()
    }
  }, [notifications])

  async function handleAccion(notification, accion) {
    if (!accion || !accion.endpoint) return

    setProcesandoAccion(notification.id)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setToast({ message: 'No hay sesión activa', type: 'error' })
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

      // Actualizar estado de la clase en el estado local
      if (notification.metadata?.id_clase) {
        if (accion.tipo === 'aceptar_consentimiento') {
          setEstadosClases(prev => ({ ...prev, [notification.metadata.id_clase]: 'En Curso' }))
        } else if (accion.tipo === 'rechazar_consentimiento') {
          setEstadosClases(prev => ({ ...prev, [notification.metadata.id_clase]: 'Cancelada' }))
        }
      }

      // Determinar el tipo de toast según la acción
      const esAceptar = accion.tipo === 'aceptar_consentimiento'
      const esRechazar = accion.tipo === 'rechazar_consentimiento'
      const tipoToast = esRechazar ? 'error' : 'success'

      // Mostrar mensaje de éxito o error con toast
      setToast({ 
        message: data.message || (data.ok ? 'Acción ejecutada correctamente' : 'Acción completada'),
        type: tipoToast
      })

      // Cerrar modal si está abierto después de un breve delay
      setTimeout(() => {
        if (onClose) {
          onClose()
        }
      }, 500)

      // No recargar la página - los eventos Socket.io actualizarán automáticamente
    } catch (err) {
      setToast({ 
        message: err.message || 'Error al ejecutar la acción',
        type: 'error'
      })
    } finally {
      setProcesandoAccion(null)
    }
  }
  const footerLabel = useMemo(() => {
    if (!lastSync) return 'Sincroniza para ver nuevas notificaciones'
    return `Actualizado ${formatRelativeTime(lastSync)}`
  }, [lastSync])

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
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
                  {hasAcciones && (() => {
                    // Filtrar acciones de consentimiento si la clase ya no está en "Programada"
                    let accionesValidas = notification.metadata.acciones
                    if (notification.metadata?.tipo === 'consentimiento_inicio' && notification.metadata?.id_clase) {
                      const estadoClase = estadosClases[notification.metadata.id_clase]
                      if (estadoClase && estadoClase !== 'Programada') {
                        accionesValidas = accionesValidas.filter(accion => 
                          accion.tipo !== 'aceptar_consentimiento' && 
                          accion.tipo !== 'rechazar_consentimiento'
                        )
                      }
                    }

                    // Si no hay acciones válidas, no mostrar los botones
                    if (accionesValidas.length === 0) {
                      return null
                    }

                    return (
                      <div className="notifications-actions-buttons">
                        {accionesValidas.map((accion, idx) => {
                          const esAceptar = accion.tipo === 'aceptar_consentimiento'
                          const esRechazar = accion.tipo === 'rechazar_consentimiento'
                          
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`notification-action-btn ${
                                accion.tipo === 'iniciar_clase' || esAceptar ? 'btn-iniciar' : 
                                accion.tipo === 'finalizar_clase' ? 'btn-finalizar' : 
                                esRechazar ? 'btn-cancelar' :
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
                                  {(accion.tipo === 'iniciar_clase' || esAceptar) && <FiPlay size={14} />}
                                  {accion.tipo === 'finalizar_clase' && <FiSquare size={14} />}
                                  {esRechazar && <FiX size={14} />}
                                  {accion.label}
                                </>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
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
    </>
  )
}

export default NotificationsModal