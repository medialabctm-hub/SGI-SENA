import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import CustomSelect from '../components/CustomSelect'
import { FiTool, FiPackage, FiCalendar, FiUser, FiFileText, FiSearch, FiCheck, FiX, FiType } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/crearMantenimiento.css'

export default function CrearMantenimiento() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    codigo_equipo: '',
    tipo_mantenimiento: 'Preventivo',
    fecha_mantenimiento: '',
    fecha_proximo: '',
    descripcion_trabajo: '',
    id_usuario_tecnico: '',
    observaciones: '',
    estado_mantenimiento: 'Programado',
  })
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [codigoInventario, setCodigoInventario] = useState('')
  const [equipoEncontrado, setEquipoEncontrado] = useState(null)
  const [buscandoEquipo, setBuscandoEquipo] = useState(false)
  const [cedulaTecnico, setCedulaTecnico] = useState('')
  const [tecnicoEncontrado, setTecnicoEncontrado] = useState(null)
  const [buscandoTecnico, setBuscandoTecnico] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const userObj = JSON.parse(userData)
        setUser(userObj)
        // Solo Administrador y Cuentadante pueden crear mantenimientos
        if (userObj.nombre_rol !== 'Administrador' && userObj.nombre_rol !== 'Cuentadante') {
          navigate('/dashboard')
        }
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [navigate])

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

  async function buscarTecnico() {
    if (!cedulaTecnico.trim()) {
      setToast({ message: 'Ingresa una Documento', type: 'error' })
      return
    }

    try {
      setBuscandoTecnico(true)
      setTecnicoEncontrado(null)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/auth/user/cedula/${encodeURIComponent(cedulaTecnico.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await parseApiResponse(res)
        setTecnicoEncontrado(data)
        setForm(prev => ({ ...prev, id_usuario_tecnico: data.id_usuario }))
        setToast({ message: 'Técnico encontrado correctamente', type: 'success' })
      } else {
        const errorData = await res.json().catch(() => ({}))
        setToast({ 
          message: errorData.error || 'Técnico no encontrado', 
          type: 'error' 
        })
        setTecnicoEncontrado(null)
        setForm(prev => ({ ...prev, id_usuario_tecnico: '' }))
      }
    } catch (err) {
      setToast({ 
        message: buildErrorMessage(err, 'Error al buscar el técnico'), 
        type: 'error' 
      })
      setTecnicoEncontrado(null)
      setForm(prev => ({ ...prev, id_usuario_tecnico: '' }))
    } finally {
      setBuscandoTecnico(false)
    }
  }

  function limpiarEquipo() {
    setCodigoInventario('')
    setEquipoEncontrado(null)
    setForm(prev => ({ ...prev, codigo_equipo: '' }))
  }

  function limpiarTecnico() {
    setCedulaTecnico('')
    setTecnicoEncontrado(null)
    setForm(prev => ({ ...prev, id_usuario_tecnico: '' }))
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    if (!form.codigo_equipo || !form.tipo_mantenimiento || !form.fecha_mantenimiento) {
      setToast({ message: 'Equipo, tipo de mantenimiento y fecha son obligatorios', type: 'error' })
      return
    }

    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      // Preparar datos para enviar
      const payload = {
        ...form,
        id_usuario_tecnico: form.id_usuario_tecnico || null,
        fecha_proximo: form.fecha_proximo || null,
        descripcion_trabajo: form.descripcion_trabajo.trim() || null,
        observaciones: form.observaciones.trim() || null,
      }

      const res = await fetch('/api/mantenimiento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok) {
        setToast({ 
          message: data.message || 'Mantenimiento registrado correctamente', 
          type: 'success' 
        })
        setForm({
          codigo_equipo: '',
          tipo_mantenimiento: 'Preventivo',
          fecha_mantenimiento: '',
          fecha_proximo: '',
          descripcion_trabajo: '',
          id_usuario_tecnico: '',
          observaciones: '',
          estado_mantenimiento: 'Programado',
        })
        limpiarEquipo()
        limpiarTecnico()
      } else {
        setToast({ 
          message: data.error || 'Error al registrar el mantenimiento', 
          type: 'error' 
        })
      }
    } catch (err) {
      setToast({ message: 'Error de conexión con el servidor', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Obtener fecha actual en formato YYYY-MM-DDTHH:mm para el input datetime-local
  const getCurrentDateTime = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
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
            <div className="form-icon-wrapper crear-mantenimiento-header-icon">
              <FiTool size={28} color="#fff" />
            </div>
            <div className="crear-mantenimiento-header-content">
              <h2 className="crear-mantenimiento-title">Registrar Mantenimiento</h2>
              <p className="crear-mantenimiento-subtitle">
                Registra mantenimientos preventivos, correctivos o actualizaciones realizadas en equipos
              </p>
            </div>
          </div>

          <div className="form-divider"></div>

          <form onSubmit={handleSubmit}>
            {/* Sección: Equipo */}
            <div className="form-section">
              <h3 className="form-section-title">
                    <FiPackage size={18} className="crear-mantenimiento-section-icon" />
                Equipo a Mantener
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

            {/* Sección: Información del Mantenimiento */}
            <div className="form-section">
              <h3 className="form-section-title">
                    <FiType size={18} className="crear-mantenimiento-section-icon" />
                Información del Mantenimiento
              </h3>

              <div className="form-grid">
                <div className="form-group">
                  <label>
                    <FiTool size={16} className="crear-mantenimiento-option-icon" />
                    Tipo de Mantenimiento *
                  </label>
                  <CustomSelect
                    name="tipo_mantenimiento"
                    value={form.tipo_mantenimiento}
                    onChange={(e) => handleChange('tipo_mantenimiento', e.target.value)}
                    options={['Preventivo', 'Correctivo', 'Actualización']}
                    placeholder="Seleccionar tipo de mantenimiento"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    <FiCalendar size={16} className="crear-mantenimiento-option-icon" />
                    Estado *
                  </label>
                  <CustomSelect
                    name="estado_mantenimiento"
                    value={form.estado_mantenimiento}
                    onChange={(e) => handleChange('estado_mantenimiento', e.target.value)}
                    options={['Programado', 'En Proceso', 'Completado', 'Cancelado']}
                    placeholder="Seleccionar estado"
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>
                    <FiCalendar size={16} className="crear-mantenimiento-option-icon" />
                    Fecha de Mantenimiento *
                  </label>
                  <input
                    type="datetime-local"
                    value={form.fecha_mantenimiento}
                    onChange={(e) => handleChange('fecha_mantenimiento', e.target.value)}
                    min={getCurrentDateTime()}
                    required
                  />
                  <p className="crear-mantenimiento-help-text">
                    Selecciona una fecha futura para programar el mantenimiento
                  </p>
                </div>

                <div className="form-group">
                  <label>
                    <FiCalendar size={16} className="crear-mantenimiento-option-icon" />
                    Próximo Mantenimiento (Opcional)
                  </label>
                  <input
                    type="date"
                    value={form.fecha_proximo}
                    onChange={(e) => handleChange('fecha_proximo', e.target.value)}
                    min={form.fecha_mantenimiento ? form.fecha_mantenimiento.split('T')[0] : ''}
                  />
                  <p className="crear-mantenimiento-help-text">
                    Establece la fecha del próximo mantenimiento para que aparezca en las estadísticas del Dashboard
                  </p>
                </div>
              </div>
            </div>

            {/* Sección: Técnico (Opcional) */}
            <div className="form-section">
              <h3 className="form-section-title">
                    <FiUser size={18} className="crear-mantenimiento-section-icon" />
                Técnico Responsable (Opcional)
              </h3>
              
              <div className="form-group">
                <label>
                  Documento del Técnico
                </label>
                <div className="search-equipo-wrapper">
                  <input
                    type="text"
                    value={cedulaTecnico}
                    onChange={(e) => setCedulaTecnico(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        buscarTecnico()
                      }
                    }}
                    placeholder="Ingresa el Documento del técnico"
                    className="search-equipo-input"
                  />
                  <button
                    type="button"
                    onClick={buscarTecnico}
                    disabled={buscandoTecnico || !cedulaTecnico.trim()}
                    className="btn-search-equipo"
                  >
                    {buscandoTecnico ? (
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

              {tecnicoEncontrado && (
                <div className="equipo-found-card">
                  <div className="equipo-found-header">
                    <FiCheck size={20} color="#43a047" />
                    <span>Técnico encontrado</span>
                  </div>
                  <div className="equipo-found-info">
                    <div><strong>Nombre:</strong> {tecnicoEncontrado.nombre_usuario}</div>
                    <div><strong>Documento:</strong> {tecnicoEncontrado.cedula}</div>
                    <div><strong>Rol:</strong> {tecnicoEncontrado.nombre_rol}</div>
                  </div>
                  <button
                    type="button"
                    onClick={limpiarTecnico}
                    className="btn-clear-equipo"
                  >
                    <FiX size={14} />
                    Cambiar técnico
                  </button>
                </div>
              )}
            </div>

            {/* Sección: Detalles */}
            <div className="form-section">
              <h3 className="form-section-title">
                    <FiFileText size={18} className="crear-mantenimiento-section-icon" />
                Detalles
              </h3>

              <div className="form-group">
                <label>
                  Descripción del Trabajo Realizado
                </label>
                <textarea
                  value={form.descripcion_trabajo}
                  onChange={(e) => handleChange('descripcion_trabajo', e.target.value)}
                  placeholder="Describe detalladamente el trabajo realizado..."
                  rows={6}
                />
              </div>

              <div className="form-group">
                <label>
                  Observaciones (Opcional)
                </label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => handleChange('observaciones', e.target.value)}
                  placeholder="Observaciones adicionales..."
                  rows={4}
                />
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn-primary btn-modern"
                disabled={loading}
              >
                {loading ? 'Registrando...' : 'Registrar Mantenimiento'}
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

