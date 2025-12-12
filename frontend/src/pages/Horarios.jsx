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
  FiAlertCircle
} from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

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
    const estados = {
      'Programada': { color: '#3b82f6', bg: '#dbeafe' },
      'En Curso': { color: 'var(--success-800)', bg: '#d1fae5' },
      'Finalizada': { color: '#6b7280', bg: '#f3f4f6' },
      'Cancelada': { color: 'var(--error-700)', bg: '#fee2e2' }
    }
    const estadoInfo = estados[estado] || estados['Programada']
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

  function formatDate(dateStr) {
    if (!dateStr) return '-'
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
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FiCalendar size={24} />
              Gestión de Horarios
            </h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-verde"
                onClick={() => { resetForm(); setShowForm(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiPlus size={16} />
                Nueva Clase
              </button>
              {user?.nombre_rol === 'Administrador' && (
                <>
                  <button
                    type="button"
                    className="btn btn-verde"
                    onClick={() => setShowImport(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <FiUpload size={16} />
                    Importar Excel
                  </button>
                  <button
                    type="button"
                    className="btn btn-verde"
                    onClick={downloadTemplate}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <FiDownload size={16} />
                    Plantilla
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn"
                onClick={fetchClases}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiRefreshCw size={16} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Ambiente</label>
              <select
                value={filtros.id_ambiente}
                onChange={e => setFiltros({ ...filtros, id_ambiente: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
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
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Instructor</label>
                <select
                  value={filtros.id_instructor}
                  onChange={e => setFiltros({ ...filtros, id_instructor: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
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
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Fecha</label>
              <input
                type="date"
                value={filtros.fecha}
                onChange={e => setFiltros({ ...filtros, fecha: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Estado</label>
              <select
                value={filtros.estado_clase}
                onChange={e => setFiltros({ ...filtros, estado_clase: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
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
            <div className="verificacion-ambiente-card" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>{editingClase ? 'Editar Clase' : 'Nueva Clase'}</h3>
                <button
                  type="button"
                  className="btn"
                  onClick={() => { setShowForm(false); resetForm() }}
                  style={{ padding: '6px 12px' }}
                >
                  <FiX size={16} />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Ambiente *</label>
                    <select
                      value={form.id_ambiente}
                      onChange={e => setForm({ ...form, id_ambiente: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
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
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Instructor *</label>
                      <select
                        value={form.id_instructor}
                        onChange={e => setForm({ ...form, id_instructor: e.target.value })}
                        required
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
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
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Instructor</label>
                      <input
                        type="text"
                        value={user.nombre_usuario}
                        disabled
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--neutral-300)', background: '#f3f4f6' }}
                      />
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Código Ficha</label>
                    <input
                      type="text"
                      value={form.codigo_ficha}
                      onChange={e => setForm({ ...form, codigo_ficha: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
                      placeholder="Ej: 123456"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Nombre Clase</label>
                    <input
                      type="text"
                      value={form.nombre_clase}
                      onChange={e => setForm({ ...form, nombre_clase: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
                      placeholder="Ej: Programación Web"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Fecha *</label>
                    <input
                      type="date"
                      value={form.fecha_clase}
                      onChange={e => setForm({ ...form, fecha_clase: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Hora Inicio *</label>
                    <input
                      type="time"
                      value={form.hora_inicio}
                      onChange={e => setForm({ ...form, hora_inicio: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Hora Fin *</label>
                    <input
                      type="time"
                      value={form.hora_fin}
                      onChange={e => setForm({ ...form, hora_fin: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Descripción</label>
                  <textarea
                    value={form.descripcion}
                    onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--neutral-300)', resize: 'vertical' }}
                    placeholder="Descripción de la clase..."
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn"
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
            <div className="verificacion-ambiente-card" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Importar Horarios desde Excel</h3>
                <button
                  type="button"
                  className="btn"
                  onClick={() => { setShowImport(false); setImportFile(null) }}
                  style={{ padding: '6px 12px' }}
                >
                  <FiX size={16} />
                </button>
              </div>
              <div>
                <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                  Selecciona un archivo Excel con el formato correcto. Puedes descargar la plantilla haciendo clic en el botón "Plantilla".
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => setImportFile(e.target.files[0])}
                  style={{ marginBottom: '1rem', width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid var(--neutral-300)' }}
                />
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              Cargando clases...
            </div>
          ) : clases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <FiCalendar size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>No hay clases registradas</p>
            </div>
          ) : (
            <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
              <table className="consulta-table" style={{ width: '100%' }}>
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
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            {clase.codigo_ambiente}
                          </div>
                        </div>
                      </td>
                      <td>{clase.instructor_nombre}</td>
                      <td>{clase.codigo_ficha || '-'}</td>
                      <td>{clase.nombre_clase || '-'}</td>
                      <td>{formatDate(clase.fecha_clase)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FiClock size={14} />
                          {clase.hora_inicio} - {clase.hora_fin}
                        </div>
                      </td>
                      <td>{clase.total_participantes || 0}</td>
                      <td>{getEstadoBadge(clase.estado_clase)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {clase.estado_clase === 'Programada' && (
                            <>
                              <button
                                className="btn btn-edit"
                                onClick={() => handleEdit(clase)}
                                disabled={loading}
                                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                title="Editar"
                              >
                                <FiEdit size={14} />
                              </button>
                              <button
                                className="btn btn-delete"
                                onClick={() => setConfirmDelete({ open: true, id: clase.id_clase })}
                                disabled={loading}
                                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                title="Cancelar"
                              >
                                <FiTrash2 size={14} />
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
      </main>
    </div>
  )
}

