import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { FiUserPlus, FiPackage, FiUsers, FiShield, FiFileText, FiSearch, FiCheck, FiUserCheck, FiTrash2, FiList, FiAlertCircle } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function AsignarEquipo() {
  const [activeTab, setActiveTab] = useState('asignar') // 'asignar' o 'ver'
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
  const [asignaciones, setAsignaciones] = useState([])
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, info: null })

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

  useEffect(() => {
    // Verificar si hay un parámetro de URL para la pestaña
    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get('tab')
    if (tabParam === 'ver') {
      setActiveTab('ver')
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'ver') {
      fetchAsignaciones()
    }
  }, [activeTab])

  const isInstructor = user?.nombre_rol === 'Instructor'
  const isAdmin = user?.nombre_rol === 'Administrador'

  async function fetchAsignaciones() {
    setLoadingAsignaciones(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/asignaciones', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo cargar las asignaciones')
      setAsignaciones(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar asignaciones'), type: 'error' })
      setAsignaciones([])
    } finally {
      setLoadingAsignaciones(false)
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getTipoResponsabilidadBadge(tipo) {
    const tipos = {
      'Principal': { color: '#3b82f6', bg: '#dbeafe' },
      'Secundario': { color: '#6b7280', bg: '#f3f4f6' }
    }
    const tipoInfo = tipos[tipo] || tipos['Principal']
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: tipoInfo.color,
        background: tipoInfo.bg,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <FiShield size={12} />
        {tipo}
      </span>
    )
  }

  function confirmDelete(id, info) {
    setDeleteConfirm({ 
      open: true, 
      id,
      info: info || 'esta asignación'
    })
  }

  async function handleDelete() {
    const id = deleteConfirm.id
    if (!id) return
    
    setDeleteConfirm({ open: false, id: null, info: null })
    setLoadingAsignaciones(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/asignaciones/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo eliminar la asignación')
      setToast({ message: data.message || 'Asignación eliminada correctamente', type: 'success' })
      await fetchAsignaciones()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al eliminar la asignación'), type: 'error' })
    } finally {
      setLoadingAsignaciones(false)
    }
  }

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

    // Validar que el equipo no esté en mantenimiento
    if (equipoEncontrado?.estado_mantenimiento_activo === 'En Proceso') {
      setToast({ 
        message: `Este equipo está en mantenimiento (${equipoEncontrado.tipo_mantenimiento_activo || 'En Proceso'}). No se puede asignar hasta que el mantenimiento finalice.`, 
        type: 'error' 
      })
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
        // Actualizar lista de asignaciones si está visible
        if (activeTab === 'ver') {
          await fetchAsignaciones()
        }
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
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <ConfirmModal
            open={deleteConfirm.open}
            title="Eliminar Asignación"
            message={`¿Estás seguro de que deseas eliminar ${deleteConfirm.info}? Esta acción no se puede deshacer.`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDelete}
            onCancel={() => setDeleteConfirm({ open: false, id: null, info: null })}
          />
        <div className="form-equipos form-modern">
          <div className="form-header">
            <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #51cf66 0%, #40c057 100%)' }}>
              <FiUserPlus size={28} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Asignación de Equipos</h2>
              <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                {isInstructor 
                  ? 'Asigna equipos a aprendices y gestiona las asignaciones'
                  : 'Asigna equipos a usuarios y gestiona todas las asignaciones'
                }
              </p>
            </div>
          </div>

          {/* Pestañas */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginTop: '1.5rem',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '0'
          }}>
            <button
              onClick={() => setActiveTab('asignar')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'transparent',
                color: activeTab === 'asignar' ? '#40c057' : '#6b7280',
                fontWeight: activeTab === 'asignar' ? 600 : 400,
                fontSize: '1rem',
                cursor: 'pointer',
                borderBottom: activeTab === 'asignar' ? '3px solid #40c057' : '3px solid transparent',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FiUserPlus size={18} />
              Asignar Equipo
            </button>
            <button
              onClick={() => setActiveTab('ver')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'transparent',
                color: activeTab === 'ver' ? '#40c057' : '#6b7280',
                fontWeight: activeTab === 'ver' ? 600 : 400,
                fontSize: '1rem',
                cursor: 'pointer',
                borderBottom: activeTab === 'ver' ? '3px solid #40c057' : '3px solid transparent',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FiList size={18} />
              Ver Asignaciones
            </button>
          </div>

          <div className="form-divider" style={{ marginTop: '0' }}></div>

          {activeTab === 'asignar' ? (
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
                    {equipoEncontrado.estado_mantenimiento_activo === 'En Proceso' ? (
                      <>
                        <FiAlertCircle size={20} color="#f59e0b" />
                        <span>Equipo en Mantenimiento</span>
                      </>
                    ) : (
                      <>
                        <FiCheck size={20} color="#43a047" />
                        <span>Equipo encontrado</span>
                      </>
                    )}
                  </div>
                  <div className="equipo-found-info">
                    <div><strong>Código:</strong> {equipoEncontrado.codigo_inventario}</div>
                    <div><strong>Equipo:</strong> {equipoEncontrado.tipo} {equipoEncontrado.marca} {equipoEncontrado.modelo}</div>
                    {equipoEncontrado.nombre_ambiente && (
                      <div><strong>Ambiente:</strong> {equipoEncontrado.nombre_ambiente}</div>
                    )}
                    {equipoEncontrado.estado_mantenimiento_activo === 'En Proceso' && (
                      <div style={{ 
                        marginTop: '12px', 
                        padding: '12px', 
                        background: '#fef3c7', 
                        borderRadius: '8px',
                        border: '1px solid #f59e0b'
                      }}>
                        <strong style={{ color: '#f59e0b' }}>⚠️ Equipo en Mantenimiento</strong>
                        <div style={{ marginTop: '4px', fontSize: '0.9rem', color: '#92400e' }}>
                          Este equipo está actualmente en mantenimiento ({equipoEncontrado.tipo_mantenimiento_activo || 'En Proceso'}). 
                          No se puede asignar hasta que el mantenimiento finalice.
                        </div>
                      </div>
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
          ) : (
            <div style={{ marginTop: '1.5rem' }}>
              {loadingAsignaciones ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div className="loading-spinner"></div>
                  <p style={{ marginTop: '1rem', color: '#666' }}>Cargando asignaciones...</p>
                </div>
              ) : asignaciones.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon-wrapper">
                    <FiUserCheck size={48} color="#9ca3af" />
                  </div>
                  <h3>No hay asignaciones activas</h3>
                  <p>Las asignaciones de equipos aparecerán aquí</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="consulta-table asignaciones-table" style={{ marginTop: '1rem' }}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Equipo</th>
                        <th>Usuario</th>
                        <th>Tipo Responsabilidad</th>
                        <th>Fecha Asignación</th>
                        <th>Días Asignado</th>
                        <th>Asignado Por</th>
                        <th>Observaciones</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asignaciones.map((asig) => (
                        <tr key={asig.id_responsable}>
                          <td>{asig.id_responsable}</td>
                          <td>
                            <div>
                              <strong>{asig.equipo_tipo} {asig.equipo_marca} {asig.equipo_modelo}</strong>
                              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                                Código: {asig.codigo_inventario || asig.codigo_equipo}
                                {asig.numero_serie && <span> | S/N: {asig.numero_serie}</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong>{asig.usuario_nombre}</strong>
                              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                                Cédula: {asig.usuario_cedula}
                                {asig.usuario_rol && (
                                  <span style={{
                                    marginLeft: '8px',
                                    padding: '2px 8px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    background: '#e0e7ff',
                                    color: '#4338ca',
                                    fontWeight: 600
                                  }}>
                                    {asig.usuario_rol}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>{getTipoResponsabilidadBadge(asig.tipo_responsabilidad)}</td>
                          <td>{formatDate(asig.fecha_asignacion)}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                              {asig.dias_asignado || 0} días
                            </span>
                          </td>
                          <td>{asig.asignado_por_nombre || 'Sistema'}</td>
                          <td style={{ maxWidth: '200px', fontSize: '0.9rem', color: '#666' }}>
                            {asig.observaciones || '-'}
                          </td>
                          <td>
                            <button
                              className="btn danger"
                              onClick={() => confirmDelete(
                                asig.id_responsable,
                                `la asignación del equipo "${asig.equipo_tipo} ${asig.equipo_marca} ${asig.equipo_modelo}" a "${asig.usuario_nombre}"`
                              )}
                              style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                              disabled={loadingAsignaciones}
                            >
                              <FiTrash2 size={14} style={{ marginRight: '4px' }} />
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        </main>
      </div>
    </div>
  )
}


