import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import { FiDownload, FiSearch, FiList, FiClock } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
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
    let equiposParaPDF = equipos
    if (equipos.length === 0) {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/equipos', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await parseApiResponse(res, 'No se pudo obtener los equipos para el PDF')
        equiposParaPDF = Array.isArray(data) ? data : []
      } catch (err) {
        setToast({ message: buildErrorMessage(err, 'No se pudo obtener los equipos para el PDF'), type: 'error' })
        setLoading(false)
        return
      } finally {
        setLoading(false)
      }
    }

    if (equiposParaPDF.length === 0) {
      setToast({ message: 'No hay equipos para descargar', type: 'error' })
      return
    }

    try {
      // Validar que jsPDF esté disponible
      if (typeof jsPDF === 'undefined') {
        throw new Error('jsPDF no está disponible. Por favor, recarga la página.')
      }

      // Crear nuevo documento PDF
      const doc = new jsPDF('landscape', 'mm', 'a4')
      
      // Título
      doc.setFontSize(18)
      doc.setTextColor(0, 0, 0)
      doc.text('Reporte de Equipos - SENA', 14, 15)
      
      // Fecha de generación
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      try {
        const fechaGeneracion = new Date().toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        doc.text(`Generado el: ${fechaGeneracion}`, 14, 22)
      } catch (dateErr) {
        doc.text(`Generado el: ${new Date().toISOString().split('T')[0]}`, 14, 22)
      }
      
      // Preparar datos para la tabla
      const tableData = equiposParaPDF.map(eq => {
        // Función auxiliar para truncar texto de forma segura
        const truncateText = (text, maxLength = 30) => {
          if (!text) return '-'
          const textStr = String(text)
          if (textStr.length <= maxLength) return textStr
          return textStr.substring(0, maxLength) + '...'
        }

        return [
          eq.codigo_inventario || '-',
          eq.codigo_equipo || '-',
          eq.tipo || '-',
          // eq.marca || '-', // Eliminado
          eq.modelo || '-',
          eq.consecutivo || '-',
          eq.estado_fisico || '-',
          eq.fecha_adquisicion ? formatDate(eq.fecha_adquisicion) : '-',
          eq.costo ? formatCurrency(eq.costo) : '-',
          eq.nombre_ambiente || '-',
          eq.codigo_ambiente || '-',
          eq.incluye_mouse ? 'Sí' : 'No',
          eq.incluye_teclado ? 'Sí' : 'No',
          eq.incluye_monitor ? 'Sí' : 'No',
          eq.incluye_torre ? 'Sí' : 'No',
          truncateText(eq.descripcion, 30),
          truncateText(eq.specs_completas, 30)
        ]
      })

      // Configurar la tabla
      // jspdf-autotable extiende automáticamente jsPDF con el método autoTable
      // Si no está disponible, puede ser un problema de carga de módulos
      if (typeof doc.autoTable !== 'function') {
        // Intentar cargar dinámicamente como último recurso
        try {
          await import('jspdf-autotable')
          // Esperar un momento para que el módulo se registre
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (err) {
          console.error('Error al cargar autoTable:', err)
        }
        
        // Verificar nuevamente después de la importación dinámica
        if (typeof doc.autoTable !== 'function') {
          throw new Error('La librería autoTable no se cargó correctamente. Por favor, recarga la página completamente (Ctrl+F5) e intenta nuevamente.')
        }
      }

      doc.autoTable({
        startY: 28,
        head: [[
          'Código Inventario',
          'ID Interno',
          'Tipo',
          // 'Marca', // Eliminado
          'Modelo',
          'Consecutivo',
          'Estado',
          'Fecha Adquisición',
          'Costo',
          'Ambiente',
          'Código Ambiente',
          'Mouse',
          'Teclado',
          'Monitor',
          'Torre',
          'Descripción',
          'Especificaciones'
        ]],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [34, 139, 34], // Verde SENA
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7
        },
        bodyStyles: {
          fontSize: 6,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        styles: {
          cellPadding: 2,
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        margin: { top: 28, left: 14, right: 14 },
        pageBreak: 'auto',
        rowPageBreak: 'avoid'
      })

      // Pie de página con total de equipos
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : 28
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.text(`Total de equipos: ${equiposParaPDF.length}`, 14, finalY + 10)

      // Guardar el PDF
      const nombreArchivo = `equipos_sena_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(nombreArchivo)
      
      setToast({ message: `PDF descargado exitosamente: ${nombreArchivo}`, type: 'success' })
    } catch (err) {
      console.error('Error al generar PDF:', err)
      setToast({ message: 'Error al generar el PDF. Por favor, intenta nuevamente.', type: 'error' })
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
                Descargar PDF
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
