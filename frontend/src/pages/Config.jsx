import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Toast from '../components/Toast'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import NotificationsModal from '../components/NotificationsModal'
import Security from './config/Security'
import RolesAreas from './config/RolesAreas'
import Notifications from './config/Notifications'
import AppSettings from './config/AppSettings'
import InvitationCodes from './config/InvitationCodes'
import TiposEquipo from './config/TiposEquipo'
import { useNavigate } from 'react-router-dom'
import '../styles/pages/config.css'
import '../styles/pages/equipos.css'

export default function Config() {
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })
  const [toast, setToast] = useState(null)
  const selected = searchParams.get('section') || 'security'
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    const section = searchParams.get('section')
    if (!section) {
      setSearchParams({ section: 'security' })
    } else if (section === 'profile') {
      nav('/perfil')
    }
  }, [searchParams, setSearchParams, nav])

  useEffect(() => {
    async function fetchMe() {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        if (data?.user) {
          setUser(data.user)
          try { localStorage.setItem('user', JSON.stringify(data.user)) } catch (e) {
            // localStorage puede fallar en modo privado o cuando está lleno; ignorar silenciosamente
          }
        }
      } catch (err) { /* ignore */ }
    }
    fetchMe()
  }, [])

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
            <div className="form-row"><label>Contraseña actual</label><input type="password" value={current} onChange={e => setCurrent(e.target.value)} /></div>
            <div className="form-row"><label>Nueva contraseña</label><input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} /></div>
            <div className="form-row"><label>Confirmar nueva</label><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
          </div>
          <div className="config-security-submit">
            <button className="btn-verde" type="submit">Actualizar contraseña</button>
          </div>
        </form>
      </div>
    )
  }


  function Placeholder({ title, children }) {
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
          {selected === 'security' && <Security />}
          {selected === 'invitation-codes' && <InvitationCodes />}
          {selected === 'roles' && <RolesAreas />}
          {selected === 'notifications' && <Notifications />}
          {selected === 'app' && <AppSettings />}
          {selected === 'tipos-equipo' && <TiposEquipo />}
        </main>
      </div>
      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
    </div>
  )
}