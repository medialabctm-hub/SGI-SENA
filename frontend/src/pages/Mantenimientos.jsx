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
          
          <div className="form-equipos form-modern" style={{ maxWidth: '1200px' }}>
          <div className="form-header">
            <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
              <FiTool size={28} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Mantenimientos</h2>
              <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                Historial de mantenimientos realizados en los equipos
              </p>
            </div>
            <button
              onClick={() => navigate('/mantenimientos/crear')}
              className="btn-primary btn-modern"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
            >
              <FiPlus size={18} />
              Nuevo Mantenimiento
            </button>
          </div>

          <div className="form-divider"></div>

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
            <div style={{ overflowX: 'auto' }}>
              <table className="consulta-table" style={{ marginTop: '1rem' }}>
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
                          {mant.numero_serie && <div style={{ fontSize: '0.85rem', color: '#666' }}>S/N: {mant.numero_serie}</div>}
                        </div>
                      </td>
                      <td>{getTipoBadge(mant.tipo_mantenimiento)}</td>
                      <td>{formatDate(mant.fecha_mantenimiento)}</td>
                      <td>{mant.fecha_proximo_mantenimiento ? formatDate(mant.fecha_proximo_mantenimiento) : '-'}</td>
                      <td>{getEstadoBadge(mant.estado_mantenimiento)}</td>
                      <td>{formatCurrency(mant.costo)}</td>
                      <td>{mant.realizado_por_nombre || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            className="btn"
                            onClick={() => setSelectedMantenimiento(mant)}
                            style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                          >
                            <FiEye size={14} style={{ marginRight: '4px' }} />
                            Ver
                          </button>
                          {(isAdmin || isInstructor) && (
                            <button
                              className="btn"
                              onClick={() => {
                                setSelectedMantenimiento(mant)
                                abrirEditarEstado(mant)
                              }}
                              style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                              disabled={loading}
                            >
                              <FiEdit size={14} style={{ marginRight: '4px' }} />
                              Estado
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              className="btn danger"
                              onClick={() => confirmDelete(mant.id_mantenimiento)}
                              style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                              disabled={loading}
                            >
                              <FiTrash2 size={14} style={{ marginRight: '4px' }} />
                              Eliminar
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

      {selectedMantenimiento && (
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
        }} onClick={() => setSelectedMantenimiento(null)}>
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
              <h3 style={{ margin: 0, fontSize: '24px', color: '#1a2a3a' }}>Detalle de Mantenimiento</h3>
              <button
                onClick={() => setSelectedMantenimiento(null)}
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
                <strong>ID:</strong> {selectedMantenimiento.id_mantenimiento}
              </div>
              <div>
                <strong>Equipo:</strong> {selectedMantenimiento.equipo_tipo} {selectedMantenimiento.equipo_marca} {selectedMantenimiento.equipo_modelo}
                {selectedMantenimiento.numero_serie && <span> (S/N: {selectedMantenimiento.numero_serie})</span>}
              </div>
              <div>
                <strong>Tipo:</strong> {getTipoBadge(selectedMantenimiento.tipo_mantenimiento)}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>Estado:</strong>
                  {!editandoEstado && (isAdmin || isInstructor) && (
                    <button
                      onClick={() => abrirEditarEstado(selectedMantenimiento)}
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
                      <option value="Programado">Programado</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Completado">Completado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
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
                  getEstadoBadge(selectedMantenimiento.estado_mantenimiento)
                )}
              </div>
              <div>
                <strong>Fecha de mantenimiento:</strong> {formatDate(selectedMantenimiento.fecha_mantenimiento)}
              </div>
              <div>
                <strong>Próximo mantenimiento del equipo:</strong>
                {editandoFechaProximo ? (
                  <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
                    <input
                      type="date"
                      value={nuevaFechaProximo}
                      onChange={(e) => setNuevaFechaProximo(e.target.value)}
                      min={selectedMantenimiento.fecha_mantenimiento ? selectedMantenimiento.fecha_mantenimiento.split('T')[0] : ''}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1.5px solid #b2dfdb',
                        fontSize: '0.95rem'
                      }}
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
                        className="btn-primary btn-modern"
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
                        className="btn-secondary btn-modern"
                        disabled={loading}
                        style={{ flex: 1 }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span>{selectedMantenimiento.fecha_proximo_mantenimiento ? formatDate(selectedMantenimiento.fecha_proximo_mantenimiento) : 'No establecida'}</span>
                    <button
                      onClick={() => {
                        setEditandoFechaProximo(true)
                        setNuevaFechaProximo(selectedMantenimiento.fecha_proximo_mantenimiento || '')
                      }}
                      className="btn-secondary btn-modern"
                      style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                    >
                      <FiEdit size={14} style={{ marginRight: '4px' }} />
                      {selectedMantenimiento.fecha_proximo_mantenimiento ? 'Editar' : 'Establecer'}
                    </button>
                  </div>
                )}
              </div>
              {selectedMantenimiento.descripcion_trabajo && (
                <div>
                  <strong>Descripción del trabajo:</strong>
                  <div style={{ marginTop: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                    {selectedMantenimiento.descripcion_trabajo}
                  </div>
                </div>
              )}
              {selectedMantenimiento.costo && (
                <div>
                  <strong>Costo:</strong> {formatCurrency(selectedMantenimiento.costo)}
                </div>
              )}
              {selectedMantenimiento.realizado_por_nombre && (
                <div>
                  <strong>Realizado por:</strong> {selectedMantenimiento.realizado_por_nombre}
                </div>
              )}
              {selectedMantenimiento.tecnico_nombre && (
                <div>
                  <strong>Técnico:</strong> {selectedMantenimiento.tecnico_nombre}
                </div>
              )}
              {selectedMantenimiento.observaciones && (
                <div>
                  <strong>Observaciones:</strong>
                  <div style={{ marginTop: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                    {selectedMantenimiento.observaciones}
                  </div>
                </div>
              )}
              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                  <button
                    onClick={() => confirmDelete(selectedMantenimiento.id_mantenimiento)}
                    className="btn danger"
                    style={{ flex: 1 }}
                  >
                    <FiTrash2 size={14} style={{ marginRight: '4px' }} />
                    Eliminar
                  </button>
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

