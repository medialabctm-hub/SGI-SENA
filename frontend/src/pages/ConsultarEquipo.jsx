import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import { FiDownload, FiSearch, FiList, FiClock } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import '../styles/equipos.css'

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
      fecha_adquisicion: eq.fecha_adquisicion ? String(eq.fecha_adquisicion).slice(0,10) : ''
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
      const payload = { ...draft }
      // normalizar booleanos
      payload.incluye_mouse = !!payload.incluye_mouse
      payload.incluye_teclado = !!payload.incluye_teclado
      payload.incluye_monitor = !!payload.incluye_monitor
      payload.incluye_torre = !!payload.incluye_torre
      // permitir enviar 'ambiente' como texto/código si el usuario lo edita
      if (payload.ambiente && payload.ambiente.trim() === '') delete payload.ambiente

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
      'Bueno': { color: '#10b981', bg: '#d1fae5' },
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
      // Preparar datos para Excel
      const datosExcel = equiposParaExportar.map(eq => ({
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
        'Mouse': eq.incluye_mouse ? 'Sí' : 'No',
        'Teclado': eq.incluye_teclado ? 'Sí' : 'No',
        'Monitor': eq.incluye_monitor ? 'Sí' : 'No',
        'Torre': eq.incluye_torre ? 'Sí' : 'No',
        'Descripción': eq.descripcion || '-',
        'Especificaciones': eq.specs_completas || '-'
      }))

      // Crear workbook
      const wb = XLSX.utils.book_new()
      
      // Crear worksheet desde los datos
      const ws = XLSX.utils.json_to_sheet(datosExcel)
      
      // Ajustar ancho de columnas
      const colWidths = [
        { wch: 18 }, // Código Inventario
        { wch: 12 }, // ID Interno
        { wch: 15 }, // Tipo
        { wch: 20 }, // Modelo
        { wch: 15 }, // Consecutivo
        { wch: 15 }, // Estado
        { wch: 18 }, // Fecha Adquisición
        { wch: 15 }, // Costo
        { wch: 20 }, // Ambiente
        { wch: 18 }, // Código Ambiente
        { wch: 8 },  // Mouse
        { wch: 10 }, // Teclado
        { wch: 10 }, // Monitor
        { wch: 10 }, // Torre
        { wch: 30 }, // Descripción
        { wch: 30 }  // Especificaciones
      ]
      ws['!cols'] = colWidths
      
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
            <h2 style={{margin:0}}>Consultar Equipo</h2>
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              <form onSubmit={handleBuscar} style={{display:'flex', gap:12, alignItems:'center'}}>
                <input
                  type="text"
                  placeholder="Buscar por código de inventario..."
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  className="search-input"
                />
                <button className="btn btn-verde" type="submit" disabled={loading}>
                  <FiSearch size={16} />
                  {loading ? 'Buscando...' : 'Buscar'}
                </button>
                <button type="button" className="btn" onClick={handleMostrarTodos} disabled={loading}>
                  <FiList size={16} />
                  {loading ? 'Cargando...' : 'Mostrar todos'}
                </button>
              </form>
              <button type="button" className="btn btn-verde" onClick={handleDescargarPDF} disabled={loading}>
                <FiDownload size={16} />
                Descargar Excel
              </button>
            </div>
          </div>

          <div style={{marginTop:12}}>
            {loading ? (
              <div>Cargando equipos...</div>
            ) : equipos.length > 0 ? (
              <div style={{overflowX:'auto'}}>
                <table className="users-table" style={{width:'100%'}}>
                  <thead>
                    <tr>
                      <th>Código Inventario</th>
                      <th>ID Interno</th>
                      <th>Tipo</th>
                      {/* <th>Marca</th> -- Eliminado por solicitud */}
                      <th>Modelo</th>
                      <th>Consecutivo</th>
                      <th>Estado</th>
                      <th>Fecha Adquisición</th>
                      <th>Costo</th>
                      <th>Ambiente</th>
                      <th>Código Ambiente</th>
                      <th>Mouse</th>
                      <th>Teclado</th>
                      <th>Monitor</th>
                      <th>Torre</th>
                      <th>Descripción</th>
                      <th>Especificaciones</th>
                      <th style={{width: user?.nombre_rol === 'Administrador' ? '280px' : '120px'}}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map((eq) => (
                      <tr key={eq.codigo_equipo}>
                        <td>{eq.codigo_inventario || '-'}</td>
                        <td>{eq.codigo_equipo}</td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input value={draft.tipo || ''} onChange={e=>onDraft('tipo', e.target.value)} className="cell-input" />
                          ) : (eq.tipo)}
                        </td>
                        {/* Eliminado Marca */}
                        {/* <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input value={draft.marca || ''} onChange={e=>onDraft('marca', e.target.value)} className="cell-input" />
                          ) : (eq.marca || '-')}
                        </td> */}
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input value={draft.modelo || ''} onChange={e=>onDraft('modelo', e.target.value)} className="cell-input" />
                          ) : (eq.modelo || '-')}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input value={draft.consecutivo || ''} onChange={e=>onDraft('consecutivo', e.target.value)} className="cell-input" />
                          ) : (eq.consecutivo || '-')}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input value={draft.estado_fisico || ''} onChange={e=>onDraft('estado_fisico', e.target.value)} className="cell-input" />
                          ) : getEstadoBadge(eq.estado_fisico)}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input type="date" value={draft.fecha_adquisicion || ''} onChange={e=>onDraft('fecha_adquisicion', e.target.value)} className="cell-input" />
                          ) : formatDate(eq.fecha_adquisicion)}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input type="number" value={draft.costo ?? ''} onChange={e=>onDraft('costo', e.target.value === '' ? null : Number(e.target.value))} className="cell-input" />
                          ) : formatCurrency(eq.costo)}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input value={draft.nombre_ambiente || ''} onChange={e=>onDraft('nombre_ambiente', e.target.value)} className="cell-input" placeholder="Nombre ambiente (solo visual)" />
                          ) : (eq.nombre_ambiente || '-')}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input value={draft.ambiente || eq.codigo_ambiente || ''} onChange={e=>onDraft('ambiente', e.target.value)} className="cell-input" placeholder="ID/ Código/ Nombre" />
                          ) : (eq.codigo_ambiente || '-')}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input type="checkbox" checked={!!draft.incluye_mouse} onChange={e=>onDraft('incluye_mouse', e.target.checked)} />
                          ) : (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: eq.incluye_mouse ? '#10b981' : '#6b7280',
                              background: eq.incluye_mouse ? '#d1fae5' : '#f3f4f6',
                              display: 'inline-block'
                            }}>
                              {eq.incluye_mouse ? 'Sí' : 'No'}
                            </span>
                          )}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input type="checkbox" checked={!!draft.incluye_teclado} onChange={e=>onDraft('incluye_teclado', e.target.checked)} />
                          ) : (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: eq.incluye_teclado ? '#10b981' : '#6b7280',
                              background: eq.incluye_teclado ? '#d1fae5' : '#f3f4f6',
                              display: 'inline-block'
                            }}>
                              {eq.incluye_teclado ? 'Sí' : 'No'}
                            </span>
                          )}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input type="checkbox" checked={!!draft.incluye_monitor} onChange={e=>onDraft('incluye_monitor', e.target.checked)} />
                          ) : (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: eq.incluye_monitor ? '#10b981' : '#6b7280',
                              background: eq.incluye_monitor ? '#d1fae5' : '#f3f4f6',
                              display: 'inline-block'
                            }}>
                              {eq.incluye_monitor ? 'Sí' : 'No'}
                            </span>
                          )}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input type="checkbox" checked={!!draft.incluye_torre} onChange={e=>onDraft('incluye_torre', e.target.checked)} />
                          ) : (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: eq.incluye_torre ? '#10b981' : '#6b7280',
                              background: eq.incluye_torre ? '#d1fae5' : '#f3f4f6',
                              display: 'inline-block'
                            }}>
                              {eq.incluye_torre ? 'Sí' : 'No'}
                            </span>
                          )}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <textarea value={draft.descripcion || ''} onChange={e=>onDraft('descripcion', e.target.value)} className="cell-textarea" />
                          ) : (eq.descripcion || '-')}
                        </td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <textarea value={draft.specs_completas || ''} onChange={e=>onDraft('specs_completas', e.target.value)} className="cell-textarea" />
                          ) : (eq.specs_completas || '-')}
                        </td>
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
                                onClick={() => navigate(`/equipos/historial-verificaciones/${eq.codigo_equipo}`)} 
                                disabled={loading}
                                title="Ver historial de verificaciones"
                                style={{ fontSize: '0.85rem', padding: '6px 12px', marginRight: '6px' }}
                              >
                                <FiClock size={14} />
                                Historial
                              </button>
                              {user?.nombre_rol === 'Administrador' && (
                                <>
                                  <button 
                                    className="btn btn-edit" 
                                    type="button" 
                                    onClick={() => startEdit(eq)} 
                                    disabled={loading}
                                    style={{ marginRight: '6px' }}
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
                  <div style={{color:'#666', marginTop:6}}>Busca un equipo por código de inventario o haz clic en "Mostrar todos" para ver todos los equipos.</div>
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
