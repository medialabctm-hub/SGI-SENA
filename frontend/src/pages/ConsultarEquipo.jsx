import React, { useState } from 'react'
import Header from '../components/Header'
import '../styles/equipos.css'

export default function ConsultarEquipo() {
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [equipos, setEquipos] = useState([])
  const [editingCodigo, setEditingCodigo] = useState(null)
  const [draft, setDraft] = useState({})

  async function handleBuscar(e) {
    e.preventDefault()
    setError('')
    setEquipos([])
    if (!codigo) { setError('Ingrese el código del equipo'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigo)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'No se pudo consultar el equipo')
        setEquipos([])
      } else {
        setEquipos([data])
      }
    } catch {
      setError('Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  async function handleMostrarTodos() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/equipos')
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'No se pudo listar los equipos')
        setEquipos([])
      } else {
        setEquipos(Array.isArray(data) ? data : [])
      }
    } catch {
      setError('Error de conexión con el servidor')
      setEquipos([])
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
    setError('')
    try {
      const payload = { ...draft }
      // normalizar booleanos
      payload.incluye_mouse = !!payload.incluye_mouse
      payload.incluye_teclado = !!payload.incluye_teclado
      payload.incluye_monitor = !!payload.incluye_monitor
      payload.incluye_torre = !!payload.incluye_torre
      // permitir enviar 'ambiente' como texto/código si el usuario lo edita
      if (payload.ambiente && payload.ambiente.trim() === '') delete payload.ambiente

      const res = await fetch(`/api/equipos/${encodeURIComponent(editingCodigo)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'No se pudo actualizar el equipo')
        return
      }
      // actualizar lista local
      setEquipos(prev => prev.map(eq => eq.codigo_equipo === editingCodigo ? {
        ...eq,
        ...draft,
        fecha_adquisicion: draft.fecha_adquisicion || eq.fecha_adquisicion
      } : eq))
      cancelEdit()
    } catch {
      setError('Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(codigoEq) {
    if (!window.confirm(`¿Eliminar equipo ${codigoEq}? Esta acción no se puede deshacer.`)) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigoEq)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'No se pudo eliminar el equipo')
        return
      }
      setEquipos(prev => prev.filter(eq => eq.codigo_equipo !== codigoEq))
      if (editingCodigo === codigoEq) cancelEdit()
    } catch {
      setError('Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  

  return (
    <div className="page simple-page">
      <Header />
      <main className="container">
        <div className="users-panel consulta-panel">
          <div className="users-toolbar">
            <h2 style={{ margin: 0 }}>Consultar Equipo</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Código de inventario"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                className="search-input"
              />
              <button className="btn primary" type="button" onClick={handleBuscar} disabled={loading}>
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
              <button type="button" className="btn" onClick={handleMostrarTodos} disabled={loading}>
                {loading ? 'Cargando...' : 'Mostrar todos'}
              </button>
            </div>
          </div>

          {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

          <div style={{ marginTop: 12 }}>
            {equipos.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="users-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th className="sticky-col">Código</th>
                      <th>Tipo</th>
                      <th>Marca</th>
                      <th>Modelo</th>
                      <th>N° Serie</th>
                      <th>Estado</th>
                      <th>Fecha Adquisición</th>
                      <th>Costo</th>
                      <th>Ambiente</th>
                      <th>Código Ambiente</th>
                      <th>Vida útil (meses)</th>
                      <th>Mouse</th>
                      <th>Teclado</th>
                      <th>Monitor</th>
                      <th>Torre</th>
                      <th>Descripción</th>
                      <th>Especificaciones</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map((eq) => (
                      <tr key={eq.codigo_equipo}>
                        <td className="sticky-col">{eq.codigo_equipo}</td>
                        <td>
                          {editingCodigo === eq.codigo_equipo ? (
                            <input value={draft.tipo || ''} onChange={e => onDraft('tipo', e.target.value)} className="cell-input" />
                          ) : (eq.tipo)}
                        </td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input value={draft.marca || ''} onChange={e => onDraft('marca', e.target.value)} className="cell-input" />
                        ) : (eq.marca || '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input value={draft.modelo || ''} onChange={e => onDraft('modelo', e.target.value)} className="cell-input" />
                        ) : (eq.modelo || '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input value={draft.numero_serie || ''} onChange={e => onDraft('numero_serie', e.target.value)} className="cell-input" />
                        ) : (eq.numero_serie || '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input value={draft.estado_fisico || ''} onChange={e => onDraft('estado_fisico', e.target.value)} className="cell-input" />
                        ) : (eq.estado_fisico || '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input type="date" value={draft.fecha_adquisicion || ''} onChange={e => onDraft('fecha_adquisicion', e.target.value)} className="cell-input" />
                        ) : (eq.fecha_adquisicion || '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input type="number" value={draft.costo ?? ''} onChange={e => onDraft('costo', e.target.value === '' ? null : Number(e.target.value))} className="cell-input" />
                        ) : (eq.costo ?? '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input value={draft.nombre_ambiente || ''} onChange={e => onDraft('nombre_ambiente', e.target.value)} className="cell-input" placeholder="Nombre ambiente (solo visual)" />
                        ) : (eq.nombre_ambiente || '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input value={draft.ambiente || eq.codigo_ambiente || ''} onChange={e => onDraft('ambiente', e.target.value)} className="cell-input" placeholder="ID/ Código/ Nombre" />
                        ) : (eq.codigo_ambiente || '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input type="number" value={draft.vida_util_meses ?? ''} onChange={e => onDraft('vida_util_meses', e.target.value === '' ? null : Number(e.target.value))} className="cell-input" />
                        ) : (eq.vida_util_meses ?? '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input type="checkbox" checked={!!draft.incluye_mouse} onChange={e => onDraft('incluye_mouse', e.target.checked)} />
                        ) : (eq.incluye_mouse ? 'Sí' : 'No')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input type="checkbox" checked={!!draft.incluye_teclado} onChange={e => onDraft('incluye_teclado', e.target.checked)} />
                        ) : (eq.incluye_teclado ? 'Sí' : 'No')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input type="checkbox" checked={!!draft.incluye_monitor} onChange={e => onDraft('incluye_monitor', e.target.checked)} />
                        ) : (eq.incluye_monitor ? 'Sí' : 'No')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <input type="checkbox" checked={!!draft.incluye_torre} onChange={e => onDraft('incluye_torre', e.target.checked)} />
                        ) : (eq.incluye_torre ? 'Sí' : 'No')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <textarea value={draft.descripcion || ''} onChange={e => onDraft('descripcion', e.target.value)} className="cell-textarea" />
                        ) : (eq.descripcion || '-')}</td>
                        <td>{editingCodigo === eq.codigo_equipo ? (
                          <textarea value={draft.specs_completas || ''} onChange={e => onDraft('specs_completas', e.target.value)} className="cell-textarea" />
                        ) : (eq.specs_completas || '-')}</td>
                        <td className="users-actions">
                          {editingCodigo === eq.codigo_equipo ? (
                            <>
                              <button className="btn-verde" type="button" onClick={saveEdit} disabled={loading}>Guardar</button>
                              <button className="btn" type="button" onClick={cancelEdit} disabled={loading}>Cancelar</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-edit" type="button" onClick={() => startEdit(eq)} disabled={loading}>Editar</button>
                              <button className="btn-delete" type="button" onClick={() => handleDelete(eq.codigo_equipo)} disabled={loading}>Eliminar</button>
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
                  <div style={{color:'#666', marginTop:6}}>Busca por código o presiona "Mostrar todos" para listar.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
