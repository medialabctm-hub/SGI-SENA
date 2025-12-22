import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { FiFileText, FiEye, FiEdit, FiTrash2, FiX, FiPackage, FiType, FiSearch, FiCheck, FiList } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/reportes.css'
import '../styles/reportesModal.css'

export default function Reportes() {
  const [activeTab, setActiveTab] = useState('ver') // 'ver' o 'crear'
  const [reportes, setReportes] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedReporte, setSelectedReporte] = useState(null)
  const [editingReporte, setEditingReporte] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [user, setUser] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
  
  // Estados para crear reporte
  const [form, setForm] = useState({
    tipo_reporte: 'General',
    titulo: '',
    descripcion: '',
    codigo_equipo: '',
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
      fetchReportes()
    }
  }, [activeTab])

  async function fetchReportes() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/reportes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo cargar los reportes')
      setReportes(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar reportes'), type: 'error' })
      setReportes([])
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = user?.nombre_rol === 'Administrador'

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
      setLoadingCrear(true)
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
        // Cambiar a la pestaña de ver y actualizar lista
        setActiveTab('ver')
        await fetchReportes()
      } else {
        setToast({ 
          message: data.error || 'Error al crear el reporte', 
          type: 'error' 
        })
      }
    } catch (err) {
      setToast({ message: 'Error de conexión con el servidor', type: 'error' })
    } finally {
      setLoadingCrear(false)
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

  function startEdit(reporte) {
    setEditingReporte(reporte.id_reporte)
    setEditForm({
      tipo_reporte: reporte.tipo_reporte,
      titulo: reporte.titulo,
      descripcion: reporte.descripcion,
      codigo_equipo: reporte.codigo_equipo || ''
    })
  }

  function cancelEdit() {
    setEditingReporte(null)
    setEditForm({})
  }

  async function saveEdit() {
    if (!editingReporte) return
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/reportes/${editingReporte}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      })
      const data = await parseApiResponse(res, 'No se pudo actualizar el reporte')
      setToast({ message: data.message || 'Reporte actualizado correctamente', type: 'success' })
      await fetchReportes()
      cancelEdit()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar el reporte'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function confirmDelete(id) {
    setDeleteConfirm({ open: true, id })
  }

  async function handleDelete() {
    const id = deleteConfirm.id
    if (!id) return
    
    setDeleteConfirm({ open: false, id: null })
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/reportes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo eliminar el reporte')
      setToast({ message: data.message || 'Reporte eliminado correctamente', type: 'success' })
      await fetchReportes()
      if (selectedReporte?.id_reporte === id) {
        setSelectedReporte(null)
      }
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al eliminar el reporte'), type: 'error' })
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
            title="Eliminar Reporte"
            message="¿Estás seguro de que deseas eliminar este reporte? Esta acción no se puede deshacer."
            confirmText="Eliminar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDelete}
            onCancel={() => setDeleteConfirm({ open: false, id: null })}
          />
          
          <div className="form-equipos form-modern reportes-container">
          <div className="form-header">
            <div className="form-icon-wrapper reportes-header-icon">
              <FiFileText size={28} color="#fff" />
            </div>
            <div className="reportes-header-content">
              <h2 className="reportes-title">Reportes</h2>
              <p className="reportes-subtitle">
                Informes sobre equipos, mantenimiento y uso general
              </p>
            </div>
          </div>

          {/* Pestañas */}
          <div className="reportes-tabs">
            <button
              onClick={() => setActiveTab('ver')}
              className={`reportes-tab-button ${activeTab === 'ver' ? 'active' : ''}`}
            >
              <FiList size={18} />
              Ver Reportes
            </button>
            <button
              onClick={() => setActiveTab('crear')}
              className={`reportes-tab-button ${activeTab === 'crear' ? 'active' : ''}`}
            >
              <FiFileText size={18} />
              Crear Reporte
            </button>
          </div>

          <div className="form-divider form-divider-no-margin"></div>

          {activeTab === 'ver' ? (
            <>
            {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Cargando reportes...</p>
            </div>
          ) : reportes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <FiFileText size={48} color="#9ca3af" />
              </div>
              <h3>No hay reportes registrados</h3>
              <p>Los reportes generados aparecerán aquí</p>
            </div>
          ) : (
            <div className="reportes-table-wrapper">
              <table className="consulta-table reportes-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tipo</th>
                    <th>Título</th>
                    <th>Equipo</th>
                    <th>Generado por</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reportes.map((reporte) => (
                    <tr key={reporte.id_reporte}>
                      <td>{reporte.id_reporte}</td>
                      <td>
                        <span className={`reportes-tipo-badge ${
                          reporte.tipo_reporte === 'General' ? 'reportes-tipo-badge-general' :
                          reporte.tipo_reporte === 'Mantenimiento' ? 'reportes-tipo-badge-mantenimiento' :
                          'reportes-tipo-badge-uso'
                        }`}>
                          {reporte.tipo_reporte}
                        </span>
                      </td>
                      <td>
                        <strong>{reporte.titulo}</strong>
                      </td>
                      <td>
                        {reporte.equipo_tipo ? (
                          <div>
                            {reporte.equipo_tipo} {reporte.equipo_marca} {reporte.equipo_modelo}
                          </div>
                        ) : (
                          <span className="text-muted-italic">General</span>
                        )}
                      </td>
                      <td>{reporte.generado_por_nombre}</td>
                      <td>{formatDate(reporte.fecha_generacion)}</td>
                      <td>
                        <div className="reportes-actions">
                          <button
                            className="btn reportes-action-button"
                            onClick={() => setSelectedReporte(reporte)}
                          >
                            <FiEye size={14} className="reportes-action-icon" />
                            Ver
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                className="btn reportes-action-button"
                                onClick={() => startEdit(reporte)}
                                disabled={loading}
                              >
                                <FiEdit size={14} className="reportes-action-icon" />
                                Editar
                              </button>
                              <button
                                className="btn danger reportes-action-button"
                                onClick={() => confirmDelete(reporte.id_reporte)}
                                disabled={loading}
                              >
                                <FiTrash2 size={14} className="reportes-action-icon" />
                                Eliminar
                              </button>
                            </>
                          )}
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
            <form onSubmit={handleSubmit}>
              {/* Sección: Información del Reporte */}
              <div className="form-section">
                <h3 className="form-section-title">
                  <FiFileText size={18} className="reportes-section-icon" />
                  Información del Reporte
                </h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label>
                      <FiType size={16} className="reportes-option-icon" />
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
                      <FiFileText size={16} className="reportes-option-icon" />
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
                  <FiPackage size={18} className="reportes-section-icon" />
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
                  <p className="form-help-text reportes-form-help-text">
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
                  <FiFileText size={18} className="reportes-section-icon" />
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
                  disabled={loadingCrear}
                >
                  {loadingCrear ? 'Creando...' : 'Crear Reporte'}
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

      {selectedReporte && (
        <div className="reportes-modal-overlay" onClick={() => setSelectedReporte(null)}>
          <div className="reportes-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="reportes-modal-header">
              <h3 className="reportes-modal-title">Detalle de Reporte</h3>
              <button
                onClick={() => setSelectedReporte(null)}
                className="reportes-modal-close-btn"
              >
                ×
              </button>
            </div>

            {editingReporte === selectedReporte.id_reporte ? (
              <div className="reportes-modal-info-grid">
                <div className="form-group">
                  <label>Tipo de Reporte *</label>
                  <select
                    value={editForm.tipo_reporte}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tipo_reporte: e.target.value }))}
                    className="reportes-modal-input"
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
                  <label>Título *</label>
                  <input
                    type="text"
                    value={editForm.titulo}
                    onChange={(e) => setEditForm(prev => ({ ...prev, titulo: e.target.value }))}
                    className="reportes-modal-input"
                  />
                </div>
                <div className="form-group">
                  <label>Descripción *</label>
                  <textarea
                    value={editForm.descripcion}
                    onChange={(e) => setEditForm(prev => ({ ...prev, descripcion: e.target.value }))}
                    rows={6}
                    className="reportes-modal-textarea"
                  />
                </div>
                <div className="reportes-modal-actions-row">
                  <button
                    onClick={saveEdit}
                    className="btn-primary btn-modern reportes-modal-btn"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="btn-secondary btn-modern reportes-modal-btn"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="reportes-modal-info-grid">
                <div>
                  <strong>ID:</strong> {selectedReporte.id_reporte}
                </div>
                <div>
                  <strong>Tipo:</strong> 
                  <span className="reportes-modal-badge reportes-tipo-badge-general">
                    {selectedReporte.tipo_reporte}
                  </span>
                </div>
                <div>
                  <strong>Título:</strong> {selectedReporte.titulo}
                </div>
                {selectedReporte.equipo_tipo && (
                  <div>
                    <strong>Equipo:</strong> {selectedReporte.equipo_tipo} {selectedReporte.equipo_marca} {selectedReporte.equipo_modelo}
                  </div>
                )}
                <div>
                  <strong>Descripción:</strong>
                  <div className="reportes-modal-description-box">
                    {selectedReporte.descripcion}
                  </div>
                </div>
                <div>
                  <strong>Generado por:</strong> {selectedReporte.generado_por_nombre}
                </div>
                <div>
                  <strong>Fecha de generación:</strong> {formatDate(selectedReporte.fecha_generacion)}
                </div>
                {isAdmin && (
                  <div className="reportes-modal-actions-footer">
                    <button
                      onClick={() => startEdit(selectedReporte)}
                      className="btn reportes-modal-btn"
                    >
                      <FiEdit size={14} className="reportes-modal-icon" />
                      Editar
                    </button>
                    <button
                      onClick={() => confirmDelete(selectedReporte.id_reporte)}
                      className="btn danger reportes-modal-btn"
                    >
                      <FiTrash2 size={14} className="reportes-modal-icon" />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  )
}

