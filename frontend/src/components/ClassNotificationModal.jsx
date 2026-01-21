import React, { useState, useEffect } from 'react'
import { FiPlay, FiSquare, FiX, FiAlertCircle } from 'react-icons/fi'
import '../styles/classNotificationModal.css'

function ClassNotificationModal({ notification, onClose, onMarkAsRead }) {
  const [procesandoAccion, setProcesandoAccion] = useState(null)

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
      if (onMarkAsRead && notification.id) {
        onMarkAsRead(notification.id)
      }

      // Mostrar mensaje de éxito
      alert(data.message || (data.ok ? 'Acción ejecutada correctamente' : 'Acción completada'))

      // Cerrar modal
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

  if (!notification || !notification.metadata || !notification.metadata.acciones) {
    return null
  }

  const acciones = notification.metadata.acciones || []
  const tipoNotificacion = notification.metadata.tipo || ''

  return (
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
            {acciones.map((accion, idx) => {
              const estaProcesando = procesandoAccion === accion.tipo
              const esIniciar = accion.tipo === 'iniciar_clase'
              const esFinalizar = accion.tipo === 'finalizar_clase'
              const esCancelar = accion.tipo === 'cancelar_clase'

              return (
                <button
                  key={idx}
                  type="button"
                  className={`class-notification-action-btn ${
                    esIniciar ? 'btn-iniciar' : 
                    esFinalizar ? 'btn-finalizar' : 
                    esCancelar ? 'btn-cancelar' : 
                    'btn-default'
                  }`}
                  onClick={() => handleAccion(accion)}
                  disabled={estaProcesando}
                >
                  {estaProcesando ? (
                    <div className="loading-spinner class-notification-spinner"></div>
                  ) : (
                    <>
                      {esIniciar && <FiPlay size={18} />}
                      {esFinalizar && <FiSquare size={18} />}
                      {esCancelar && <FiX size={18} />}
                      {accion.label}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClassNotificationModal

