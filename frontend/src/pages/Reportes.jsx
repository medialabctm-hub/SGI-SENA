import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { FiFileText, FiEye, FiEdit, FiTrash2, FiX } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function Reportes() {
  const [reportes, setReportes] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedReporte, setSelectedReporte] = useState(null)
  const [editingReporte, setEditingReporte] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [user, setUser] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })

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
    fetchReportes()
  }, [])

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
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Reportes</h2>
                <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                  Informes sobre equipos, mantenimiento y uso general
                </p>
              </div>
              <a href="/reportes/crear" className="btn-primary btn-modern" style={{ textDecoration: 'none' }}>
                Nuevo Reporte
              </a>
            </div>
          </div>

          <div className="form-divider"></div>

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

