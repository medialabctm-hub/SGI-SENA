import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import CustomSelect from '../components/CustomSelect'
import { FiTool, FiEye, FiCheckCircle, FiClock, FiXCircle, FiAlertCircle, FiPlus, FiEdit, FiTrash2, FiList, FiPackage, FiCalendar, FiUser, FiFileText, FiSearch, FiCheck, FiX, FiType } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/mantenimientos.css'
import '../styles/crearMantenimiento.css'

export default function Mantenimientos() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('historial') // 'historial' o 'crear'
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
  
  // Estados para crear mantenimiento
  const [form, setForm] = useState({
    codigo_equipo: '',
    tipo_mantenimiento: '',
    fecha_mantenimiento: '',
    fecha_proximo: '',
    descripcion_trabajo: '',
    id_usuario_tecnico: '',
    observaciones: '',
    estado_mantenimiento: '',
  })
  const [codigoInventario, setCodigoInventario] = useState('')
  const [equipoEncontrado, setEquipoEncontrado] = useState(null)
  const [buscandoEquipo, setBuscandoEquipo] = useState(false)
  const [cedulaTecnico, setCedulaTecnico] = useState('')
  const [tecnicoEncontrado, setTecnicoEncontrado] = useState(null)
  const [buscandoTecnico, setBuscandoTecnico] = useState(false)
  const [tiposMantenimiento, setTiposMantenimiento] = useState([])
  const [cargandoOpciones, setCargandoOpciones] = useState(true)
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
    // Verificar permisos: solo Administrador y Cuentadante pueden acceder
    if (user && user.nombre_rol !== 'Administrador' && user.nombre_rol !== 'Cuentadante') {
      navigate('/dashboard')
      return
    }
    
    // Verificar si hay un parámetro de URL para la pestaña
    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get('tab')
    const currentPath = window.location.pathname
    
    if (currentPath === '/mantenimientos/crear' || tabParam === 'crear') {
      setActiveTab('crear')
      // Redirigir a /mantenimientos?tab=crear si estamos en /mantenimientos/crear
      if (currentPath === '/mantenimientos/crear') {
        navigate('/mantenimientos?tab=crear', { replace: true })
      }
    } else {
      setActiveTab('historial')
    }
  }, [user, navigate, location])

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchMantenimientos()
      cargarEstadosMantenimiento()
    } else if (activeTab === 'crear') {
      cargarOpcionesMantenimiento()
    }
  }, [activeTab])
  
  // Cargar tipos y estados de mantenimiento desde la API
  async function cargarOpcionesMantenimiento() {
    try {
      setCargandoOpciones(true)
      const token = localStorage.getItem('token')
      
      // Cargar tipos de mantenimiento
      const resTipos = await fetch('/api/mantenimiento/tipos', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (resTipos.ok) {
        const tipos = await parseApiResponse(resTipos)
        if (Array.isArray(tipos) && tipos.length > 0) {
          setTiposMantenimiento(tipos)
          setForm(prev => ({
            ...prev,
            tipo_mantenimiento: prev.tipo_mantenimiento || tipos[0]
          }))
        }
      }

      // Cargar estados de mantenimiento
      const resEstados = await fetch('/api/mantenimiento/estados', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (resEstados.ok) {
        const estados = await parseApiResponse(resEstados)
        if (Array.isArray(estados) && estados.length > 0) {
          setEstadosMantenimiento(estados)
          setForm(prev => ({
            ...prev,
            estado_mantenimiento: prev.estado_mantenimiento || estados[0]
          }))
        }
      }
    } catch (err) {
      console.error('Error al cargar opciones de mantenimiento:', err)
      setToast({ 
        message: 'Error al cargar las opciones de mantenimiento. Por favor, recarga la página.', 
        type: 'error' 
      })
    } finally {
      setCargandoOpciones(false)
    }
  }

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
    // Parsear la fecha sin ajuste de zona horaria
    // Formato esperado: YYYY-MM-DD HH:mm:ss o YYYY-MM-DDTHH:mm:ss
    let date
    if (dateString.includes('T')) {
      // Formato ISO: YYYY-MM-DDTHH:mm:ss
      const [datePart, timePart] = dateString.split('T')
      const [year, month, day] = datePart.split('-')
      const [hours, minutes] = timePart.split(':')
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes || 0))
    } else if (dateString.includes(' ')) {
      // Formato MySQL: YYYY-MM-DD HH:mm:ss
      const [datePart, timePart] = dateString.split(' ')
      const [year, month, day] = datePart.split('-')
      const [hours, minutes] = timePart.split(':')
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes || 0))
    } else {
      date = new Date(dateString)
    }
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
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

  // Funciones para crear mantenimiento
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

  async function buscarTecnico() {
    if (!cedulaTecnico.trim()) {
      setToast({ message: 'Ingresa una Documento', type: 'error' })
      return
    }

    try {
      setBuscandoTecnico(true)
      setTecnicoEncontrado(null)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/auth/user/cedula/${encodeURIComponent(cedulaTecnico.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await parseApiResponse(res)
        setTecnicoEncontrado(data)
        setForm(prev => ({ ...prev, id_usuario_tecnico: data.id_usuario }))
        setToast({ message: 'Técnico encontrado correctamente', type: 'success' })
      } else {
        const errorData = await res.json().catch(() => ({}))
        setToast({ 
          message: errorData.error || 'Técnico no encontrado', 
          type: 'error' 
        })
        setTecnicoEncontrado(null)
        setForm(prev => ({ ...prev, id_usuario_tecnico: '' }))
      }
    } catch (err) {
      setToast({ 
        message: buildErrorMessage(err, 'Error al buscar el técnico'), 
        type: 'error' 
      })
      setTecnicoEncontrado(null)
      setForm(prev => ({ ...prev, id_usuario_tecnico: '' }))
    } finally {
      setBuscandoTecnico(false)
    }
  }

  function limpiarEquipo() {
    setCodigoInventario('')
    setEquipoEncontrado(null)
    setForm(prev => ({ ...prev, codigo_equipo: '' }))
  }

  function limpiarTecnico() {
    setCedulaTecnico('')
    setTecnicoEncontrado(null)
    setForm(prev => ({ ...prev, id_usuario_tecnico: '' }))
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmitCrear(e) {
    e.preventDefault()
    
    if (!form.codigo_equipo || !form.tipo_mantenimiento || !form.fecha_mantenimiento) {
      setToast({ message: 'Equipo, tipo de mantenimiento y fecha son obligatorios', type: 'error' })
      return
    }

    try {
      setLoadingCrear(true)
      const token = localStorage.getItem('token')
      
      const payload = {
        ...form,
        id_usuario_tecnico: form.id_usuario_tecnico || null,
        fecha_proximo: form.fecha_proximo || null,
        descripcion_trabajo: form.descripcion_trabajo.trim() || null,
        observaciones: form.observaciones.trim() || null,
      }

      const res = await fetch('/api/mantenimiento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok) {
        setToast({ 
          message: data.message || 'Mantenimiento registrado correctamente', 
          type: 'success' 
        })
        setForm({
          codigo_equipo: '',
          tipo_mantenimiento: tiposMantenimiento[0] || '',
          fecha_mantenimiento: '',
          fecha_proximo: '',
          descripcion_trabajo: '',
          id_usuario_tecnico: '',
          observaciones: '',
          estado_mantenimiento: estadosMantenimiento[0] || '',
        })
        limpiarEquipo()
        limpiarTecnico()
        setActiveTab('historial')
        fetchMantenimientos()
      } else {
        setToast({ 
          message: data.error || 'Error al registrar el mantenimiento', 
          type: 'error' 
        })
      }
    } catch (err) {
      setToast({ message: 'Error de conexión con el servidor', type: 'error' })
    } finally {
      setLoadingCrear(false)
    }
  }

  const getCurrentDateTime = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
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
                {activeTab === 'historial' 
                  ? 'Historial de mantenimientos realizados en los equipos'
                  : 'Registra mantenimientos preventivos, correctivos o actualizaciones realizadas en equipos'}
              </p>
            </div>
          </div>

          {/* Pestañas */}
          <div className="mantenimientos-tabs">
            <button
              onClick={() => {
                setActiveTab('historial')
                fetchMantenimientos()
              }}
              className={`mantenimientos-tab ${activeTab === 'historial' ? 'active' : ''}`}
            >
              <FiList size={18} />
              Ver Historial
            </button>
            {(isAdmin || user?.nombre_rol === 'Cuentadante') && (
              <button
                onClick={() => {
                  setActiveTab('crear')
                  if (tiposMantenimiento.length === 0) {
                    cargarOpcionesMantenimiento()
                  }
                }}
                className={`mantenimientos-tab ${activeTab === 'crear' ? 'active' : ''}`}
              >
                <FiTool size={18} />
                Registrar Mantenimiento
              </button>
            )}
          </div>

          <div className="form-divider form-divider-no-margin"></div>

          {activeTab === 'historial' ? (
            <>
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
                          <strong>{mant.equipo_tipo} {mant.equipo_modelo}</strong>
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
                            className="btn btn-view btn-sm"
                            onClick={() => setSelectedMantenimiento(mant)}
                          >
                            <FiEye size={16} />
                            Ver
                          </button>
                          {(isAdmin || isInstructor) && (
                            <button
                              className="btn btn-edit btn-sm"
                              onClick={() => {
                                setSelectedMantenimiento(mant)
                                abrirEditarEstado(mant)
                              }}
                              disabled={loading}
                            >
                              <FiEdit size={16} />
                              Estado
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              className="btn btn-delete btn-sm"
                              onClick={() => confirmDelete(mant.id_mantenimiento)}
                              disabled={loading}
                            >
                              <FiTrash2 size={16} />
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
            </>
          ) : (
            <>
              {cargandoOpciones ? (
                <div className="loading-state">
                  <p>Cargando opciones de mantenimiento...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitCrear}>
                  {/* Sección: Equipo */}
                  <div className="form-section">
                    <h3 className="form-section-title">
                      <FiPackage size={18} className="crear-mantenimiento-section-icon" />
                      Equipo a Mantener
                    </h3>
                    
                    <div className="form-group">
                      <label>
                        Código de Inventario *
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
                          placeholder="Ingresa el código de inventario del equipo"
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
                    </div>

                    {equipoEncontrado && (
                      <div className="equipo-found-card">
                        <div className="equipo-found-header">
                          <FiCheck size={20} color="#43a047" />
                          <span>Equipo encontrado</span>
                        </div>
                        <div className="equipo-found-info">
                          <div><strong>Código:</strong> {equipoEncontrado.codigo_inventario}</div>
                          <div><strong>Equipo:</strong> {equipoEncontrado.tipo} {equipoEncontrado.modelo}</div>
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
                          Cambiar equipo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sección: Información del Mantenimiento */}
                  <div className="form-section">
                    <h3 className="form-section-title">
                      <FiType size={18} className="crear-mantenimiento-section-icon" />
                      Información del Mantenimiento
                    </h3>

                    <div className="form-grid">
                      <div className="form-group">
                        <label>
                          <FiTool size={16} className="crear-mantenimiento-option-icon" />
                          Tipo de Mantenimiento *
                        </label>
                        <CustomSelect
                          name="tipo_mantenimiento"
                          value={form.tipo_mantenimiento}
                          onChange={(e) => handleChange('tipo_mantenimiento', e.target.value)}
                          options={tiposMantenimiento}
                          placeholder="Seleccionar tipo de mantenimiento"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>
                          <FiCalendar size={16} className="crear-mantenimiento-option-icon" />
                          Estado *
                        </label>
                        <CustomSelect
                          name="estado_mantenimiento"
                          value={form.estado_mantenimiento}
                          onChange={(e) => handleChange('estado_mantenimiento', e.target.value)}
                          options={estadosMantenimiento}
                          placeholder="Seleccionar estado"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label>
                          <FiCalendar size={16} className="crear-mantenimiento-option-icon" />
                          Fecha de Mantenimiento *
                        </label>
                        <input
                          type="datetime-local"
                          value={form.fecha_mantenimiento}
                          onChange={(e) => handleChange('fecha_mantenimiento', e.target.value)}
                          min={getCurrentDateTime()}
                          required
                        />
                        <p className="crear-mantenimiento-help-text">
                          Selecciona una fecha futura para programar el mantenimiento
                        </p>
                      </div>

                      <div className="form-group">
                        <label>
                          <FiCalendar size={16} className="crear-mantenimiento-option-icon" />
                          Próximo Mantenimiento (Opcional)
                        </label>
                        <input
                          type="date"
                          value={form.fecha_proximo}
                          onChange={(e) => handleChange('fecha_proximo', e.target.value)}
                          min={form.fecha_mantenimiento ? form.fecha_mantenimiento.split('T')[0] : ''}
                        />
                        <p className="crear-mantenimiento-help-text">
                          Establece la fecha del próximo mantenimiento para que aparezca en las estadísticas del Dashboard
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sección: Técnico (Opcional) */}
                  <div className="form-section">
                    <h3 className="form-section-title">
                      <FiUser size={18} className="crear-mantenimiento-section-icon" />
                      Técnico Responsable (Opcional)
                    </h3>
                    
                    <div className="form-group">
                      <label>
                        Documento del Técnico
                      </label>
                      <div className="search-equipo-wrapper">
                        <input
                          type="text"
                          value={cedulaTecnico}
                          onChange={(e) => setCedulaTecnico(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              buscarTecnico()
                            }
                          }}
                          placeholder="Ingresa el Documento del técnico"
                          className="search-equipo-input"
                        />
                        <button
                          type="button"
                          onClick={buscarTecnico}
                          disabled={buscandoTecnico || !cedulaTecnico.trim()}
                          className="btn-search-equipo"
                        >
                          {buscandoTecnico ? (
                            'Buscando...'
                          ) : (
                            <>
                              <FiSearch size={16} />
                              Buscar
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {tecnicoEncontrado && (
                      <div className="equipo-found-card">
                        <div className="equipo-found-header">
                          <FiCheck size={20} color="#43a047" />
                          <span>Técnico encontrado</span>
                        </div>
                        <div className="equipo-found-info">
                          <div><strong>Nombre:</strong> {tecnicoEncontrado.nombre_usuario}</div>
                          <div><strong>Documento:</strong> {tecnicoEncontrado.cedula}</div>
                          <div><strong>Rol:</strong> {tecnicoEncontrado.nombre_rol}</div>
                        </div>
                        <button
                          type="button"
                          onClick={limpiarTecnico}
                          className="btn-clear-equipo"
                        >
                          <FiX size={14} />
                          Cambiar técnico
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sección: Detalles */}
                  <div className="form-section">
                    <h3 className="form-section-title">
                      <FiFileText size={18} className="crear-mantenimiento-section-icon" />
                      Detalles
                    </h3>

                    <div className="form-group">
                      <label>
                        Descripción del Trabajo Realizado
                      </label>
                      <textarea
                        value={form.descripcion_trabajo}
                        onChange={(e) => handleChange('descripcion_trabajo', e.target.value)}
                        placeholder="Describe detalladamente el trabajo realizado..."
                        rows={6}
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        Observaciones (Opcional)
                      </label>
                      <textarea
                        value={form.observaciones}
                        onChange={(e) => handleChange('observaciones', e.target.value)}
                        placeholder="Observaciones adicionales..."
                        rows={4}
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button 
                      type="submit" 
                      className="btn-primary btn-modern"
                      disabled={loadingCrear}
                    >
                      {loadingCrear ? 'Registrando...' : 'Registrar Mantenimiento'}
                    </button>
                    <button 
                      type="button" 
                      className="btn-secondary btn-modern"
                      onClick={() => setActiveTab('historial')}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
          </div>

      {selectedMantenimiento && (
        <div className="mantenimientos-modal-overlay modal-overlay"
          onClick={() => setSelectedMantenimiento(null)}
        >
          <div className="mantenimientos-modal-content modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mantenimientos-modal-header">
              <h3 className="mantenimientos-modal-title">
                <FiTool size={24} />
                Detalle de Mantenimiento
              </h3>
              <button
                onClick={() => setSelectedMantenimiento(null)}
                className="mantenimientos-modal-close modal-close"
              >
                ×
              </button>
            </div>

            <div className="mantenimientos-modal-body">
              <div className="mantenimientos-modal-grid">
              <div className="mantenimientos-modal-field">
                <strong className="mantenimientos-modal-field-label">ID:</strong> {selectedMantenimiento.id_mantenimiento}
              </div>
              <div className="mantenimientos-modal-field">
                <strong className="mantenimientos-modal-field-label">Equipo:</strong> {selectedMantenimiento.equipo_tipo} {selectedMantenimiento.equipo_modelo}
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
                          // Convertir la fecha a formato datetime-local sin ajuste de zona horaria
                          const fechaStr = selectedMantenimiento.fecha_mantenimiento
                          let fechaFormateada = ''
                          
                          if (fechaStr.includes('T')) {
                            // Formato ISO: YYYY-MM-DDTHH:mm:ss
                            fechaFormateada = fechaStr.slice(0, 16)
                          } else if (fechaStr.includes(' ')) {
                            // Formato MySQL: YYYY-MM-DD HH:mm:ss
                            const [date, time] = fechaStr.split(' ')
                            const timeShort = time.slice(0, 5) // HH:mm
                            fechaFormateada = `${date}T${timeShort}`
                          } else {
                            // Fallback
                            fechaFormateada = fechaStr
                          }
                          
                          setNuevaFechaMantenimiento(fechaFormateada)
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
                          // Convertir fecha_proximo_mantenimiento a formato date (YYYY-MM-DD)
                          const fechaProximo = selectedMantenimiento.fecha_proximo_mantenimiento
                          if (fechaProximo) {
                            if (fechaProximo.includes('T')) {
                              setNuevaFechaProximo(fechaProximo.slice(0, 10))
                            } else if (fechaProximo.includes(' ')) {
                              setNuevaFechaProximo(fechaProximo.split(' ')[0])
                            } else {
                              setNuevaFechaProximo(fechaProximo)
                            }
                          } else {
                            setNuevaFechaProximo('')
                          }
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
              </div>
            </div>

            {isAdmin && (
              <div className="mantenimientos-modal-footer">
                <button
                  onClick={() => confirmDelete(selectedMantenimiento.id_mantenimiento)}
                  className="btn danger mantenimientos-modal-footer-button"
                >
                  <FiTrash2 size={16} className="mantenimientos-action-icon" />
                  Eliminar Mantenimiento
                </button>
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

