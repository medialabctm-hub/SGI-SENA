import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Toast from '../components/Toast'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import NotificationsModal from '../components/NotificationsModal'
import Security from './config/Security'
import RolesAreas from './config/RolesAreas'
import Notifications from './config/Notifications'
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
    } else if (section === 'app') {
      setSearchParams({ section: 'security' })
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
          try { localStorage.setItem('user', JSON.stringify(data.user)) } catch {
            // localStorage puede fallar en modo privado o cuando está lleno; ignorar silenciosamente
          }
        }
      } catch { /* ignore */ }
    }
    fetchMe()
  }, [])

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
          {selected === 'tipos-equipo' && <TiposEquipo />}
        </main>
      </div>
      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
    </div>
  )
}