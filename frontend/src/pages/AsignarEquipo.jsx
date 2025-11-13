import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Toast from '../components/Toast'
import { FiUserPlus, FiPackage, FiUsers, FiShield, FiFileText, FiSearch, FiCheck } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function AsignarEquipo() {
  const [form, setForm] = useState({
    codigo_equipo: '',
    id_usuario: '',
    tipo_responsabilidad: 'Principal',
    observaciones: '',
    dias_asignados: '',
  })
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [codigoInventario, setCodigoInventario] = useState('')
  const [equipoEncontrado, setEquipoEncontrado] = useState(null)
  const [buscandoEquipo, setBuscandoEquipo] = useState(false)
  const [cedulaUsuario, setCedulaUsuario] = useState('')
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(null)
  const [buscandoUsuario, setBuscandoUsuario] = useState(false)

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

  const isInstructor = user?.nombre_rol === 'Instructor'

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

  async function buscarUsuario() {
    if (!cedulaUsuario.trim()) {
      setToast({ message: 'Ingresa una cédula', type: 'error' })
      return
    }

    try {
      setBuscandoUsuario(true)
      setUsuarioEncontrado(null)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/auth/user/cedula/${encodeURIComponent(cedulaUsuario.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await parseApiResponse(res)
        
        // Validar que si es Instructor, solo puede asignar a Aprendices
        if (isInstructor && data.nombre_rol !== 'Aprendiz') {
          setToast({ 
            message: 'Solo puedes asignar equipos a aprendices', 
            type: 'error' 
          })
          setUsuarioEncontrado(null)
          setForm(prev => ({ ...prev, id_usuario: '' }))
          return
        }
        
        setUsuarioEncontrado(data)
        setForm(prev => ({ ...prev, id_usuario: data.id_usuario }))
        setToast({ message: 'Usuario encontrado correctamente', type: 'success' })
      } else {
        const errorData = await res.json().catch(() => ({}))
        setToast({ 
          message: errorData.error || 'Usuario no encontrado', 
          type: 'error' 
        })
        setUsuarioEncontrado(null)
        setForm(prev => ({ ...prev, id_usuario: '' }))
      }
    } catch (err) {
      setToast({ 
        message: buildErrorMessage(err, 'Error al buscar el usuario'), 
        type: 'error' 
      })
      setUsuarioEncontrado(null)
      setForm(prev => ({ ...prev, id_usuario: '' }))
    } finally {
      setBuscandoUsuario(false)
    }
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function limpiarEquipo() {
    setCodigoInventario('')
    setEquipoEncontrado(null)
    setForm(prev => ({ ...prev, codigo_equipo: '' }))
  }

  function limpiarUsuario() {
    setCedulaUsuario('')
    setUsuarioEncontrado(null)
    setForm(prev => ({ ...prev, id_usuario: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    if (!form.codigo_equipo || !form.id_usuario) {
      setToast({ message: 'Debes buscar y seleccionar un equipo y un usuario', type: 'error' })
      return
    }

    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/asignar', {
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
          message: data.message || 'Equipo asignado correctamente', 
          type: 'success' 
        })
        setForm({
          codigo_equipo: '',
          id_usuario: '',
          tipo_responsabilidad: 'Principal',
          observaciones: '',
          dias_asignados: '',
        })
        limpiarEquipo()
        limpiarUsuario()
      } else {
        setToast({ 
          message: data.error || 'Error al asignar el equipo', 
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
            <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #51cf66 0%, #40c057 100%)' }}>
              <FiUserPlus size={28} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Asignar Equipo</h2>
              <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                {isInstructor 
                  ? 'Asigna equipos a aprendices bajo tu supervisión'
                  : 'Asigna equipos a cualquier usuario del sistema'
                }
              </p>
            </div>
          </div>

          <div className="form-divider"></div>

          <form onSubmit={handleSubmit}>
            {/* Sección: Búsqueda de Equipo */}
            <div className="form-section">
              <h3 className="form-section-title">
                <FiPackage size={18} style={{ marginRight: 8 }} />
                Equipo a Asignar
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
                    Cambiar equipo
                  </button>
                </div>
              )}
            </div>

            {/* Sección: Usuario y Responsabilidad */}
            <div className="form-section">
              <h3 className="form-section-title">
                <FiUsers size={18} style={{ marginRight: 8 }} />
                Asignación
              </h3>

              <div className="form-group">
                <label>
                  Cédula del Usuario {isInstructor ? '(Aprendiz) ' : ''}*
                </label>
                <div className="search-equipo-wrapper">
                  <input
                    type="text"
                    value={cedulaUsuario}
                    onChange={(e) => setCedulaUsuario(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        buscarUsuario()
                      }
                    }}
                    placeholder="Ingresa la cédula del usuario"
                    className="search-equipo-input"
                  />
                  <button
                    type="button"
                    onClick={buscarUsuario}
                    disabled={buscandoUsuario || !cedulaUsuario.trim()}
                    className="btn-search-equipo"
                  >
                    {buscandoUsuario ? (
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

              {usuarioEncontrado && (
                <div className="equipo-found-card">
                  <div className="equipo-found-header">
                    <FiCheck size={20} color="#43a047" />
                    <span>Usuario encontrado</span>
                  </div>
                  <div className="equipo-found-info">
                    <div><strong>Nombre:</strong> {usuarioEncontrado.nombre_usuario}</div>
                    <div><strong>Cédula:</strong> {usuarioEncontrado.cedula}</div>
                    <div><strong>Rol:</strong> {usuarioEncontrado.nombre_rol}</div>
                    {usuarioEncontrado.area && (
                      <div><strong>Área:</strong> {usuarioEncontrado.area}</div>
                    )}
                    {usuarioEncontrado.equipos_asignados !== undefined && (
                      <div><strong>Equipos asignados:</strong> {usuarioEncontrado.equipos_asignados}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={limpiarUsuario}
                    className="btn-clear-equipo"
                  >
                    Cambiar usuario
                  </button>
            </div>
              )}

              <div className="form-grid" style={{ marginTop: '1.5rem' }}>
            <div className="form-group">
              <label>
                <FiShield size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Tipo de Responsabilidad
              </label>
              <select
                value={form.tipo_responsabilidad}
                onChange={(e) => handleChange('tipo_responsabilidad', e.target.value)}
              >
                <option value="Principal">Principal</option>
                <option value="Secundario">Secundario</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                    Días de Asignación (Opcional)
              </label>
                  <input
                    type="number"
                    min="1"
                    value={form.dias_asignados}
                    onChange={(e) => handleChange('dias_asignados', e.target.value)}
                    placeholder="Ej: 30, 60, 90..."
                    style={{ width: '100%' }}
                  />
                  <p style={{ marginTop: '4px', fontSize: '0.8rem', color: '#666' }}>
                    Duración esperada de la asignación en días
                  </p>
                </div>
              </div>
            </div>

            {/* Sección: Observaciones */}
            <div className="form-section">
              <h3 className="form-section-title">
                <FiFileText size={18} style={{ marginRight: 8 }} />
                Observaciones (Opcional)
              </h3>
              
              <div className="form-group">
              <textarea
                value={form.observaciones}
                onChange={(e) => handleChange('observaciones', e.target.value)}
                  placeholder="Notas adicionales sobre la asignación..."
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
                {loading ? 'Asignando...' : 'Asignar Equipo'}
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


