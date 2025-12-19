import React, { useState, useEffect } from 'react'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage, getAuthHeaders } from '../../utils/api'
import { useLanguage } from '../../contexts/LanguageContext'
import '../../styles/appSettings.css'

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
      <div className="form-equipos app-settings-container">
        <div className="app-settings-loading">
          <div className="loading-spinner"></div>
          <p className="app-settings-loading-text">Cargando ajustes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="form-equipos app-settings-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="app-settings-header">
        <h3 className="app-settings-title">Ajustes de la Aplicación</h3>
        <p className="app-settings-description">
          Configura preferencias globales: idioma y zona horaria
        </p>
      </div>

      <div className="app-settings-form">
        <div className="form-row">
          <label>Idioma</label>
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="app-settings-select"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
          <small className="app-settings-help">
            Selecciona el idioma de la interfaz
          </small>
        </div>

        <div className="form-row">
          <label>Zona horaria</label>
          <select
            value={tz}
            onChange={e => setTz(e.target.value)}
            className="app-settings-select"
          >
            {timeZones.map(tzOption => (
              <option key={tzOption} value={tzOption}>
                {tzOption.replace('_', ' ')}
              </option>
            ))}
          </select>
          <small className="app-settings-help">
            Zona horaria para mostrar fechas y horas
          </small>
        </div>

        <div className="app-settings-save">
          <button className="btn-verde" onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar ajustes'}
          </button>
        </div>
      </div>
    </div>
  )
}
