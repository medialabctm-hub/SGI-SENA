import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { FiTool, FiEye, FiCheckCircle, FiClock, FiXCircle, FiAlertCircle, FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function Mantenimientos() {
  const navigate = useNavigate()
  const [mantenimientos, setMantenimientos] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedMantenimiento, setSelectedMantenimiento] = useState(null)
  const [editandoEstado, setEditandoEstado] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [editandoFechaProximo, setEditandoFechaProximo] = useState(false)
  const [nuevaFechaProximo, setNuevaFechaProximo] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
  const [user, setUser] = useState(null)

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
    fetchMantenimientos()
  }, [])

  async function fetchMantenimientos() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/mantenimiento', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo cargar los mantenimientos')
      setMantenimientos(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar mantenimientos'), type: 'error' })
      setMantenimientos([])
    } finally {
      setLoading(false)
    }
  }

  function getEstadoBadge(estado) {
    const estados = {
      'Programado': { color: '#3b82f6', bg: '#dbeafe', icon: <FiClock size={14} /> },
      'En Proceso': { color: '#f59e0b', bg: '#fef3c7', icon: <FiAlertCircle size={14} /> },
      'Completado': { color: '#10b981', bg: '#d1fae5', icon: <FiCheckCircle size={14} /> },
      'Cancelado': { color: '#ef4444', bg: '#fee2e2', icon: <FiXCircle size={14} /> }
    }
    const estadoInfo = estados[estado] || estados['Completado']
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
        {estado || 'Completado'}
      </span>
    )
  }

  function getTipoBadge(tipo) {
    const tipos = {
      'Preventivo': { color: '#10b981', bg: '#d1fae5' },
      'Correctivo': { color: '#f59e0b', bg: '#fef3c7' },
      'Actualización': { color: '#3b82f6', bg: '#dbeafe' }
    }
    const tipoInfo = tipos[tipo] || tipos['Preventivo']
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: tipoInfo.color,
        background: tipoInfo.bg
      }}>
        {tipo}
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

  function formatCurrency(value) {
    if (!value) return '-'
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value)
  }

  const isAdmin = user?.nombre_rol === 'Administrador'
  const isInstructor = user?.nombre_rol === 'Instructor'

  function abrirEditarEstado(mantenimiento) {
    setNuevoEstado(mantenimiento.estado_mantenimiento || 'Programado')
    setEditandoEstado(true)
  }

  function cancelarEditarEstado() {
    setEditandoEstado(false)
    setNuevoEstado('')
  }

  async function guardarEstado() {
    if (!selectedMantenimiento || !nuevoEstado) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/mantenimiento/${selectedMantenimiento.id_mantenimiento}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          estado_mantenimiento: nuevoEstado
        })
      })

      const data = await parseApiResponse(res, 'No se pudo actualizar el estado')
      setToast({ message: data.message || 'Estado actualizado correctamente', type: 'success' })
      
      // Actualizar el mantenimiento en la lista
      setMantenimientos(prev => prev.map(m => 
        m.id_mantenimiento === selectedMantenimiento.id_mantenimiento 
          ? { ...m, estado_mantenimiento: nuevoEstado }
          : m
      ))
      
      // Actualizar el mantenimiento seleccionado
      setSelectedMantenimiento(prev => ({ ...prev, estado_mantenimiento: nuevoEstado }))
      cancelarEditarEstado()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar el estado'), type: 'error' })
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
      const res = await fetch(`/api/mantenimiento/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo eliminar el mantenimiento')
      setToast({ message: data.message || 'Mantenimiento eliminado correctamente', type: 'success' })
      await fetchMantenimientos()
      if (selectedMantenimiento?.id_mantenimiento === id) {
        setSelectedMantenimiento(null)
      }
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al eliminar el mantenimiento'), type: 'error' })
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
            title="Eliminar Mantenimiento"
            message="¿Estás seguro de que deseas eliminar este mantenimiento? Esta acción no se puede deshacer."
            confirmText="Eliminar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDelete}
            onCancel={() => setDeleteConfirm({ open: false, id: null })}
          />
          
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <FiTool size={24} />
                </div>
                <div>
                  <h2 className="card-title">Mantenimientos</h2>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '14px' }}>
                    Historial de mantenimientos realizados en los equipos
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/mantenimientos/crear')}
                className="btn btn-primary btn-md"
              >
                <FiPlus size={18} />
                Nuevo Mantenimiento
              </button>
            </div>

            <div className="card-body">
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Cargando mantenimientos...</p>
                </div>
              ) : mantenimientos.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon-wrapper">
                    <FiTool size={48} color="#9ca3af" />
                  </div>
                  <h3>No hay mantenimientos registrados</h3>
                  <p>Los mantenimientos realizados aparecerán aquí</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Equipo</th>
                        <th>Tipo</th>
                        <th>Fecha</th>
                        <th>Próximo</th>
                        <th>Estado</th>
                        <th>Costo</th>
                        <th>Realizado por</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mantenimientos.map((mant) => (
                        <tr key={mant.id_mantenimiento}>
                          <td>{mant.id_mantenimiento}</td>
                          <td>
                            <div>
                              <strong>{mant.equipo_tipo} {mant.equipo_marca} {mant.equipo_modelo}</strong>
                              {mant.consecutivo && <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '4px' }}>Consecutivo: {mant.consecutivo}</div>}
                            </div>
                          </td>
                          <td>{getTipoBadge(mant.tipo_mantenimiento)}</td>
                          <td>{formatDate(mant.fecha_mantenimiento)}</td>
                          <td>{mant.fecha_proximo_mantenimiento ? formatDate(mant.fecha_proximo_mantenimiento) : '-'}</td>
                          <td>{getEstadoBadge(mant.estado_mantenimiento)}</td>
                          <td>{formatCurrency(mant.costo)}</td>
                          <td>{mant.realizado_por_nombre || '-'}</td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="table-action-btn"
                                onClick={() => setSelectedMantenimiento(mant)}
                                title="Ver detalles"
                              >
                                <FiEye size={14} />
                              </button>
                              {(isAdmin || isInstructor) && (
                                <button
                                  className="table-action-btn"
                                  onClick={() => {
                                    setSelectedMantenimiento(mant)
                                    abrirEditarEstado(mant)
                                  }}
                                  disabled={loading}
                                  title="Editar estado"
                                >
                                  <FiEdit size={14} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  className="table-action-btn table-action-btn-danger"
                                  onClick={() => confirmDelete(mant.id_mantenimiento)}
                                  disabled={loading}
                                  title="Eliminar"
                                >
                                  <FiTrash2 size={14} />
                                </button>
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
          </div>

      {selectedMantenimiento && (
        <div className="modal-overlay" onClick={() => setSelectedMantenimiento(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Detalle de Mantenimiento</h3>
              <button
                className="modal-close"
                onClick={() => setSelectedMantenimiento(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ID</label>
                  <div>{selectedMantenimiento.id_mantenimiento}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Equipo</label>
                  <div>
                    {selectedMantenimiento.equipo_tipo} {selectedMantenimiento.equipo_marca} {selectedMantenimiento.equipo_modelo}
                    {selectedMantenimiento.consecutivo && <span> (Consecutivo: {selectedMantenimiento.consecutivo})</span>}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <div>{getTipoBadge(selectedMantenimiento.tipo_mantenimiento)}</div>
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label">Estado</label>
                    {!editandoEstado && (isAdmin || isInstructor) && (
                      <button
                        onClick={() => abrirEditarEstado(selectedMantenimiento)}
                        className="btn btn-secondary btn-sm"
                      >
                        <FiEdit size={14} />
                        Cambiar Estado
                      </button>
                    )}
                  </div>
                  {editandoEstado ? (
                    <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
                      <select
                        className="form-select"
                        value={nuevoEstado}
                        onChange={(e) => setNuevoEstado(e.target.value)}
                      >
                        <option value="Programado">Programado</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Completado">Completado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={guardarEstado}
                          className="btn btn-primary btn-sm"
                          disabled={loading}
                          style={{ flex: 1 }}
                        >
                          {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          onClick={cancelarEditarEstado}
                          className="btn btn-secondary btn-sm"
                          disabled={loading}
                          style={{ flex: 1 }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{marginTop: '8px'}}>{getEstadoBadge(selectedMantenimiento.estado_mantenimiento)}</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de mantenimiento</label>
                  <div>{formatDate(selectedMantenimiento.fecha_mantenimiento)}</div>
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label">Próximo mantenimiento del equipo</label>
                  </div>
                  {editandoFechaProximo ? (
                    <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
                      <input
                        type="date"
                        className="form-input"
                        value={nuevaFechaProximo}
                        onChange={(e) => setNuevaFechaProximo(e.target.value)}
                        min={selectedMantenimiento.fecha_mantenimiento ? selectedMantenimiento.fecha_mantenimiento.split('T')[0] : ''}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={async () => {
                            try {
                              setLoading(true)
                              const token = localStorage.getItem('token')
                              const res = await fetch(`/api/mantenimiento/${selectedMantenimiento.id_mantenimiento}/fecha-proximo`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({ fecha_proximo: nuevaFechaProximo })
                              })
                              const data = await parseApiResponse(res, 'Error al actualizar fecha')
                              if (res.ok) {
                                setToast({ message: data.message || 'Fecha actualizada correctamente', type: 'success' })
                                setEditandoFechaProximo(false)
                                setNuevaFechaProximo('')
                                fetchMantenimientos()
                                setSelectedMantenimiento({ ...selectedMantenimiento, fecha_proximo_mantenimiento: nuevaFechaProximo })
                              }
                            } catch (err) {
                              setToast({ message: buildErrorMessage(err, 'Error al actualizar fecha'), type: 'error' })
                            } finally {
                              setLoading(false)
                            }
                          }}
                          className="btn btn-primary btn-sm"
                          disabled={loading || !nuevaFechaProximo}
                          style={{ flex: 1 }}
                        >
                          {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => {
                            setEditandoFechaProximo(false)
                            setNuevaFechaProximo('')
                          }}
                          className="btn btn-secondary btn-sm"
                          disabled={loading}
                          style={{ flex: 1 }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <span>{selectedMantenimiento.fecha_proximo_mantenimiento ? formatDate(selectedMantenimiento.fecha_proximo_mantenimiento) : 'No establecida'}</span>
                      <button
                        onClick={() => {
                          setEditandoFechaProximo(true)
                          setNuevaFechaProximo(selectedMantenimiento.fecha_proximo_mantenimiento || '')
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <FiEdit size={14} />
                        {selectedMantenimiento.fecha_proximo_mantenimiento ? 'Editar' : 'Establecer'}
                      </button>
                    </div>
                  )}
                </div>
                {selectedMantenimiento.descripcion_trabajo && (
                  <div className="form-group">
                    <label className="form-label">Descripción del trabajo</label>
                    <div style={{ marginTop: '8px', padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                      {selectedMantenimiento.descripcion_trabajo}
                    </div>
                  </div>
                )}
                {selectedMantenimiento.costo && (
                  <div className="form-group">
                    <label className="form-label">Costo</label>
                    <div>{formatCurrency(selectedMantenimiento.costo)}</div>
                  </div>
                )}
                {selectedMantenimiento.realizado_por_nombre && (
                  <div className="form-group">
                    <label className="form-label">Realizado por</label>
                    <div>{selectedMantenimiento.realizado_por_nombre}</div>
                  </div>
                )}
                {selectedMantenimiento.tecnico_nombre && (
                  <div className="form-group">
                    <label className="form-label">Técnico</label>
                    <div>{selectedMantenimiento.tecnico_nombre}</div>
                  </div>
                )}
                {selectedMantenimiento.observaciones && (
                  <div className="form-group">
                    <label className="form-label">Observaciones</label>
                    <div style={{ marginTop: '8px', padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                      {selectedMantenimiento.observaciones}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {isAdmin && (
                <button
                  onClick={() => confirmDelete(selectedMantenimiento.id_mantenimiento)}
                  className="btn btn-danger btn-md"
                >
                  <FiTrash2 size={14} />
                  Eliminar
                </button>
              )}
              <button className="btn btn-secondary btn-md" onClick={() => setSelectedMantenimiento(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  )
}

