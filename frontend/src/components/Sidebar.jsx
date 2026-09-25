import React, { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FiChevronDown, FiChevronRight } from 'react-icons/fi'
import { useSidebar } from '../contexts/SidebarContext'
import { useBlockedNavigate } from '../hooks/useBlockedNavigate'
import { useEstadoNavegacion } from '../hooks/useEstadoNavegacion'
import { menuParaRol, entradaActiva, grupoDeEntrada } from '../config/navigation'
import { estadoDeEntrada } from '../utils/navigationEstado'
import '../styles/layout/sidebar.css'

const leerUsuarioGuardado = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

const esMovil = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches

/**
 * Menú lateral de consulta: lleva a las pantallas principales y muestra el
 * estado de cada una. Las acciones viven en las pantallas (ver config/navigation).
 */
export default function Sidebar({ user }) {
  const { isOpen, closeSidebar } = useSidebar()
  const nav = useBlockedNavigate()
  const location = useLocation()
  const usuario = user || leerUsuarioGuardado()
  const rol = usuario?.nombre_rol || ''

  const menu = useMemo(() => menuParaRol(rol), [rol])
  const activa = entradaActiva(rol, location.pathname, location.search)
  const grupoActivo = grupoDeEntrada(activa)
  const estado = useEstadoNavegacion(Boolean(usuario))

  // Solo se guardan los grupos que el usuario plegó o desplegó a mano; el resto
  // sigue la regla: abiertos salvo Configuración, y siempre el de la pantalla actual.
  const [abiertosManual, setAbiertosManual] = useState({})
  const estaAbierto = grupo =>
    abiertosManual[grupo.key] ?? (grupo.key === grupoActivo || !grupo.colapsadoPorDefecto)

  const irA = path => {
    nav(path)
    if (esMovil()) closeSidebar()
  }

  const renderItem = (item, claseExtra = '') => {
    const Icono = item.icon
    const estaActiva = item.key === activa
    const infoEstado = item.estado ? estadoDeEntrada(item.estado, estado, rol) : null
    return (
      <button
        key={item.key}
        type="button"
        className={`sidebar-item ${infoEstado ? 'sidebar-item-con-estado' : ''} ${claseExtra} ${estaActiva ? 'active' : ''}`}
        aria-current={estaActiva ? 'page' : undefined}
        onClick={() => irA(item.path)}
      >
        {Icono && <Icono aria-hidden="true" />}
        <span className="sidebar-item-texto">
          <span className="sidebar-item-titulo">{item.title}</span>
          {infoEstado && (
            <span className={`sidebar-item-estado sidebar-estado-${infoEstado.tono}`}>
              {infoEstado.texto}
            </span>
          )}
        </span>
      </button>
    )
  }

  const renderGrupo = grupo => {
    const Icono = grupo.icon
    const abierto = estaAbierto(grupo)
    const idItems = `sidebar-grupo-${grupo.key}`
    return (
      <div key={grupo.key} className={`sidebar-section ${abierto ? 'expanded' : ''}`}>
        <button
          type="button"
          className="sidebar-section-header"
          aria-expanded={abierto}
          aria-controls={idItems}
          onClick={() => setAbiertosManual(prev => ({ ...prev, [grupo.key]: !abierto }))}
        >
          <span className="sidebar-section-title">
            <Icono aria-hidden="true" />
            <span>{grupo.title}</span>
          </span>
          <span className="sidebar-chevron-wrapper" aria-hidden="true">
            {abierto ? <FiChevronDown /> : <FiChevronRight />}
          </span>
        </button>
        <div id={idItems} className={`sidebar-section-items ${abierto ? 'expanded' : ''}`} hidden={!abierto}>
          {grupo.items.map(item => renderItem(item))}
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
        <nav className="sidebar-content" aria-label="Navegación principal">
          <p className="sidebar-caption">Consultar y ver estado</p>
          {menu.map(entrada => (entrada.items ? renderGrupo(entrada) : renderItem(entrada, 'sidebar-home')))}
        </nav>
      </aside>
    </>
  )
}
