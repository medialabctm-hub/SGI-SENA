import React, { useState, useEffect } from 'react'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage } from '../../utils/api'

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
      <div className="form-equipos" style={{ maxWidth: 700 }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem', color: '#666' }}>Cargando preferencias...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="form-equipos" style={{ maxWidth: 700 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--neutral-800)' }}>Notificaciones</h3>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
          Configura cómo recibir notificaciones del sistema
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            padding: '1rem',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <label style={{ fontWeight: 500, color: '#111827', cursor: 'pointer', display: 'block' }}>
              Correo electrónico
            </label>
            <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.85rem' }}>
              Recibe notificaciones por correo electrónico
            </p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
            <input
              type="checkbox"
              checked={email}
              onChange={e => setEmail(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: email ? '#10b981' : '#ccc',
                transition: '0.3s',
                borderRadius: '24px'
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: email ? '22px' : '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '0.3s',
                  borderRadius: '50%'
                }}
              />
            </span>
          </label>
        </div>

        <div
          style={{
            padding: '1rem',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: 0.6
          }}
        >
          <div>
            <label style={{ fontWeight: 500, color: '#111827', display: 'block' }}>
              SMS
            </label>
            <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.85rem' }}>
              Recibe notificaciones por SMS (pendiente de integración)
            </p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
            <input
              type="checkbox"
              checked={sms}
              onChange={e => setSms(e.target.checked)}
              disabled
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'not-allowed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: sms ? '#10b981' : '#ccc',
                transition: '0.3s',
                borderRadius: '24px'
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: sms ? '22px' : '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '0.3s',
                  borderRadius: '50%'
                }}
              />
            </span>
          </label>
        </div>

        <div
          style={{
            padding: '1rem',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <label style={{ fontWeight: 500, color: '#111827', cursor: 'pointer', display: 'block' }}>
              Notificaciones en la app
            </label>
            <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.85rem' }}>
              Recibe notificaciones dentro de la aplicación
            </p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
            <input
              type="checkbox"
              checked={inApp}
              onChange={e => setInApp(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: inApp ? '#10b981' : '#ccc',
                transition: '0.3s',
                borderRadius: '24px'
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: inApp ? '22px' : '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '0.3s',
                  borderRadius: '50%'
                }}
              />
            </span>
          </label>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <button className="btn-verde" onClick={save} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar preferencias'}
        </button>
      </div>
    </div>
  )
}
