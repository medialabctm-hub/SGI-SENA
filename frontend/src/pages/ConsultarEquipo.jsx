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
    { key: 'codigo_equipo', label: 'ID Interno', default: false },
    { key: 'tipo', label: 'Tipo', default: false },
    { key: 'modelo', label: 'Modelo', default: true },
    { key: 'consecutivo', label: 'Consecutivo', default: false },
    { key: 'estado_fisico', label: 'Estado', default: true },
    { key: 'fecha_adquisicion', label: 'Fecha Adquisición', default: true },
    { key: 'costo', label: 'Costo', default: true },
    { key: 'nombre_ambiente', label: 'Ambiente', default: true },
    { key: 'codigo_ambiente', label: 'Código Ambiente', default: false },
    { key: 'descripcion', label: 'Descripción', default: true },
    { key: 'specs_completas', label: 'Especificaciones', default: true },
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
      setEquipos([data])
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
    const estados = {
      'Bueno': { color: 'var(--success-800)', bg: 'var(--success-50)' },
      'Regular': { color: '#f59e0b', bg: '#fef3c7' },
      'Malo': { color: '#ef4444', bg: '#fee2e2' },
      'Nuevo': { color: '#3b82f6', bg: '#dbeafe' },
      'En Reparación': { color: '#8b5cf6', bg: '#ede9fe' }
    }
    const estadoInfo = estados[estado] || { color: '#6b7280', bg: '#f3f4f6' }
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
        {estado || '-'}
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
          'ID Interno': eq.codigo_equipo || '-',
          'Tipo': eq.tipo || '-',
          'Modelo': eq.modelo || '-',
          'Consecutivo': eq.consecutivo || '-',
          'Estado': eq.estado_fisico || '-',
          'Fecha Adquisición': eq.fecha_adquisicion ? formatDate(eq.fecha_adquisicion) : '-',
          'Costo': eq.costo ? formatCurrency(eq.costo) : '-',
          'Ambiente': eq.nombre_ambiente || '-',
          'Código Ambiente': eq.codigo_ambiente || '-',
          'Descripción': eq.descripcion || '-',
          'Marca (Especificaciones)': specs.marca,
          'Serial (Especificaciones)': specs.serial,
          'Modelo (Especificaciones)': specs.modelo,
          'Observaciones': specs.observaciones
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
        { wch: 12 }, // ID Interno
        { wch: 18 }, // Tipo
        { wch: 25 }, // Modelo
        { wch: 18 }, // Consecutivo
        { wch: 15 }, // Estado
        { wch: 20 }, // Fecha Adquisición
        { wch: 18 }, // Costo
        { wch: 25 }, // Ambiente
        { wch: 18 }, // Código Ambiente
        { wch: 35 }, // Descripción
        { wch: 20 }, // Marca (Especificaciones)
        { wch: 20 }, // Serial (Especificaciones)
        { wch: 25 }, // Modelo (Especificaciones)
        { wch: 50 }  // Observaciones
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
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Consultar Equipo</h2>
              <div className="search-wrapper">
                <form onSubmit={handleBuscar} style={{display:'flex', gap:'12px', alignItems:'center', flex: 1}}>
                  <div className="search-input-wrapper" style={{flex: 1}}>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Buscar por código de inventario..."
                      value={codigo}
                      onChange={e => setCodigo(e.target.value)}
                    />
                    <span className="search-icon">🔍</span>
                  </div>
                  <button className="btn btn-primary btn-md" type="submit" disabled={loading}>
                    <FiSearch size={16} />
                    {loading ? 'Buscando...' : 'Buscar'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-md" onClick={handleMostrarTodos} disabled={loading}>
                    <FiList size={16} />
                    {loading ? 'Cargando...' : 'Mostrar todos'}
                  </button>
                </form>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-md" 
                  onClick={() => setShowColumnFilter(true)}
                  title="Configurar columnas visibles"
                >
                  <FiSettings size={16} />
                  Columnas
                </button>
                <button type="button" className="btn btn-primary btn-md" onClick={handleDescargarPDF} disabled={loading}>
                  <FiDownload size={16} />
                  Descargar Excel
                </button>
              </div>
            </div>

          {/* Modal de filtro de columnas */}
          {showColumnFilter && (
            <div className="modal-overlay" onClick={() => setShowColumnFilter(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 className="modal-title">Seleccionar Columnas</h3>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setShowColumnFilter(false)}
                  >
                    ×
                  </button>
                </div>
                
                <div className="modal-body">
                  <div style={{display: 'flex', gap: '12px', marginBottom: '20px'}}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setVisibleColumns(allColumns.map(col => col.key))}
                    >
                      Seleccionar Todas
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setVisibleColumns(allColumns.filter(col => col.default).map(col => col.key))}
                    >
                      Restaurar Predeterminadas
                    </button>
                  </div>
                  
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto'}}>
                    {allColumns.map((column) => {
                      const isVisible = visibleColumns.includes(column.key)
                      return (
                        <label
                          key={column.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            borderRadius: '8px',
                            background: isVisible ? 'var(--success-50)' : 'var(--neutral-50)',
                            border: `1px solid ${isVisible ? 'var(--success-200)' : 'var(--neutral-200)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setVisibleColumns([...visibleColumns, column.key])
                              } else {
                                if (visibleColumns.length > 1) {
                                  setVisibleColumns(visibleColumns.filter(key => key !== column.key))
                                } else {
                                  setToast({ message: 'Debe haber al menos una columna visible', type: 'warning' })
                                }
                              }
                            }}
                            style={{width: '18px', height: '18px', cursor: 'pointer'}}
                          />
                          <span style={{flex: 1, fontWeight: isVisible ? '600' : '400', color: isVisible ? 'var(--success-800)' : 'var(--neutral-700)'}}>
                            {column.label}
                          </span>
                          {isVisible ? (
                            <FiCheckSquare size={20} color="var(--success-800)" />
                          ) : (
                            <FiSquare size={20} color="#9ca3af" />
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-md"
                    onClick={() => setShowColumnFilter(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

            <div className="card-body">
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Cargando equipos...</p>
                </div>
              ) : equipos.length > 0 ? (
                <div className="table-wrapper" style={{overflowX:'auto'}}>
                  <table className="table" style={{width:'100%'}}>
                  <thead>
                    <tr>
                      {visibleColumns.includes('codigo_inventario') && <th>Código Inventario</th>}
                      {visibleColumns.includes('codigo_equipo') && <th>ID Interno</th>}
                      {visibleColumns.includes('tipo') && <th>Tipo</th>}
                      {visibleColumns.includes('modelo') && <th>Modelo</th>}
                      {visibleColumns.includes('consecutivo') && <th>Consecutivo</th>}
                      {visibleColumns.includes('estado_fisico') && <th>Estado</th>}
                      {visibleColumns.includes('fecha_adquisicion') && <th>Fecha Adquisición</th>}
                      {visibleColumns.includes('costo') && <th>Costo</th>}
                      {visibleColumns.includes('nombre_ambiente') && <th>Ambiente</th>}
                      {visibleColumns.includes('codigo_ambiente') && <th>Código Ambiente</th>}
                      {visibleColumns.includes('descripcion') && <th>Descripción</th>}
                      {visibleColumns.includes('specs_completas') && <th>Especificaciones</th>}
                      <th style={{width: user?.nombre_rol === 'Administrador' ? '280px' : '120px'}}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map((eq) => (
                      <tr key={eq.codigo_equipo}>
                        {visibleColumns.includes('codigo_inventario') && (
                          <td>{eq.codigo_inventario || '-'}</td>
                        )}
                        {visibleColumns.includes('codigo_equipo') && (
                          <td>{eq.codigo_equipo}</td>
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
                        {visibleColumns.includes('codigo_ambiente') && (
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
                            ) : (eq.codigo_ambiente || '-')}
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
                        <td>
                          <div className="table-actions">
                            {editingCodigo === eq.codigo_equipo ? (
                              <>
                                <button className="btn btn-primary btn-sm" type="button" onClick={saveEdit} disabled={loading}>Guardar</button>
                                <button className="btn btn-secondary btn-sm" type="button" onClick={cancelEdit} disabled={loading}>Cancelar</button>
                              </>
                            ) : (
                              <>
                                <button 
                                  className="table-action-btn" 
                                  type="button" 
                                  onClick={() => navigate(`/equipos/detalle/${eq.codigo_equipo}`)} 
                                  disabled={loading}
                                  title="Ver detalle completo del equipo"
                                >
                                  <FiEye size={14} />
                                </button>
                                <button 
                                  className="table-action-btn" 
                                  type="button" 
                                  onClick={() => navigate(`/equipos/historial-verificaciones/${eq.codigo_equipo}`)} 
                                  disabled={loading}
                                  title="Ver historial de verificaciones"
                                >
                                  <FiClock size={14} />
                                </button>
                                {user?.nombre_rol === 'Administrador' && (
                                  <>
                                    <button 
                                      className="table-action-btn" 
                                      type="button" 
                                      onClick={() => startEdit(eq)} 
                                      disabled={loading}
                                      title="Editar equipo"
                                    >
                                      Editar
                                    </button>
                                    <button 
                                      className="table-action-btn table-action-btn-danger" 
                                      type="button" 
                                      onClick={() => confirmDelete(eq.codigo_equipo)} 
                                      disabled={loading}
                                      title="Eliminar equipo"
                                    >
                                      Eliminar
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon-wrapper">📋</div>
                <h3>No hay equipos para mostrar</h3>
                <p>Busca un equipo por código de inventario o haz clic en "Mostrar todos" para ver todos los equipos.</p>
              </div>
            )}
          </div>
        </div>
        </main>
      </div>
    </div>
  )
}
