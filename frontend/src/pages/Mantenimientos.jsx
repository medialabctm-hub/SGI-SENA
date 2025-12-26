import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import CustomSelect from '../components/CustomSelect'
import { FiTool, FiEye, FiCheckCircle, FiClock, FiXCircle, FiAlertCircle, FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/mantenimientos.css'

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
  const [editandoFechaMantenimiento, setEditandoFechaMantenimiento] = useState(false)
  const [nuevaFechaMantenimiento, setNuevaFechaMantenimiento] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
  const [user, setUser] = useState(null)
  const [estadosMantenimiento, setEstadosMantenimiento] = useState([])

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
    // Verificar permisos: solo Administrador y Cuentadante pueden acceder
    if (user && user.nombre_rol !== 'Administrador' && user.nombre_rol !== 'Cuentadante') {
      navigate('/dashboard')
      return
    }
    fetchMantenimientos()
    cargarEstadosMantenimiento()
  }, [user, navigate])

  // Cargar estados de mantenimiento desde la API
  async function cargarEstadosMantenimiento() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/mantenimiento/estados', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const estados = await parseApiResponse(res)
        if (Array.isArray(estados) && estados.length > 0) {
          setEstadosMantenimiento(estados)
        }
      }
    } catch (err) {
      console.error('Error al cargar estados de mantenimiento:', err)
    }
  }

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
      'En Proceso': { color: 'var(--warning-600)', bg: '#fef3c7', icon: <FiAlertCircle size={14} /> },
      'Completado': { color: 'var(--success-800)', bg: '#d1fae5', icon: <FiCheckCircle size={14} /> },
      'Cancelado': { color: 'var(--error-700)', bg: '#fee2e2', icon: <FiXCircle size={14} /> }
    }
    const estadoInfo = estados[estado] || estados['Completado']
    const estadoClass = estado === 'Programado' ? 'programado' : 
                       estado === 'En Proceso' ? 'en-proceso' :
                       estado === 'Completado' ? 'completado' :
                       estado === 'Cancelado' ? 'cancelado' : 'completado'
    return (
      <span className={`mantenimientos-estado-badge ${estadoClass}`}>
        {estadoInfo.icon}
        {estado || 'Completado'}
      </span>
    )
  }

  function getTipoBadge(tipo) {
    const tipos = {
      'Preventivo': { color: 'var(--success-800)', bg: '#d1fae5' },
      'Correctivo': { color: 'var(--warning-600)', bg: '#fef3c7' },
      'Predictivo': { color: '#3b82f6', bg: '#dbeafe' }
    }
    const tipoInfo = tipos[tipo] || tipos['Preventivo']
    return (
      <span className="mantenimientos-tipo-badge">
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
  const isCuentadante = user?.nombre_rol === 'Cuentadante'
  const canEditFechas = isAdmin || isCuentadante

  function abrirEditarEstado(mantenimiento) {
    setNuevoEstado(mantenimiento.estado_mantenimiento || estadosMantenimiento[0] || '')
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
          
          <div className="form-equipos form-modern mantenimientos-container">
          <div className="form-header">
            <div className="form-icon-wrapper mantenimientos-header-icon">
              <FiTool size={28} color="#fff" />
            </div>
            <div className="mantenimientos-header-content">
              <h2 className="mantenimientos-title">Mantenimientos</h2>
              <p className="mantenimientos-subtitle">
                Historial de mantenimientos realizados en los equipos
              </p>
            </div>
            {(isAdmin || user?.nombre_rol === 'Cuentadante') && (
              <button
                onClick={() => navigate('/mantenimientos/crear')}
                className="btn-primary btn-modern mantenimientos-add-button"
              >
                <FiPlus size={18} />
                Nuevo Mantenimiento
              </button>
            )}
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
            <div className="mantenimientos-table-wrapper">
              <table className="consulta-table mantenimientos-table">
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
                          {mant.consecutivo && <div className="mantenimientos-consecutivo">Consecutivo: {mant.consecutivo}</div>}
                        </div>
                      </td>
                      <td>{getTipoBadge(mant.tipo_mantenimiento)}</td>
                      <td>{formatDate(mant.fecha_mantenimiento)}</td>
                      <td>{mant.fecha_proximo_mantenimiento ? formatDate(mant.fecha_proximo_mantenimiento) : '-'}</td>
                      <td>{getEstadoBadge(mant.estado_mantenimiento)}</td>
                      <td>{formatCurrency(mant.costo)}</td>
                      <td>{mant.realizado_por_nombre || '-'}</td>
                      <td>
                        <div className="mantenimientos-actions">
                          <button
                            className="btn mantenimientos-action-button"
                            onClick={() => setSelectedMantenimiento(mant)}
                          >
                            <FiEye size={14} className="mantenimientos-action-icon" />
                            Ver
                          </button>
                          {(isAdmin || isInstructor) && (
                            <button
                              className="btn mantenimientos-action-button"
                              onClick={() => {
                                setSelectedMantenimiento(mant)
                                abrirEditarEstado(mant)
                              }}
                              disabled={loading}
                            >
                              <FiEdit size={14} className="mantenimientos-action-icon" />
                              Estado
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              className="btn danger mantenimientos-action-button"
                              onClick={() => confirmDelete(mant.id_mantenimiento)}
                              disabled={loading}
                            >
                              <FiTrash2 size={14} className="mantenimientos-action-icon" />
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
        <div className="mantenimientos-modal-overlay modal-overlay"
          onClick={() => setSelectedMantenimiento(null)}
        >
          <div className="mantenimientos-modal-content modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mantenimientos-modal-header">
              <h3 className="mantenimientos-modal-title">Detalle de Mantenimiento</h3>
              <button
                onClick={() => setSelectedMantenimiento(null)}
                className="mantenimientos-modal-close modal-close"
              >
                ×
              </button>
            </div>

            <div className="mantenimientos-modal-grid">
              <div className="mantenimientos-modal-field">
                <strong className="mantenimientos-modal-field-label">ID:</strong> {selectedMantenimiento.id_mantenimiento}
              </div>
              <div className="mantenimientos-modal-field">
                <strong className="mantenimientos-modal-field-label">Equipo:</strong> {selectedMantenimiento.equipo_tipo} {selectedMantenimiento.equipo_marca} {selectedMantenimiento.equipo_modelo}
                {selectedMantenimiento.consecutivo && <span> (Consecutivo: {selectedMantenimiento.consecutivo})</span>}
              </div>
              <div className="mantenimientos-modal-field">
                <strong className="mantenimientos-modal-field-label">Tipo:</strong> {getTipoBadge(selectedMantenimiento.tipo_mantenimiento)}
              </div>
              <div className="mantenimientos-modal-field">
                <div className="mantenimientos-modal-field-header">
                  <strong className="mantenimientos-modal-field-label">Estado:</strong>
                  {!editandoEstado && (isAdmin || isInstructor) && (
                    <button
                      onClick={() => abrirEditarEstado(selectedMantenimiento)}
                      className="btn mantenimientos-action-button"
                    >
                      <FiEdit size={14} className="mantenimientos-action-icon" />
                      Cambiar Estado
                    </button>
                  )}
                </div>
                {editandoEstado ? (
                  <div className="mantenimientos-modal-edit-grid">
                    <CustomSelect
                      name="nuevoEstado"
                      value={nuevoEstado}
                      onChange={(e) => setNuevoEstado(e.target.value)}
                      options={estadosMantenimiento}
                      placeholder="Seleccionar estado"
                      className="mantenimientos-modal-select form-select"
                    />
                    <div className="mantenimientos-modal-actions-row">
                      <button
                        onClick={guardarEstado}
                        className="btn-primary btn-modern mantenimientos-modal-action-button"
                        disabled={loading}
                      >
                        {loading ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={cancelarEditarEstado}
                        className="btn-secondary btn-modern mantenimientos-modal-action-button"
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  getEstadoBadge(selectedMantenimiento.estado_mantenimiento)
                )}
              </div>
              <div className="mantenimientos-modal-field">
                <strong className="mantenimientos-modal-field-label">Fecha de mantenimiento:</strong>
                {editandoFechaMantenimiento ? (
                  <div className="mantenimientos-modal-edit-grid">
                    <input
                      type="datetime-local"
                      value={nuevaFechaMantenimiento}
                      onChange={(e) => setNuevaFechaMantenimiento(e.target.value)}
                      className="mantenimientos-modal-input form-input"
                    />
                    <div className="mantenimientos-modal-actions-row">
                      <button
                        onClick={async () => {
                          try {
                            setLoading(true)
                            const token = localStorage.getItem('token')
                            const res = await fetch(`/api/mantenimiento/${selectedMantenimiento.id_mantenimiento}/fecha-mantenimiento`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                              },
                              body: JSON.stringify({ fecha_mantenimiento: nuevaFechaMantenimiento })
                            })
                            const data = await parseApiResponse(res, 'Error al actualizar fecha')
                            if (res.ok) {
                              setToast({ message: data.message || 'Fecha actualizada correctamente', type: 'success' })
                              setEditandoFechaMantenimiento(false)
                              setNuevaFechaMantenimiento('')
                              fetchMantenimientos()
                              setSelectedMantenimiento({ ...selectedMantenimiento, fecha_mantenimiento: data.fecha_mantenimiento || nuevaFechaMantenimiento })
                            }
                          } catch (err) {
                            setToast({ message: buildErrorMessage(err, 'Error al actualizar fecha de mantenimiento'), type: 'error' })
                          } finally {
                            setLoading(false)
                          }
                        }}
                        className="btn-primary btn-modern mantenimientos-modal-action-button"
                        disabled={loading || !nuevaFechaMantenimiento}
                      >
                        {loading ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => {
                          setEditandoFechaMantenimiento(false)
                          setNuevaFechaMantenimiento('')
                        }}
                        className="btn-secondary btn-modern mantenimientos-modal-action-button"
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mantenimientos-modal-edit-row">
                    <span>{formatDate(selectedMantenimiento.fecha_mantenimiento)}</span>
                    {canEditFechas && (
                      <button
                        onClick={() => {
                          setEditandoFechaMantenimiento(true)
                          // Convertir la fecha a formato datetime-local (YYYY-MM-DDTHH:mm)
                          const fecha = new Date(selectedMantenimiento.fecha_mantenimiento)
                          const year = fecha.getFullYear()
                          const month = String(fecha.getMonth() + 1).padStart(2, '0')
                          const day = String(fecha.getDate()).padStart(2, '0')
                          const hours = String(fecha.getHours()).padStart(2, '0')
                          const minutes = String(fecha.getMinutes()).padStart(2, '0')
                          setNuevaFechaMantenimiento(`${year}-${month}-${day}T${hours}:${minutes}`)
                        }}
                        className="btn-secondary btn-modern mantenimientos-modal-edit-button-small"
                      >
                        <FiEdit size={14} className="mantenimientos-action-icon" />
                        Editar
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="mantenimientos-modal-field">
                <strong className="mantenimientos-modal-field-label">Próximo mantenimiento del equipo:</strong>
                {editandoFechaProximo ? (
                  <div className="mantenimientos-modal-edit-grid">
                    <input
                      type="date"
                      value={nuevaFechaProximo}
                      onChange={(e) => setNuevaFechaProximo(e.target.value)}
                      min={selectedMantenimiento.fecha_mantenimiento ? selectedMantenimiento.fecha_mantenimiento.split('T')[0] : ''}
                      className="mantenimientos-modal-input form-input"
                    />
                    <div className="mantenimientos-modal-actions-row">
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
                        className="btn-primary btn-modern mantenimientos-modal-action-button"
                        disabled={loading || !nuevaFechaProximo}
                      >
                        {loading ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => {
                          setEditandoFechaProximo(false)
                          setNuevaFechaProximo('')
                        }}
                        className="btn-secondary btn-modern mantenimientos-modal-action-button"
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mantenimientos-modal-edit-row">
                    <span>{selectedMantenimiento.fecha_proximo_mantenimiento ? formatDate(selectedMantenimiento.fecha_proximo_mantenimiento) : 'No establecida'}</span>
                    {canEditFechas && (
                      <button
                        onClick={() => {
                          setEditandoFechaProximo(true)
                          setNuevaFechaProximo(selectedMantenimiento.fecha_proximo_mantenimiento || '')
                        }}
                        className="btn-secondary btn-modern mantenimientos-modal-edit-button-small"
                      >
                        <FiEdit size={14} className="mantenimientos-action-icon" />
                        {selectedMantenimiento.fecha_proximo_mantenimiento ? 'Editar' : 'Establecer'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {selectedMantenimiento.descripcion_trabajo && (
                <div className="mantenimientos-modal-field">
                  <strong className="mantenimientos-modal-field-label">Descripción del trabajo:</strong>
                  <div className="mantenimientos-modal-text-box">
                    {selectedMantenimiento.descripcion_trabajo}
                  </div>
                </div>
              )}
              {selectedMantenimiento.costo && (
                <div className="mantenimientos-modal-field">
                  <strong className="mantenimientos-modal-field-label">Costo:</strong> {formatCurrency(selectedMantenimiento.costo)}
                </div>
              )}
              {selectedMantenimiento.realizado_por_nombre && (
                <div className="mantenimientos-modal-field">
                  <strong className="mantenimientos-modal-field-label">Realizado por:</strong> {selectedMantenimiento.realizado_por_nombre}
                </div>
              )}
              {selectedMantenimiento.tecnico_nombre && (
                <div className="mantenimientos-modal-field">
                  <strong className="mantenimientos-modal-field-label">Técnico:</strong> {selectedMantenimiento.tecnico_nombre}
                </div>
              )}
              {selectedMantenimiento.observaciones && (
                <div className="mantenimientos-modal-field">
                  <strong className="mantenimientos-modal-field-label">Observaciones:</strong>
                  <div className="mantenimientos-modal-text-box">
                    {selectedMantenimiento.observaciones}
                  </div>
                </div>
              )}
              {isAdmin && (
                <div className="mantenimientos-modal-footer">
                  <button
                    onClick={() => confirmDelete(selectedMantenimiento.id_mantenimiento)}
                    className="btn danger mantenimientos-modal-footer-button"
                  >
                    <FiTrash2 size={14} className="mantenimientos-action-icon" />
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

