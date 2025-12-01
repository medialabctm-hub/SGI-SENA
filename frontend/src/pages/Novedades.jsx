import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiAlertCircle, FiEye, FiCheckCircle, FiXCircle, FiEdit, FiPackage, FiFileText, FiSearch, FiCheck, FiX, FiList } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/novedades.css'

export default function Novedades() {
  const [activeTab, setActiveTab] = useState('ver') // 'ver' o 'crear'
  const [novedades, setNovedades] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedNovedad, setSelectedNovedad] = useState(null)
  const [editandoEstado, setEditandoEstado] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [observacionesResolucion, setObservacionesResolucion] = useState('')
  const [user, setUser] = useState(null)
  
  // Estados para crear novedad
  const [form, setForm] = useState({
    codigo_equipo: '',
    tipo_novedad: 'Mal Funcionamiento',
    descripcion: '',
  })
  const [codigoInventario, setCodigoInventario] = useState('')
  const [equipoEncontrado, setEquipoEncontrado] = useState(null)
  const [buscandoEquipo, setBuscandoEquipo] = useState(false)
  const [loadingCrear, setLoadingCrear] = useState(false)

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
    if (tabParam === 'crear') {
      setActiveTab('crear')
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'ver') {
      fetchNovedades()
    }
  }, [activeTab])

  async function fetchNovedades() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/novedades', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo cargar las novedades')
      setNovedades(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar novedades'), type: 'error' })
      setNovedades([])
    } finally {
      setLoading(false)
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
      setLoadingCrear(true)
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
        // Cambiar a la pestaña de ver y actualizar lista
        setActiveTab('ver')
        await fetchNovedades()
      } else {
        setToast({ 
          message: data.error || 'Error al registrar la novedad', 
          type: 'error' 
        })
      }
    } catch (err) {
      setToast({ message: 'Error de conexión con el servidor', type: 'error' })
    } finally {
      setLoadingCrear(false)
    }
  }

  function getEstadoBadge(estado) {
    const estados = {
      'Pendiente': { class: 'pendiente', icon: <FiAlertCircle size={14} /> },
      'En Proceso': { class: 'en-proceso', icon: <FiAlertCircle size={14} /> },
      'Resuelto': { class: 'resuelto', icon: <FiCheckCircle size={14} /> },
      'No Resuelto': { class: 'no-resuelto', icon: <FiXCircle size={14} /> }
    }
    const estadoInfo = estados[estado] || estados['Pendiente']
    return (
      <span className={`novedades-estado-badge ${estadoInfo.class}`}>
        {estadoInfo.icon}
        {estado || 'Pendiente'}
      </span>
    )
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

  function abrirEditarEstado(novedad) {
    setNuevoEstado(novedad.estado_resolucion || 'Pendiente')
    setObservacionesResolucion(novedad.observaciones_resolucion || '')
    setEditandoEstado(true)
  }

  function cancelarEditarEstado() {
    setEditandoEstado(false)
    setNuevoEstado('')
    setObservacionesResolucion('')
  }

  async function guardarEstado() {
    if (!selectedNovedad || !nuevoEstado) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/novedades/${selectedNovedad.id_novedad}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          estado_resolucion: nuevoEstado,
          observaciones_resolucion: observacionesResolucion || null
        })
      })

      const data = await parseApiResponse(res, 'No se pudo actualizar el estado')
      setToast({ message: data.message || 'Estado actualizado correctamente', type: 'success' })
      
      // Actualizar la novedad en la lista
      setNovedades(prev => prev.map(n => 
        n.id_novedad === selectedNovedad.id_novedad 
          ? { ...n, estado_resolucion: nuevoEstado, observaciones_resolucion: observacionesResolucion || null }
          : n
      ))
      
      // Actualizar la novedad seleccionada
      setSelectedNovedad(prev => ({ ...prev, estado_resolucion: nuevoEstado, observaciones_resolucion: observacionesResolucion || null }))
      cancelarEditarEstado()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar el estado'), type: 'error' })
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
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--error-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <FiAlertCircle size={24} />
                </div>
                <div>
                  <h2 className="card-title">Novedades</h2>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '14px' }}>
                    Registro de incidencias y problemas con equipos
                  </p>
                </div>
              </div>
            </div>

            <div className="card-body">
              {/* Pestañas */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid var(--neutral-200)', paddingBottom: '0' }}>
                <button
                  onClick={() => setActiveTab('ver')}
                  className={`btn btn-ghost ${activeTab === 'ver' ? '' : ''}`}
                  style={{ 
                    borderBottom: activeTab === 'ver' ? '3px solid var(--success-800)' : '3px solid transparent',
                    borderRadius: '0',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px',
                    color: activeTab === 'ver' ? 'var(--success-800)' : 'var(--neutral-600)',
                    fontWeight: activeTab === 'ver' ? '600' : '400'
                  }}
                >
                  <FiList size={18} />
                  Ver Novedades
                </button>
                <button
                  onClick={() => setActiveTab('crear')}
                  className={`btn btn-ghost ${activeTab === 'crear' ? '' : ''}`}
                  style={{ 
                    borderBottom: activeTab === 'crear' ? '3px solid var(--success-800)' : '3px solid transparent',
                    borderRadius: '0',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px',
                    color: activeTab === 'crear' ? 'var(--success-800)' : 'var(--neutral-600)',
                    fontWeight: activeTab === 'crear' ? '600' : '400'
                  }}
                >
                  <FiAlertCircle size={18} />
                  Registrar Novedad
                </button>
              </div>

            {activeTab === 'ver' ? (
              <>
                {loading ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Cargando novedades...</p>
                  </div>
                ) : novedades.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon-wrapper">
                      <FiAlertCircle size={48} color="#9ca3af" />
                    </div>
                    <h3>No hay novedades registradas</h3>
                    <p>Las novedades reportadas aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Equipo</th>
                          <th>Tipo</th>
                          <th>Descripción</th>
                          <th>Reportado por</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {novedades.map((novedad) => (
                          <tr key={novedad.id_novedad}>
                            <td>{novedad.id_novedad}</td>
                            <td>
                              <div>
                                <strong>{novedad.equipo_tipo} {novedad.equipo_marca} {novedad.equipo_modelo}</strong>
                                {novedad.consecutivo && <div style={{fontSize: '0.85rem', color: 'var(--muted)', marginTop: '4px'}}>Consecutivo: {novedad.consecutivo}</div>}
                              </div>
                            </td>
                            <td>{novedad.tipo_novedad}</td>
                            <td>
                              <div style={{maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={novedad.descripcion}>
                                {novedad.descripcion}
                              </div>
                            </td>
                            <td>{novedad.reportado_por_nombre}</td>
                            <td>{formatDate(novedad.fecha_novedad)}</td>
                            <td>{getEstadoBadge(novedad.estado_resolucion)}</td>
                            <td>
                              <div className="table-actions">
                                <button
                                  className="table-action-btn"
                                  onClick={() => setSelectedNovedad(novedad)}
                                  title="Ver detalles"
                                >
                                  <FiEye size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <form className="form" onSubmit={handleSubmit}>
                {/* Sección: Equipo */}
                <div style={{marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--neutral-200)'}}>
                  <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', color: 'var(--neutral-800)', marginBottom: '16px'}}>
                    <FiPackage size={18} />
                    Equipo Afectado
                  </h3>
                  
                  <div className="form-group">
                    <label className="form-label">Código de Inventario *</label>
                    <div className="search-wrapper">
                      <div className="search-input-wrapper" style={{flex: 1}}>
                        <input
                          type="text"
                          className="search-input"
                          value={codigoInventario}
                          onChange={(e) => setCodigoInventario(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              buscarEquipo()
                            }
                          }}
                          placeholder="Ingresa el código de inventario del equipo"
                        />
                        <span className="search-icon">🔍</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-md"
                        onClick={buscarEquipo}
                        disabled={buscandoEquipo || !codigoInventario.trim()}
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
                    <div className="card" style={{marginTop: '16px', border: '2px solid var(--success-800)', background: 'var(--success-50)'}}>
                      <div className="card-body">
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--success-800)', fontWeight: '600'}}>
                          <FiCheck size={20} />
                          <span>Equipo encontrado</span>
                        </div>
                        <div style={{display: 'grid', gap: '8px', marginBottom: '12px'}}>
                          <div><strong>Código:</strong> {equipoEncontrado.codigo_inventario}</div>
                          <div><strong>Equipo:</strong> {equipoEncontrado.tipo} {equipoEncontrado.marca} {equipoEncontrado.modelo}</div>
                          {equipoEncontrado.nombre_ambiente && (
                            <div><strong>Ambiente:</strong> {equipoEncontrado.nombre_ambiente}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={limpiarEquipo}
                        >
                          <FiX size={14} />
                          Cambiar equipo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sección: Tipo de Novedad */}
                <div style={{marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--neutral-200)'}}>
                  <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', color: 'var(--neutral-800)', marginBottom: '16px'}}>
                    <FiAlertCircle size={18} />
                    Tipo de Novedad
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Tipo de Novedad *</label>
                    <select
                      className="form-select"
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
                <div style={{marginBottom: '24px'}}>
                  <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', color: 'var(--neutral-800)', marginBottom: '16px'}}>
                    <FiFileText size={18} />
                    Descripción del Problema
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Descripción Detallada *</label>
                    <textarea
                      className="form-textarea"
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
                    className="btn btn-primary btn-md"
                    disabled={loadingCrear}
                  >
                    {loadingCrear ? 'Registrando...' : 'Registrar Novedad'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-md"
                    onClick={() => setActiveTab('ver')}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>

          {selectedNovedad && (
            <div className="modal-overlay" onClick={() => setSelectedNovedad(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 className="modal-title">Detalle de Novedad</h3>
                  <button
                    className="modal-close"
                    onClick={() => setSelectedNovedad(null)}
                  >
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">ID</label>
                      <div>{selectedNovedad.id_novedad}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Equipo</label>
                      <div>
                        {selectedNovedad.equipo_tipo} {selectedNovedad.equipo_marca} {selectedNovedad.equipo_modelo}
                        {selectedNovedad.consecutivo && <span> (Consecutivo: {selectedNovedad.consecutivo})</span>}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipo de Novedad</label>
                      <div>{selectedNovedad.tipo_novedad}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Descripción</label>
                      <div style={{padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', marginTop: '8px'}}>
                        {selectedNovedad.descripcion}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reportado por</label>
                      <div>{selectedNovedad.reportado_por_nombre}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fecha de reporte</label>
                      <div>{formatDate(selectedNovedad.fecha_novedad)}</div>
                    </div>
                    <div className="form-group">
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                        <label className="form-label">Estado</label>
                        {!editandoEstado && (user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                          <button
                            onClick={() => abrirEditarEstado(selectedNovedad)}
                            className="btn btn-secondary btn-sm"
                          >
                            <FiEdit size={14} />
                            Cambiar Estado
                          </button>
                        )}
                      </div>
                      {editandoEstado ? (
                        <div style={{display: 'grid', gap: '12px', marginTop: '8px'}}>
                          <select
                            className="form-select"
                            value={nuevoEstado}
                            onChange={(e) => setNuevoEstado(e.target.value)}
                          >
                            <option value="Pendiente">Pendiente</option>
                            <option value="En Proceso">En Proceso</option>
                            <option value="Resuelto">Resuelto</option>
                            <option value="No Resuelto">No Resuelto</option>
                          </select>
                          <textarea
                            className="form-textarea"
                            value={observacionesResolucion}
                            onChange={(e) => setObservacionesResolucion(e.target.value)}
                            placeholder="Observaciones de resolución (opcional)..."
                            rows={3}
                          />
                          <div style={{display: 'flex', gap: '8px'}}>
                            <button
                              onClick={guardarEstado}
                              className="btn btn-primary btn-sm"
                              disabled={loading}
                            >
                              {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              onClick={cancelarEditarEstado}
                              className="btn btn-secondary btn-sm"
                              disabled={loading}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{marginTop: '8px'}}>{getEstadoBadge(selectedNovedad.estado_resolucion)}</div>
                      )}
                    </div>
                    {selectedNovedad.fecha_resolucion && (
                      <div className="form-group">
                        <label className="form-label">Fecha de resolución</label>
                        <div>{formatDate(selectedNovedad.fecha_resolucion)}</div>
                      </div>
                    )}
                    {selectedNovedad.resuelto_por_nombre && (
                      <div className="form-group">
                        <label className="form-label">Resuelto por</label>
                        <div>{selectedNovedad.resuelto_por_nombre}</div>
                      </div>
                    )}
                    {selectedNovedad.observaciones_resolucion && (
                      <div className="form-group">
                        <label className="form-label">Observaciones de resolución</label>
                        <div style={{padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', marginTop: '8px'}}>
                          {selectedNovedad.observaciones_resolucion}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-md" onClick={() => setSelectedNovedad(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
