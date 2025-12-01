import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Toast from '../components/Toast'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import NotificationsModal from '../components/NotificationsModal'
import Profile from './config/Profile'
import Security from './config/Security'
import RolesAreas from './config/RolesAreas'
import Notifications from './config/Notifications'
import AppSettings from './config/AppSettings'
import InvitationCodes from './config/InvitationCodes'
import { useNavigate } from 'react-router-dom'
import '../styles/config.css'

export default function Config() {
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)
  const selected = searchParams.get('section') || 'profile'
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    // Si no hay sección seleccionada, redirigir a profile por defecto
    if (!searchParams.get('section')) {
      setSearchParams({ section: 'profile' })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    setForm({
      nombre_usuario: user?.nombre_usuario || user?.nombre || '',
      correo: user?.correo || '',
      telefono: user?.telefono || '',
      cedula: user?.cedula || ''
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
            cedula: data.user.cedula || ''
          })
          try { localStorage.setItem('user', JSON.stringify(data.user)) } catch (e) {
            // localStorage puede fallar en modo privado o cuando está lleno; ignorar silenciosamente
          }
        }
      } catch (err) { /* ignore */ }
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
      const updated = { ...user, nombre_usuario: form.nombre_usuario, correo: form.correo, telefono: form.telefono, cedula: form.cedula }
      setUser(updated)
      try { localStorage.setItem('user', JSON.stringify(updated)) } catch (e) {
        // localStorage puede fallar en modo privado o cuando está lleno; ignorar silenciosamente
      }
      setToast({ message: data?.message || 'Usuario actualizado', type: 'success' })
      setEditing(false)
    } catch (err) {
      setToast({ message: err.message || 'Error al actualizar', type: 'error' })
    } finally { setLoading(false) }
  }


  function ProfilePanel() {
    return (
      <div className="form-equipos config-profile-container">
        <div className="config-profile-header">
          <div>
            <div className="config-profile-title">Información del usuario</div>
            <div className="config-profile-subtitle">Aquí puedes revisar y editar tu información de perfil.</div>
          </div>
          <div className="config-profile-actions">
            {!editing ? (
              <button className="btn-verde config-profile-edit-btn" onClick={() => setEditing(true)}>Editar</button>
            ) : (
              <>
                <button className="btn-verde config-profile-save-btn" onClick={handleSave} disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
                <button className="btn config-profile-cancel-btn" onClick={() => { setEditing(false); setForm({ nombre_usuario: user?.nombre_usuario || '', correo: user?.correo || '', telefono: user?.telefono || '', cedula: user?.cedula || '' }) }}>Cancelar</button>
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
      <div className="form-equipos config-security-container">
        <h3>Cambiar contraseña</h3>
        <form onSubmit={changePassword}>
          <div className="form-grid">
            <div className="form-row"><label>Contraseña actual</label><input type="password" value={current} onChange={e=>setCurrent(e.target.value)} /></div>
            <div className="form-row"><label>Nueva contraseña</label><input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} /></div>
            <div className="form-row"><label>Confirmar nueva</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} /></div>
          </div>
          <div className="config-security-submit">
            <button className="btn-verde" type="submit">Actualizar contraseña</button>
          </div>
        </form>
      </div>
    )
  }


  function Placeholder({title, children}) {
    return (
      <div className="form-equipos config-placeholder-container">
        <h3>{title}</h3>
        <div className="config-placeholder-content">{children}</div>
      </div>
    )
  }

  return (
    <div className="page simple-page config-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header onOpenNotifications={() => setShowNotifications(true)} />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          <h2 className="config-page-title">Configuración</h2>
          {selected==='profile' && <Profile />}
          {selected==='security' && <Security />}
          {selected==='invitation-codes' && <InvitationCodes />}
          {selected==='roles' && <RolesAreas />}
          {selected==='notifications' && <Notifications />}
          {selected==='app' && <AppSettings />}
        </main>
      </div>
      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
    </div>
  )
}