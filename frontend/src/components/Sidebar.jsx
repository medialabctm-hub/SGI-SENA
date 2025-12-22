import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import {
  FiPlus,
  FiSearch,
  FiUsers,
  FiSettings,
  FiFileText,
  FiAlertCircle,
  FiPackage,
  FiTool,
  FiUserCheck,
  FiChevronDown,
  FiChevronRight,
  FiHome,
  FiMapPin,
  FiUser,
  FiShield,
  FiKey,
  FiBell,
  FiCheckCircle,
  FiCalendar,
  FiClock
} from 'react-icons/fi'
import { useSidebar } from '../contexts/SidebarContext'
import '../styles/sidebar.css'

export default function Sidebar({ user }) {
  const { isOpen, closeSidebar } = useSidebar()
  const nav = useNavigate()
  const location = useLocation()
  const userRole = user?.nombre_rol || ''
  const isAdmin = userRole === 'Administrador'
  const isInstructor = userRole === 'Instructor'
  const isAprendiz = userRole === 'Aprendiz'

  // Estado de menús expandidos
  const [expandedMenus, setExpandedMenus] = useState({
    equipos: false,
    incidencias: false,
    mantenimiento: false,
    horarios: false,
    config: false
  })

  // Expandir automáticamente el menú correspondiente según la ruta actual
  useEffect(() => {
    const path = location.pathname
    
    // Determinar qué menú debe estar expandido basándose en la ruta
    // Solo expandir el menú correspondiente y colapsar los demás
    if (path.startsWith('/equipos') || path.startsWith('/mis-equipos') || path.startsWith('/asignaciones') || path.startsWith('/ambientes')) {
      setExpandedMenus({
        equipos: true,
        incidencias: false,
        mantenimiento: false,
        horarios: false,
        config: false
      })
    } else if (path.startsWith('/novedades') || path.startsWith('/reportes')) {
      setExpandedMenus({
        equipos: false,
        incidencias: true,
        mantenimiento: false,
        horarios: false,
        config: false
      })
    } else if (path.startsWith('/mantenimientos')) {
      setExpandedMenus({
        equipos: false,
        incidencias: false,
        mantenimiento: true,
        horarios: false,
        config: false
      })
    } else if (path.startsWith('/horarios') || path.startsWith('/clases')) {
      setExpandedMenus({
        equipos: false,
        incidencias: false,
        mantenimiento: false,
        horarios: true,
        config: false
      })
    } else if (path.startsWith('/usuarios') || path.startsWith('/aprendices') || path.startsWith('/config')) {
      setExpandedMenus({
        equipos: false,
        incidencias: false,
        mantenimiento: false,
        horarios: false,
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
      { title: 'Registrar Inventario', path: '/equipos', icon: <FiPlus />, roles: ['Administrador', 'Cuentadante'] },
      { title: 'Consultar Inventario', path: '/equipos/consultar', icon: <FiSearch />, roles: ['all'] },
      { title: 'Mis Equipos', path: '/mis-equipos', icon: <FiPackage />, roles: ['all'] },
      { title: 'Asignar Equipo', path: '/equipos/asignar', icon: <FiUsers />, roles: ['Administrador', 'Instructor'] },
      { title: 'Verificar Inventario', path: '/equipos/verificar', icon: <FiCheckCircle />, roles: ['Instructor'] },
      // { title: 'Historial de Verificaciones', path: '/equipos/verificacion/historial', icon: <FiClock />, roles: ['all'] }, // DESACTIVADO
      // Historial de Uso - DESACTIVADO
      { title: 'Buscar Cuentadante', path: '/equipos/cuentadantes/buscar', icon: <FiSearch />, roles: ['Administrador'] },
      { title: 'Gestión de Ambientes', path: '/ambientes', icon: <FiMapPin />, roles: ['Administrador'] },
      { title: 'Asignar Ambientes', path: '/ambientes/asignar', icon: <FiUserCheck />, roles: ['Administrador'] }
    ],
    incidencias: [
      { title: 'Novedades', path: '/novedades', icon: <FiAlertCircle />, roles: ['Administrador', 'Instructor', 'Cuentadante'] },
      { title: 'Reportes', path: '/reportes', icon: <FiFileText />, roles: ['Administrador', 'Instructor', 'Cuentadante'] }
    ],
    mantenimiento: [
      { title: 'Historial de Mantenimientos', path: '/mantenimientos', icon: <FiTool />, roles: ['Administrador', 'Cuentadante'] }
    ],
    horarios: [
      { title: 'Mis Horarios', path: '/horarios', icon: <FiCalendar />, roles: ['Instructor'] },
      { title: 'Gestión de Horarios', path: '/horarios', icon: <FiCalendar />, roles: ['Administrador'] },
      /*{ title: 'Consultar Responsables', path: '/horarios/responsables', icon: <FiClock />, roles: ['all'] }*/
    ],
    config: [
      { title: 'Usuarios', path: '/usuarios', icon: <FiUsers />, roles: ['Administrador', 'Instructor'] },
      { title: 'Aprendices', path: '/aprendices', icon: <FiUser />, roles: ['Administrador'] },
      { title: 'Seguridad', path: '/config?section=security', icon: <FiShield />, roles: ['all'] },
      { title: 'Códigos de Seguridad', path: '/config?section=invitation-codes', icon: <FiKey />, roles: ['Administrador'] },
      { title: 'Tipos de Equipos', path: '/config?section=tipos-equipo', icon: <FiPackage />, roles: ['Administrador'] },
      { title: 'Roles y Áreas', path: '/config?section=roles', icon: <FiSettings />, roles: ['Administrador', 'Instructor', 'Aprendiz'] },
      { title: 'Notificaciones', path: '/config?section=notifications', icon: <FiBell />, roles: ['all'] },
      { title: 'Ajustes de la App', path: '/config?section=app', icon: <FiSettings />, roles: ['all'] }
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
        {renderMenuSection('incidencias', 'Incidencias / Reportes', <FiAlertCircle />)}
        {renderMenuSection('mantenimiento', 'Mantenimiento', <FiTool />)}
        {renderMenuSection('horarios', 'Horarios y Clases', <FiCalendar />)}
        {renderMenuSection('config', 'Configuración / Usuarios', <FiSettings />)}
        </div>
      </aside>
    </>
  )
}

