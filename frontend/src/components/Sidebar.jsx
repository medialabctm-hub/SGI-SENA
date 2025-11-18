import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  FiMapPin
} from 'react-icons/fi'
import { useSidebar } from '../contexts/SidebarContext'

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
    equipos: true,
    incidencias: false,
    mantenimiento: false,
    config: false
  })

  const toggleMenu = (menu) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }))
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  const menuItems = {
    equipos: [
      { title: 'Registrar Equipo', path: '/equipos', icon: <FiPlus />, roles: ['Administrador'] },
      { title: 'Consultar Equipo', path: '/equipos/consultar', icon: <FiSearch />, roles: ['all'] },
      { title: 'Mis Equipos', path: '/mis-equipos', icon: <FiPackage />, roles: ['all'] },
      { title: 'Asignar Equipo', path: '/equipos/asignar', icon: <FiUsers />, roles: ['Administrador', 'Instructor'] }
    ],
    incidencias: [
      { title: 'Novedades', path: '/novedades', icon: <FiAlertCircle />, roles: ['Administrador', 'Instructor'] },
      { title: 'Reportes', path: '/reportes', icon: <FiFileText />, roles: ['Administrador', 'Instructor'] }
    ],
    mantenimiento: [
      { title: 'Historial de Mantenimientos', path: '/mantenimientos', icon: <FiTool />, roles: ['all'] }
    ],
    config: [
      { title: 'Personal Registrado', path: '/usuarios', icon: <FiUsers />, roles: ['Administrador', 'Instructor'] },
      { title: 'Gestión de Ambientes', path: '/ambientes', icon: <FiMapPin />, roles: ['Administrador'] },
      { title: 'Configuración', path: '/config', icon: <FiSettings />, roles: ['all'] }
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
      <div key={key} className="sidebar-section">
        <button
          className="sidebar-section-header"
          onClick={() => toggleMenu(key)}
        >
          <div className="sidebar-section-title">
            {icon}
            <span>{title}</span>
          </div>
          {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
        </button>
        {isExpanded && (
          <div className="sidebar-section-items">
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
        )}
      </div>
    )
  }

  return (
    <>
      {isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-content">
        <button
          className={`sidebar-item sidebar-home ${isActive('/dashboard') || isActive('/') ? 'active' : ''}`}
          onClick={() => nav('/dashboard')}
        >
          <FiHome />
          <span>Inicio</span>
        </button>

        {renderMenuSection('equipos', 'Gestión de Equipos', <FiPackage />)}
        {renderMenuSection('incidencias', 'Incidencias / Reportes', <FiAlertCircle />)}
        {renderMenuSection('mantenimiento', 'Mantenimiento', <FiTool />)}
        {renderMenuSection('config', 'Configuración / Usuarios', <FiSettings />)}
        </div>
      </aside>
    </>
  )
}

