import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { FiFileText, FiEye, FiEdit, FiTrash2, FiX, FiPackage, FiType, FiSearch, FiCheck, FiList } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

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
          
          <div className="form-equipos form-modern" style={{ maxWidth: '1200px' }}>
          <div className="form-header">
            <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #4dabf7 0%, #339af0 100%)' }}>
              <FiFileText size={28} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Reportes</h2>
              <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                Informes sobre equipos, mantenimiento y uso general
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
                color: activeTab === 'ver' ? '#4dabf7' : '#6b7280',
                fontWeight: activeTab === 'ver' ? 600 : 400,
                fontSize: '1rem',
                cursor: 'pointer',
                borderBottom: activeTab === 'ver' ? '3px solid #4dabf7' : '3px solid transparent',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FiList size={18} />
              Ver Reportes
            </button>
            <button
              onClick={() => setActiveTab('crear')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'transparent',
                color: activeTab === 'crear' ? '#4dabf7' : '#6b7280',
                fontWeight: activeTab === 'crear' ? 600 : 400,
                fontSize: '1rem',
                cursor: 'pointer',
                borderBottom: activeTab === 'crear' ? '3px solid #4dabf7' : '3px solid transparent',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FiFileText size={18} />
              Crear Reporte
            </button>
          </div>

          <div className="form-divider" style={{ marginTop: '0' }}></div>

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
            <div style={{ overflowX: 'auto' }}>
              <table className="consulta-table" style={{ marginTop: '1rem' }}>
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
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          background: '#e0e7ff',
                          color: '#4338ca'
                        }}>
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
                          <span style={{ color: '#999', fontStyle: 'italic' }}>General</span>
                        )}
                      </td>
                      <td>{reporte.generado_por_nombre}</td>
                      <td>{formatDate(reporte.fecha_generacion)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            className="btn"
                            onClick={() => setSelectedReporte(reporte)}
                            style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                          >
                            <FiEye size={14} style={{ marginRight: '4px' }} />
                            Ver
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                className="btn"
                                onClick={() => startEdit(reporte)}
                                style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                                disabled={loading}
                              >
                                <FiEdit size={14} style={{ marginRight: '4px' }} />
                                Editar
                              </button>
                              <button
                                className="btn danger"
                                onClick={() => confirmDelete(reporte.id_reporte)}
                                style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                                disabled={loading}
                              >
                                <FiTrash2 size={14} style={{ marginRight: '4px' }} />
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
        }} onClick={() => setSelectedReporte(null)}>
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
              <h3 style={{ margin: 0, fontSize: '24px', color: '#1a2a3a' }}>Detalle de Reporte</h3>
              <button
                onClick={() => setSelectedReporte(null)}
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

            {editingReporte === selectedReporte.id_reporte ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                  <label>Tipo de Reporte *</label>
                  <select
                    value={editForm.tipo_reporte}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tipo_reporte: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #b2dfdb' }}
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
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #b2dfdb' }}
                  />
                </div>
                <div className="form-group">
                  <label>Descripción *</label>
                  <textarea
                    value={editForm.descripcion}
                    onChange={(e) => setEditForm(prev => ({ ...prev, descripcion: e.target.value }))}
                    rows={6}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid #b2dfdb', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                  <button
                    onClick={saveEdit}
                    className="btn-primary btn-modern"
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="btn-secondary btn-modern"
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <strong>ID:</strong> {selectedReporte.id_reporte}
                </div>
                <div>
                  <strong>Tipo:</strong> 
                  <span style={{
                    marginLeft: '8px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    background: '#e0e7ff',
                    color: '#4338ca'
                  }}>
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
                  <div style={{ marginTop: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
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
                  <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => startEdit(selectedReporte)}
                      className="btn"
                      style={{ flex: 1 }}
                    >
                      <FiEdit size={14} style={{ marginRight: '4px' }} />
                      Editar
                    </button>
                    <button
                      onClick={() => confirmDelete(selectedReporte.id_reporte)}
                      className="btn danger"
                      style={{ flex: 1 }}
                    >
                      <FiTrash2 size={14} style={{ marginRight: '4px' }} />
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

