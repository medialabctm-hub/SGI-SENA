import React, { useEffect, useState } from 'react'
import Toast from '../components/Toast'
import Header from '../components/Header'
import NotificationsModal from '../components/NotificationsModal'
import Profile from './config/Profile'
import Security from './config/Security'
import UsersManagement from './config/UsersManagement'
import RolesAreas from './config/RolesAreas'
import Notifications from './config/Notifications'
import AppSettings from './config/AppSettings'
import { useNavigate } from 'react-router-dom'

const SIDEBAR = [
  { id: 'profile', label: 'Perfil' },
  { id: 'security', label: 'Seguridad' },
  { id: 'users', label: 'Gestión de Usuarios' },
  { id: 'roles', label: 'Roles y Áreas' },
  { id: 'notifications', label: 'Notificaciones' },
  { id: 'app', label: 'Ajustes de la App' }
]

export default function Config() {
  const nav = useNavigate()
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState('profile')
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    setForm({
      nombre_usuario: user?.nombre_usuario || user?.nombre || '',
      correo: user?.correo || '',
      telefono: user?.telefono || '',
      cedula: user?.cedula || '',
      area: user?.area || ''
    })

    async function fetchMe() {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        if (data?.user) {
          setUser(data.user)
          setForm({
            nombre_usuario: data.user.nombre_usuario || '',
            correo: data.user.correo || '',
            telefono: data.user.telefono || '',
            cedula: data.user.cedula || '',
            area: data.user.area || ''
          })
          try { localStorage.setItem('user', JSON.stringify(data.user)) } catch {}
        }
      } catch (err) { }
    }
    fetchMe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onChange(e) { const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value })) }

  async function handleSave(e) {
    e && e.preventDefault && e.preventDefault()
    if (!form.nombre_usuario || !form.correo || !form.cedula || !form.telefono) {
      setToast({ message: 'Por favor completa los campos obligatorios.', type: 'error' })
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No autorizado')
      const id = user?.id_usuario || user?.id
      if (!id) throw new Error('ID de usuario no disponible')
      const res = await fetch(`/api/auth/user/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre: form.nombre_usuario, correo: form.correo, telefono: form.telefono, cedula: form.cedula, rol: user?.nombre_rol || 'Aprendiz' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || data?.message || 'Error al actualizar')
      const updated = { ...user, nombre_usuario: form.nombre_usuario, correo: form.correo, telefono: form.telefono, cedula: form.cedula, area: form.area }
      setUser(updated)
      try { localStorage.setItem('user', JSON.stringify(updated)) } catch {}
      setToast({ message: data?.message || 'Usuario actualizado', type: 'success' })
      setEditing(false)
    } catch (err) {
      setToast({ message: err.message || 'Error al actualizar', type: 'error' })
    } finally { setLoading(false) }
  }

  function SectionSidebar() {
    return (
      <div className="sidebar" style={{width:240}}>
        {SIDEBAR.map(s => (
          <div key={s.id} className={`big-card ${selected===s.id? 'active-card':''}`} style={{marginBottom:12, cursor:'pointer'}} onClick={() => setSelected(s.id)}>
            <div style={{fontWeight:700}}>{s.label}</div>
          </div>
        ))}
      </div>
    )
  }

  function ProfilePanel() {
    return (
      <div className="form-equipos" style={{maxWidth:900}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <div>
            <div style={{fontSize:18, fontWeight:700}}>Información del usuario</div>
            <div style={{color:'#666', fontSize:13}}>Aquí puedes revisar y editar tu información de perfil.</div>
          </div>
          <div style={{display:'flex', gap:12}}>
            {!editing ? (
              <button className="btn-verde" onClick={() => setEditing(true)} style={{width:'auto', padding:'0.45rem 1rem'}}>Editar</button>
            ) : (
              <>
                <button className="btn-verde" onClick={handleSave} disabled={loading} style={{padding:'0.45rem 1rem'}}>{loading ? 'Guardando...' : 'Guardar'}</button>
                <button className="btn" onClick={() => { setEditing(false); setForm({ nombre_usuario: user?.nombre_usuario || '', correo: user?.correo || '', telefono: user?.telefono || '', cedula: user?.cedula || '', area: user?.area || '' }) }} style={{background:'#eee', color:'#222'}}>Cancelar</button>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-row">
              <label>Nombre completo</label>
              <input name="nombre_usuario" value={form.nombre_usuario || ''} onChange={onChange} readOnly={!editing} />
            </div>
            <div className="form-row">
              <label>Correo electrónico</label>
              <input name="correo" value={form.correo || ''} onChange={onChange} readOnly={!editing} />
            </div>
            <div className="form-row">
              <label>Teléfono</label>
              <input name="telefono" value={form.telefono || ''} onChange={onChange} readOnly={!editing} />
            </div>
            <div className="form-row">
              <label>Cédula</label>
              <input name="cedula" value={form.cedula || ''} onChange={onChange} readOnly={!editing} />
            </div>
            <div className="form-row">
              <label>Área</label>
              <input name="area" value={form.area || ''} onChange={onChange} readOnly={!editing} />
            </div>
            <div className="form-row">
              <label>Rol</label>
              <input value={user?.nombre_rol || ''} readOnly />
            </div>
          </div>
        </form>
      </div>
    )
  }

  function SecurityPanel() {
    const [current, setCurrent] = useState('')
    const [newPass, setNewPass] = useState('')
    const [confirm, setConfirm] = useState('')
    async function changePassword(e) {
      e.preventDefault()
      if (!current || !newPass) return setToast({ message: 'Completa los campos', type: 'error' })
      if (newPass !== confirm) return setToast({ message: 'Las contraseñas no coinciden', type: 'error' })
      // En este backend no hay endpoint para cambiar contraseña; mostrar aviso
      setToast({ message: 'Funcionalidad de cambio de contraseña requiere endpoint en backend.', type: 'info' })
    }
    return (
      <div className="form-equipos" style={{maxWidth:700}}>
        <h3>Cambiar contraseña</h3>
        <form onSubmit={changePassword}>
          <div className="form-grid">
            <div className="form-row"><label>Contraseña actual</label><input type="password" value={current} onChange={e=>setCurrent(e.target.value)} /></div>
            <div className="form-row"><label>Nueva contraseña</label><input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} /></div>
            <div className="form-row"><label>Confirmar nueva</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} /></div>
          </div>
          <div style={{marginTop:12}}>
            <button className="btn-verde" type="submit">Actualizar contraseña</button>
          </div>
        </form>
      </div>
    )
  }

  function UsersPanel() {
    return (
      <div className="form-equipos" style={{maxWidth:900}}>
        <h3>Gestión de Usuarios</h3>
        <p style={{color:'#666'}}>Accede al listado de usuarios para crear, editar o inactivar cuentas.</p>
        <div style={{marginTop:12}}>
          <button className="btn-verde" onClick={() => nav('/usuarios')}>Ir a Usuarios</button>
        </div>
      </div>
    )
  }

  function Placeholder({title, children}) {
    return (
      <div className="form-equipos" style={{maxWidth:900}}>
        <h3>{title}</h3>
        <div style={{color:'#666'}}>{children}</div>
      </div>
    )
  }

  return (
    <div className="page simple-page config-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header onOpenNotifications={() => setShowNotifications(true)} />
      <div style={{display:'flex', gap:20, marginTop:12}}>
        <SectionSidebar />
        <div style={{flex:1}}>
          <h2 style={{textAlign:'center', marginTop: 6}}>Configuración</h2>
          {selected==='profile' && <Profile />}
          {selected==='security' && <Security />}
          {selected==='users' && <UsersManagement />}
          {selected==='roles' && <RolesAreas />}
          {selected==='notifications' && <Notifications />}
          {selected==='app' && <AppSettings />}
        </div>
      </div>
      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
    </div>
  )
}