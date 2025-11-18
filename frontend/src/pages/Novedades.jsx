import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiAlertCircle, FiEye, FiCheckCircle, FiXCircle, FiEdit, FiPackage, FiFileText, FiSearch, FiCheck, FiX, FiList } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

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
      'Pendiente': { color: '#f59e0b', bg: '#fef3c7', icon: <FiAlertCircle size={14} /> },
      'En Proceso': { color: '#3b82f6', bg: '#dbeafe', icon: <FiAlertCircle size={14} /> },
      'Resuelto': { color: '#10b981', bg: '#d1fae5', icon: <FiCheckCircle size={14} /> },
      'No Resuelto': { color: '#ef4444', bg: '#fee2e2', icon: <FiXCircle size={14} /> }
    }
    const estadoInfo = estados[estado] || estados['Pendiente']
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: estadoInfo.color,
        background: estadoInfo.bg
      }}>
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
          <div className="form-equipos form-modern" style={{ maxWidth: '1200px' }}>
            <div className="form-header">
              <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)' }}>
                <FiAlertCircle size={28} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Novedades</h2>
                <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                  Registro de incidencias y problemas con equipos
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
                onClick={() => setActiveTab('ver')}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  background: 'transparent',
                  color: activeTab === 'ver' ? '#ff6b6b' : '#6b7280',
                  fontWeight: activeTab === 'ver' ? 600 : 400,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'ver' ? '3px solid #ff6b6b' : '3px solid transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FiList size={18} />
                Ver Novedades
              </button>
              <button
                onClick={() => setActiveTab('crear')}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  background: 'transparent',
                  color: activeTab === 'crear' ? '#ff6b6b' : '#6b7280',
                  fontWeight: activeTab === 'crear' ? 600 : 400,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'crear' ? '3px solid #ff6b6b' : '3px solid transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FiAlertCircle size={18} />
                Registrar Novedad
              </button>
            </div>

            <div className="form-divider" style={{ marginTop: '0' }}></div>

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
                  <div style={{ overflowX: 'auto' }}>
                    <table className="consulta-table" style={{ marginTop: '1rem' }}>
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
                                {novedad.numero_serie && <div style={{ fontSize: '0.85rem', color: '#666' }}>S/N: {novedad.numero_serie}</div>}
                              </div>
                            </td>
                            <td>{novedad.tipo_novedad}</td>
                            <td style={{ maxWidth: '300px' }}>
                              <div style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={novedad.descripcion}>
                                {novedad.descripcion}
                              </div>
                            </td>
                            <td>{novedad.reportado_por_nombre}</td>
                            <td>{formatDate(novedad.fecha_novedad)}</td>
                            <td>{getEstadoBadge(novedad.estado_resolucion)}</td>
                            <td>
                              <button
                                className="btn"
                                onClick={() => setSelectedNovedad(novedad)}
                                style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                              >
                                <FiEye size={14} style={{ marginRight: '4px' }} />
                                Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
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
                    disabled={loadingCrear}
                  >
                    {loadingCrear ? 'Registrando...' : 'Registrar Novedad'}
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary btn-modern"
                    onClick={() => setActiveTab('ver')}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>

          {selectedNovedad && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }} onClick={() => setSelectedNovedad(null)}>
              <div style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '700px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '24px', color: '#1a2a3a' }}>Detalle de Novedad</h3>
                  <button
                    onClick={() => setSelectedNovedad(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      color: '#666'
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <strong>ID:</strong> {selectedNovedad.id_novedad}
                  </div>
                  <div>
                    <strong>Equipo:</strong> {selectedNovedad.equipo_tipo} {selectedNovedad.equipo_marca} {selectedNovedad.equipo_modelo}
                    {selectedNovedad.numero_serie && <span> (S/N: {selectedNovedad.numero_serie})</span>}
                  </div>
                  <div>
                    <strong>Tipo de Novedad:</strong> {selectedNovedad.tipo_novedad}
                  </div>
                  <div>
                    <strong>Descripción:</strong>
                    <div style={{ marginTop: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                      {selectedNovedad.descripcion}
                    </div>
                  </div>
                  <div>
                    <strong>Reportado por:</strong> {selectedNovedad.reportado_por_nombre}
                  </div>
                  <div>
                    <strong>Fecha de reporte:</strong> {formatDate(selectedNovedad.fecha_novedad)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong>Estado:</strong>
                      {!editandoEstado && (user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                        <button
                          onClick={() => abrirEditarEstado(selectedNovedad)}
                          className="btn"
                          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                        >
                          <FiEdit size={14} style={{ marginRight: '4px' }} />
                          Cambiar Estado
                        </button>
                      )}
                    </div>
                    {editandoEstado ? (
                      <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
                        <select
                          value={nuevoEstado}
                          onChange={(e) => setNuevoEstado(e.target.value)}
                          style={{
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1.5px solid #b2dfdb',
                            fontSize: '0.95rem'
                          }}
                        >
                          <option value="Pendiente">Pendiente</option>
                          <option value="En Proceso">En Proceso</option>
                          <option value="Resuelto">Resuelto</option>
                          <option value="No Resuelto">No Resuelto</option>
                        </select>
                        <textarea
                          value={observacionesResolucion}
                          onChange={(e) => setObservacionesResolucion(e.target.value)}
                          placeholder="Observaciones de resolución (opcional)..."
                          rows={3}
                          style={{
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1.5px solid #b2dfdb',
                            fontSize: '0.95rem',
                            resize: 'vertical'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={guardarEstado}
                            className="btn-primary btn-modern"
                            disabled={loading}
                            style={{ flex: 1 }}
                          >
                            {loading ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={cancelarEditarEstado}
                            className="btn-secondary btn-modern"
                            disabled={loading}
                            style={{ flex: 1 }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      getEstadoBadge(selectedNovedad.estado_resolucion)
                    )}
                  </div>
                  {selectedNovedad.fecha_resolucion && (
                    <div>
                      <strong>Fecha de resolución:</strong> {formatDate(selectedNovedad.fecha_resolucion)}
                    </div>
                  )}
                  {selectedNovedad.resuelto_por_nombre && (
                    <div>
                      <strong>Resuelto por:</strong> {selectedNovedad.resuelto_por_nombre}
                    </div>
                  )}
                  {selectedNovedad.observaciones_resolucion && (
                    <div>
                      <strong>Observaciones de resolución:</strong>
                      <div style={{ marginTop: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                        {selectedNovedad.observaciones_resolucion}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
