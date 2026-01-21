import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import InfoModal from '../components/InfoModal'
import CustomSelect from '../components/CustomSelect'
import AutocompleteInput from '../components/AutocompleteInput'
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
  FiSquare,
  FiInfo,
  FiFile
} from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import { useSocket } from '../contexts/SocketContext'
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
    fecha_inicio: '', // Fecha inicio para rango (clases recurrentes)
    fecha_fin: '', // Fecha fin para rango (clases recurrentes)
    hora_inicio: '',
    hora_fin: '',
    dias_semana: [], // Días de la semana para clases recurrentes (solo dentro del rango)
    observaciones: ''
  })
  const [infoModal, setInfoModal] = useState({ open: false, message: '', title: '', type: 'info' })
  const [iniciandoClase, setIniciandoClase] = useState(null) // ID de clase que se está iniciando
  const [claseParaIniciar, setClaseParaIniciar] = useState(null) // Datos de la clase a iniciar
  const [importResult, setImportResult] = useState(null) // Resultado de la importación
  const [importing, setImporting] = useState(false) // Estado de carga de importación
  
  const diasSemanaOpciones = [
    { nombre: 'Lunes', valor: 'Lunes' },
    { nombre: 'Martes', valor: 'Martes' },
    { nombre: 'Miércoles', valor: 'Miércoles' },
    { nombre: 'Jueves', valor: 'Jueves' },
    { nombre: 'Viernes', valor: 'Viernes' },
    { nombre: 'Sábado', valor: 'Sábado' },
    { nombre: 'Domingo', valor: 'Domingo' }
  ]
  const [filtros, setFiltros] = useState({
    id_ambiente: '',
    id_instructor: '',
    fecha: '',
    estado_clase: ''
  })
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null })
  const [confirmIniciar, setConfirmIniciar] = useState({ open: false, id: null })
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [nombresClases, setNombresClases] = useState([])
  const [loadingNombres, setLoadingNombres] = useState(false)
  
  const { subscribe } = useSocket()

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
      fetchNombresClases()
      // Solo cargar instructores si es administrador
      if (user.nombre_rol === 'Administrador') {
        fetchInstructores()
      }
      // SISTEMA 100% MANUAL: No hay sincronización automática
      // Los estados se cambian únicamente mediante acciones manuales del usuario
      // (botones Iniciar/Finalizar Clase)
      // La función sincronizarResponsabilidades() solo se puede llamar manualmente si es necesario
      // sincronizarResponsabilidades() // ELIMINADO: No sincronizar automáticamente
    }
  }, [user, filtros])

  // Suscribirse a actualizaciones en tiempo real de clases
  useEffect(() => {
    if (!subscribe) return;
    
    const unsubscribe = subscribe('clase:updated', (data) => {
      // Recargar clases cuando haya un cambio
      fetchClases();
    });
    
    return unsubscribe;
  }, [subscribe, fetchClases])

  // SISTEMA 100% MANUAL: Sincronización automática ELIMINADA
  // Los estados de clases son completamente manuales
  // No hay intervalos, schedulers ni polling
  // Los estados solo cambian cuando el usuario presiona los botones Iniciar/Finalizar

  async function sincronizarResponsabilidades() {
    // SISTEMA 100% MANUAL: Esta función solo se puede llamar manualmente si es necesario
    // No se ejecuta automáticamente
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/clases/sincronizar-responsabilidades', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      // Actualizar la lista de clases después de sincronizar
      fetchClases()
    } catch (err) {
      // Silenciar errores de sincronización
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
      // El backend ahora retorna { clases: [...], paginacion: {...} }
      // Mantener compatibilidad con respuesta antigua (array directo)
      const clasesList = Array.isArray(data) ? data : (data?.clases || [])
      setClases(clasesList)
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
      const res = await fetch('/api/auth/users?rol=Instructor', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res)
      setInstructores(data || [])
    } catch (err) {
      console.error('Error al obtener instructores:', err)
      setInstructores([])
    }
  }

  async function fetchNombresClases() {
    try {
      setLoadingNombres(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/clases/nombres', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // Manejar errores de permisos
      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}))
        setNombresClases([])
        return
      }
      
      const data = await parseApiResponse(res)
      // El backend devuelve { ok: true, nombres: [...], total: number }
      setNombresClases(data.nombres || [])
    } catch (err) {
      console.error('Error al obtener nombres de clases:', err)
      // No mostrar error al usuario si es solo para autocompletado
      setNombresClases([])
    } finally {
      setLoadingNombres(false)
    }
  }

  async function handleNuevoNombreClase(nombre) {
    if (!nombre || !nombre.trim()) return
    
    // Validar longitud mínima
    if (nombre.trim().length < 3) {
      setToast({ message: 'El nombre de la clase debe tener al menos 3 caracteres', type: 'error' })
      return
    }
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/clases/nombres', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nombre_clase: nombre.trim() })
      })

      // Manejar código 403 (no autorizado)
      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detalle || errorData.error || 'No tienes permiso para crear nombres de clases')
      }

      // Manejar código 400 (validación)
      if (res.status === 400) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detalle || errorData.error || 'El nombre de clase no es válido')
      }

      // Manejar código 409 (conflicto - duplicado)
      if (res.status === 409) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detalle || errorData.error || 'El nombre de clase ya existe')
      }

      const data = await parseApiResponse(res, 'Error al crear nombre de clase')
      // Actualizar la lista de nombres
      await fetchNombresClases()
      setToast({ 
        message: data.message || 'Nombre de clase agregado correctamente', 
        type: 'success' 
      })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al agregar nombre de clase'), type: 'error' })
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
    // Validar que si hay días seleccionados, debe haber rango de fechas
    if (form.dias_semana.length > 0) {
      if (!form.fecha_inicio || !form.fecha_fin) {
        setToast({ 
          message: 'Si seleccionas días de la semana, debes especificar fecha de inicio y fin', 
          type: 'error' 
        })
        return
      }
      if (new Date(form.fecha_inicio) > new Date(form.fecha_fin)) {
        setToast({ 
          message: 'La fecha de inicio debe ser anterior a la fecha de fin', 
          type: 'error' 
        })
        return
      }
      if (cantidadClases === 0) {
        setToast({ 
          message: 'No hay fechas válidas en el rango seleccionado para los días elegidos', 
          type: 'error' 
        })
        return
      }
    }

    // Validar que si hay rango de fechas, debe haber días seleccionados o fecha_clase
    if (form.fecha_inicio && form.fecha_fin && form.dias_semana.length === 0 && !form.fecha_clase) {
      setToast({ 
        message: 'Si especificas un rango de fechas, debes seleccionar días de la semana o una fecha específica', 
        type: 'error' 
      })
      return
    }

    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      // Si es instructor, no enviar id_instructor (el backend lo asigna automáticamente)
      const bodyData = { ...form }
      if (user?.nombre_rol === 'Instructor') {
        delete bodyData.id_instructor
      }
      
      // Limpiar campos no necesarios según el tipo de clase
      if (form.dias_semana.length > 0 && form.fecha_inicio && form.fecha_fin) {
        // Clase recurrente: usar fecha_inicio, fecha_fin, dias_semana
        delete bodyData.fecha_clase
      } else if (form.fecha_clase) {
        // Clase única: usar fecha_clase, limpiar campos de rango
        delete bodyData.fecha_inicio
        delete bodyData.fecha_fin
        delete bodyData.dias_semana
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
      
      // Asegurar formato correcto para fecha_inicio y fecha_fin
      if (bodyData.fecha_inicio && typeof bodyData.fecha_inicio === 'string') {
        bodyData.fecha_inicio = bodyData.fecha_inicio.split('T')[0].split(' ')[0]
      }
      if (bodyData.fecha_fin && typeof bodyData.fecha_fin === 'string') {
        bodyData.fecha_fin = bodyData.fecha_fin.split('T')[0].split(' ')[0]
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
    // Buscar la clase en el estado para mostrar información
    const clase = clases.find(c => c.id_clase === idClase)
    if (!clase) {
      setToast({ message: 'No se encontró la información de la clase', type: 'error' })
      return
    }

    // Guardar datos de la clase para mostrar después
    setClaseParaIniciar({
      id: idClase,
      nombre: clase.nombre_clase || 'Sin nombre',
      ambiente: clase.nombre_ambiente || 'Sin ambiente',
      codigo_ambiente: clase.codigo_ambiente || '',
      instructor: clase.instructor_nombre || 'Sin instructor',
      fecha: formatDate(clase.fecha_clase),
      horario: `${clase.hora_inicio} - ${clase.hora_fin}`
    })
    
    // Mostrar modal de confirmación
    setConfirmIniciar({ open: true, id: idClase })
  }

  async function confirmarIniciarClase() {
    if (!claseParaIniciar) return

    setIniciandoClase(claseParaIniciar.id)
    setLoading(true)
    setToast(null)
    setInfoModal({ open: false, message: '', title: '', type: 'info' })
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/clases/${claseParaIniciar.id}/iniciar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      })
      const data = await parseApiResponse(res, 'No se pudo iniciar la clase')
      
      // Mostrar modal de éxito
      setInfoModal({
        open: true,
        title: 'Clase Iniciada',
        type: 'success',
        message: `La clase "${claseParaIniciar.nombre}" ha sido iniciada correctamente.\n\n` +
                 `El instructor ${claseParaIniciar.instructor} ahora tiene acceso al inventario del ambiente ${claseParaIniciar.ambiente}.`
      })
      
      setToast({ message: data.message || 'Clase iniciada correctamente', type: 'success' })
      fetchClases()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo iniciar la clase'), type: 'error' })
    } finally {
      setLoading(false)
      setIniciandoClase(null)
      setClaseParaIniciar(null)
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

  function handleToggleDia(dia) {
    // Validar que haya rango de fechas antes de permitir seleccionar días
    if (!form.fecha_inicio || !form.fecha_fin) {
      setToast({ 
        message: 'Debes seleccionar fecha de inicio y fin antes de seleccionar días de la semana', 
        type: 'error' 
      })
      return
    }

    // Validar que fecha_inicio sea anterior a fecha_fin
    if (new Date(form.fecha_inicio) > new Date(form.fecha_fin)) {
      setToast({ 
        message: 'La fecha de inicio debe ser anterior a la fecha de fin', 
        type: 'error' 
      })
      return
    }

    setForm(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia]
    }))
  }

  // Calcular si hay rango de fechas válido
  const tieneRangoFechas = form.fecha_inicio && form.fecha_fin && 
                           new Date(form.fecha_inicio) <= new Date(form.fecha_fin)
  
  // Calcular cantidad de clases que se crearían con los días seleccionados
  const calcularCantidadClases = () => {
    if (!tieneRangoFechas || form.dias_semana.length === 0) return 0
    
    const inicio = new Date(form.fecha_inicio)
    const fin = new Date(form.fecha_fin)
    const diasSeleccionados = form.dias_semana.map(dia => {
      const diasMap = { 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6, 'Domingo': 0 }
      return diasMap[dia] !== undefined ? diasMap[dia] : -1
    }).filter(d => d !== -1)
    
    let contador = 0
    const fechaActual = new Date(inicio)
    
    while (fechaActual <= fin) {
      const diaSemana = fechaActual.getDay()
      if (diasSeleccionados.includes(diaSemana)) {
        contador++
      }
      fechaActual.setDate(fechaActual.getDate() + 1)
    }
    
    return contador
  }

  const cantidadClases = calcularCantidadClases()

  function resetForm() {
    setForm({
      id_ambiente: '',
      id_instructor: '',
      nombre_clase: '',
      codigo_ficha: '',
      descripcion: '',
      fecha_clase: '',
      fecha_inicio: '',
      fecha_fin: '',
      hora_inicio: '',
      hora_fin: '',
      dias_semana: [],
      observaciones: ''
    })
    setEditingClase(null)
  }

  async function handleImport() {
    if (!importFile) {
      setToast({ message: 'Selecciona un archivo', type: 'error' })
      return
    }

    setImporting(true)
    setLoading(true)
    setToast(null)
    setImportResult(null)
    
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('archivo', importFile)

      const res = await fetch('/api/horarios/importar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })

      // Manejar códigos HTTP: 200, 207, 400
      let data
      if (res.status === 207) {
        // Multi-Status: algunos exitosos, algunos fallidos
        data = await res.json().catch(() => ({}))
      } else if (res.ok) {
        data = await parseApiResponse(res, 'No se pudo importar el archivo')
      } else {
        throw await parseApiResponse(res, 'No se pudo importar el archivo').catch(() => {
          throw new Error('Error al procesar la respuesta del servidor')
        })
      }

      setImportResult(data)
      
      // Mostrar modal de éxito o advertencia según el resultado
      const exitosos = data.resultados?.exitosos?.length || data.exitosos || 0
      const errores = data.resultados?.errores?.length || data.errores || 0
      const warnings = data.resultados?.warnings?.length || data.warnings || 0

      if (exitosos > 0 && errores === 0 && warnings === 0) {
        setInfoModal({
          open: true,
          title: 'Importación Exitosa',
          type: 'success',
          message: `Se importaron correctamente ${exitosos} horario(s).`
        })
      } else if (exitosos > 0) {
        setInfoModal({
          open: true,
          title: 'Importación Parcial',
          type: 'warning',
          message: `Se importaron ${exitosos} horario(s) exitosamente.\n\n` +
                   `${errores > 0 ? `Errores: ${errores}\n` : ''}` +
                   `${warnings > 0 ? `Advertencias: ${warnings}` : ''}`
        })
      } else {
        setToast({ 
          message: data.message || 'No se pudieron importar los horarios', 
          type: 'error' 
        })
      }

      setShowImport(false)
      setImportFile(null)
      fetchClases()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo importar el archivo'), type: 'error' })
      setImportResult({ error: true, message: buildErrorMessage(err) })
    } finally {
      setLoading(false)
      setImporting(false)
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

        {confirmIniciar.open && claseParaIniciar && (
          <ConfirmModal
            open={confirmIniciar.open}
            title="Confirmar Inicio de Clase"
            message={`¿Estás seguro de iniciar esta clase?\n\n` +
                     `📚 Clase: ${claseParaIniciar.nombre}\n` +
                     `🏢 Ambiente: ${claseParaIniciar.ambiente} (${claseParaIniciar.codigo_ambiente})\n` +
                     `👤 Instructor: ${claseParaIniciar.instructor}\n` +
                     `📅 Fecha: ${claseParaIniciar.fecha}\n` +
                     `🕐 Horario: ${claseParaIniciar.horario}\n\n` +
                     `Al iniciar, el instructor recibirá el inventario del ambiente.`}
            confirmText="Iniciar Clase"
            cancelText="Cancelar"
            type="info"
            onConfirm={confirmarIniciarClase}
            onCancel={() => {
              setConfirmIniciar({ open: false, id: null })
              setClaseParaIniciar(null)
            }}
          />
        )}

        <InfoModal
          open={infoModal.open}
          message={infoModal.message}
          title={infoModal.title}
          type={infoModal.type}
          onClose={() => setInfoModal({ open: false, message: '', title: '', type: 'info' })}
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
              <CustomSelect
                name="id_ambiente"
                className="horarios-filter-select"
                value={filtros.id_ambiente}
                onChange={e => setFiltros({ ...filtros, id_ambiente: e.target.value })}
                options={[
                  { value: '', label: 'Todos' },
                  ...ambientes.map(amb => ({
                    value: amb.id_ambiente.toString(),
                    label: `${amb.codigo_ambiente} - ${amb.nombre_ambiente}`
                  }))
                ]}
                placeholder="Todos los ambientes"
              />
            </div>
            {user?.nombre_rol === 'Administrador' && (
              <div className="horarios-filter-item">
                <label className="horarios-filter-label">Instructor</label>
                <CustomSelect
                  name="id_instructor"
                  className="horarios-filter-select"
                  value={filtros.id_instructor}
                  onChange={e => setFiltros({ ...filtros, id_instructor: e.target.value })}
                  options={[
                    { value: '', label: 'Todos' },
                    ...instructores.map(inst => ({
                      value: inst.id_usuario.toString(),
                      label: inst.nombre_usuario
                    }))
                  ]}
                  placeholder="Todos los instructores"
                />
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
              <CustomSelect
                name="estado_clase"
                className="horarios-filter-select"
                value={filtros.estado_clase}
                onChange={e => setFiltros({ ...filtros, estado_clase: e.target.value })}
                options={['', 'Programada', 'En Curso', 'Finalizada', 'Cancelada']}
                placeholder="Todos los estados"
              />
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
                    <CustomSelect
                      name="id_ambiente"
                      className="horarios-form-select form-select"
                      value={form.id_ambiente}
                      onChange={e => setForm({ ...form, id_ambiente: e.target.value })}
                      options={[
                        { value: '', label: 'Seleccione...' },
                        ...ambientes.map(amb => ({
                          value: amb.id_ambiente.toString(),
                          label: `${amb.codigo_ambiente} - ${amb.nombre_ambiente}`
                        }))
                      ]}
                      placeholder="Seleccionar ambiente"
                      required
                    />
                  </div>
                  {user?.nombre_rol === 'Administrador' && (
                    <div className="horarios-form-row">
                      <label className="horarios-form-label form-label-required">Instructor</label>
                      <CustomSelect
                        name="id_instructor"
                        className="horarios-form-select form-select"
                        value={form.id_instructor}
                        onChange={e => setForm({ ...form, id_instructor: e.target.value })}
                        options={[
                          { value: '', label: 'Seleccione...' },
                          ...instructores.map(inst => ({
                            value: inst.id_usuario.toString(),
                            label: `${inst.nombre_usuario} (${inst.cedula})`
                          }))
                        ]}
                        placeholder="Seleccionar instructor"
                        required
                      />
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
                    <AutocompleteInput
                      value={form.nombre_clase}
                      onChange={(value) => setForm({ ...form, nombre_clase: value })}
                      suggestions={nombresClases}
                      placeholder="Ej: Programación Web"
                      className="horarios-form-input form-input"
                      allowNew={true}
                      onNewValue={handleNuevoNombreClase}
                      minLength={2}
                      maxSuggestions={8}
                    />
                  </div>
                  {/* Opción 1: Clase única (fecha específica) */}
                  <div className="horarios-form-row">
                    <label className="horarios-form-label">
                      Fecha de Clase (Clase Única)
                      <span className="horarios-form-help-text">
                      </span>
                    </label>
                    <input
                      type="date"
                      className="horarios-form-input form-input"
                      value={form.fecha_clase}
                      onChange={e => {
                        // Si se selecciona fecha_clase, limpiar rango y días
                        setForm({ 
                          ...form, 
                          fecha_clase: e.target.value,
                          fecha_inicio: '',
                          fecha_fin: '',
                          dias_semana: []
                        })
                      }}
                      disabled={form.fecha_inicio && form.fecha_fin}
                    />
                  </div>
                  
                  {/* Opción 2: Clase recurrente (rango de fechas + días) */}
                  <div className="horarios-form-row">
                    <label className="horarios-form-label">
                      Rango de Fechas (Clase Recurrente)
                      <span className="horarios-form-help-text">
                      </span>
                    </label>
                    <div className="horarios-rango-fechas">
                      <input
                        type="date"
                        className="horarios-form-input form-input horarios-fecha-inicio"
                        value={form.fecha_inicio}
                        onChange={e => {
                          const nuevaFechaInicio = e.target.value
                          setForm({ 
                            ...form, 
                            fecha_inicio: nuevaFechaInicio,
                            // Si hay fecha_clase, limpiarla
                            fecha_clase: nuevaFechaInicio ? '' : form.fecha_clase,
                            // Si la nueva fecha inicio es mayor que fin, limpiar días
                            dias_semana: (nuevaFechaInicio && form.fecha_fin && new Date(nuevaFechaInicio) > new Date(form.fecha_fin)) 
                              ? [] 
                              : form.dias_semana
                          })
                        }}
                        placeholder="Fecha inicio"
                        disabled={!!form.fecha_clase}
                      />
                      <span className="horarios-rango-separador">hasta</span>
                      <input
                        type="date"
                        className="horarios-form-input form-input horarios-fecha-fin"
                        value={form.fecha_fin}
                        onChange={e => {
                          const nuevaFechaFin = e.target.value
                          setForm({ 
                            ...form, 
                            fecha_fin: nuevaFechaFin,
                            // Si hay fecha_clase, limpiarla
                            fecha_clase: nuevaFechaFin ? '' : form.fecha_clase,
                            // Si la fecha fin es menor que inicio, limpiar días
                            dias_semana: (form.fecha_inicio && nuevaFechaFin && new Date(form.fecha_inicio) > new Date(nuevaFechaFin)) 
                              ? [] 
                              : form.dias_semana
                          })
                        }}
                        placeholder="Fecha fin"
                        disabled={!!form.fecha_clase}
                        min={form.fecha_inicio || undefined}
                      />
                    </div>
                  </div>
                  {/* Campos de hora agrupados */}
                  <div className="horarios-form-row">
                    <div className="horarios-horas-container">
                      <div className="horarios-hora-item">
                        <label className="horarios-form-label form-label-required">Hora Inicio</label>
                        <input
                          type="time"
                          className="horarios-form-input form-input"
                          value={form.hora_inicio}
                          onChange={e => setForm({ ...form, hora_inicio: e.target.value })}
                          required
                        />
                      </div>
                      <div className="horarios-hora-item">
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
                  </div>
                </div>
                {/* Días de la semana (solo para clases recurrentes) */}
                <div className="horarios-form-row horarios-dias-row">
                  <label className="horarios-form-label">
                    Días de la Semana
                    <span className="horarios-form-help-text">
                      {tieneRangoFechas 
                        ? `Se aplicarán únicamente dentro del rango de fechas seleccionado. Se crearán ${cantidadClases} clase(s).`
                        : 'Selecciona primero un rango de fechas (inicio y fin) para habilitar los días'}
                  </span>
                  </label>
                  <div className="horarios-dias-container">
                    {diasSemanaOpciones.map(dia => (
                      <label 
                        key={dia.valor} 
                        className={`horarios-dia-checkbox ${form.dias_semana.includes(dia.valor) ? 'selected' : ''} ${!tieneRangoFechas ? 'disabled' : ''}`}
                        title={!tieneRangoFechas ? 'Selecciona fecha de inicio y fin primero' : ''}
                      >
                        <input
                          type="checkbox"
                          checked={form.dias_semana.includes(dia.valor)}
                          onChange={() => handleToggleDia(dia.valor)}
                          disabled={!tieneRangoFechas}
                        />
                        <span>{dia.nombre}</span>
                      </label>
                    ))}
                  </div>
                  {form.dias_semana.length > 0 && tieneRangoFechas && (
                    <div className="horarios-dias-info">
                      <FiInfo size={16} />
                      <span>
                        Se crearán <strong>{cantidadClases} clase(s)</strong> en el rango del {formatDate(form.fecha_inicio)} al {formatDate(form.fecha_fin)} 
                        para los días seleccionados.
                      </span>
                    </div>
                  )}
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
            <div className="horarios-import-modal-overlay" onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}>
              <div className="horarios-import-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="horarios-import-header">
                  <h3 className="horarios-import-title">
                    <FiUpload size={20} />
                    Importar Horarios desde Excel
                  </h3>
                  <button
                    type="button"
                    className="horarios-import-close"
                    onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}
                  >
                    <FiX size={20} />
                  </button>
                </div>
                <div className="horarios-import-body">
                  <p className="horarios-import-text">
                    Selecciona un archivo Excel con el formato correcto. Puedes descargar la plantilla haciendo clic en el botón "Plantilla".
                  </p>
                  
                  <div className="horarios-import-file-section">
                    <label className="horarios-import-file-label">
                      <FiFile size={18} />
                      Seleccionar Archivo
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={e => {
                        setImportFile(e.target.files[0])
                        setImportResult(null)
                      }}
                      className="horarios-import-input"
                      disabled={importing}
                    />
                    {importFile && (
                      <div className="horarios-import-file-info">
                        <FiCheckCircle size={16} />
                        <span>{importFile.name}</span>
                        <span className="horarios-import-file-size">
                          ({(importFile.size / 1024).toFixed(2)} KB)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Resultado de importación */}
                  {importResult && !importResult.error && (
                    <div className="horarios-import-result">
                      <div className="horarios-import-result-header">
                        <FiCheckCircle size={20} />
                        <strong>Resultado de la Importación</strong>
                      </div>
                      <div className="horarios-import-result-stats">
                        <div className="horarios-import-result-stat success">
                          <span className="horarios-import-result-number">
                            {importResult.resultados?.exitosos?.length || importResult.exitosos || 0}
                          </span>
                          <span className="horarios-import-result-label">Exitosos</span>
                        </div>
                        {(importResult.resultados?.errores?.length || importResult.errores || 0) > 0 && (
                          <div className="horarios-import-result-stat error">
                            <span className="horarios-import-result-number">
                              {importResult.resultados?.errores?.length || importResult.errores || 0}
                            </span>
                            <span className="horarios-import-result-label">Errores</span>
                          </div>
                        )}
                        {(importResult.resultados?.warnings?.length || importResult.warnings || 0) > 0 && (
                          <div className="horarios-import-result-stat warning">
                            <span className="horarios-import-result-number">
                              {importResult.resultados?.warnings?.length || importResult.warnings || 0}
                            </span>
                            <span className="horarios-import-result-label">Advertencias</span>
                          </div>
                        )}
                      </div>
                      {importResult.resultados?.errores && importResult.resultados.errores.length > 0 && (
                        <div className="horarios-import-errors">
                          <strong>Errores encontrados:</strong>
                          <ul>
                            {importResult.resultados.errores.slice(0, 5).map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                            {importResult.resultados.errores.length > 5 && (
                              <li>... y {importResult.resultados.errores.length - 5} más</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {importResult?.error && (
                    <div className="horarios-import-error-box">
                      <FiAlertCircle size={18} />
                      <span>{importResult.message || 'Error al importar el archivo'}</span>
                    </div>
                  )}

                  <div className="horarios-import-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}
                      disabled={importing}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-verde"
                      onClick={handleImport}
                      disabled={importing || !importFile}
                    >
                      {importing ? (
                        <>
                          <div className="loading-spinner horarios-import-spinner"></div>
                          Importando...
                        </>
                      ) : (
                        <>
                          <FiUpload size={16} />
                          Importar
                        </>
                      )}
                    </button>
                  </div>
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
                                disabled={loading || iniciandoClase === clase.id_clase}
                                title="Iniciar Clase"
                              >
                                {iniciandoClase === clase.id_clase ? (
                                  <div className="loading-spinner horarios-action-spinner"></div>
                                ) : (
                                  <FiPlay size={14} />
                                )}
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

