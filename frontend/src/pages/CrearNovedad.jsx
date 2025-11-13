import React, { useState } from 'react'
import Header from '../components/Header'
import Toast from '../components/Toast'
import { FiAlertCircle, FiPackage, FiFileText, FiSearch, FiCheck, FiX } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function CrearNovedad() {
  const [form, setForm] = useState({
    codigo_equipo: '',
    tipo_novedad: 'Mal Funcionamiento',
    descripcion: '',
  })
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [codigoInventario, setCodigoInventario] = useState('')
  const [equipoEncontrado, setEquipoEncontrado] = useState(null)
  const [buscandoEquipo, setBuscandoEquipo] = useState(false)

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
    
    if (!form.codigo_equipo || !form.tipo_novedad || !form.descripcion.trim()) {
      setToast({ message: 'Todos los campos son obligatorios', type: 'error' })
      return
    }

    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/novedades', {
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
          message: data.message || 'Novedad registrada correctamente', 
          type: 'success' 
        })
        setForm({
          codigo_equipo: '',
          tipo_novedad: 'Mal Funcionamiento',
          descripcion: '',
        })
        limpiarEquipo()
      } else {
        setToast({ 
          message: data.error || 'Error al registrar la novedad', 
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <main className="container">
        <div className="form-equipos form-modern">
          <div className="form-header">
            <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)' }}>
              <FiAlertCircle size={28} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Registrar Novedad</h2>
              <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                Reporta daños, pérdidas, robos o mal funcionamiento de equipos
              </p>
            </div>
          </div>

          <div className="form-divider"></div>

          <form onSubmit={handleSubmit}>
            {/* Sección: Equipo */}
            <div className="form-section">
              <h3 className="form-section-title">
                <FiPackage size={18} style={{ marginRight: 8 }} />
                Equipo Afectado
              </h3>
              
              <div className="form-group">
                <label>
                  Código de Inventario *
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
                    placeholder="Ingresa el código de inventario del equipo"
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
                    Cambiar equipo
                  </button>
                </div>
              )}
            </div>

            {/* Sección: Tipo de Novedad */}
            <div className="form-section">
              <h3 className="form-section-title">
                <FiAlertCircle size={18} style={{ marginRight: 8 }} />
                Tipo de Novedad
              </h3>

              <div className="form-group">
                <label>
                  Tipo de Novedad *
                </label>
                <select
                  value={form.tipo_novedad}
                  onChange={(e) => handleChange('tipo_novedad', e.target.value)}
                  required
                >
                  <option value="Mal Funcionamiento">Mal Funcionamiento</option>
                  <option value="Daño">Daño</option>
                  <option value="Pérdida">Pérdida</option>
                  <option value="Robo">Robo</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            {/* Sección: Descripción */}
            <div className="form-section">
              <h3 className="form-section-title">
                <FiFileText size={18} style={{ marginRight: 8 }} />
                Descripción del Problema
              </h3>

            <div className="form-group">
              <label>
                  Descripción Detallada *
              </label>
              <textarea
                value={form.descripcion}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                placeholder="Describe detalladamente el problema o situación..."
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
                {loading ? 'Registrando...' : 'Registrar Novedad'}
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
  )
}

