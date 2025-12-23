import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import CustomSelect from '../components/CustomSelect'
import { FiAlertCircle, FiEye, FiCheckCircle, FiXCircle, FiEdit, FiPackage, FiFileText, FiSearch, FiCheck, FiX, FiList, FiType, FiTrash2, FiDownload } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import jsPDF from 'jspdf'
import '../styles/equipos.css'
import '../styles/novedades.css'
import '../styles/reportes.css'
import '../styles/reportesModal.css'

export default function Novedades() {
  const [activeTab, setActiveTab] = useState('ver') // 'ver', 'crear', o 'reportes'
  const [novedades, setNovedades] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedNovedad, setSelectedNovedad] = useState(null)
  const [editandoEstado, setEditandoEstado] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [observacionesResolucion, setObservacionesResolucion] = useState('')
  const [user, setUser] = useState(null)
  
  // Estados para crear novedad
  const [form, setForm] = useState({
    codigo_inventario: '',
    tipo_novedad: 'Mal Funcionamiento',
    descripcion: '',
  })
  const [codigoInventario, setCodigoInventario] = useState('')
  const [equipoEncontrado, setEquipoEncontrado] = useState(null)
  const [buscandoEquipo, setBuscandoEquipo] = useState(false)
  const [loadingCrear, setLoadingCrear] = useState(false)

  // Estados para reportes
  const [reportes, setReportes] = useState([])
  const [loadingReportes, setLoadingReportes] = useState(false)
  const [selectedReporte, setSelectedReporte] = useState(null)
  const [editingReporte, setEditingReporte] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
  const [reportesTab, setReportesTab] = useState('ver') // 'ver' o 'crear'
  const [formReporte, setFormReporte] = useState({
    tipo_reporte: 'General',
    titulo: '',
    descripcion: '',
    codigo_equipo: '',
  })
  const [codigoInventarioReporte, setCodigoInventarioReporte] = useState('')
  const [equipoEncontradoReporte, setEquipoEncontradoReporte] = useState(null)
  const [buscandoEquipoReporte, setBuscandoEquipoReporte] = useState(false)
  const [loadingCrearReporte, setLoadingCrearReporte] = useState(false)

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
    // Verificar si hay un parámetro de URL para la pestaña o si la ruta es /reportes
    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get('tab')
    const currentPath = window.location.pathname
    
    if (currentPath === '/reportes' || currentPath === '/reportes/crear' || tabParam === 'reportes') {
      setActiveTab('reportes')
      if (currentPath === '/reportes/crear' || tabParam === 'crear') {
        setReportesTab('crear')
      }
    } else if (tabParam === 'crear') {
      setActiveTab('crear')
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'ver') {
      fetchNovedades()
    } else if (activeTab === 'reportes') {
      fetchReportes()
    }
  }, [activeTab])

  async function fetchNovedades() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/novedades', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo cargar las novedades')
      setNovedades(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar novedades'), type: 'error' })
      setNovedades([])
    } finally {
      setLoading(false)
    }
  }

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

  function limpiarEquipo() {
    setCodigoInventario('')
    setEquipoEncontrado(null)
    setForm(prev => ({ ...prev, codigo_equipo: '' }))
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    if (!form.codigo_equipo || !form.tipo_novedad || !form.descripcion.trim()) {
      setToast({ message: 'Todos los campos son obligatorios', type: 'error' })
      return
    }

    try {
      setLoadingCrear(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/novedades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })

      const data = await res.json()

      if (res.ok) {
        setToast({ 
          message: data.message || 'Novedad registrada correctamente', 
          type: 'success' 
        })
        setForm({
          codigo_equipo: '',
          tipo_novedad: 'Mal Funcionamiento',
          descripcion: '',
        })
        limpiarEquipo()
        // Cambiar a la pestaña de ver y actualizar lista
        setActiveTab('ver')
        await fetchNovedades()
      } else {
        setToast({ 
          message: data.error || 'Error al registrar la novedad', 
          type: 'error' 
        })
      }
    } catch (err) {
      setToast({ message: 'Error de conexión con el servidor', type: 'error' })
    } finally {
      setLoadingCrear(false)
    }
  }

  function getEstadoBadge(estado) {
    const estados = {
      'Pendiente': { class: 'pendiente', icon: <FiAlertCircle size={14} /> },
      'En Proceso': { class: 'en-proceso', icon: <FiAlertCircle size={14} /> },
      'Resuelto': { class: 'resuelto', icon: <FiCheckCircle size={14} /> },
      'No Resuelto': { class: 'no-resuelto', icon: <FiXCircle size={14} /> }
    }
    const estadoInfo = estados[estado] || estados['Pendiente']
    return (
      <span className={`novedades-estado-badge ${estadoInfo.class}`}>
        {estadoInfo.icon}
        {estado || 'Pendiente'}
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

  function abrirEditarEstado(novedad) {
    setNuevoEstado(novedad.estado_resolucion || 'Pendiente')
    setObservacionesResolucion(novedad.observaciones_resolucion || '')
    setEditandoEstado(true)
  }

  function cancelarEditarEstado() {
    setEditandoEstado(false)
    setNuevoEstado('')
    setObservacionesResolucion('')
  }

  async function guardarEstado() {
    if (!selectedNovedad || !nuevoEstado) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/novedades/${selectedNovedad.id_novedad}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          estado_resolucion: nuevoEstado,
          observaciones_resolucion: observacionesResolucion || null
        })
      })

      const data = await parseApiResponse(res, 'No se pudo actualizar el estado')
      setToast({ message: data.message || 'Estado actualizado correctamente', type: 'success' })
      
      // Actualizar la novedad en la lista
      setNovedades(prev => prev.map(n => 
        n.id_novedad === selectedNovedad.id_novedad 
          ? { ...n, estado_resolucion: nuevoEstado, observaciones_resolucion: observacionesResolucion || null }
          : n
      ))
      
      // Actualizar la novedad seleccionada
      setSelectedNovedad(prev => ({ ...prev, estado_resolucion: nuevoEstado, observaciones_resolucion: observacionesResolucion || null }))
      cancelarEditarEstado()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar el estado'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // ========== FUNCIONES DE REPORTES ==========
  
  async function fetchReportes() {
    setLoadingReportes(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/reportes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo cargar los reportes')
      setReportes(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar reportes'), type: 'error' })
      setReportes([])
    } finally {
      setLoadingReportes(false)
    }
  }

  async function buscarEquipoReporte() {
    if (!codigoInventarioReporte.trim()) {
      setToast({ message: 'Ingresa un código de inventario', type: 'error' })
      return
    }

    try {
      setBuscandoEquipoReporte(true)
      setEquipoEncontradoReporte(null)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigoInventarioReporte.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await parseApiResponse(res)
        setEquipoEncontradoReporte(data)
        setFormReporte(prev => ({ ...prev, codigo_equipo: data.codigo_equipo }))
        setToast({ message: 'Equipo encontrado correctamente', type: 'success' })
      } else {
        const errorData = await res.json().catch(() => ({}))
        setToast({ 
          message: errorData.error || 'Equipo no encontrado', 
          type: 'error' 
        })
        setEquipoEncontradoReporte(null)
        setFormReporte(prev => ({ ...prev, codigo_equipo: '' }))
      }
    } catch (err) {
      setToast({ 
        message: buildErrorMessage(err, 'Error al buscar el equipo'), 
        type: 'error' 
      })
      setEquipoEncontradoReporte(null)
      setFormReporte(prev => ({ ...prev, codigo_equipo: '' }))
    } finally {
      setBuscandoEquipoReporte(false)
    }
  }

  function limpiarEquipoReporte() {
    setCodigoInventarioReporte('')
    setEquipoEncontradoReporte(null)
    setFormReporte(prev => ({ ...prev, codigo_equipo: '' }))
  }

  function handleChangeReporte(field, value) {
    setFormReporte(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmitReporte(e) {
    e.preventDefault()
    
    if (!formReporte.tipo_reporte || !formReporte.titulo.trim() || !formReporte.descripcion.trim()) {
      setToast({ message: 'El tipo, título y descripción son obligatorios', type: 'error' })
      return
    }

    try {
      setLoadingCrearReporte(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/reportes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formReporte)
      })

      const data = await res.json()

      if (res.ok) {
        setToast({ 
          message: data.message || 'Reporte creado correctamente', 
          type: 'success' 
        })
        setFormReporte({
          tipo_reporte: 'General',
          titulo: '',
          descripcion: '',
          codigo_equipo: '',
        })
        limpiarEquipoReporte()
        setReportesTab('ver')
        await fetchReportes()
      } else {
        setToast({ 
          message: data.error || 'Error al crear el reporte', 
          type: 'error' 
        })
      }
    } catch (err) {
      setToast({ message: 'Error de conexión con el servidor', type: 'error' })
    } finally {
      setLoadingCrearReporte(false)
    }
  }

  function startEditReporte(reporte) {
    setEditingReporte(reporte.id_reporte)
    setEditForm({
      tipo_reporte: reporte.tipo_reporte,
      titulo: reporte.titulo,
      descripcion: reporte.descripcion,
      codigo_equipo: reporte.codigo_equipo || ''
    })
  }

  function cancelEditReporte() {
    setEditingReporte(null)
    setEditForm({})
  }

  async function saveEditReporte() {
    if (!editingReporte) return
    setLoadingReportes(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/reportes/${editingReporte}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      })
      const data = await parseApiResponse(res, 'No se pudo actualizar el reporte')
      setToast({ message: data.message || 'Reporte actualizado correctamente', type: 'success' })
      await fetchReportes()
      cancelEditReporte()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar el reporte'), type: 'error' })
    } finally {
      setLoadingReportes(false)
    }
  }

  function confirmDeleteReporte(id) {
    setDeleteConfirm({ open: true, id })
  }

  async function handleDeleteReporte() {
    const id = deleteConfirm.id
    if (!id) return
    
    setDeleteConfirm({ open: false, id: null })
    setLoadingReportes(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/reportes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo eliminar el reporte')
      setToast({ message: data.message || 'Reporte eliminado correctamente', type: 'success' })
      await fetchReportes()
      if (selectedReporte?.id_reporte === id) {
        setSelectedReporte(null)
      }
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al eliminar el reporte'), type: 'error' })
    } finally {
      setLoadingReportes(false)
    }
  }

  function generarPDFReporte(reporte) {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      let yPos = margin

      // Encabezado
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('REPORTE DE EQUIPOS', pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Sistema de Gestión de Inventarios SENA`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 15

      // Línea separadora
      doc.setLineWidth(0.5)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 10

      // Información del reporte
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Información del Reporte', margin, yPos)
      yPos += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      
      const info = [
        ['ID:', reporte.id_reporte.toString()],
        ['Tipo:', reporte.tipo_reporte],
        ['Título:', reporte.titulo],
        ['Fecha:', formatDate(reporte.fecha_generacion)],
        ['Generado por:', reporte.generado_por_nombre]
      ]

      info.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold')
        doc.text(label, margin, yPos)
        doc.setFont('helvetica', 'normal')
        const textWidth = doc.getTextWidth(value)
        if (textWidth > pageWidth - margin * 2 - 40) {
          const lines = doc.splitTextToSize(value, pageWidth - margin * 2 - 40)
          doc.text(lines, margin + 40, yPos)
          yPos += lines.length * 5
        } else {
          doc.text(value, margin + 40, yPos)
          yPos += 6
        }
      })

      yPos += 5

      // Información del equipo si existe
      if (reporte.equipo_tipo) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Equipo Relacionado', margin, yPos)
        yPos += 8

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        
        const equipoInfo = [
          ['Tipo:', reporte.equipo_tipo],
          ['Marca:', reporte.equipo_marca || '-'],
          ['Modelo:', reporte.equipo_modelo || '-'],
          ['Placa:', reporte.equipo_placa || '-']
        ]

        equipoInfo.forEach(([label, value]) => {
          doc.setFont('helvetica', 'bold')
          doc.text(label, margin, yPos)
          doc.setFont('helvetica', 'normal')
          doc.text(value, margin + 40, yPos)
          yPos += 6
        })

        yPos += 5
      }

      // Descripción
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Descripción', margin, yPos)
      yPos += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const descLines = doc.splitTextToSize(reporte.descripcion || 'Sin descripción', pageWidth - margin * 2)
      descLines.forEach((line) => {
        if (yPos > pageHeight - margin - 10) {
          doc.addPage()
          yPos = margin
        }
        doc.text(line, margin, yPos)
        yPos += 6
      })

      // Pie de página
      const totalPages = doc.internal.pages.length - 1
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.text(
          `Página ${i} de ${totalPages} - Generado el ${new Date().toLocaleDateString('es-ES')}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
      }

      // Descargar PDF
      const fileName = `Reporte_${reporte.id_reporte}_${reporte.titulo.substring(0, 30).replace(/[^a-z0-9]/gi, '_')}.pdf`
      doc.save(fileName)
      
      setToast({ message: 'PDF generado correctamente', type: 'success' })
    } catch (err) {
      console.error('Error al generar PDF:', err)
      setToast({ message: 'Error al generar el PDF', type: 'error' })
    }
  }

  const isAdmin = user?.nombre_rol === 'Administrador'

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <div className="form-equipos form-modern novedades-form-container">
            <div className="form-header">
              <div className="form-icon-wrapper novedades-icon-wrapper">
                <FiAlertCircle size={28} color="#fff" />
              </div>
              <div className="novedades-header-content">
                <h2 className="novedades-title">Novedades</h2>
                <p className="novedades-subtitle">
                  Registro de incidencias y problemas con equipos
                </p>
              </div>
            </div>

            {/* Pestañas */}
            <div className="novedades-tabs">
              <button
                onClick={() => setActiveTab('ver')}
                className={`novedades-tab ${activeTab === 'ver' ? 'active' : ''}`}
              >
                <FiList size={18} />
                Ver Novedades
              </button>
              <button
                onClick={() => setActiveTab('crear')}
                className={`novedades-tab ${activeTab === 'crear' ? 'active' : ''}`}
              >
                <FiAlertCircle size={18} />
                Registrar Novedad
              </button>
              <button
                onClick={() => setActiveTab('reportes')}
                className={`novedades-tab ${activeTab === 'reportes' ? 'active' : ''}`}
              >
                <FiFileText size={18} />
                Reportes
              </button>
            </div>

            <div className="form-divider form-divider-no-margin"></div>

            {activeTab === 'ver' ? (
              <>
                {loading ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Cargando novedades...</p>
                  </div>
                ) : novedades.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon-wrapper">
                      <FiAlertCircle size={48} color="#9ca3af" />
                    </div>
                    <h3>No hay novedades registradas</h3>
                    <p>Las novedades reportadas aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="consulta-table novedades-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Equipo</th>
                          <th>Tipo</th>
                          <th>Descripción</th>
                          <th>Reportado por</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {novedades.map((novedad) => (
                          <tr key={novedad.id_novedad}>
                            <td>{novedad.id_novedad}</td>
                            <td>
                              <div>
                                <strong>{novedad.equipo_tipo} {novedad.equipo_marca} {novedad.equipo_modelo}</strong>
                                {novedad.codigo_inventario && <div className="novedades-serie-numero">Placa: {novedad.codigo_inventario}</div>}
                              </div>
                            </td>
                            <td>{novedad.tipo_novedad}</td>
                            <td className="novedades-descripcion-cell">
                              <div className="novedades-descripcion-text" title={novedad.descripcion}>
                                {novedad.descripcion}
                              </div>
                            </td>
                            <td>{novedad.reportado_por_nombre}</td>
                            <td>{formatDate(novedad.fecha_novedad)}</td>
                            <td>{getEstadoBadge(novedad.estado_resolucion)}</td>
                            <td>
                              <button
                                className="btn novedades-ver-btn"
                                onClick={() => setSelectedNovedad(novedad)}
                              >
                                <FiEye size={14} className="novedades-icon-inline-small" />
                                Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : activeTab === 'crear' ? (
              <form onSubmit={handleSubmit}>
                {/* Sección: Equipo */}
                <div className="form-section">
                  <h3 className="form-section-title">
                    <FiPackage size={18} className="novedades-icon-inline" />
                    Equipo Afectado
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
                        <div><strong>Equipo:</strong> {equipoEncontrado.tipo} {equipoEncontrado.marca} {equipoEncontrado.modelo}</div>
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

                {/* Sección: Tipo de Novedad */}
                <div className="form-section">
                  <h3 className="form-section-title">
                    <FiAlertCircle size={18} className="novedades-icon-inline" />
                    Tipo de Novedad
                  </h3>

                  <div className="form-group">
                    <label>
                      Tipo de Novedad *
                    </label>
                    <CustomSelect
                      name="tipo_novedad"
                      value={form.tipo_novedad}
                      onChange={(e) => handleChange('tipo_novedad', e.target.value)}
                      options={['Mal Funcionamiento', 'Daño', 'Pérdida', 'Robo', 'Otro']}
                      placeholder="Seleccionar tipo de novedad"
                      required
                    />
                  </div>
                </div>

                {/* Sección: Descripción */}
                <div className="form-section">
                  <h3 className="form-section-title">
                    <FiFileText size={18} className="novedades-icon-inline" />
                    Descripción del Problema
                  </h3>

                  <div className="form-group">
                    <label>
                      Descripción Detallada *
                    </label>
                    <textarea
                      value={form.descripcion}
                      onChange={(e) => handleChange('descripcion', e.target.value)}
                      placeholder="Describe detalladamente el problema o situación..."
                      rows={8}
                      required
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn-primary btn-modern"
                    disabled={loadingCrear}
                  >
                    {loadingCrear ? 'Registrando...' : 'Registrar Novedad'}
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary btn-modern"
                    onClick={() => setActiveTab('ver')}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : activeTab === 'reportes' ? (
              <>
                {/* Pestañas internas de reportes */}
                {!selectedReporte && !editingReporte && (
                  <div className="novedades-tabs" style={{ marginBottom: '20px' }}>
                    <button
                      onClick={() => {
                        setReportesTab('ver')
                        fetchReportes()
                      }}
                      className={`novedades-tab ${reportesTab === 'ver' ? 'active' : ''}`}
                    >
                      <FiList size={18} />
                      Ver Reportes
                    </button>
                    <button
                      onClick={() => {
                        setReportesTab('crear')
                        setFormReporte({
                          tipo_reporte: 'General',
                          titulo: '',
                          descripcion: '',
                          codigo_equipo: '',
                        })
                        limpiarEquipoReporte()
                      }}
                      className={`novedades-tab ${reportesTab === 'crear' ? 'active' : ''}`}
                    >
                      <FiFileText size={18} />
                      Crear Reporte
                    </button>
                  </div>
                )}

                {selectedReporte || editingReporte ? (
                  // Vista de detalle/edición de reporte
                  <div className="reportes-detail-view">
                    {editingReporte === selectedReporte?.id_reporte ? (
                      <div className="reportes-edit-form">
                        <h3 className="form-section-title">Editar Reporte</h3>
                        <div className="form-group">
                          <label>Tipo de Reporte *</label>
                          <CustomSelect
                            name="tipo_reporte"
                            value={editForm.tipo_reporte}
                            onChange={(e) => setEditForm(prev => ({ ...prev, tipo_reporte: e.target.value }))}
                            options={['General', 'Equipos', 'Mantenimiento', 'Novedades', 'Uso', 'Otro']}
                            placeholder="Seleccionar tipo de reporte"
                          />
                        </div>
                        <div className="form-group">
                          <label>Título *</label>
                          <input
                            type="text"
                            value={editForm.titulo}
                            onChange={(e) => setEditForm(prev => ({ ...prev, titulo: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Descripción *</label>
                          <textarea
                            value={editForm.descripcion}
                            onChange={(e) => setEditForm(prev => ({ ...prev, descripcion: e.target.value }))}
                            rows={6}
                          />
                        </div>
                        <div className="form-actions">
                          <button
                            onClick={saveEditReporte}
                            className="btn-primary btn-modern"
                            disabled={loadingReportes}
                          >
                            {loadingReportes ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => {
                              cancelEditReporte()
                              setSelectedReporte(null)
                              setReportesTab('ver')
                            }}
                            className="btn-secondary btn-modern"
                            disabled={loadingReportes}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="reportes-detail-content">
                        <div className="reportes-detail-header">
                          <h3>Detalle del Reporte</h3>
                          <button
                            onClick={() => {
                              setSelectedReporte(null)
                              setReportesTab('ver')
                            }}
                            className="btn-secondary btn-modern"
                          >
                            <FiX size={16} />
                            Cerrar
                          </button>
                        </div>
                        <div className="reportes-modal-info-grid">
                          <div><strong>ID:</strong> {selectedReporte.id_reporte}</div>
                          <div>
                            <strong>Tipo:</strong> 
                            <span className={`reportes-tipo-badge reportes-tipo-badge-${selectedReporte.tipo_reporte.toLowerCase()}`}>
                              {selectedReporte.tipo_reporte}
                            </span>
                          </div>
                          <div><strong>Título:</strong> {selectedReporte.titulo}</div>
                          {selectedReporte.equipo_tipo && (
                            <div>
                              <strong>Equipo:</strong> {selectedReporte.equipo_tipo} {selectedReporte.equipo_marca} {selectedReporte.equipo_modelo}
                            </div>
                          )}
                          <div>
                            <strong>Descripción:</strong>
                            <div className="reportes-modal-description-box">
                              {selectedReporte.descripcion}
                            </div>
                          </div>
                          <div><strong>Generado por:</strong> {selectedReporte.generado_por_nombre}</div>
                          <div><strong>Fecha de generación:</strong> {formatDate(selectedReporte.fecha_generacion)}</div>
                          <div className="reportes-detail-actions">
                            <button
                              onClick={() => generarPDFReporte(selectedReporte)}
                              className="btn-primary btn-modern"
                            >
                              <FiDownload size={16} />
                              Descargar PDF
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => startEditReporte(selectedReporte)}
                                  className="btn btn-modern"
                                >
                                  <FiEdit size={16} />
                                  Editar
                                </button>
                                <button
                                  onClick={() => confirmDeleteReporte(selectedReporte.id_reporte)}
                                  className="btn danger btn-modern"
                                >
                                  <FiTrash2 size={16} />
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : reportesTab === 'crear' || formReporte.titulo ? (
                    // Formulario de creación
                    <form onSubmit={handleSubmitReporte}>
                      <div className="form-section">
                        <h3 className="form-section-title">
                          <FiFileText size={18} className="novedades-icon-inline" />
                          Información del Reporte
                        </h3>
                        <div className="form-grid">
                          <div className="form-group">
                            <label>
                              <FiType size={16} className="novedades-icon-inline" />
                              Tipo de Reporte *
                            </label>
                            <CustomSelect
                              name="tipo_reporte"
                              value={formReporte.tipo_reporte}
                              onChange={(e) => handleChangeReporte('tipo_reporte', e.target.value)}
                              options={['General', 'Equipos', 'Mantenimiento', 'Novedades', 'Uso', 'Otro']}
                              placeholder="Seleccionar tipo de reporte"
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>
                              <FiFileText size={16} className="novedades-icon-inline" />
                              Título *
                            </label>
                            <input
                              type="text"
                              value={formReporte.titulo}
                              onChange={(e) => handleChangeReporte('titulo', e.target.value)}
                              placeholder="Título descriptivo del reporte"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="form-section">
                        <h3 className="form-section-title">
                          <FiPackage size={18} className="novedades-icon-inline" />
                          Equipo Relacionado (Opcional)
                        </h3>
                        <div className="form-group">
                          <label>Código de Inventario</label>
                          <div className="search-equipo-wrapper">
                            <input
                              type="text"
                              value={codigoInventarioReporte}
                              onChange={(e) => setCodigoInventarioReporte(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  buscarEquipoReporte()
                                }
                              }}
                              placeholder="Ingresa el código de inventario (opcional)"
                              className="search-equipo-input"
                            />
                            <button
                              type="button"
                              onClick={buscarEquipoReporte}
                              disabled={buscandoEquipoReporte || !codigoInventarioReporte.trim()}
                              className="btn-search-equipo"
                            >
                              {buscandoEquipoReporte ? 'Buscando...' : (
                                <>
                                  <FiSearch size={16} />
                                  Buscar
                                </>
                              )}
                            </button>
                          </div>
                          <p className="form-help-text">Si no especificas un equipo, el reporte será general</p>
                        </div>

                        {equipoEncontradoReporte && (
                          <div className="equipo-found-card">
                            <div className="equipo-found-header">
                              <FiCheck size={20} color="#43a047" />
                              <span>Equipo encontrado</span>
                            </div>
                            <div className="equipo-found-info">
                              <div><strong>Código:</strong> {equipoEncontradoReporte.codigo_inventario}</div>
                              <div><strong>Equipo:</strong> {equipoEncontradoReporte.tipo} {equipoEncontradoReporte.marca} {equipoEncontradoReporte.modelo}</div>
                              {equipoEncontradoReporte.nombre_ambiente && (
                                <div><strong>Ambiente:</strong> {equipoEncontradoReporte.nombre_ambiente}</div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={limpiarEquipoReporte}
                              className="btn-clear-equipo"
                            >
                              <FiX size={14} />
                              Quitar equipo
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="form-section">
                        <h3 className="form-section-title">
                          <FiFileText size={18} className="novedades-icon-inline" />
                          Descripción del Reporte
                        </h3>
                        <div className="form-group">
                          <label>Descripción Detallada *</label>
                          <textarea
                            value={formReporte.descripcion}
                            onChange={(e) => handleChangeReporte('descripcion', e.target.value)}
                            placeholder="Describe detalladamente el contenido del reporte..."
                            rows={8}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-actions">
                        <button 
                          type="submit" 
                          className="btn-primary btn-modern"
                          disabled={loadingCrearReporte}
                        >
                          {loadingCrearReporte ? 'Creando...' : 'Crear Reporte'}
                        </button>
                        <button 
                          type="button" 
                          className="btn-secondary btn-modern"
                          onClick={() => {
                            setFormReporte({
                              tipo_reporte: 'General',
                              titulo: '',
                              descripcion: '',
                              codigo_equipo: '',
                            })
                            limpiarEquipoReporte()
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                ) : loadingReportes ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Cargando reportes...</p>
                  </div>
                ) : reportes.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon-wrapper">
                      <FiFileText size={48} color="#9ca3af" />
                    </div>
                    <h3>No hay reportes registrados</h3>
                    <p>Los reportes generados aparecerán aquí</p>
                  </div>
                ) : (
                  // Lista de reportes
                  <div className="table-wrapper">
                    <table className="consulta-table novedades-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Tipo</th>
                          <th>Título</th>
                          <th>Equipo</th>
                          <th>Generado por</th>
                          <th>Fecha</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportes.map((reporte) => (
                          <tr key={reporte.id_reporte}>
                            <td>{reporte.id_reporte}</td>
                            <td>
                              <span className={`reportes-tipo-badge ${
                                reporte.tipo_reporte === 'General' ? 'reportes-tipo-badge-general' :
                                reporte.tipo_reporte === 'Mantenimiento' ? 'reportes-tipo-badge-mantenimiento' :
                                'reportes-tipo-badge-uso'
                              }`}>
                                {reporte.tipo_reporte}
                              </span>
                            </td>
                            <td><strong>{reporte.titulo}</strong></td>
                            <td>
                              {reporte.equipo_tipo ? (
                                <div>
                                  {reporte.equipo_tipo} {reporte.equipo_marca} {reporte.equipo_modelo}
                                </div>
                              ) : (
                                <span className="text-muted-italic">General</span>
                              )}
                            </td>
                            <td>{reporte.generado_por_nombre}</td>
                            <td>{formatDate(reporte.fecha_generacion)}</td>
                            <td>
                              <div className="reportes-actions">
                                <button
                                  className="btn novedades-ver-btn"
                                  onClick={() => setSelectedReporte(reporte)}
                                >
                                  <FiEye size={14} />
                                  Ver
                                </button>
                                <button
                                  className="btn novedades-ver-btn"
                                  onClick={() => generarPDFReporte(reporte)}
                                  title="Descargar PDF"
                                >
                                  <FiDownload size={14} />
                                  PDF
                                </button>
                                {isAdmin && (
                                  <>
                                    <button
                                      className="btn novedades-ver-btn"
                                      onClick={() => startEditReporte(reporte)}
                                      disabled={loadingReportes}
                                    >
                                      <FiEdit size={14} />
                                      Editar
                                    </button>
                                    <button
                                      className="btn danger novedades-ver-btn"
                                      onClick={() => confirmDeleteReporte(reporte.id_reporte)}
                                      disabled={loadingReportes}
                                    >
                                      <FiTrash2 size={14} />
                                      Eliminar
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
              </>
            ) : null}
          </div>

          {selectedNovedad && (
            <div className="novedades-modal-overlay" onClick={() => setSelectedNovedad(null)}>
              <div className="novedades-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="novedades-modal-header">
                  <h3 className="novedades-modal-title">Detalle de Novedad</h3>
                  <button
                    onClick={() => setSelectedNovedad(null)}
                    className="novedades-modal-close"
                  >
                    ×
                  </button>
                </div>

                <div className="novedades-modal-grid">
                  <div>
                    <strong>ID:</strong> {selectedNovedad.id_novedad}
                  </div>
                  <div>
                    <strong>Equipo:</strong> {selectedNovedad.equipo_tipo} {selectedNovedad.equipo_marca} {selectedNovedad.equipo_modelo}
                    {selectedNovedad.codigo_inventario && <span> (Placa: {selectedNovedad.codigo_inventario})</span>}
                  </div>
                  <div>
                    <strong>Tipo de Novedad:</strong> {selectedNovedad.tipo_novedad}
                  </div>
                  <div>
                    <strong>Descripción:</strong>
                    <div className="novedades-descripcion-box">
                      {selectedNovedad.descripcion}
                    </div>
                  </div>
                  <div>
                    <strong>Reportado por:</strong> {selectedNovedad.reportado_por_nombre}
                  </div>
                  <div>
                    <strong>Fecha de reporte:</strong> {formatDate(selectedNovedad.fecha_novedad)}
                  </div>
                  <div>
                    <div className="novedades-estado-header">
                      <strong>Estado:</strong>
                      {!editandoEstado && (user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                        <button
                          onClick={() => abrirEditarEstado(selectedNovedad)}
                          className="btn novedades-cambiar-estado-btn"
                        >
                          <FiEdit size={14} className="novedades-icon-inline-small" />
                          Cambiar Estado
                        </button>
                      )}
                    </div>
                    {editandoEstado ? (
                      <div className="novedades-editar-estado-grid">
                        <CustomSelect
                          name="nuevoEstado"
                          value={nuevoEstado}
                          onChange={(e) => setNuevoEstado(e.target.value)}
                          options={['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto']}
                          placeholder="Seleccionar estado"
                          className="novedades-estado-select"
                        />
                        <textarea
                          value={observacionesResolucion}
                          onChange={(e) => setObservacionesResolucion(e.target.value)}
                          placeholder="Observaciones de resolución (opcional)..."
                          rows={3}
                          className="novedades-observaciones-textarea"
                        />
                        <div className="novedades-editar-buttons">
                          <button
                            onClick={guardarEstado}
                            className="btn-primary btn-modern novedades-editar-btn"
                            disabled={loading}
                          >
                            {loading ? 'Guardando' : 'Guardar'}
                          </button>
                          <button
                            onClick={cancelarEditarEstado}
                            className="btn-secondary btn-modern novedades-editar-btn"
                            disabled={loading}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      getEstadoBadge(selectedNovedad.estado_resolucion)
                    )}
                  </div>
                  {selectedNovedad.fecha_resolucion && (
                    <div>
                      <strong>Fecha de resolución:</strong> {formatDate(selectedNovedad.fecha_resolucion)}
                    </div>
                  )}
                  {selectedNovedad.resuelto_por_nombre && (
                    <div>
                      <strong>Resuelto por:</strong> {selectedNovedad.resuelto_por_nombre}
                    </div>
                  )}
                  {selectedNovedad.observaciones_resolucion && (
                    <div>
                      <strong>Observaciones de resolución:</strong>
                      <div className="novedades-descripcion-box">
                        {selectedNovedad.observaciones_resolucion}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <ConfirmModal
            open={deleteConfirm.open}
            title="Eliminar Reporte"
            message="¿Estás seguro de que deseas eliminar este reporte? Esta acción no se puede deshacer."
            confirmText="Eliminar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDeleteReporte}
            onCancel={() => setDeleteConfirm({ open: false, id: null })}
          />
        </main>
      </div>
    </div>
  )
}
