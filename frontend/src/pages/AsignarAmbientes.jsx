import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import CustomSelect from '../components/CustomSelect'
import { FiMapPin, FiUser, FiPlus, FiTrash2, FiRefreshCw, FiPackage, FiCalendar, FiClock } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/pages/equipos.css'
import '../styles/pages/verificaciones.css'
import '../styles/pages/asignaciones.css'

export default function AsignarAmbientes() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [asignaciones, setAsignaciones] = useState([])
  const [ambientes, setAmbientes] = useState([])
  // Instructores y cuentadantes pueden ser asignados a ambientes (ambos dan clases)
  const [responsablesAmbiente, setResponsablesAmbiente] = useState([])
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
      fetchResponsablesAmbiente()
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

  // Cargar instructores y cuentadantes (ambos pueden ser asignados a ambientes)
  async function fetchResponsablesAmbiente() {
    try {
      const token = localStorage.getItem('token')
      const [resInstructor, resCuentadante] = await Promise.all([
        fetch('/api/auth/users?rol=Instructor', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/auth/users?rol=Cuentadante', { headers: { Authorization: `Bearer ${token}` } })
      ])
      const dataInstructor = await parseApiResponse(resInstructor, 'No se pudo obtener instructores')
      const dataCuentadante = await parseApiResponse(resCuentadante, 'No se pudo obtener cuentadantes')
      const instructores = Array.isArray(dataInstructor) ? dataInstructor : []
      const cuentadantes = Array.isArray(dataCuentadante) ? dataCuentadante : []
      const idsInstructor = new Set((instructores || []).map(u => u.id_usuario))
      const merged = [
        ...(instructores || []).map(u => ({ ...u, nombre_rol: u.nombre_rol || 'Instructor' })),
        ...cuentadantes.filter(c => !idsInstructor.has(c.id_usuario)).map(u => ({ ...u, nombre_rol: u.nombre_rol || 'Cuentadante' }))
      ]
      setResponsablesAmbiente(merged)
    } catch (err) {
      console.error('Error al obtener responsables para ambientes:', err)
      setResponsablesAmbiente([])
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
    const estadoClass = estado === 'Activa' ? 'verificado' : 'pendiente'
    return (
      <span className={`verificacion-badge ${estadoClass}`}>
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
            message="¿Estás seguro de que deseas desasignar este ambiente? El responsable ya no podrá verificar el inventario de este ambiente."
            confirmText="Desasignar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDesasignar}
            onCancel={() => setConfirmDelete({ open: false, id: null })}
          />

          <div className="users-panel">
            <div className="users-toolbar">
              <h2 className="asignar-ambientes-header">
                <FiMapPin size={24} />
                Asignar Ambientes a Instructores o Cuentadantes
              </h2>
              <div className="asignar-ambientes-actions">
                <button
                  type="button"
                  className="btn btn-verde"
                  onClick={() => setShowForm(true)}
                >
                  <FiPlus size={16} />
                  Nueva Asignación
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={fetchAsignaciones}
                  disabled={loading}
                >
                  <FiRefreshCw size={16} />
                  Actualizar
                </button>
              </div>
            </div>

            {showForm && (
              <div className="verificacion-ambiente-card asignar-ambientes-form-container">
                <h3 className="asignar-ambientes-form-title">Nueva Asignación de Ambiente</h3>
                <form onSubmit={handleSubmit}>
                  {/* Fila 1: Ambiente e Instructor */}
                  <div className="asignar-ambientes-form-grid">
                    <div className="asignar-ambientes-form-row">
                      <label className="asignar-ambientes-form-label form-label-required">
                        <FiMapPin size={14} className="asignar-ambientes-form-label-icon" />
                        Ambiente
                      </label>
                      <CustomSelect
                        name="id_ambiente"
                        className="asignar-ambientes-form-select form-select"
                        value={form.id_ambiente}
                        onChange={e => setForm({ ...form, id_ambiente: e.target.value })}
                        options={[
                          { value: '', label: 'Seleccione un ambiente...' },
                          ...ambientes.map(amb => ({
                            value: amb.id_ambiente.toString(),
                            label: `${amb.codigo_ambiente} - ${amb.nombre_ambiente}`
                          }))
                        ]}
                        placeholder="Seleccionar ambiente"
                        required
                      />
                    </div>
                    <div className="asignar-ambientes-form-row">
                      <label className="asignar-ambientes-form-label form-label-required">
                        <FiUser size={14} className="asignar-ambientes-form-label-icon" />
                        Instructor o Cuentadante
                      </label>
                      <CustomSelect
                        name="id_instructor"
                        className="asignar-ambientes-form-select form-select"
                        value={form.id_instructor}
                        onChange={e => setForm({ ...form, id_instructor: e.target.value })}
                        options={[
                          { value: '', label: 'Seleccione instructor o cuentadante...' },
                          ...responsablesAmbiente.map(inst => ({
                            value: inst.id_usuario.toString(),
                            label: `${inst.nombre_usuario} (${inst.cedula})`
                          }))
                        ]}
                        placeholder="Seleccionar instructor o cuentadante"
                        required
                      />
                    </div>
                  </div>

                  {/* Fila 2: Fechas */}
                  <div className="asignar-ambientes-form-grid">
                    <div className="asignar-ambientes-form-row">
                      <label className="asignar-ambientes-form-label form-label-required">
                        <FiCalendar size={14} className="asignar-ambientes-form-label-icon" />
                        Fecha Inicio
                      </label>
                      <input
                        type="date"
                        className="asignar-ambientes-form-input form-input"
                        value={form.fecha_inicio}
                        onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                        required
                      />
                    </div>
                    <div className="asignar-ambientes-form-row">
                      <label className="asignar-ambientes-form-label form-label-required">
                        <FiCalendar size={14} className="asignar-ambientes-form-label-icon" />
                        Fecha Fin
                      </label>
                      <input
                        type="date"
                        className="asignar-ambientes-form-input form-input"
                        value={form.fecha_fin}
                        onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Fila 3: Días de la semana */}
                  <div className="asignar-ambientes-form-row">
                    <label className="asignar-ambientes-form-label form-label-required">
                      Días de la Semana
                    </label>
                    <div className="asignar-ambientes-dias-container">
                      {diasSemanaOpciones.map(dia => (
                        <label 
                          key={dia.valor} 
                          className={`asignar-ambientes-dia-checkbox ${form.dias_semana.includes(dia.valor) ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={form.dias_semana.includes(dia.valor)}
                            onChange={() => handleToggleDia(dia.valor)}
                          />
                          <span>{dia.nombre}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Fila 4: Horas */}
                  <div className="asignar-ambientes-form-grid">
                    <div className="asignar-ambientes-form-row">
                      <label className="asignar-ambientes-form-label form-label-required">
                        <FiClock size={14} className="asignar-ambientes-form-label-icon" />
                        Hora Inicio
                      </label>
                      <input
                        type="time"
                        className="asignar-ambientes-form-input form-input"
                        value={form.hora_inicio}
                        onChange={e => setForm({ ...form, hora_inicio: e.target.value })}
                        required
                      />
                    </div>
                    <div className="asignar-ambientes-form-row">
                      <label className="asignar-ambientes-form-label form-label-required">
                        <FiClock size={14} className="asignar-ambientes-form-label-icon" />
                        Hora Fin
                      </label>
                      <input
                        type="time"
                        className="asignar-ambientes-form-input form-input"
                        value={form.hora_fin}
                        onChange={e => setForm({ ...form, hora_fin: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Resumen de asignaciones */}
                  {cantidadAsignaciones > 0 && (
                    <div className="asignar-ambientes-info-box">
                      <strong>ℹ️ Información:</strong> Se crearán <strong>{cantidadAsignaciones}</strong> asignaciones para todos los días seleccionados dentro del rango de fechas.
                    </div>
                  )}

                  {/* Observaciones */}
                  <div className="asignar-ambientes-form-row">
                    <label className="asignar-ambientes-form-label">
                      Observaciones
                    </label>
                    <textarea
                      className="asignar-ambientes-form-textarea form-textarea"
                      value={form.observaciones}
                      onChange={e => setForm({ ...form, observaciones: e.target.value })}
                      placeholder="Observaciones opcionales sobre la asignación..."
                      rows={3}
                    />
                  </div>

                  {/* Botones */}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
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
              <div className="asignar-ambientes-loading">
                <div className="loading-spinner asignar-ambientes-loading-spinner"></div>
                <p>Cargando asignaciones...</p>
              </div>
            ) : asignaciones.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrapper">
                  <FiMapPin size={48} color="#9ca3af" />
                </div>
                <h3>No hay asignaciones registradas</h3>
                <p>Asigna ambientes a instructores o cuentadantes para que puedan verificar el inventario y dar clases</p>
              </div>
            ) : (
              <div className="asignar-ambientes-content">
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
                      jornada: asig.jornada // Para compatibilidad con asignaciones antiguas
                    })
                  })

                  return Object.values(agrupadas).map((grupo, idx) => (
                    <div key={idx} className="verificacion-ambiente-card asignar-ambientes-ambiente-card">
                      <div className="verificacion-ambiente-header">
                        <div>
                          <h3 className="asignar-ambientes-ambiente-header">
                            <FiMapPin size={20} />
                            {grupo.ambiente.nombre}
                          </h3>
                          <p className="asignar-ambientes-ambiente-subtitle">
                            <span>Código: {grupo.ambiente.codigo} | {grupo.ambiente.tipo}</span>
                            <span className="asignar-ambientes-ambiente-badge asignar-ambientes-ambiente-badge-info">
                              <FiPackage size={14} />
                              {grupo.ambiente.equipos} equipo(s)
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="asignar-ambientes-table-container">
                        <table className="consulta-table asignar-ambientes-table">
                          <thead>
                            <tr>
                              <th>Responsable</th>
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
                                    <div className="asignar-ambientes-table-meta">
                                      CC: {asig.instructor_cedula}
                                    </div>
                                  </div>
                                </td>
                                <td>{formatDate(asig.fecha_inicio)}</td>
                                <td>{asig.hora_inicio || '-'}</td>
                                <td>{asig.hora_fin || '-'}</td>
                                <td>{getEstadoBadge(asig.estado)}</td>
                                <td className="asignar-ambientes-table-cell-observaciones">{asig.observaciones || '-'}</td>
                                <td>
                                  {asig.estado === 'Activa' && (
                                    <button
                                      className="btn btn-delete btn-sm asignar-ambientes-table-actions"
                                      onClick={() => setConfirmDelete({ open: true, id: asig.id })}
                                      disabled={loading}
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

