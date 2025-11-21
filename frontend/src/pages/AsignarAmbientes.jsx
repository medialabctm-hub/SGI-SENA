import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { FiMapPin, FiUser, FiPlus, FiTrash2, FiRefreshCw, FiPackage } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/verificacion.css'

export default function AsignarAmbientes() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [asignaciones, setAsignaciones] = useState([])
  const [ambientes, setAmbientes] = useState([])
  const [instructores, setInstructores] = useState([])
  const [toast, setToast] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    id_ambiente: '',
    id_instructor: '',
    jornada: 'Mañana',
    observaciones: ''
  })
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null })

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const userObj = JSON.parse(userData)
        setUser(userObj)
        if (userObj.nombre_rol !== 'Administrador') {
          setToast({ message: 'Solo los administradores pueden gestionar asignaciones de ambientes', type: 'error' })
        }
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [])

  useEffect(() => {
    if (user?.nombre_rol === 'Administrador') {
      fetchAsignaciones()
      fetchAmbientes()
      fetchInstructores()
    }
  }, [user])

  async function fetchAsignaciones() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/ambientes/asignaciones', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener las asignaciones')
      setAsignaciones(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo obtener las asignaciones'), type: 'error' })
      setAsignaciones([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchAmbientes() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/ambientes/activos', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener los ambientes')
      setAmbientes(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error al obtener ambientes:', err)
      setAmbientes([])
    }
  }

  async function fetchInstructores() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener los instructores')
      // Filtrar solo instructores activos
      const instructoresData = Array.isArray(data) 
        ? data.filter(u => u.nombre_rol === 'Instructor' && u.estado === 'Activo')
        : []
      setInstructores(instructoresData)
    } catch (err) {
      console.error('Error al obtener instructores:', err)
      setInstructores([])
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.id_ambiente || !form.id_instructor || !form.jornada) {
      setToast({ message: 'Debes seleccionar un ambiente, un instructor y una jornada', type: 'error' })
      return
    }

    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/ambientes/asignar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id_ambiente: parseInt(form.id_ambiente),
          id_instructor: parseInt(form.id_instructor),
          jornada: form.jornada,
          observaciones: form.observaciones || null
        })
      })
      const data = await parseApiResponse(res, 'No se pudo asignar el ambiente')
      setToast({ message: data.message || 'Ambiente asignado correctamente', type: 'success' })
      setShowForm(false)
      setForm({ id_ambiente: '', id_instructor: '', jornada: 'Mañana', observaciones: '' })
      fetchAsignaciones()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo asignar el ambiente'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDesasignar() {
    if (!confirmDelete.id) return

    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/ambientes/asignaciones/${confirmDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo desasignar el ambiente')
      setToast({ message: data.message || 'Ambiente desasignado correctamente', type: 'success' })
      setConfirmDelete({ open: false, id: null })
      fetchAsignaciones()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo desasignar el ambiente'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  function getEstadoBadge(estado) {
    const estados = {
      'Activa': { color: '#10b981', bg: '#d1fae5' },
      'Finalizada': { color: '#6b7280', bg: '#f3f4f6' }
    }
    const estadoInfo = estados[estado] || estados['Finalizada']
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: estadoInfo.color,
        background: estadoInfo.bg,
        display: 'inline-block'
      }}>
        {estado}
      </span>
    )
  }

  if (user?.nombre_rol !== 'Administrador') {
    return null
  }

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

          <ConfirmModal
            open={confirmDelete.open}
            title="Desasignar Ambiente"
            message="¿Estás seguro de que deseas desasignar este ambiente del instructor? El instructor ya no podrá verificar el inventario de este ambiente."
            confirmText="Desasignar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDesasignar}
            onCancel={() => setConfirmDelete({ open: false, id: null })}
          />

          <div className="users-panel">
            <div className="users-toolbar">
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FiMapPin size={24} />
                Asignar Ambientes a Instructores
              </h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-verde"
                  onClick={() => setShowForm(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <FiPlus size={16} />
                  Nueva Asignación
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={fetchAsignaciones}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <FiRefreshCw size={16} />
                  Actualizar
                </button>
              </div>
            </div>

            {showForm && (
              <div className="verificacion-ambiente-card" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Nueva Asignación</h3>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        Ambiente *
                      </label>
                      <select
                        value={form.id_ambiente}
                        onChange={e => setForm({ ...form, id_ambiente: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid var(--neutral-300)',
                          fontSize: '0.95rem'
                        }}
                      >
                        <option value="">Seleccione un ambiente...</option>
                        {ambientes.map(amb => (
                          <option key={amb.id_ambiente} value={amb.id_ambiente}>
                            {amb.codigo_ambiente} - {amb.nombre_ambiente}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        Instructor *
                      </label>
                      <select
                        value={form.id_instructor}
                        onChange={e => setForm({ ...form, id_instructor: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid var(--neutral-300)',
                          fontSize: '0.95rem'
                        }}
                      >
                        <option value="">Seleccione un instructor...</option>
                        {instructores.map(inst => (
                          <option key={inst.id_usuario} value={inst.id_usuario}>
                            {inst.nombre_usuario} ({inst.cedula})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        Jornada *
                      </label>
                      <select
                        value={form.jornada}
                        onChange={e => setForm({ ...form, jornada: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid var(--neutral-300)',
                          fontSize: '0.95rem'
                        }}
                      >
                        <option value="Mañana">Mañana</option>
                        <option value="Tarde">Tarde</option>
                        <option value="Noche">Noche</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                      Observaciones
                    </label>
                    <textarea
                      value={form.observaciones}
                      onChange={e => setForm({ ...form, observaciones: e.target.value })}
                      placeholder="Observaciones opcionales sobre la asignación..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '2px solid var(--neutral-300)',
                        fontSize: '0.95rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setShowForm(false)
                        setForm({ id_ambiente: '', id_instructor: '', observaciones: '' })
                      }}
                      disabled={loading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-verde"
                      disabled={loading}
                    >
                      {loading ? 'Asignando...' : 'Asignar Ambiente'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading && asignaciones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                <p>Cargando asignaciones...</p>
              </div>
            ) : asignaciones.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrapper">
                  <FiMapPin size={48} color="#9ca3af" />
                </div>
                <h3>No hay asignaciones registradas</h3>
                <p>Asigna ambientes a instructores para que puedan verificar el inventario</p>
              </div>
            ) : (
              <div style={{ marginTop: '1.5rem' }}>
                {/* Agrupar asignaciones por ambiente y jornada para mejor visualización */}
                {(() => {
                  // Agrupar por ambiente y jornada
                  const agrupadas = {}
                  asignaciones.forEach(asig => {
                    const key = `${asig.id_ambiente}-${asig.jornada || 'Sin Jornada'}`
                    if (!agrupadas[key]) {
                      agrupadas[key] = {
                        ambiente: {
                          id: asig.id_ambiente,
                          nombre: asig.nombre_ambiente,
                          codigo: asig.codigo_ambiente,
                          tipo: asig.tipo_ambiente,
                          equipos: asig.total_equipos || 0
                        },
                        jornada: asig.jornada,
                        instructores: []
                      }
                    }
                    agrupadas[key].instructores.push({
                      id: asig.id_responsabilidad_ambiente,
                      nombre: asig.instructor_nombre,
                      cedula: asig.instructor_cedula,
                      fecha_inicio: asig.fecha_inicio,
                      fecha_fin: asig.fecha_fin,
                      estado: asig.estado_responsabilidad,
                      observaciones: asig.observaciones
                    })
                  })

                  return Object.values(agrupadas).map((grupo, idx) => (
                    <div key={idx} className="verificacion-ambiente-card" style={{ marginBottom: '1.5rem' }}>
                      <div className="verificacion-ambiente-header">
                        <div>
                          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiMapPin size={20} />
                            {grupo.ambiente.nombre_ambiente}
                          </h3>
                          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span>Código: {grupo.ambiente.codigo_ambiente} | {grupo.ambiente.tipo}</span>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: grupo.jornada === 'Mañana' ? '#f59e0b' : grupo.jornada === 'Tarde' ? '#3b82f6' : '#8b5cf6',
                              background: grupo.jornada === 'Mañana' ? '#fef3c7' : grupo.jornada === 'Tarde' ? '#dbeafe' : '#ede9fe'
                            }}>
                              Jornada: {grupo.jornada || 'Sin Jornada'}
                            </span>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: '#3b82f6',
                              background: '#dbeafe'
                            }}>
                              <FiPackage size={14} />
                              {grupo.ambiente.equipos} equipo(s)
                            </span>
                          </p>
                        </div>
                      </div>

                      <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                        <table className="consulta-table" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th>Instructor</th>
                              <th>Fecha Inicio</th>
                              <th>Fecha Fin</th>
                              <th>Estado</th>
                              <th>Observaciones</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.instructores.map(inst => (
                              <tr key={inst.id}>
                                <td>
                                  <div>
                                    <strong>{inst.nombre}</strong>
                                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                      CC: {inst.cedula}
                                    </div>
                                  </div>
                                </td>
                                <td>{formatDate(inst.fecha_inicio)}</td>
                                <td>{inst.fecha_fin ? formatDate(inst.fecha_fin) : 'Permanente'}</td>
                                <td>{getEstadoBadge(inst.estado)}</td>
                                <td>{inst.observaciones || '-'}</td>
                                <td>
                                  {inst.estado === 'Activa' && (
                                    <button
                                      className="btn btn-delete"
                                      onClick={() => setConfirmDelete({ open: true, id: inst.id })}
                                      disabled={loading}
                                      style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                      title="Desasignar ambiente"
                                    >
                                      <FiTrash2 size={14} />
                                      Desasignar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

