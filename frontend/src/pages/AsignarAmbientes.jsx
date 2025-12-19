import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { FiMapPin, FiUser, FiPlus, FiTrash2, FiRefreshCw, FiPackage, FiCalendar, FiClock } from 'react-icons/fi'
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
  const [cantidadAsignaciones, setCantidadAsignaciones] = useState(0)
  const [form, setForm] = useState({
    id_ambiente: '',
    id_instructor: '',
    fecha_inicio: '',
    fecha_fin: '',
    dias_semana: [],
    hora_inicio: '08:00',
    hora_fin: '12:00',
    observaciones: ''
  })
  
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null })

  const diasSemanaOpciones = [
    { nombre: 'Lunes', valor: 'Lunes' },
    { nombre: 'Martes', valor: 'Martes' },
    { nombre: 'Miércoles', valor: 'Miércoles' },
    { nombre: 'Jueves', valor: 'Jueves' },
    { nombre: 'Viernes', valor: 'Viernes' },
    { nombre: 'Sábado', valor: 'Sábado' },
    { nombre: 'Domingo', valor: 'Domingo' }
  ]

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

  // Calcular cantidad de asignaciones cuando cambian las fechas o días
  useEffect(() => {
    if (form.fecha_inicio && form.fecha_fin && form.dias_semana.length > 0) {
      calcularCantidadAsignaciones()
    } else {
      setCantidadAsignaciones(0)
    }
  }, [form.fecha_inicio, form.fecha_fin, form.dias_semana])

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
      const instructoresData = Array.isArray(data)
        ? data.filter(u => u.nombre_rol === 'Instructor' && u.estado === 'Activo')
        : []
      setInstructores(instructoresData)
    } catch (err) {
      console.error('Error al obtener instructores:', err)
      setInstructores([])
    }
  }

  function calcularCantidadAsignaciones() {
    // Convertir nombres de días a números (0=domingo, 1=lunes, etc.)
    const mapaoDias = {
      'Lunes': 1,
      'Martes': 2,
      'Miércoles': 3,
      'Jueves': 4,
      'Viernes': 5,
      'Sábado': 6,
      'Domingo': 0
    }

    const numeroDias = form.dias_semana.map(d => mapaoDias[d]).filter(d => d !== undefined)

    const inicio = new Date(form.fecha_inicio)
    const fin = new Date(form.fecha_fin)

    inicio.setHours(0, 0, 0, 0)
    fin.setHours(23, 59, 59, 999)

    let contador = 0
    const diaActual = new Date(inicio)

    while (diaActual <= fin) {
      if (numeroDias.includes(diaActual.getDay())) {
        contador++
      }
      diaActual.setDate(diaActual.getDate() + 1)
    }

    setCantidadAsignaciones(contador)
  }

  function handleToggleDia(dia) {
    setForm(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia]
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.id_ambiente || !form.id_instructor || !form.fecha_inicio || !form.fecha_fin || form.dias_semana.length === 0 || !form.hora_inicio || !form.hora_fin) {
      setToast({ message: 'Debes completar todos los campos obligatorios', type: 'error' })
      return
    }

    if (cantidadAsignaciones === 0) {
      setToast({ message: 'No hay fechas válidas para los días seleccionados', type: 'error' })
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
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          dias_semana: form.dias_semana,
          hora_inicio: form.hora_inicio,
          hora_fin: form.hora_fin,
          observaciones: form.observaciones || null
        })
      })
      const data = await parseApiResponse(res, 'No se pudo asignar el ambiente')
      setToast({ message: data.message || `Ambiente asignado correctamente para ${data.cantidad_asignaciones} fechas`, type: 'success' })
      setShowForm(false)
      setForm({
        id_ambiente: '',
        id_instructor: '',
        fecha_inicio: '',
        fecha_fin: '',
        dias_semana: [],
        hora_inicio: '08:00',
        hora_fin: '12:00',
        observaciones: ''
      })
      setCantidadAsignaciones(0)
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
      'Activa': { color: 'var(--success-800)', bg: '#d1fae5' },
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
                  className="btn-act"
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
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Nueva Asignación de Ambiente</h3>
                <form onSubmit={handleSubmit}>
                  {/* Fila 1: Ambiente e Instructor */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        <FiMapPin size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
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
                          border: '2px solid var(--success-800)',
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
                        <FiUser size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
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
                          border: '2px solid var(--success-800)',
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
                  </div>

                  {/* Fila 2: Fechas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        <FiCalendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Fecha Inicio *
                      </label>
                      <input
                        type="date"
                        value={form.fecha_inicio}
                        onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid var(--success-800)',
                          fontSize: '0.95rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        <FiCalendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Fecha Fin *
                      </label>
                      <input
                        type="date"
                        value={form.fecha_fin}
                        onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid var(--success-800)',
                          fontSize: '0.95rem'
                        }}
                      />
                    </div>
                  </div>

                  {/* Fila 3: Días de la semana */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                      Días de la Semana *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                      {diasSemanaOpciones.map(dia => (
                        <label key={dia.valor} style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid var(--success-800)',
                          cursor: 'pointer',
                          backgroundColor: form.dias_semana.includes(dia.valor) ? '#d1fae5' : 'white',
                          borderColor: form.dias_semana.includes(dia.valor) ? 'var(--success-800)' : 'var(--success-800)',
                          transition: 'all 0.2s'
                        }}>
                          <input
                            type="checkbox"
                            checked={form.dias_semana.includes(dia.valor)}
                            onChange={() => handleToggleDia(dia.valor)}
                            style={{ marginRight: '8px', cursor: 'pointer' }}
                          />
                          <span>{dia.nombre}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Fila 4: Horas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        <FiClock size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Hora Inicio *
                      </label>
                      <input
                        type="time"
                        value={form.hora_inicio}
                        onChange={e => setForm({ ...form, hora_inicio: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid var(--neutral-300)',
                          fontSize: '0.95rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        <FiClock size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Hora Fin *
                      </label>
                      <input
                        type="time"
                        value={form.hora_fin}
                        onChange={e => setForm({ ...form, hora_fin: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid var(--success-800)',
                          fontSize: '0.95rem'
                        }}
                      />
                    </div>
                  </div>

                  {/* Resumen de asignaciones */}
                  {cantidadAsignaciones > 0 && (
                    <div style={{
                      padding: '12px 14px',
                      marginBottom: '1rem',
                      borderRadius: '8px',
                      backgroundColor: '#dbeafe',
                      borderLeft: '4px solid #3b82f6',
                      color: '#1e40af'
                    }}>
                      <strong>ℹ️ Información:</strong> Se crearán <strong>{cantidadAsignaciones}</strong> asignaciones para todos los días seleccionados dentro del rango de fechas.
                    </div>
                  )}

                  {/* Observaciones */}
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
                        border: '2px solid var(--success-800)',
                        fontSize: '0.95rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {/* Botones */}
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setShowForm(false)
                        setForm({
                          id_ambiente: '',
                          id_instructor: '',
                          fecha_inicio: '',
                          fecha_fin: '',
                          dias_semana: [],
                          hora_inicio: '08:00',
                          hora_fin: '12:00',
                          observaciones: ''
                        })
                        setCantidadAsignaciones(0)
                      }}
                      disabled={loading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-verde"
                      disabled={loading || cantidadAsignaciones === 0}
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
                {/* Agrupar asignaciones por ambiente para mejor visualización */}
                {(() => {
                  // Agrupar por ambiente
                  const agrupadas = {}
                  asignaciones.forEach(asig => {
                    const key = asig.id_ambiente
                    if (!agrupadas[key]) {
                      agrupadas[key] = {
                        ambiente: {
                          id: asig.id_ambiente,
                          nombre: asig.nombre_ambiente,
                          codigo: asig.codigo_ambiente,
                          tipo: asig.tipo_ambiente,
                          equipos: asig.total_equipos || 0
                        },
                        asignaciones: []
                      }
                    }
                    agrupadas[key].asignaciones.push({
                      id: asig.id_responsabilidad_ambiente,
                      instructor_nombre: asig.instructor_nombre,
                      instructor_cedula: asig.instructor_cedula,
                      fecha_inicio: asig.fecha_inicio,
                      hora_inicio: asig.hora_inicio,
                      hora_fin: asig.hora_fin,
                      estado: asig.estado_responsabilidad,
                      observaciones: asig.observaciones,
                      dias_semana: asig.dias_semana || [],
                      hora_inicio: asig.hora_inicio,
                      hora_fin: asig.hora_fin,
                      jornada: asig.jornada // Para compatibilidad con asignaciones antiguas
                    })
                  })

                  return Object.values(agrupadas).map((grupo, idx) => (
                    <div key={idx} className="verificacion-ambiente-card" style={{ marginBottom: '1.5rem' }}>
                      <div className="verificacion-ambiente-header">
                        <div>
                          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiMapPin size={20} />
                            {grupo.ambiente.nombre}
                          </h3>
                          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span>Código: {grupo.ambiente.codigo} | {grupo.ambiente.tipo}</span>
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
                              <th>Fecha</th>
                              <th>Hora Inicio</th>
                              <th>Hora Fin</th>
                              <th>Estado</th>
                              <th>Observaciones</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.asignaciones.map(asig => (
                              <tr key={asig.id}>
                                <td>
                                  <div>
                                    <strong>{asig.instructor_nombre}</strong>
                                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                      CC: {asig.instructor_cedula}
                                    </div>
                                  </div>
                                </td>
                                <td>{formatDate(asig.fecha_inicio)}</td>
                                <td>{asig.hora_inicio || '-'}</td>
                                <td>{asig.hora_fin || '-'}</td>
                                <td>{getEstadoBadge(asig.estado)}</td>
                                <td style={{ maxWidth: '250px', wordWrap: 'break-word' }}>{asig.observaciones || '-'}</td>
                                <td>
                                  {asig.estado === 'Activa' && (
                                    <button
                                      className="btn btn-delete"
                                      onClick={() => setConfirmDelete({ open: true, id: asig.id })}
                                      disabled={loading}
                                      style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                      title="Desasignar ambiente"
                                    >
                                      <FiTrash2 size={14} />
                                      Eliminar
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

