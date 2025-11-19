import React, { useState, useEffect } from 'react'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage } from '../../utils/api'
import { useLanguage } from '../../contexts/LanguageContext'

export default function AppSettings() {
  const { language, updateLanguage } = useLanguage()
  const [lang, setLang] = useState(language)
  const [tz, setTz] = useState('America/Bogota')
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Sincronizar con el contexto cuando cambie
  useEffect(() => {
    setLang(language)
  }, [language])

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
      
      if (data.app) {
        setLang(data.app.idioma || 'es')
        setTz(data.app.zona_horaria || 'America/Bogota')
      }
    } catch (err) {
      // Si falla, usar valores por defecto
      console.error('Error al cargar preferencias:', err)
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota')
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
          app: {
            idioma: lang,
            zona_horaria: tz
          }
        })
      })

      await parseApiResponse(res, 'No se pudieron guardar los ajustes')
      // Actualizar el contexto de idioma
      updateLanguage(lang)
      setToast({ message: 'Ajustes guardados correctamente', type: 'success' })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al guardar los ajustes'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Obtener zonas horarias comunes
  const timeZones = [
    'America/Bogota',
    'America/Lima',
    'America/Mexico_City',
    'America/New_York',
    'America/Los_Angeles',
    'America/Santiago',
    'America/Buenos_Aires',
    'Europe/Madrid',
    'UTC'
  ]

  if (loading) {
    return (
      <div className="form-equipos" style={{ maxWidth: 900 }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem', color: '#666' }}>Cargando ajustes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="form-equipos" style={{ maxWidth: 900 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--neutral-800)' }}>Ajustes de la Aplicación</h3>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
          Configura preferencias globales: idioma y zona horaria
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 600 }}>
        <div className="form-row">
          <label>Idioma</label>
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            style={{ display: 'block', marginTop: '6px', width: '100%', padding: '0.5rem' }}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
          <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
            Selecciona el idioma de la interfaz
          </small>
        </div>

        <div className="form-row">
          <label>Zona horaria</label>
          <select
            value={tz}
            onChange={e => setTz(e.target.value)}
            style={{ display: 'block', marginTop: '6px', width: '100%', padding: '0.5rem' }}
          >
            {timeZones.map(tzOption => (
              <option key={tzOption} value={tzOption}>
                {tzOption.replace('_', ' ')}
              </option>
            ))}
          </select>
          <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
            Zona horaria para mostrar fechas y horas
          </small>
        </div>

        <div style={{ marginTop: '0.5rem' }}>
          <button className="btn-verde" onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar ajustes'}
          </button>
        </div>
      </div>
    </div>
  )
}
