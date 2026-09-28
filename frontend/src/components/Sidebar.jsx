import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  FiSearch,
  FiUsers,
  FiSettings,
  FiAlertCircle,
  FiPackage,
  FiTool,
  FiChevronDown,
  FiChevronRight,
  FiHome,
  FiMapPin,
  FiUser,
  FiShield,
  FiKey,
  FiBell,
  FiCalendar,
  FiClipboard,
  FiMonitor
} from 'react-icons/fi'
import { useSidebar } from '../contexts/SidebarContext'
import { useBlockedNavigate } from '../hooks/useBlockedNavigate'
import '../styles/layout/sidebar.css'

export default function Sidebar({ user }) {
  const { isOpen, closeSidebar } = useSidebar()
  const nav = useBlockedNavigate()
  const location = useLocation()
  const userRole = user?.nombre_rol || ''

  // Estado de menús expandidos
  const [expandedMenus, setExpandedMenus] = useState({
    equipos: false,
    ambientesHorarios: false,
    config: false
  })

  // Contador de solicitudes pendientes de autorizar (para badge en menú)
  const [pendientesAutorizacion, setPendientesAutorizacion] = useState(0)
  useEffect(() => {
    if (user?.nombre_rol !== 'Administrador' && user?.nombre_rol !== 'Cuentadante') return
    const hasSession = localStorage.getItem('user');
    if (!hasSession) return
    fetch('/api/equipos/autorizacion-movimiento/pendientes/count', {
      credentials: 'include'
    })
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setPendientesAutorizacion(d?.count ?? 0))
      .catch(() => setPendientesAutorizacion(0))
  }, [user?.nombre_rol])

  // Expandir automáticamente el menú correspondiente según la ruta actual
  useEffect(() => {
    const path = location.pathname
    
    // Determinar qué menú debe estar expandido basándose en la ruta
    // Solo expandir el menú correspondiente y colapsar los demás
    if (path.startsWith('/equipos') || path.startsWith('/mis-equipos') || path.startsWith('/asignaciones') || path.startsWith('/novedades') || path.startsWith('/reportes') || path.startsWith('/mantenimientos')) {
      setExpandedMenus({
        equipos: true,
        ambientesHorarios: false,
        config: false
      })
    } else if (path.startsWith('/ambientes') || path.startsWith('/horarios') || path.startsWith('/clases')) {
      setExpandedMenus({
        equipos: false,
        ambientesHorarios: true,
        config: false
      })
    } else if (path.startsWith('/usuarios') || path.startsWith('/aprendices') || path.startsWith('/config')) {
      setExpandedMenus({
        equipos: false,
        ambientesHorarios: false,
        config: true
      })
    }
  }, [location.pathname])

  const toggleMenu = (menu) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }))
  }

  const isActive = (path) => {
    const currentPath = location.pathname;
    if (path.includes('#')) return currentPath === path.split('#')[0]
    if (path === '/equipos/consultar') {
      return ['/equipos', '/mis-equipos', '/asignaciones'].includes(currentPath)
        || currentPath === path
        || currentPath.startsWith('/equipos/detalle/')
        || currentPath.startsWith('/equipos/verificar')
    }
    
    if (path.includes('?')) {
      const [basePath, query] = path.split('?')
      if (currentPath === basePath) {
        const urlParams = new URLSearchParams(location.search)
        const pathParams = new URLSearchParams(query)
        return urlParams.get('section') === pathParams.get('section')
      }
    }
    return currentPath === path
  }

  const menuItems = {
    equipos: [
      { title: 'Equipos', path: '/equipos/consultar', icon: <FiSearch />, roles: ['all'] },
      { title: 'Equipos prestados', path: '/equipos/prestados', icon: <FiMonitor />, roles: ['Administrador', 'Instructor', 'Cuentadante'] },
      { title: 'Autorizaciones', path: '/equipos/autorizaciones#pendientes', icon: <FiClipboard />, roles: ['Administrador', 'Instructor', 'Cuentadante'] },
      { title: 'Novedades y reportes', path: '/novedades', icon: <FiAlertCircle />, roles: ['Administrador', 'Instructor', 'Cuentadante'] },
      { title: 'Mantenimientos', path: '/mantenimientos', icon: <FiTool />, roles: ['Administrador', 'Cuentadante'] }
    ],
    ambientesHorarios: [
      { title: 'Ambientes', path: '/ambientes', icon: <FiMapPin />, roles: ['Administrador', 'Cuentadante'] },
      { title: 'Agenda', path: '/horarios', icon: <FiCalendar />, roles: ['Administrador', 'Instructor', 'Cuentadante'] }
    ],
    config: [
      { title: 'Usuarios', path: '/usuarios', icon: <FiUsers />, roles: ['Administrador', 'Instructor', 'Cuentadante'] },
      { title: 'Aprendices', path: '/aprendices', icon: <FiUser />, roles: ['Administrador'] },
      { title: 'Seguridad', path: '/config?section=security', icon: <FiShield />, roles: ['all'] },
      { title: 'Códigos de Seguridad', path: '/config?section=invitation-codes', icon: <FiKey />, roles: ['Administrador'] },
      { title: 'Tipos de Equipos', path: '/config?section=tipos-equipo', icon: <FiPackage />, roles: ['Administrador'] },
      { title: 'Roles y Áreas', path: '/config?section=roles', icon: <FiSettings />, roles: ['Administrador', 'Cuentadante'] },
      { title: 'Notificaciones', path: '/config?section=notifications', icon: <FiBell />, roles: ['all'] }
    ]
  }

  const canAccess = (item) => {
    if (item.roles.includes('all')) return true
    return item.roles.includes(userRole)
  }

  const renderMenuSection = (key, title, icon) => {
    const items = menuItems[key]
    const filteredItems = items.filter(canAccess)
    
    if (filteredItems.length === 0) return null

    const isExpanded = expandedMenus[key]

    return (
      <div key={key} className={`sidebar-section ${isExpanded ? 'expanded' : ''}`}>
        <button
          className="sidebar-section-header"
          onClick={() => toggleMenu(key)}
          aria-expanded={isExpanded}
        >
          <div className="sidebar-section-title">
            {icon}
            <span>{title}</span>
          </div>
          <span className="sidebar-chevron-wrapper">
            {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
          </span>
        </button>
        <div className={`sidebar-section-items ${isExpanded ? 'expanded' : ''}`}>
          {filteredItems.map((item) => (
            <button
              key={item.path}
              className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => nav(item.path)}
            >
              {item.icon}
              <span>{item.title}</span>
              {item.path === '/equipos/autorizaciones' && pendientesAutorizacion > 0 && (
                <span className="sidebar-badge sidebar-badge-pendientes" title={`${pendientesAutorizacion} solicitud(es) pendiente(s)`}>
                  {pendientesAutorizacion > 99 ? '99+' : pendientesAutorizacion}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />
      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-content">
        <button
          className={`sidebar-item sidebar-home ${isActive('/dashboard') || isActive('/') ? 'active' : ''}`}
          onClick={() => nav('/dashboard')}
        >
          <FiHome />
          <span>Inicio</span>
        </button>

        {renderMenuSection('equipos', 'Inventario', <FiPackage />)}
        {renderMenuSection('ambientesHorarios', 'Ambientes y horarios', <FiMapPin />)}
        {renderMenuSection('config', 'Configuración / Usuarios', <FiSettings />)}
        </div>
      </aside>
    </>
  )
}

