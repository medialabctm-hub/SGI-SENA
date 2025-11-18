import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiFileText, FiPackage, FiType, FiSearch, FiCheck, FiX } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function CrearReporte() {
  const [form, setForm] = useState({
    tipo_reporte: 'General',
    titulo: '',
    descripcion: '',
    codigo_equipo: '',
  })
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [codigoInventario, setCodigoInventario] = useState('')
  const [equipoEncontrado, setEquipoEncontrado] = useState(null)
  const [buscandoEquipo, setBuscandoEquipo] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [])

  async function buscarEquipo() {
    if (!codigoInventario.trim()) {
      setToast({ message: 'Ingresa un código de inventario', type: 'error' })
      return
    }

    try {
      setBuscandoEquipo(true)
      setEquipoEncontrado(null)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigoInventario.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await parseApiResponse(res)
        setEquipoEncontrado(data)
        setForm(prev => ({ ...prev, codigo_equipo: data.codigo_equipo }))
        setToast({ message: 'Equipo encontrado correctamente', type: 'success' })
      } else {
        const errorData = await res.json().catch(() => ({}))
        setToast({ 
          message: errorData.error || 'Equipo no encontrado', 
          type: 'error' 
        })
        setEquipoEncontrado(null)
        setForm(prev => ({ ...prev, codigo_equipo: '' }))
      }
    } catch (err) {
      setToast({ 
        message: buildErrorMessage(err, 'Error al buscar el equipo'), 
        type: 'error' 
      })
      setEquipoEncontrado(null)
      setForm(prev => ({ ...prev, codigo_equipo: '' }))
    } finally {
      setBuscandoEquipo(false)
    }
  }

  function limpiarEquipo() {
    setCodigoInventario('')
    setEquipoEncontrado(null)
    setForm(prev => ({ ...prev, codigo_equipo: '' }))
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    if (!form.tipo_reporte || !form.titulo.trim() || !form.descripcion.trim()) {
      setToast({ message: 'El tipo, título y descripción son obligatorios', type: 'error' })
      return
    }

    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/reportes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })

      const data = await res.json()

      if (res.ok) {
        setToast({ 
          message: data.message || 'Reporte creado correctamente', 
          type: 'success' 
        })
        setForm({
          tipo_reporte: 'General',
          titulo: '',
          descripcion: '',
          codigo_equipo: '',
        })
        limpiarEquipo()
      } else {
        setToast({ 
          message: data.error || 'Error al crear el reporte', 
          type: 'error' 
        })
      }
    } catch (err) {
      setToast({ message: 'Error de conexión con el servidor', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="form-equipos form-modern">
          <div className="form-header">
            <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #4dabf7 0%, #339af0 100%)' }}>
              <FiFileText size={28} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Crear Reporte</h2>
              <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                Genera informes sobre equipos, mantenimiento, novedades o uso general
              </p>
            </div>
          </div>

          <div className="form-divider"></div>

          <form onSubmit={handleSubmit}>
            {/* Sección: Información del Reporte */}
            <div className="form-section">
              <h3 className="form-section-title">
                <FiFileText size={18} style={{ marginRight: 8 }} />
                Información del Reporte
              </h3>

            <div className="form-grid">
              <div className="form-group">
                <label>
                  <FiType size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Tipo de Reporte *
                </label>
                <select
                  value={form.tipo_reporte}
                  onChange={(e) => handleChange('tipo_reporte', e.target.value)}
                  required
                >
                  <option value="General">General</option>
                  <option value="Equipos">Equipos</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Novedades">Novedades</option>
                  <option value="Uso">Uso</option>
                  <option value="Otro">Otro</option>
                </select>
            </div>

            <div className="form-group">
              <label>
                <FiFileText size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Título *
              </label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
                placeholder="Título descriptivo del reporte"
                required
              />
            </div>
              </div>
            </div>

            {/* Sección: Equipo (Opcional) */}
            <div className="form-section">
              <h3 className="form-section-title">
                <FiPackage size={18} style={{ marginRight: 8 }} />
                Equipo Relacionado (Opcional)
              </h3>
              
              <div className="form-group">
                <label>
                  Código de Inventario
                </label>
                <div className="search-equipo-wrapper">
                  <input
                    type="text"
                    value={codigoInventario}
                    onChange={(e) => setCodigoInventario(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        buscarEquipo()
                      }
                    }}
                    placeholder="Ingresa el código de inventario (opcional)"
                    className="search-equipo-input"
                  />
                  <button
                    type="button"
                    onClick={buscarEquipo}
                    disabled={buscandoEquipo || !codigoInventario.trim()}
                    className="btn-search-equipo"
                  >
                    {buscandoEquipo ? (
                      'Buscando...'
                    ) : (
                      <>
                        <FiSearch size={16} />
                        Buscar
                      </>
                    )}
                  </button>
                </div>
                <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#666' }}>
                  Si no especificas un equipo, el reporte será general
                </p>
              </div>

              {equipoEncontrado && (
                <div className="equipo-found-card">
                  <div className="equipo-found-header">
                    <FiCheck size={20} color="#43a047" />
                    <span>Equipo encontrado</span>
                  </div>
                  <div className="equipo-found-info">
                    <div><strong>Código:</strong> {equipoEncontrado.codigo_inventario}</div>
                    <div><strong>Equipo:</strong> {equipoEncontrado.tipo} {equipoEncontrado.marca} {equipoEncontrado.modelo}</div>
                    {equipoEncontrado.nombre_ambiente && (
                      <div><strong>Ambiente:</strong> {equipoEncontrado.nombre_ambiente}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={limpiarEquipo}
                    className="btn-clear-equipo"
                  >
                    <FiX size={14} />
                    Quitar equipo
                  </button>
                </div>
              )}
            </div>

            {/* Sección: Descripción */}
            <div className="form-section">
              <h3 className="form-section-title">
                <FiFileText size={18} style={{ marginRight: 8 }} />
                Descripción del Reporte
              </h3>

            <div className="form-group">
              <label>
                  Descripción Detallada *
              </label>
              <textarea
                value={form.descripcion}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                placeholder="Describe detalladamente el contenido del reporte..."
                rows={8}
                required
              />
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn-primary btn-modern"
                disabled={loading}
              >
                {loading ? 'Creando...' : 'Crear Reporte'}
              </button>
              <button 
                type="button" 
                className="btn-secondary btn-modern"
                onClick={() => window.history.back()}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
        </main>
      </div>
    </div>
  )
}

