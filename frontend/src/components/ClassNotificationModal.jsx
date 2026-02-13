import React, { useState, useEffect } from 'react'
import { FiPlay, FiSquare, FiX, FiAlertCircle } from 'react-icons/fi'
import Toast from './Toast'
import '../styles/components/modals.css'

function ClassNotificationModal({ notification, onClose, onMarkAsRead }) {
  const [procesandoAccion, setProcesandoAccion] = useState(null)
  const [estadoClase, setEstadoClase] = useState(null)
  const [verificandoEstado, setVerificandoEstado] = useState(true)
  const [toast, setToast] = useState(null)

  // Verificar estado de la clase al montar el componente
  useEffect(() => {
    async function verificarEstadoClase() {
      if (!notification?.metadata?.id_clase) {
        setVerificandoEstado(false)
        return
      }

      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setVerificandoEstado(false)
          return
        }

        const res = await fetch(`/api/clases/${notification.metadata.id_clase}`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (res.ok) {
          const clase = await res.json()
          setEstadoClase(clase.estado_clase)
          
          // Si la clase ya no está en "Programada", cerrar el modal y marcar como leída
          if (clase.estado_clase !== 'Programada') {
            if (onMarkAsRead && notification.id) {
              onMarkAsRead(notification.id)
            }
            if (onClose) {
              onClose()
            }
          }
        }
      } catch (err) {
        console.error('Error al verificar estado de la clase:', err)
      } finally {
        setVerificandoEstado(false)
      }
    }

    verificarEstadoClase()
  }, [notification, onClose, onMarkAsRead])

  useEffect(() => {
    // Cerrar automáticamente después de 30 segundos si no hay interacción
    const timer = setTimeout(() => {
      if (onClose) onClose()
    }, 30000)

    return () => clearTimeout(timer)
  }, [onClose])

  async function handleAccion(accion) {
    if (!accion || !accion.endpoint) return

    setProcesandoAccion(accion.tipo)
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
      if (onMarkAsRead && notification.id) {
        onMarkAsRead(notification.id)
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

      // Cerrar modal después de un breve delay para que se vea el toast
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

  // Requiere metadata; acciones son opcionales (clase_proxima_inicio es solo informativa)
  if (!notification || !notification.metadata) {
    return null
  }

  // Si está verificando el estado, no mostrar nada aún
  if (verificandoEstado) {
    return null
  }

  const tipoNotificacion = notification.metadata.tipo || ''
  const esInformativa = tipoNotificacion === 'clase_proxima_inicio'

  // Para consentimiento: solo mostrar si la clase sigue "Programada"
  if (!esInformativa) {
    if (estadoClase && estadoClase !== 'Programada') {
      return null
    }
  }

  // Filtrar acciones de consentimiento si la clase ya no está en "Programada"
  let acciones = notification.metadata.acciones || []
  if (!esInformativa && estadoClase && estadoClase !== 'Programada') {
    acciones = acciones.filter(accion =>
      accion.tipo !== 'aceptar_consentimiento' &&
      accion.tipo !== 'rechazar_consentimiento'
    )
  }

  // Consentimiento sin acciones válidas no se muestra; informativa sí (solo botón Cerrar)
  if (!esInformativa && acciones.length === 0) {
    return null
  }

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="class-notification-overlay" onClick={onClose}>
        <div className="class-notification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="class-notification-header">
          <div className="class-notification-icon">
            <FiAlertCircle size={24} />
          </div>
          <h3 className="class-notification-title">{notification.titulo}</h3>
          <button 
            className="class-notification-close" 
            onClick={onClose}
            type="button"
            aria-label="Cerrar"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="class-notification-body">
          <p className="class-notification-message">{notification.cuerpo}</p>

          <div className="class-notification-actions">
            {esInformativa ? (
              <button
                type="button"
                className="class-notification-action-btn btn-default"
                onClick={onClose}
              >
                Entendido
              </button>
            ) : (
              acciones.map((accion, idx) => {
                const estaProcesando = procesandoAccion === accion.tipo
                const esIniciar = accion.tipo === 'iniciar_clase'
                const esFinalizar = accion.tipo === 'finalizar_clase'
                const esCancelar = accion.tipo === 'cancelar_clase'
                const esAceptar = accion.tipo === 'aceptar_consentimiento'
                const esRechazar = accion.tipo === 'rechazar_consentimiento'

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`class-notification-action-btn ${
                      esIniciar || esAceptar ? 'btn-iniciar' :
                      esFinalizar ? 'btn-finalizar' :
                      esCancelar || esRechazar ? 'btn-cancelar' :
                      'btn-default'
                    }`}
                    onClick={() => handleAccion(accion)}
                    disabled={estaProcesando}
                  >
                    {estaProcesando ? (
                      <div className="loading-spinner class-notification-spinner"></div>
                    ) : (
                      <>
                        {(esIniciar || esAceptar) && <FiPlay size={18} />}
                        {esFinalizar && <FiSquare size={18} />}
                        {(esCancelar || esRechazar) && <FiX size={18} />}
                        {accion.label}
                      </>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default ClassNotificationModal

