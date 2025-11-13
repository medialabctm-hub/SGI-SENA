import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function Usuarios() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [viewUser, setViewUser] = useState(null)
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState({ nombre: '', cedula: '', correo: '', telefono: '', area: '', rol: 'Aprendiz', contrasena: '' })
  const [confirm, setConfirm] = useState({ open: false, id: null })
  const [currentUser, setCurrentUser] = useState(null)

  // Obtener rol del usuario actual
  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        setCurrentUser(JSON.parse(userData))
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [])

  const isAdmin = currentUser?.nombre_rol === 'Administrador'
  const isInstructor = currentUser?.nombre_rol === 'Instructor'

  // deletion handler: calls API to delete the user stored in `confirm.id` and updates UI
  async function doDelete() {
    const id = confirm.id
    setConfirm({ open: false, id: null })
    if (!id) {
      setToast({ message: 'No se seleccionó usuario', type: 'error' })
      return
    }
    try {
      setLoading(true)
      const res = await fetch(`/api/auth/user/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
      const data = await parseApiResponse(res, 'No se pudo eliminar el usuario')
      setUsers(prev => prev.filter(u => u.id_usuario !== id))
      setToast({ message: data.message || 'Usuario eliminado', type: 'success' })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo eliminar el usuario'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const displayedUsers = users.filter(u => {
    if (!query) return true
    const q = query.toLowerCase()
    return (u.nombre_usuario || '').toLowerCase().includes(q) || (u.cedula || '').toLowerCase().includes(q) || (u.nombre_rol || '').toLowerCase().includes(q) || (u.area || '').toLowerCase().includes(q)
  })

  function getAuthHeaders() {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
  }

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/users', { headers: getAuthHeaders() })
      const data = await parseApiResponse(res, 'No se pudo obtener el listado de usuarios')
      setUsers(data)
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo obtener el listado de usuarios'), type: 'error' })
    } finally { setLoading(false) }
  }

  // Creation disabled: this app section only edits existing users

  function openEdit(u) {
    // fetch latest details before editing to ensure data is current
    (async () => {
      try {
        const res = await fetch(`/api/auth/user/${u.id_usuario}`, { headers: getAuthHeaders() })
        const data = await parseApiResponse(res, 'No se pudo obtener usuario')
        const user = data.user || data
        setEditingUser(user)
        setForm({ nombre: user.nombre_usuario || '', cedula: user.cedula || '', correo: user.correo || '', telefono: user.telefono || '', area: user.area || '', rol: user.nombre_rol || 'Aprendiz', contrasena: '' })
        setShowForm(true)
      } catch (err) {
        setToast({ message: buildErrorMessage(err, 'No se pudo cargar la información del usuario'), type: 'error' })
      }
    })()
  }

  async function submitForm(e) {
    e && e.preventDefault && e.preventDefault()
    try {
      if (!editingUser) {
        setToast({ message: 'Selecciona primero un usuario para editar', type: 'error' })
        return
      }
      // update only
      const res = await fetch(`/api/auth/user/${editingUser.id_usuario}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ nombre: form.nombre, cedula: form.cedula, correo: form.correo, telefono: form.telefono, rol: form.rol }) })
      const data = await parseApiResponse(res, 'No se pudo actualizar el usuario')
      setToast({ message: data.message || 'Usuario actualizado', type: 'success' })
      setShowForm(false)
      fetchUsers()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo actualizar el usuario'), type: 'error' })
    }
  }

  // deletion disabled for this view-only admin panel

  async function openView(u) {
    try {
      const res = await fetch(`/api/auth/user/${u.id_usuario}`, { headers: getAuthHeaders() })
      const data = await parseApiResponse(res, 'No se pudo obtener detalle')
      setViewUser(data)
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo obtener detalle del usuario'), type: 'error' })
    }
  }

  return (
    <div className="page simple-page">
      <Header />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <main className="container">
        <div className="users-panel">
          <div className="users-toolbar">
            <h2 style={{margin:0}}>Usuarios</h2>
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              <input className="search-input" placeholder="Buscar por nombre, cédula, rol o área..." value={query} onChange={e=>setQuery(e.target.value)} />
            </div>
          </div>

          <div style={{marginTop:12}}>
            {loading ? <div>Cargando usuarios...</div> : (
              displayedUsers.length ? (
                <div style={{overflowX:'auto'}}>
                  <table className="users-table" style={{width:'100%'}}>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Cédula</th>
                        <th>Rol</th>
                        <th>Área</th>
                        <th>Equipos</th>
                        <th style={{width:180}}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedUsers.map(u => (
                        <tr key={u.id_usuario}>
                          <td>{u.nombre_usuario}</td>
                          <td>{u.cedula}</td>
                          <td>{u.nombre_rol}</td>
                          <td>{u.area}</td>
                          <td><span className="equip-count">{u.equipos_asignados || 0}</span></td>
                          <td className="users-actions">
                            <button className="btn btn-view" onClick={() => openView(u)}>Ver</button>
                            {/* Editar y Eliminar: Solo Administrador */}
                            {isAdmin && (
                              <>
                                <button className="btn btn-edit" onClick={() => openEdit(u)}>Editar</button>
                                <button className="btn btn-delete" onClick={() => setConfirm({ open: true, id: u.id_usuario })}>Eliminar</button>
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
                    <strong>No hay usuarios para mostrar</strong>
                    <div style={{color:'#666', marginTop:6}}>No se encontraron registros. Si los usuarios se registraron vía la aplicación, revisa la base de datos o el proceso de registro.</div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </main>

      {/* View modal */}
      {viewUser && (
        <div className="modal-overlay">
          <div className="modal-sheet" style={{maxWidth:800}}>
            <div className="form-equipos">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{margin:0}}>Detalle: {viewUser.user.nombre_usuario}</h3>
                <button className="btn" onClick={() => setViewUser(null)}>Cerrar</button>
              </div>
              <div style={{marginTop:12}}>
                <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap:12}}>
                  <div><strong>Cédula:</strong> {viewUser.user.cedula}</div>
                  <div><strong>Rol:</strong> {viewUser.user.nombre_rol}</div>
                  <div><strong>Correo:</strong> {viewUser.user.correo}</div>
                  <div><strong>Teléfono:</strong> {viewUser.user.telefono}</div>
                  <div><strong>Área:</strong> {viewUser.user.area}</div>
                </div>
              </div>
              <hr />
              <h4>Equipos asignados</h4>
              {viewUser.equipos && viewUser.equipos.length ? (
                <table className="users-table" style={{width:'100%'}}>
                  <thead><tr><th>Equipo</th><th>Serie</th><th>Ambiente</th><th>Asignado (días)</th></tr></thead>
                  <tbody>
                    {viewUser.equipos.map(eq => (
                      <tr key={eq.codigo_equipo}><td style={{padding:8}}>{eq.tipo} {eq.marca} {eq.modelo}</td><td>{eq.numero_serie}</td><td>{eq.nombre_ambiente}</td><td>{eq.dias_asignado}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : (<div>No hay equipos asignados</div>)}
            </div>
          </div>
        </div>
      )}

      {/* Form modal add/edit */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-sheet" style={{maxWidth:520}}>
            <div className="form-equipos">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{margin:0}}>Editar usuario</h3>
                <button className="btn" onClick={() => setShowForm(false)}>Cerrar</button>
              </div>
              <form onSubmit={submitForm} style={{marginTop:12}}>
                <div className="form-grid">
                  <div className="form-row">
                    <label>Nombre completo</label>
                    <input value={form.nombre} onChange={e => setForm(prev=>({ ...prev, nombre: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label>Cédula</label>
                    <input value={form.cedula} onChange={e => setForm(prev=>({ ...prev, cedula: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label>Correo</label>
                    <input value={form.correo} onChange={e => setForm(prev=>({ ...prev, correo: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label>Teléfono</label>
                    <input value={form.telefono} onChange={e => setForm(prev=>({ ...prev, telefono: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label>Área</label>
                    <input value={form.area} onChange={e => setForm(prev=>({ ...prev, area: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label>Rol</label>
                    <select value={form.rol} onChange={e => setForm(prev=>({ ...prev, rol: e.target.value }))}>
                      <option>Administrador</option>
                      <option>Instructor</option>
                      <option>Aprendiz</option>
                    </select>
                  </div>
                  {/* No se permite crear usuarios aquí; edición solamente. */}
                </div>
                <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
                  <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button className="btn-verde" type="submit">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={confirm.open} message="¿Eliminar este usuario?" onConfirm={doDelete} onCancel={() => setConfirm({ open:false, id:null })} />
    </div>
  )
}
