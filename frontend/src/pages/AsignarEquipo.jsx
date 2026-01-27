import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import CustomSelect from '../components/CustomSelect'
import { FiUserPlus, FiPackage, FiUsers, FiShield, FiFileText, FiSearch, FiCheck, FiUserCheck, FiTrash2, FiList, FiAlertCircle } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import { useSocket } from '../contexts/SocketContext'
import '../styles/pages/equipos.css'
import '../styles/pages/asignaciones.css'

export default function AsignarEquipo() {
  const [activeTab, setActiveTab] = useState('asignar') // 'asignar' o 'ver'
  const [form, setForm] = useState({
    codigo_equipo: '',
    id_usuario: '',
    tipo_responsabilidad: 'Principal',
    observaciones: '',
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

  // Suscribirse a actualizaciones en tiempo real de asignaciones
  const { subscribe } = useSocket()
  useEffect(() => {
    if (!subscribe || activeTab !== 'ver') return
    
    const unsubscribeCreated = subscribe('asignacion:created', () => {
      fetchAsignaciones()
    })
    
    const unsubscribeDeleted = subscribe('asignacion:deleted', () => {
      fetchAsignaciones()
    })
    
    const unsubscribeUpdated = subscribe('asignacion:updated', () => {
      fetchAsignaciones()
    })
    
    return () => {
      unsubscribeCreated()
      unsubscribeDeleted()
      unsubscribeUpdated()
    }
  }, [subscribe, activeTab])

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
    const badgeClass = tipo === 'Principal' ? 'asignar-equipo-badge-principal' : 'asignar-equipo-badge-secundario'
    return (
      <span className={badgeClass}>
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
      const data = await parseApiResponse(res, 'No se pudo eliminar la habilitación')
      setToast({ message: data.message || 'Habilitación eliminada correctamente', type: 'success' })
      await fetchAsignaciones()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al eliminar la habilitación'), type: 'error' })
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
      setToast({ message: 'Ingresa una Documento', type: 'error' })
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
        message: `Este equipo está en mantenimiento (${equipoEncontrado.tipo_mantenimiento_activo || 'En Proceso'}). No se puede habilitar hasta que el mantenimiento finalice.`, 
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
          message: data.message || 'Equipo habilitado correctamente', 
          type: 'success' 
        })
        setForm({
          codigo_equipo: '',
          id_usuario: '',
          tipo_responsabilidad: 'Principal',
          observaciones: '',
        })
        limpiarEquipo()
        limpiarUsuario()
        // Actualizar lista de asignaciones si está visible
        if (activeTab === 'ver') {
          await fetchAsignaciones()
        }
      } else {
        setToast({ 
          message: data.error || 'Error al habilitar el equipo', 
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
            title="Eliminar Habilitación"
            message={`¿Estás seguro de que deseas eliminar ${deleteConfirm.info}? Esta acción no se puede deshacer.`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDelete}
            onCancel={() => setDeleteConfirm({ open: false, id: null, info: null })}
          />
        <div className="form-equipos form-modern">
          <div className="form-header">
            <div className="form-icon-wrapper asignar-equipo-header-icon">
              <FiUserPlus size={28} color="#fff" />
            </div>
            <div className="asignar-equipo-header-content">
              <h2 className="asignar-equipo-header-title">Habilitación de Equipos</h2>
              <p className="asignar-equipo-header-description">
                {isInstructor 
                  ? 'Habilita equipos para aprendices. Esto permite que el aprendiz inicie sesión en la aplicación de escritorio para desbloquear el equipo. El inventario permanece asignado al ambiente.'
                  : 'Habilita equipos para usuarios. Esto permite que el usuario inicie sesión en la aplicación de escritorio para desbloquear el equipo. El inventario permanece asignado al ambiente.'
                }
              </p>
            </div>
          </div>

          {/* Pestañas */}
          <div className="asignar-equipo-tabs">
            <button
              onClick={() => setActiveTab('asignar')}
              className={`asignar-equipo-tab ${activeTab === 'asignar' ? 'active' : ''}`}
            >
              <FiUserPlus size={18} />
              Habilitar Equipo
            </button>
            <button
              onClick={() => setActiveTab('ver')}
              className={`asignar-equipo-tab ${activeTab === 'ver' ? 'active' : ''}`}
            >
              <FiList size={18} />
              Ver Habilitaciones
            </button>
          </div>

          <div className="form-divider asignar-equipo-divider-no-margin"></div>

          {activeTab === 'asignar' ? (
            <form onSubmit={handleSubmit}>
              {/* Sección: Búsqueda de Equipo */}
              <div className="form-section">
                <h3 className="form-section-title">
                  <FiPackage size={18} className="asignar-equipo-section-icon" />
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
                        <FiAlertCircle size={20} color="var(--warning-600)" />
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
                      <div className="asignar-equipo-warning-box">
                        <strong className="asignar-equipo-warning-title">⚠️ Equipo en Mantenimiento</strong>
                        <div className="asignar-equipo-warning-text">
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
                  <FiUsers size={18} className="asignar-equipo-section-icon" />
                  Asignación
                </h3>

                <div className="form-group">
                <label>
                  Documento del Usuario {isInstructor ? '(Aprendiz) ' : ''}*
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
                    placeholder="Ingresa la Documento del usuario"
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
                    <div><strong>Documento:</strong> {usuarioEncontrado.cedula}</div>
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

                <div className="form-grid asignar-equipo-form-grid">
                  <div className="form-group">
                    <label>
                      <FiShield size={16} className="asignar-equipo-shield-icon" />
                      Tipo de Responsabilidad
                    </label>
                    <CustomSelect
                      name="tipo_responsabilidad"
                      value={form.tipo_responsabilidad}
                      onChange={(e) => handleChange('tipo_responsabilidad', e.target.value)}
                      options={['Principal', 'Secundario']}
                      placeholder="Seleccionar tipo"
                    />
                  </div>
                </div>
              </div>

              {/* Sección: Observaciones */}
              <div className="form-section">
                <h3 className="form-section-title">
                  <FiFileText size={18} className="asignar-equipo-section-icon" />
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
                  {loading ? 'Habilitando...' : 'Habilitar Equipo'}
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
            <div className="asignar-equipo-content-wrapper">
              {loadingAsignaciones ? (
                <div className="asignar-equipo-loading">
                  <div className="loading-spinner"></div>
                  <p className="asignar-equipo-loading-text">Cargando asignaciones...</p>
                </div>
              ) : asignaciones.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon-wrapper">
                    <FiUserCheck size={48} color="#9ca3af" />
                  </div>
                  <h3>No hay habilitaciones activas</h3>
                  <p>Las habilitaciones de equipos aparecerán aquí</p>
                </div>
              ) : (
                <div className="asignar-equipo-table-wrapper">
                  <table className="consulta-table asignaciones-table asignar-equipo-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Equipo</th>
                        <th>Usuario</th>
                        <th>Tipo Responsabilidad</th>
                        <th>Fecha Habilitación</th>
                        <th>Días Habilitado</th>
                        <th>Habilitado Por</th>
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
                              <div className="asignar-equipo-equipo-info">
                                Código: {asig.codigo_inventario || asig.codigo_equipo}
                                {asig.consecutivo && <span> | Consecutivo: {asig.consecutivo}</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong>{asig.usuario_nombre}</strong>
                              <div className="asignar-equipo-usuario-info">
                                Documento: {asig.usuario_cedula}
                                {asig.usuario_rol && (
                                  <span className="asignar-equipo-rol-badge">
                                    {asig.usuario_rol}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>{getTipoResponsabilidadBadge(asig.tipo_responsabilidad)}</td>
                          <td>{formatDate(asig.fecha_asignacion)}</td>
                          <td>
                            <span className="asignar-equipo-dias-badge">
                              {asig.dias_asignado || 0} días
                            </span>
                          </td>
                          <td>{asig.asignado_por_nombre || 'Sistema'}</td>
                          <td className="asignar-equipo-observaciones-cell">
                            {asig.observaciones || '-'}
                          </td>
                          <td>
                            <button
                              className="btn danger asignar-equipo-delete-btn"
                              onClick={() => confirmDelete(
                                asig.id_responsable,
                                `la habilitación del equipo "${asig.equipo_tipo} ${asig.equipo_marca} ${asig.equipo_modelo}" a "${asig.usuario_nombre}"`
                              )}
                              disabled={loadingAsignaciones}
                            >
                              <FiTrash2 size={14} className="asignar-equipo-delete-icon" />
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


