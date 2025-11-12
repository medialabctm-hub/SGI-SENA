import React, { useState } from 'react'
import { FiBell, FiLogOut, FiUser, FiHome, FiSettings, FiUsers, FiMonitor } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import logo from '/public/images/logoSena.png'
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import PerfilModal from './PerfilModal';

export default function Header({ onOpenNotifications }) {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'))
  const [toast, setToast] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showPerfil, setShowPerfil] = useState(false)
  const nav = useNavigate()

  function handleLogout() {
    setShowConfirm(true)
  }
  function confirmLogout() {
    setShowConfirm(false)
    localStorage.removeItem('token');
    setToast({ message: 'Sesión cerrada correctamente', type: 'success' })
    setTimeout(() => { window.location.href = '/login' }, 1200)
  }
  function cancelLogout() {
    setShowConfirm(false)
  }

  function go(ruta) {
    nav(ruta)
  }

  async function handleOpenPerfil() {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.user) {
          setUser(data.user)
          try { localStorage.setItem('user', JSON.stringify(data.user)) } catch {}
        }
      }
    } catch (err) {
      // Silencioso: si falla seguimos mostrando lo que haya en localStorage
    }
    setShowPerfil(true)
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal open={showConfirm} message="¿Seguro que deseas cerrar sesión?" onConfirm={confirmLogout} onCancel={cancelLogout} />
      <PerfilModal open={showPerfil} user={user} onClose={() => setShowPerfil(false)} />
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo"><img src={logo} alt="logo" /></div>
          <div className="app-title">
            <div className="name">Gestión de Equipos</div>
            <div className="sub">SENA</div>
          </div>
        </div>
        <nav className="header-nav">
          <button className="nav-btn" onClick={() => go('/dashboard')} title="Inicio"><FiHome /> <span>Inicio</span></button>
          <button className="nav-btn" onClick={() => go('/equipos')} title="Equipos"><FiMonitor /> <span>Equipos</span></button>
          <button className="nav-btn" onClick={() => go('/usuarios')} title="Usuarios"><FiUsers /> <span>Usuarios</span></button>
          <button className="nav-btn" onClick={() => go('/config')} title="Configuración"><FiSettings /> <span>Config</span></button>
        </nav>
        <div className="header-right">
          <button className="icon-btn" onClick={onOpenNotifications} aria-label="notificaciones"><FiBell /><span className="badge">3</span></button>
          <button className="icon-btn" onClick={handleOpenPerfil} aria-label="perfil"><FiUser /></button>
          <button className="icon-btn" onClick={handleLogout} aria-label="cerrar sesión"><FiLogOut /></button>
        </div>
      </header>
    </>
  )
}
