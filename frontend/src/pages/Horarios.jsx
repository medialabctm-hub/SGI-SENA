import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { 
  FiCalendar, 
  FiClock, 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiRefreshCw, 
  FiUpload, 
  FiDownload,
  FiMapPin,
  FiUser,
  FiUsers,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiPlay,
  FiSquare
} from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/horarios.css'

export default function Horarios() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [clases, setClases] = useState([])
  const [ambientes, setAmbientes] = useState([])
  const [instructores, setInstructores] = useState([])
  const [toast, setToast] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingClase, setEditingClase] = useState(null)
  const [form, setForm] = useState({
    id_ambiente: '',
    id_instructor: '',
    nombre_clase: '',
    codigo_ficha: '',
    descripcion: '',
    fecha_clase: '',
    hora_inicio: '',
    hora_fin: '',
    observaciones: ''
  })
  const [filtros, setFiltros] = useState({
    id_ambiente: '',
    id_instructor: '',
    fecha: '',
    estado_clase: ''
  })
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null })
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState(null)

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
    if (user) {
      fetchClases()
      fetchAmbientes()
      // Solo cargar instructores si es administrador
      if (user.nombre_rol === 'Administrador') {
        fetchInstructores()
      }
      // Sincronizar responsabilidades al cargar la página
      sincronizarResponsabilidades()
    }
  }, [user, filtros])

  // Sincronizar responsabilidades automáticamente cada 2 minutos
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      sincronizarResponsabilidades()
    }, 2 * 60 * 1000) // Cada 2 minutos

    return () => clearInterval(interval)
  }, [user])

  async function sincronizarResponsabilidades() {
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/clases/sincronizar-responsabilidades', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      // Actualizar la lista de clases después de sincronizar
      fetchClases()
    } catch (err) {
      // Silenciar errores de sincronización automática
      console.debug('Sincronización automática:', err.message)
    }
  }

  async function fetchClases() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (filtros.id_ambiente) params.append('id_ambiente', filtros.id_ambiente)
      if (filtros.id_instructor) params.append('id_instructor', filtros.id_instructor)
      if (filtros.fecha) params.append('fecha', filtros.fecha)
      if (filtros.estado_clase) params.append('estado_clase', filtros.estado_clase)

      const res = await fetch(`/api/clases?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener las clases')
      setClases(data || [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo obtener las clases'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function fetchAmbientes() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/ambientes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res)
      setAmbientes(data || [])
    } catch (err) {
      console.error('Error al obtener ambientes:', err)
    }
  }

  async function fetchInstructores() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/usuarios?rol=Instructor', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res)
      setInstructores(data || [])
    } catch (err) {
      console.error('Error al obtener instructores:', err)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (editingClase) {
      handleUpdate()
    } else {
      handleCreate()
    }
  }

  async function handleCreate() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      // Si es instructor, no enviar id_instructor (el backend lo asigna automáticamente)
      const bodyData = { ...form }
      if (user?.nombre_rol === 'Instructor') {
        delete bodyData.id_instructor
      }
      
      // Asegurar que la fecha se envíe en formato YYYY-MM-DD sin conversión de zona horaria
      if (bodyData.fecha_clase) {
        // Si el input type="date" devuelve YYYY-MM-DD, usarlo directamente
        // Si por alguna razón viene como Date object, convertirlo sin zona horaria
        if (bodyData.fecha_clase instanceof Date) {
          const year = bodyData.fecha_clase.getFullYear()
          const month = String(bodyData.fecha_clase.getMonth() + 1).padStart(2, '0')
          const day = String(bodyData.fecha_clase.getDate()).padStart(2, '0')
          bodyData.fecha_clase = `${year}-${month}-${day}`
        } else if (typeof bodyData.fecha_clase === 'string') {
          // Asegurar que solo tenga la parte de la fecha (YYYY-MM-DD)
          bodyData.fecha_clase = bodyData.fecha_clase.split('T')[0].split(' ')[0]
        }
      }
      
      const res = await fetch('/api/clases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      })
      const data = await parseApiResponse(res, 'No se pudo crear la clase')
      setToast({ message: data.message || 'Clase creada correctamente', type: 'success' })
      setShowForm(false)
      resetForm()
      fetchClases()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo crear la clase'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      
      // Preparar datos asegurando formato correcto de fecha
      const bodyData = { ...form }
      
      // Asegurar que la fecha se envíe en formato YYYY-MM-DD sin conversión de zona horaria
      if (bodyData.fecha_clase) {
        // El input type="date" siempre devuelve YYYY-MM-DD como string
        // Asegurarnos de que no haya ninguna conversión
        if (bodyData.fecha_clase instanceof Date) {
          // Si por alguna razón viene como Date, convertir manualmente sin zona horaria
          const year = bodyData.fecha_clase.getFullYear()
          const month = String(bodyData.fecha_clase.getMonth() + 1).padStart(2, '0')
          const day = String(bodyData.fecha_clase.getDate()).padStart(2, '0')
          bodyData.fecha_clase = `${year}-${month}-${day}`
        } else if (typeof bodyData.fecha_clase === 'string') {
          // Extraer solo la parte de la fecha (YYYY-MM-DD) si viene con hora
          const fechaParte = bodyData.fecha_clase.split('T')[0].split(' ')[0]
          // Validar que tenga el formato correcto
          if (/^\d{4}-\d{2}-\d{2}$/.test(fechaParte)) {
            bodyData.fecha_clase = fechaParte
          } else {
            console.error('Formato de fecha inválido:', bodyData.fecha_clase)
          }
        }
      }
      
      // Log para debugging
      console.log('Actualizando clase - Enviando datos al backend:', {
        fecha_clase: bodyData.fecha_clase,
        hora_inicio: bodyData.hora_inicio,
        hora_fin: bodyData.hora_fin
      })
      
      const res = await fetch(`/api/clases/${editingClase.id_clase}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      })
      const data = await parseApiResponse(res, 'No se pudo actualizar la clase')
      setToast({ message: data.message || 'Clase actualizada correctamente', type: 'success' })
      setShowForm(false)
      setEditingClase(null)
      resetForm()
      fetchClases()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo actualizar la clase'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/clases/${confirmDelete.id}/cancelar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo cancelar la clase')
      setToast({ message: data.message || 'Clase cancelada correctamente', type: 'success' })
      setConfirmDelete({ open: false, id: null })
      fetchClases()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo cancelar la clase'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleIniciarClase(idClase) {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/clases/${idClase}/iniciar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      })
      const data = await parseApiResponse(res, 'No se pudo iniciar la clase')
      setToast({ message: data.message || 'Clase iniciada correctamente', type: 'success' })
      fetchClases()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo iniciar la clase'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleFinalizarClase(idClase) {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/clases/${idClase}/finalizar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      })
      const data = await parseApiResponse(res, 'No se pudo finalizar la clase')
      setToast({ message: data.message || 'Clase finalizada correctamente', type: 'success' })
      fetchClases()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo finalizar la clase'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function handleEdit(clase) {
    setEditingClase(clase)
    // Convertir fecha a formato YYYY-MM-DD para el input type="date"
    // Evitar problemas de zona horaria
    let fechaFormateada = clase.fecha_clase
    if (fechaFormateada) {
      // Si viene como string con hora, extraer solo la fecha
      if (fechaFormateada.includes('T')) {
        fechaFormateada = fechaFormateada.split('T')[0]
      } else if (fechaFormateada.includes(' ')) {
        fechaFormateada = fechaFormateada.split(' ')[0]
      }
      // Si viene como Date object, convertir a YYYY-MM-DD
      if (fechaFormateada instanceof Date) {
        const year = fechaFormateada.getFullYear()
        const month = String(fechaFormateada.getMonth() + 1).padStart(2, '0')
        const day = String(fechaFormateada.getDate()).padStart(2, '0')
        fechaFormateada = `${year}-${month}-${day}`
      }
    }
    
    setForm({
      id_ambiente: clase.id_ambiente,
      id_instructor: clase.id_instructor,
      nombre_clase: clase.nombre_clase || '',
      codigo_ficha: clase.codigo_ficha || '',
      descripcion: clase.descripcion || '',
      fecha_clase: fechaFormateada || '',
      hora_inicio: clase.hora_inicio ? clase.hora_inicio.substring(0, 5) : '',
      hora_fin: clase.hora_fin ? clase.hora_fin.substring(0, 5) : '',
      observaciones: clase.observaciones || ''
    })
    setShowForm(true)
  }

  function resetForm() {
    setForm({
      id_ambiente: '',
      id_instructor: '',
      nombre_clase: '',
      codigo_ficha: '',
      descripcion: '',
      fecha_clase: '',
      hora_inicio: '',
      hora_fin: '',
      observaciones: ''
    })
    setEditingClase(null)
  }

  async function handleImport() {
    if (!importFile) {
      setToast({ message: 'Selecciona un archivo', type: 'error' })
      return
    }

    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('archivo', importFile)

      const res = await fetch('/api/horarios/importar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      const data = await parseApiResponse(res, 'No se pudo importar el archivo')
      setToast({ 
        message: data.message || `Importación completada: ${data.resultados?.exitosos?.length || 0} exitosos, ${data.resultados?.errores?.length || 0} errores`, 
        type: 'success' 
      })
      setShowImport(false)
      setImportFile(null)
      fetchClases()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo importar el archivo'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function downloadTemplate() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/horarios/plantilla', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla_horarios.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setToast({ message: 'No se pudo descargar la plantilla', type: 'error' })
    }
  }

  function getEstadoBadge(estado) {
    const estadoClass = estado === 'Programada' ? 'horarios-estado-programada' :
                        estado === 'En Curso' ? 'horarios-estado-en-curso' :
                        estado === 'Finalizada' ? 'horarios-estado-finalizada' :
                        'horarios-estado-cancelada'
    return (
      <span className={`horarios-estado-badge ${estadoClass}`}>
        {estado}
      </span>
    )
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-'
    // Si viene en formato YYYY-MM-DD, extraer directamente sin conversión de zona horaria
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [year, month, day] = dateStr.split('T')[0].split(' ')[0].split('-')
      return `${day}/${month}/${year}`
    }
    // Si viene como Date object o otro formato, usar el método anterior
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  if (!user) return null

  return (
    <div className="dashboard-layout">
      <Sidebar user={user} />
      <main className="dashboard-main">
        <Header user={user} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        <ConfirmModal
          open={confirmDelete.open}
          title="Cancelar Clase"
          message="¿Estás seguro de que deseas cancelar esta clase? Esta acción no se puede deshacer."
          confirmText="Cancelar Clase"
          cancelText="No"
          type="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete({ open: false, id: null })}
        />

        <div className="users-panel">
          <div className="users-toolbar">
            <h2 className="horarios-header-title">
              <FiCalendar size={24} />
              Gestión de Horarios
            </h2>
            <div className="horarios-header-actions">
              <button
                type="button"
                className="btn btn-verde horarios-btn-icon"
                onClick={() => { resetForm(); setShowForm(true) }}
              >
                <FiPlus size={16} />
                Nueva Clase
              </button>
              {user?.nombre_rol === 'Administrador' && (
                <>
                  <button
                    type="button"
                    className="btn btn-verde horarios-btn-icon"
                    onClick={() => setShowImport(true)}
                  >
                    <FiUpload size={16} />
                    Importar Excel
                  </button>
                  <button
                    type="button"
                    className="btn btn-verde horarios-btn-icon"
                    onClick={downloadTemplate}
                  >
                    <FiDownload size={16} />
                    Plantilla
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn-act horarios-btn-icon"
                onClick={fetchClases}
                disabled={loading}
              >
                <FiRefreshCw size={16} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="horarios-filters-container">
            <div className="horarios-filter-item">
              <label className="horarios-filter-label">Ambiente</label>
              <select
                className="horarios-filter-select"
                value={filtros.id_ambiente}
                onChange={e => setFiltros({ ...filtros, id_ambiente: e.target.value })}
              >
                <option value="">Todos</option>
                {ambientes.map(amb => (
                  <option key={amb.id_ambiente} value={amb.id_ambiente}>
                    {amb.codigo_ambiente} - {amb.nombre_ambiente}
                  </option>
                ))}
              </select>
            </div>
            {user?.nombre_rol === 'Administrador' && (
              <div className="horarios-filter-item">
                <label className="horarios-filter-label">Instructor</label>
                <select
                  className="horarios-filter-select"
                  value={filtros.id_instructor}
                  onChange={e => setFiltros({ ...filtros, id_instructor: e.target.value })}
                >
                  <option value="">Todos</option>
                  {instructores.map(inst => (
                    <option key={inst.id_usuario} value={inst.id_usuario}>
                      {inst.nombre_usuario}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="horarios-filter-item">
              <label className="horarios-filter-label">Fecha</label>
              <input
                type="date"
                className="horarios-filter-input"
                value={filtros.fecha}
                onChange={e => setFiltros({ ...filtros, fecha: e.target.value })}
              />
            </div>
            <div className="horarios-filter-item">
              <label className="horarios-filter-label">Estado</label>
              <select
                className="horarios-filter-select"
                value={filtros.estado_clase}
                onChange={e => setFiltros({ ...filtros, estado_clase: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="Programada">Programada</option>
                <option value="En Curso">En Curso</option>
                <option value="Finalizada">Finalizada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          {/* Formulario */}
          {showForm && (
            <div className="horarios-form-container">
              <div className="horarios-form-header">
                <h3 className="horarios-form-title">{editingClase ? 'Editar Clase' : 'Nueva Clase'}</h3>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => { setShowForm(false); resetForm() }}
                >
                  <FiX size={16} />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="horarios-form-grid">
                  <div className="horarios-form-row">
                    <label className="horarios-form-label form-label-required">Ambiente</label>
                    <select
                      className="horarios-form-select form-select"
                      value={form.id_ambiente}
                      onChange={e => setForm({ ...form, id_ambiente: e.target.value })}
                      required
                    >
                      <option value="">Seleccione...</option>
                      {ambientes.map(amb => (
                        <option key={amb.id_ambiente} value={amb.id_ambiente}>
                          {amb.codigo_ambiente} - {amb.nombre_ambiente}
                        </option>
                      ))}
                    </select>
                  </div>
                  {user?.nombre_rol === 'Administrador' && (
                    <div className="horarios-form-row">
                      <label className="horarios-form-label form-label-required">Instructor</label>
                      <select
                        className="horarios-form-select form-select"
                        value={form.id_instructor}
                        onChange={e => setForm({ ...form, id_instructor: e.target.value })}
                        required
                      >
                        <option value="">Seleccione...</option>
                        {instructores.map(inst => (
                          <option key={inst.id_usuario} value={inst.id_usuario}>
                            {inst.nombre_usuario} ({inst.cedula})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {user?.nombre_rol === 'Instructor' && (
                    <div className="horarios-form-row">
                      <label className="horarios-form-label">Instructor</label>
                      <input
                        type="text"
                        className="horarios-form-input form-input"
                        value={user.nombre_usuario}
                        disabled
                      />
                    </div>
                  )}
                  <div className="horarios-form-row">
                    <label className="horarios-form-label">Código Ficha</label>
                    <input
                      type="text"
                      className="horarios-form-input form-input"
                      value={form.codigo_ficha}
                      onChange={e => setForm({ ...form, codigo_ficha: e.target.value })}
                      placeholder="Ej: 123456"
                    />
                  </div>
                  <div className="horarios-form-row">
                    <label className="horarios-form-label">Nombre Clase</label>
                    <input
                      type="text"
                      className="horarios-form-input form-input"
                      value={form.nombre_clase}
                      onChange={e => setForm({ ...form, nombre_clase: e.target.value })}
                      placeholder="Ej: Programación Web"
                    />
                  </div>
                  <div className="horarios-form-row">
                    <label className="horarios-form-label form-label-required">Fecha</label>
                    <input
                      type="date"
                      className="horarios-form-input form-input"
                      value={form.fecha_clase}
                      onChange={e => setForm({ ...form, fecha_clase: e.target.value })}
                      required
                    />
                  </div>
                  <div className="horarios-form-row">
                    <label className="horarios-form-label form-label-required">Hora Inicio</label>
                    <input
                      type="time"
                      className="horarios-form-input form-input"
                      value={form.hora_inicio}
                      onChange={e => setForm({ ...form, hora_inicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="horarios-form-row">
                    <label className="horarios-form-label form-label-required">Hora Fin</label>
                    <input
                      type="time"
                      className="horarios-form-input form-input"
                      value={form.hora_fin}
                      onChange={e => setForm({ ...form, hora_fin: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="horarios-form-row">
                  <label className="horarios-form-label">Descripción</label>
                  <textarea
                    className="horarios-form-textarea form-textarea"
                    value={form.descripcion}
                    onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    rows={3}
                    placeholder="Descripción de la clase..."
                  />
                </div>
                <div className="horarios-form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setShowForm(false); resetForm() }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-verde"
                    disabled={loading}
                  >
                    {editingClase ? 'Actualizar' : 'Crear'} Clase
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal de Importación */}
          {showImport && (
            <div className="verificacion-ambiente-card horarios-import-section">
              <div className="horarios-import-header">
                <h3 className="horarios-import-title">Importar Horarios desde Excel</h3>
                <button
                  type="button"
                  className="btn horarios-import-close"
                  onClick={() => { setShowImport(false); setImportFile(null) }}
                >
                  <FiX size={16} />
                </button>
              </div>
              <div>
                <p className="horarios-import-text">
                  Selecciona un archivo Excel con el formato correcto. Puedes descargar la plantilla haciendo clic en el botón "Plantilla".
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => setImportFile(e.target.files[0])}
                  className="horarios-import-input"
                />
                <div className="horarios-import-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => { setShowImport(false); setImportFile(null) }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-verde"
                    onClick={handleImport}
                    disabled={loading || !importFile}
                  >
                    Importar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de Clases */}
          {loading && clases.length === 0 ? (
            <div className="horarios-loading">
              Cargando clases...
            </div>
          ) : clases.length === 0 ? (
            <div className="horarios-empty">
              <FiCalendar size={48} className="horarios-empty-icon" />
              <p>No hay clases registradas</p>
            </div>
          ) : (
            <div className="horarios-table-wrapper">
              <table className="consulta-table horarios-table">
                <thead>
                  <tr>
                    <th>Ambiente</th>
                    <th>Instructor</th>
                    <th>Ficha</th>
                    <th>Clase</th>
                    <th>Fecha</th>
                    <th>Horario</th>
                    <th>Participantes</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clases.map(clase => (
                    <tr key={clase.id_clase}>
                      <td>
                        <div>
                          <strong>{clase.nombre_ambiente}</strong>
                          <div className="horarios-clase-info">
                            {clase.codigo_ambiente}
                          </div>
                        </div>
                      </td>
                      <td>{clase.instructor_nombre}</td>
                      <td>{clase.codigo_ficha || '-'}</td>
                      <td>{clase.nombre_clase || '-'}</td>
                      <td>{formatDate(clase.fecha_clase)}</td>
                      <td>
                        <div className="horarios-clase-time">
                          <FiClock size={14} />
                          {clase.hora_inicio} - {clase.hora_fin}
                        </div>
                      </td>
                      <td>{clase.total_participantes || 0}</td>
                      <td>{getEstadoBadge(clase.estado_clase)}</td>
                      <td>
                        <div className="horarios-clase-actions">
                          {clase.estado_clase === 'Programada' && (
                            <>
                              <button
                                className="btn btn-verde horarios-action-btn"
                                onClick={() => handleIniciarClase(clase.id_clase)}
                                disabled={loading}
                                title="Iniciar Clase"
                              >
                                <FiPlay size={14} />
                              </button>
                              <button
                                className="btn btn-edit horarios-action-btn"
                                onClick={() => handleEdit(clase)}
                                disabled={loading}
                                title="Editar"
                              >
                                <FiEdit size={14} />
                              </button>
                              <button
                                className="btn btn-delete horarios-action-btn"
                                onClick={() => setConfirmDelete({ open: true, id: clase.id_clase })}
                                disabled={loading}
                                title="Cancelar"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </>
                          )}
                          {clase.estado_clase === 'En Curso' && (
                            <button
                              className="btn btn-verde horarios-action-btn"
                              onClick={() => handleFinalizarClase(clase.id_clase)}
                              disabled={loading}
                              title="Finalizar Clase"
                            >
                              <FiSquare size={14} />
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
      </main>
    </div>
  )
}

