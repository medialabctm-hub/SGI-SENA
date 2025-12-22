import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import { FiDownload, FiSearch, FiList, FiClock, FiEye, FiUpload, FiSettings, FiCheckSquare, FiSquare } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import '../styles/equipos.css'
import '../styles/consultarEquipo.css'
import '../styles/consultarEquipoBadges.css'

export default function ConsultarEquipo() {
  const navigate = useNavigate()
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [equipos, setEquipos] = useState([])
  const [editingCodigo, setEditingCodigo] = useState(null)
  const [draft, setDraft] = useState({})
  const [toast, setToast] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, codigo: null })
  const [user, setUser] = useState(null)
  const [showColumnFilter, setShowColumnFilter] = useState(false)
  const [ambientes, setAmbientes] = useState([])
  
  const ESTADOS_FISICOS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado']
  
  // Definir todas las columnas disponibles
  const allColumns = [
    { key: 'codigo_inventario', label: 'Código Inventario', default: true },
    { key: 'tipo', label: 'Tipo', default: true },
    { key: 'modelo', label: 'Modelo', default: true },
    { key: 'consecutivo', label: 'Consecutivo', default: true },
    { key: 'estado_fisico', label: 'Estado Físico', default: true },
    { key: 'fecha_adquisicion', label: 'Fecha Adquisición', default: true },
    { key: 'costo', label: 'Valor Ingreso', default: true },
    { key: 'nombre_ambiente', label: 'Ambiente', default: true },
    { key: 'descripcion', label: 'Descripción', default: true },
    { key: 'specs_completas', label: 'Atributos', default: true },
  ]

  // Estado para columnas visibles (inicializado con las columnas por defecto)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('equipos_visible_columns')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return allColumns.filter(col => col.default).map(col => col.key)
      }
    }
    return allColumns.filter(col => col.default).map(col => col.key)
  })

  // Guardar preferencias de columnas
  useEffect(() => {
    localStorage.setItem('equipos_visible_columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [])

  // Cargar ambientes disponibles
  useEffect(() => {
    async function cargarAmbientes() {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/ambientes/activos', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await parseApiResponse(res, 'No se pudieron cargar los ambientes')
        setAmbientes(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error al cargar ambientes:', err)
        setAmbientes([])
      }
    }
    cargarAmbientes()
  }, [])

  async function handleBuscar(e) {
    e.preventDefault()
    setToast(null)
    setEquipos([])
    if (!codigo) {
      setToast({ message: 'Ingresa el código de inventario a consultar.', type: 'error' })
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigo)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo consultar el equipo')
      // Si es un array, usar directamente; si es un objeto, convertirlo a array
      setEquipos(Array.isArray(data) ? data : [data])
    } catch (err) {
      setEquipos([])
      setToast({ message: buildErrorMessage(err, 'No se pudo consultar el equipo'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleMostrarTodos() {
    setToast(null)
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo listar los equipos')
      setEquipos(Array.isArray(data) ? data : [])
    } catch (err) {
      setEquipos([])
      setToast({ message: buildErrorMessage(err, 'No se pudo listar los equipos'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function startEdit(eq) {
    setEditingCodigo(eq.codigo_equipo)
    setDraft({
      ...eq,
      fecha_adquisicion: eq.fecha_adquisicion ? String(eq.fecha_adquisicion).slice(0,10) : '',
      id_ambiente: eq.id_ambiente || null
    })
  }

  function cancelEdit() {
    setEditingCodigo(null)
    setDraft({})
  }

  function onDraft(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  async function saveEdit() {
    if (!editingCodigo) return
    setLoading(true)
    setToast(null)
    try {
      // Función helper para limpiar valores
      const cleanValue = (val) => {
        if (val === undefined || val === '' || val === null) return null;
        return val;
      };
      
      const cleanNumber = (val) => {
        if (val === undefined || val === '' || val === null) return null;
        const num = typeof val === 'string' ? parseFloat(val) : Number(val);
        return isNaN(num) ? null : num;
      };
      
      // Limpiar el payload para solo enviar campos válidos
      const payload = {}
      
      // Campos de texto - solo incluir si tienen valor
      if (draft.tipo !== undefined && draft.tipo !== null && draft.tipo !== '') {
        payload.tipo = String(draft.tipo).trim() || null;
      }
      if (draft.modelo !== undefined && draft.modelo !== null && draft.modelo !== '') {
        payload.modelo = String(draft.modelo).trim() || null;
      }
      if (draft.consecutivo !== undefined && draft.consecutivo !== null && draft.consecutivo !== '') {
        payload.consecutivo = String(draft.consecutivo).trim() || null;
      }
      if (draft.descripcion !== undefined && draft.descripcion !== null && draft.descripcion !== '') {
        payload.descripcion = String(draft.descripcion).trim() || null;
      }
      if (draft.specs_completas !== undefined && draft.specs_completas !== null && draft.specs_completas !== '') {
        payload.specs_completas = String(draft.specs_completas).trim() || null;
      }
      if (draft.marca !== undefined && draft.marca !== null && draft.marca !== '') {
        payload.marca = String(draft.marca).trim() || null;
      }
      if (draft.numero_serie !== undefined && draft.numero_serie !== null && draft.numero_serie !== '') {
        payload.numero_serie = String(draft.numero_serie).trim() || null;
      }
      if (draft.placa !== undefined && draft.placa !== null && draft.placa !== '') {
        payload.placa = String(draft.placa).trim() || null;
      }
      if (draft.r_centro !== undefined && draft.r_centro !== null && draft.r_centro !== '') {
        payload.r_centro = String(draft.r_centro).trim() || null;
      }
      
      // Fecha
      if (draft.fecha_adquisicion !== undefined && draft.fecha_adquisicion !== null && draft.fecha_adquisicion !== '') {
        payload.fecha_adquisicion = String(draft.fecha_adquisicion).trim() || null;
      }
      
      // Números
      if (draft.costo !== undefined) {
        payload.costo = cleanNumber(draft.costo);
      }
      if (draft.valor_ingreso !== undefined) {
        payload.valor_ingreso = cleanNumber(draft.valor_ingreso);
      }
      if (draft.vida_util_meses !== undefined) {
        payload.vida_util_meses = cleanNumber(draft.vida_util_meses);
      }
      
      // Estado físico
      if (draft.estado_fisico !== undefined && draft.estado_fisico !== null && draft.estado_fisico !== '') {
        payload.estado_fisico = String(draft.estado_fisico).trim();
      }
      
      // ID Ambiente
      if (draft.id_ambiente !== undefined && draft.id_ambiente !== null && draft.id_ambiente !== '') {
        const idAmb = typeof draft.id_ambiente === 'string' ? parseInt(draft.id_ambiente, 10) : draft.id_ambiente;
        if (!isNaN(idAmb) && idAmb > 0) {
          payload.id_ambiente = idAmb;
        } else {
          payload.id_ambiente = null;
        }
      }

      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/${encodeURIComponent(editingCodigo)}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      const data = await parseApiResponse(res, 'No se pudo actualizar el equipo')
      setEquipos(prev => prev.map(eq => eq.codigo_equipo === editingCodigo ? {
        ...eq,
        ...draft,
        fecha_adquisicion: draft.fecha_adquisicion || eq.fecha_adquisicion
      } : eq))
      setToast({ message: data?.message || 'Equipo actualizado correctamente', type: 'success' })
      cancelEdit()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo actualizar el equipo'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function confirmDelete(codigoEq) {
    setDeleteConfirm({ open: true, codigo: codigoEq })
  }

  async function handleDelete() {
    const codigoEq = deleteConfirm.codigo
    if (!codigoEq) return
    
    setDeleteConfirm({ open: false, codigo: null })
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigoEq)}`, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      await parseApiResponse(res, 'No se pudo eliminar el equipo')
      setEquipos(prev => prev.filter(eq => eq.codigo_equipo !== codigoEq))
      if (editingCodigo === codigoEq) cancelEdit()
      setToast({ message: `Equipo ${codigoEq} eliminado correctamente`, type: 'success' })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo eliminar el equipo'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  

  function getEstadoBadge(estado) {
    if (!estado) return <span className="consultar-equipo-estado-badge consultar-equipo-estado-badge-default">-</span>
    
    const estadoClass = estado === 'Nuevo' ? 'consultar-equipo-estado-badge-nuevo' :
                        estado === 'Bueno' ? 'consultar-equipo-estado-badge-bueno' :
                        estado === 'Regular' ? 'consultar-equipo-estado-badge-regular' :
                        estado === 'Malo' ? 'consultar-equipo-estado-badge-malo' :
                        estado === 'Dañado' ? 'consultar-equipo-estado-badge-danado' :
                        estado === 'En Reparación' ? 'consultar-equipo-estado-badge-en-reparacion' :
                        'consultar-equipo-estado-badge-default'
    
    return (
      <span className={`consultar-equipo-estado-badge ${estadoClass}`}>
        {estado}
      </span>
    )
  }

  function formatCurrency(value) {
    if (!value && value !== 0) return '-'
    try {
      const numValue = typeof value === 'string' ? parseFloat(value) : value
      if (isNaN(numValue)) return '-'
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(numValue)
    } catch (err) {
      console.error('Error formateando moneda:', err, value)
      return String(value || '-')
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return String(dateString)
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch (err) {
      console.error('Error formateando fecha:', err, dateString)
      return String(dateString || '-')
    }
  }

  // Función para parsear especificaciones del formato "MARCA:valor;SERIAL:valor;MODELO:valor;OBSERVACIONES:valor"
  function parsearEspecificaciones(specs) {
    if (!specs || typeof specs !== 'string') {
      return { marca: '-', serial: '-', modelo: '-', observaciones: '-' }
    }
    
    const resultado = { marca: '-', serial: '-', modelo: '-', observaciones: '-' }
    
    // Buscar cada campo en el formato "CAMPO:valor" (puede terminar con ; o al final del string)
    const campos = {
      marca: /MARCA:\s*([^;]+?)(?=;|$)/i,
      serial: /SERIAL:\s*([^;]+?)(?=;|$)/i,
      modelo: /MODELO:\s*([^;]+?)(?=;|$)/i,
      observaciones: /OBSERVACIONES:\s*([^;]+?)(?=;|$)/i
    }
    
    Object.keys(campos).forEach(campo => {
      const match = specs.match(campos[campo])
      if (match && match[1]) {
        const valor = match[1].trim()
        resultado[campo] = valor || '-'
      }
    })
    
    return resultado
  }

  async function handleDescargarPDF() {
    setToast(null)
    
    // Si no hay equipos cargados, obtener todos primero
    let equiposParaExportar = equipos
    if (equipos.length === 0) {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/equipos', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await parseApiResponse(res, 'No se pudo obtener los equipos para la exportación')
        equiposParaExportar = Array.isArray(data) ? data : []
      } catch (err) {
        setToast({ message: buildErrorMessage(err, 'No se pudo obtener los equipos para la exportación'), type: 'error' })
        setLoading(false)
        return
      } finally {
        setLoading(false)
      }
    }

    if (equiposParaExportar.length === 0) {
      setToast({ message: 'No hay equipos para descargar', type: 'error' })
      return
    }

    try {
      // Preparar datos para Excel con especificaciones separadas
      const datosExcel = equiposParaExportar.map(eq => {
        const specs = parsearEspecificaciones(eq.specs_completas)
        return {
          'Código Inventario': eq.codigo_inventario || '-',
          'Tipo': eq.tipo || '-',
          'Modelo': eq.modelo || '-',
          'Consecutivo': eq.consecutivo || '-',
          'Estado Físico': eq.estado_fisico || '-',
          'Fecha Adquisición': eq.fecha_adquisicion ? formatDate(eq.fecha_adquisicion) : '-',
          'Valor Ingreso': eq.costo ? formatCurrency(eq.costo) : '-',
          'Ambiente': eq.nombre_ambiente || '-',
          'Descripción': eq.descripcion || '-',
          'Atributos': eq.specs_completas || '-'
        }
      })

      // Crear workbook
      const wb = XLSX.utils.book_new()
      
      // Preparar fila de título con información
      const fechaExportacion = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      
      const numColumnas = Object.keys(datosExcel[0] || {}).length
      const filaTitulo = Array(numColumnas).fill('')
      filaTitulo[0] = `INVENTARIO DE EQUIPOS - SENA - Exportado el ${fechaExportacion} - Total de equipos: ${equiposParaExportar.length}`
      
      // Crear array de arrays: título + encabezados + datos
      const headers = Object.keys(datosExcel[0] || {})
      const datosArray = [
        filaTitulo, // Fila 0: Título
        headers,    // Fila 1: Encabezados
        ...datosExcel.map(row => headers.map(key => row[key] || '-')) // Filas 2+: Datos
      ]
      
      // Crear worksheet desde array de arrays
      const ws = XLSX.utils.aoa_to_sheet(datosArray)
      
      // Combinar celdas de la fila de título (desde A1 hasta la última columna)
      if (!ws['!merges']) ws['!merges'] = []
      ws['!merges'].push({
        s: { r: 0, c: 0 },
        e: { r: 0, c: numColumnas - 1 }
      })
      
      // Ajustar altura de la fila de título
      if (!ws['!rows']) ws['!rows'] = []
      ws['!rows'][0] = { hpt: 25 }
      ws['!rows'][1] = { hpt: 20 } // Altura para encabezados
      
      // Ajustar ancho de columnas de forma más adecuada
      const colWidths = [
        { wch: 20 }, // Código Inventario
        { wch: 18 }, // Tipo
        { wch: 25 }, // Modelo
        { wch: 18 }, // Consecutivo
        { wch: 15 }, // Estado Físico
        { wch: 20 }, // Fecha Adquisición
        { wch: 18 }, // Valor Ingreso
        { wch: 25 }, // Ambiente
        { wch: 35 }, // Descripción
        { wch: 50 }  // Atributos
      ]
      ws['!cols'] = colWidths
      
      // Configurar vista: congelar fila de encabezados (fila 2, índice 1) y primera columna
      ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
      
      // Agregar filtros automáticos (autofilter) en la fila de encabezados (fila 2, índice 1)
      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref'])
        // El autofilter debe aplicarse desde la fila de encabezados (índice 1)
        range.s.r = 1
        range.e.r = range.e.r // Mantener el final del rango
        ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) }
      }
      
      // Agregar worksheet al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Equipos')
      
      // Generar archivo Excel
      const nombreArchivo = `equipos_sena_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, nombreArchivo)
      
      setToast({ message: `Archivo Excel descargado exitosamente: ${nombreArchivo}`, type: 'success' })
    } catch (err) {
      console.error('Error al generar Excel:', err)
      setToast({ message: 'Error al generar el archivo Excel. Por favor, intenta nuevamente.', type: 'error' })
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
            title="Eliminar Equipo"
            message={`¿Estás seguro de que deseas eliminar el equipo ${deleteConfirm.codigo}? Esta acción no se puede deshacer.`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDelete}
            onCancel={() => setDeleteConfirm({ open: false, codigo: null })}
          />
          <div className="users-panel">
          <div className="users-toolbar">
            <h2 className="consultar-equipo-header">Consultar Inventario</h2>
            <div className="consultar-equipo-header-row">
              <form onSubmit={handleBuscar} className="consultar-equipo-search-form">
                <input
                  type="text"
                  placeholder="Buscar por código de inventario..."
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  className="search-input"
                />
                <button 
                  className="consultar-equipo-btn consultar-equipo-btn-verde" 
                  type="submit" 
                  disabled={loading}
                >
                  <FiSearch size={16} />
                  {loading ? 'Buscando...' : 'Buscar'}
                </button>
                <button 
                  type="button" 
                  className="consultar-equipo-btn consultar-equipo-btn-gris" 
                  onClick={handleMostrarTodos} 
                  disabled={loading}
                >
                  <FiList size={16} />
                  {loading ? 'Cargando...' : 'Mostrar todos'}
                </button>
              </form>
              <div className="consultar-equipo-actions-row">
                <button 
                  type="button" 
                  className="consultar-equipo-btn consultar-equipo-btn-gris" 
                  onClick={() => setShowColumnFilter(true)}
                  title="Configurar columnas visibles"
                >
                  <FiSettings size={16} />
                  Columnas
                </button>
                <button 
                  type="button" 
                  className="consultar-equipo-btn consultar-equipo-btn-verde" 
                  onClick={handleDescargarPDF} 
                  disabled={loading}
                >
                  <FiDownload size={16} />
                  Descargar Excel
                </button>
              </div>
            </div>
          </div>

          {/* Modal de filtro de columnas */}
          {showColumnFilter && (
            <div
              className="consultar-equipo-column-filter-modal"
              onClick={() => setShowColumnFilter(false)}
            >
              <div
                className="consultar-equipo-column-filter-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="consultar-equipo-column-filter-header">
                  <h3>Seleccionar Columnas</h3>
                  <button
                    type="button"
                    onClick={() => setShowColumnFilter(false)}
                    className="consultar-equipo-column-filter-close"
                  >
                    ×
                  </button>
                </div>
                
                <div>
                  <div className="consultar-equipo-column-filter-actions">
                    <button
                      type="button"
                      className="btn consultar-equipo-column-filter-btn"
                      onClick={() => setVisibleColumns(allColumns.map(col => col.key))}
                    >
                      Seleccionar Todas
                    </button>
                    <button
                      type="button"
                      className="btn consultar-equipo-column-filter-btn"
                      onClick={() => setVisibleColumns(allColumns.filter(col => col.default).map(col => col.key))}
                    >
                      Restaurar Predeterminadas
                    </button>
                  </div>
                  
                  <div className="consultar-equipo-column-list">
                    {allColumns.map((column) => {
                      const isVisible = visibleColumns.includes(column.key)
                      return (
                        <label
                          key={column.key}
                          className={`consultar-equipo-column-item ${isVisible ? 'checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setVisibleColumns([...visibleColumns, column.key])
                              } else {
                                // Asegurar que al menos una columna permanezca visible
                                if (visibleColumns.length > 1) {
                                  setVisibleColumns(visibleColumns.filter(key => key !== column.key))
                                } else {
                                  setToast({ message: 'Debe haber al menos una columna visible', type: 'warning' })
                                }
                              }
                            }}
                            className="consultar-equipo-column-checkbox"
                          />
                          <span className="consultar-equipo-column-label">
                            {column.label}
                          </span>
                          {isVisible ? (
                            <FiCheckSquare size={20} color="var(--success-800)" className="consultar-equipo-column-icon" />
                          ) : (
                            <FiSquare size={20} color="#9ca3af" className="consultar-equipo-column-icon" />
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="consultar-equipo-column-filter-footer">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowColumnFilter(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="consultar-equipo-content">
            {loading ? (
              <div>Cargando equipos...</div>
            ) : equipos.length > 0 ? (
              <div className="consultar-equipo-table-wrapper">
                <table className="users-table consultar-equipo-table">
                  <thead>
                    <tr>
                      {visibleColumns.includes('codigo_inventario') && <th>Código Inventario</th>}
                      {visibleColumns.includes('tipo') && <th>Tipo</th>}
                      {visibleColumns.includes('modelo') && <th>Modelo</th>}
                      {visibleColumns.includes('consecutivo') && <th>Consecutivo</th>}
                      {visibleColumns.includes('estado_fisico') && <th>Estado Físico</th>}
                      {visibleColumns.includes('fecha_adquisicion') && <th>Fecha Adquisición</th>}
                      {visibleColumns.includes('costo') && <th>Valor Ingreso</th>}
                      {visibleColumns.includes('nombre_ambiente') && <th>Ambiente</th>}
                      {visibleColumns.includes('descripcion') && <th>Descripción</th>}
                      {visibleColumns.includes('specs_completas') && <th>Atributos</th>}
                      <th className={user?.nombre_rol === 'Administrador' ? 'consultar-equipo-actions-column' : 'consultar-equipo-actions-column-instructor'}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map((eq) => (
                      <tr key={eq.codigo_equipo}>
                        {visibleColumns.includes('codigo_inventario') && (
                          <td>{eq.codigo_inventario || '-'}</td>
                        )}
                        {visibleColumns.includes('tipo') && (
                          <td>
                            {editingCodigo === eq.codigo_equipo ? (
                              <input value={draft.tipo || ''} onChange={e=>onDraft('tipo', e.target.value)} className="cell-input" />
                            ) : (eq.tipo)}
                          </td>
                        )}
                        {visibleColumns.includes('modelo') && (
                          <td>
                            {editingCodigo === eq.codigo_equipo ? (
                              <input value={draft.modelo || ''} onChange={e=>onDraft('modelo', e.target.value)} className="cell-input" />
                            ) : (eq.modelo || '-')}
                          </td>
                        )}
                        {visibleColumns.includes('consecutivo') && (
                          <td>
                            {editingCodigo === eq.codigo_equipo ? (
                              <input value={draft.consecutivo || ''} onChange={e=>onDraft('consecutivo', e.target.value)} className="cell-input" />
                            ) : (eq.consecutivo || '-')}
                          </td>
                        )}
                        {visibleColumns.includes('estado_fisico') && (
                          <td>
                            {editingCodigo === eq.codigo_equipo ? (
                              <select 
                                value={draft.estado_fisico || ''} 
                                onChange={e=>onDraft('estado_fisico', e.target.value)} 
                                className="cell-input"
                              >
                                <option value="">Seleccionar estado</option>
                                {ESTADOS_FISICOS.map(estado => (
                                  <option key={estado} value={estado}>{estado}</option>
                                ))}
                              </select>
                            ) : getEstadoBadge(eq.estado_fisico)}
                          </td>
                        )}
                        {visibleColumns.includes('fecha_adquisicion') && (
                          <td>
                            {editingCodigo === eq.codigo_equipo ? (
                              <input type="date" value={draft.fecha_adquisicion || ''} onChange={e=>onDraft('fecha_adquisicion', e.target.value)} className="cell-input" />
                            ) : formatDate(eq.fecha_adquisicion)}
                          </td>
                        )}
                        {visibleColumns.includes('costo') && (
                          <td>
                            {editingCodigo === eq.codigo_equipo ? (
                              <input type="number" value={draft.costo ?? ''} onChange={e=>onDraft('costo', e.target.value === '' ? null : Number(e.target.value))} className="cell-input" />
                            ) : formatCurrency(eq.costo)}
                          </td>
                        )}
                        {visibleColumns.includes('nombre_ambiente') && (
                          <td>
                            {editingCodigo === eq.codigo_equipo ? (
                              <select 
                                value={draft.id_ambiente || eq.id_ambiente || ''} 
                                onChange={e=>onDraft('id_ambiente', e.target.value)} 
                                className="cell-input"
                              >
                                <option value="">Seleccionar ambiente</option>
                                {(ambientes || []).map(amb => (
                                  <option key={amb.id_ambiente} value={amb.id_ambiente}>
                                    {amb.codigo_ambiente} - {amb.nombre_ambiente}
                                  </option>
                                ))}
                              </select>
                            ) : (eq.nombre_ambiente || '-')}
                          </td>
                        )}
                        {visibleColumns.includes('descripcion') && (
                          <td>
                            {editingCodigo === eq.codigo_equipo ? (
                              <textarea value={draft.descripcion || ''} onChange={e=>onDraft('descripcion', e.target.value)} className="cell-textarea" />
                            ) : (eq.descripcion || '-')}
                          </td>
                        )}
                        {visibleColumns.includes('specs_completas') && (
                          <td>
                            {editingCodigo === eq.codigo_equipo ? (
                              <textarea value={draft.specs_completas || ''} onChange={e=>onDraft('specs_completas', e.target.value)} className="cell-textarea" />
                            ) : (eq.specs_completas || '-')}
                          </td>
                        )}
                        <td className="users-actions">
                          {editingCodigo === eq.codigo_equipo ? (
                            <>
                              <button className="btn btn-verde" type="button" onClick={saveEdit} disabled={loading}>Guardar</button>
                              <button className="btn" type="button" onClick={cancelEdit} disabled={loading}>Cancelar</button>
                            </>
                          ) : (
                            <>
                              <button 
                                className="btn btn-view" 
                                type="button" 
                                onClick={() => navigate(`/equipos/detalle/${eq.codigo_equipo}`)} 
                                disabled={loading}
                                title="Ver detalle completo del equipo"
                                className="consultar-equipo-action-button"
                              >
                                <FiEye size={14} className="consultar-equipo-action-icon" />
                                Ver Detalle
                              </button>
                              <button 
                                className="btn btn-view consultar-equipo-action-button" 
                                type="button" 
                                onClick={() => navigate(`/equipos/historial-verificaciones/${eq.codigo_equipo}`)} 
                                disabled={loading}
                                title="Ver historial de verificaciones"
                              >
                                <FiClock size={14} className="consultar-equipo-action-icon" />
                                Historial
                              </button>
                              {user?.nombre_rol === 'Administrador' && (
                                <>
                                  <button 
                                    className="btn btn-edit consultar-equipo-action-button" 
                                    type="button" 
                                    onClick={() => startEdit(eq)} 
                                    disabled={loading}
                                  >
                                    Editar
                                  </button>
                                  <button 
                                    className="btn btn-delete" 
                                    type="button" 
                                    onClick={() => confirmDelete(eq.codigo_equipo)} 
                                    disabled={loading}
                                  >
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="users-empty">
                <div>
                  <strong>No hay equipos para mostrar</strong>
                  <div className="consultar-equipo-help-text">Busca un equipo por código de inventario o haz clic en "Mostrar todos" para ver todos los equipos.</div>
                </div>
              </div>
            )}
          </div>
          </div>
        </main>
      </div>
    </div>
  )
}
