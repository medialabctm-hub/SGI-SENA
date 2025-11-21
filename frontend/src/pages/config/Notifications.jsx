import React, { useState, useEffect } from 'react'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage } from '../../utils/api'
import '../../styles/notifications.css'

export default function Notifications() {
  const [email, setEmail] = useState(true)
  const [sms, setSms] = useState(false)
  const [inApp, setInApp] = useState(true)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }
  }

  useEffect(() => {
    fetchPreferences()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchPreferences() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        return
      }

      const res = await fetch('/api/preferences', { headers: getAuthHeaders() })
      const data = await parseApiResponse(res, 'No se pudieron cargar las preferencias')
      
      if (data.notificaciones) {
        setEmail(data.notificaciones.email ?? true)
        setSms(data.notificaciones.sms ?? false)
        setInApp(data.notificaciones.app ?? true)
      }
    } catch (err) {
      // Si falla, usar valores por defecto
      console.error('Error al cargar preferencias:', err)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setToast({ message: 'No autorizado. Por favor inicia sesión nuevamente', type: 'error' })
        return
      }

      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          notificaciones: {
            email,
            sms,
            app: inApp
          }
        })
      })

      await parseApiResponse(res, 'No se pudieron guardar las preferencias')
      setToast({ message: 'Preferencias guardadas correctamente', type: 'success' })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al guardar las preferencias'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="form-equipos notifications-container">
        <div className="notifications-loading">
          <div className="loading-spinner"></div>
          <p className="notifications-loading-text">Cargando preferencias...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="form-equipos notifications-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="notifications-header">
        <h3 className="notifications-title">Notificaciones</h3>
        <p className="notifications-description">
          Configura cómo recibir notificaciones del sistema
        </p>
      </div>

      <div className="notifications-list">
        <div className="notification-item">
          <div className="notification-content">
            <label className="notification-label">
              Correo electrónico
            </label>
            <p className="notification-description-text">
              Recibe notificaciones por correo electrónico
            </p>
          </div>
          <label className="notification-toggle-wrapper">
            <input
              type="checkbox"
              checked={email}
              onChange={e => setEmail(e.target.checked)}
              className="notification-toggle-input"
            />
            <span className={`notification-toggle-slider ${email ? 'active' : ''}`} />
          </label>
        </div>

        <div className="notification-item disabled">
          <div className="notification-content">
            <label className="notification-label disabled">
              SMS
            </label>
            <p className="notification-description-text">
              Recibe notificaciones por SMS (pendiente de integración)
            </p>
          </div>
          <label className="notification-toggle-wrapper">
            <input
              type="checkbox"
              checked={sms}
              onChange={e => setSms(e.target.checked)}
              disabled
              className="notification-toggle-input"
            />
            <span className={`notification-toggle-slider disabled ${sms ? 'active' : ''}`} />
          </label>
        </div>

        <div className="notification-item">
          <div className="notification-content">
            <label className="notification-label">
              Notificaciones en la app
            </label>
            <p className="notification-description-text">
              Recibe notificaciones dentro de la aplicación
            </p>
          </div>
          <label className="notification-toggle-wrapper">
            <input
              type="checkbox"
              checked={inApp}
              onChange={e => setInApp(e.target.checked)}
              className="notification-toggle-input"
            />
            <span className={`notification-toggle-slider ${inApp ? 'active' : ''}`} />
          </label>
        </div>
      </div>

      <div className="notifications-save">
        <button className="btn-verde" onClick={save} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar preferencias'}
        </button>
      </div>
    </div>
  )
}
