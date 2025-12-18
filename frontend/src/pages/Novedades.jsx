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
          <div className="form-equipos form-modern" style={{ maxWidth: '1200px' }}>
            <div className="form-header">
              <div className="form-icon-wrapper novedades-icon-wrapper">
                <FiAlertCircle size={28} color="#fff" />
              </div>
              <div className="novedades-header-content">
                <h2 className="novedades-title">Novedades</h2>
                <p className="novedades-subtitle">
                  Registro de incidencias y problemas con equipos
                </p>
              </div>
            </div>

            {/* Pestañas */}
            <div className="novedades-tabs">
              <button
                onClick={() => setActiveTab('ver')}
                className={`novedades-tab ${activeTab === 'ver' ? 'active' : ''}`}
              >
                <FiList size={18} />
                Ver Novedades
              </button>
              <button
                onClick={() => setActiveTab('crear')}
                className={`novedades-tab ${activeTab === 'crear' ? 'active' : ''}`}
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
                                {novedad.CodigoInventario && <div className="novedades-serie-numero">CodigoInventario: {novedad.CodigoInventario}</div>}
                              </div>
                            </td>
                            <td>{novedad.tipo_novedad}</td>
                            <td className="novedades-descripcion-cell">
                              <div className="novedades-descripcion-text" title={novedad.descripcion}>
                                {novedad.descripcion}
                              </div>
                            </td>
                            <td>{novedad.reportado_por_nombre}</td>
                            <td>{formatDate(novedad.fecha_novedad)}</td>
                            <td>{getEstadoBadge(novedad.estado_resolucion)}</td>
                            <td>
                              <button
                                className="btn novedades-ver-btn"
                                onClick={() => setSelectedNovedad(novedad)}
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
            <div className="novedades-modal-overlay" onClick={() => setSelectedNovedad(null)}>
              <div className="novedades-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="novedades-modal-header">
                  <h3 className="novedades-modal-title">Detalle de Novedad</h3>
                  <button
                    onClick={() => setSelectedNovedad(null)}
                    className="novedades-modal-close"
                  >
                    ×
                  </button>
                </div>

                <div className="novedades-modal-grid">
                  <div>
                    <strong>ID:</strong> {selectedNovedad.id_novedad}
                  </div>
                  <div>
                    <strong>Equipo:</strong> {selectedNovedad.equipo_tipo} {selectedNovedad.equipo_marca} {selectedNovedad.equipo_modelo}
                    {selectedNovedad.codigoInventario && <span> (codigoInventario: {selectedNovedad.codigoInventario})</span>}
                  </div>
                  <div>
                    <strong>Tipo de Novedad:</strong> {selectedNovedad.tipo_novedad}
                  </div>
                  <div>
                    <strong>Descripción:</strong>
                    <div className="novedades-descripcion-box">
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
                    <div className="novedades-estado-header">
                      <strong>Estado:</strong>
                      {!editandoEstado && (user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                        <button
                          onClick={() => abrirEditarEstado(selectedNovedad)}
                          className="btn novedades-cambiar-estado-btn"
                        >
                          <FiEdit size={14} style={{ marginRight: '4px' }} />
                          Cambiar Estado
                        </button>
                      )}
                    </div>
                    {editandoEstado ? (
                      <div className="novedades-editar-estado-grid">
                        <select
                          value={nuevoEstado}
                          onChange={(e) => setNuevoEstado(e.target.value)}
                          className="novedades-estado-select"
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
                          className="novedades-observaciones-textarea"
                        />
                        <div className="novedades-editar-buttons">
                          <button
                            onClick={guardarEstado}
                            className="btn-primary btn-modern novedades-editar-btn"
                            disabled={loading}
                          >
                            {loading ? 'Guardando' : 'Guardar'}
                          </button>
                          <button
                            onClick={cancelarEditarEstado}
                            className="btn-secondary btn-modern novedades-editar-btn"
                            disabled={loading}
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
                      <div className="novedades-descripcion-box">
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
