import React, { useEffect, useRef } from 'react'
import {
  FiClock,
  FiEdit2,
  FiEye,
  FiFileText,
  FiMoreHorizontal,
  FiRepeat,
  FiTool,
  FiTrash2,
  FiTruck,
} from 'react-icons/fi'

function ActionButton({ icon: Icon, children, onClick }) {
  return (
    <button type="button" onClick={onClick}>
      <Icon aria-hidden="true" />
      {children}
    </button>
  )
}

/** Mantiene una sola acción primaria por fila; las demás conservan su ruta y permisos. */
export default function EquipoActions({ equipo, role, navigate, onEdit, onDelete }) {
  const detailsRef = useRef(null)
  const codigo = encodeURIComponent(equipo.codigo_equipo)
  const placa = equipo.codigo_inventario || equipo.placa || equipo.codigo_equipo
  const canRegister = role === 'Administrador' || role === 'Cuentadante'

  useEffect(() => {
    const closeOutside = event => {
      if (!detailsRef.current?.contains(event.target)) detailsRef.current?.removeAttribute('open')
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  const go = path => {
    detailsRef.current?.removeAttribute('open')
    navigate(path)
  }

  return (
    <div className="consultar-equipo-row-actions">
      <button type="button" className="btn btn-view" aria-label={`Ver ficha de ${placa}`} onClick={() => go(`/equipos/detalle/${codigo}`)}>
        <FiEye aria-hidden="true" /> Ver ficha
      </button>
      <details ref={detailsRef} className="consultar-equipo-more" onKeyDown={event => {
        if (event.key === 'Escape') {
          detailsRef.current?.removeAttribute('open')
          detailsRef.current?.querySelector('summary')?.focus()
        }
      }}>
        <summary aria-label={`Más acciones para ${placa}`}><FiMoreHorizontal aria-hidden="true" /> Más acciones</summary>
        <div className="consultar-equipo-more-list">
          <ActionButton icon={FiClock} onClick={() => go(`/equipos/historial-verificaciones/${codigo}`)}>Historial de verificaciones</ActionButton>
          <ActionButton icon={FiRepeat} onClick={() => go(`/equipos/historial-movimientos/${codigo}`)}>Historial de movimientos</ActionButton>
          {canRegister && <>
            <ActionButton icon={FiFileText} onClick={() => go(`/novedades?tab=crear&equipo=${codigo}`)}>Registrar novedad</ActionButton>
            <ActionButton icon={FiFileText} onClick={() => go(`/reportes/crear?equipo=${codigo}`)}>Registrar reporte</ActionButton>
            <ActionButton icon={FiTool} onClick={() => go(`/mantenimientos?tab=crear&equipo=${codigo}`)}>Registrar mantenimiento</ActionButton>
            {equipo.status_verificacion === 'Verificado' && <ActionButton icon={FiTruck} onClick={() => go(`/equipos/autorizaciones?tab=solicitar&equipo=${codigo}`)}>Solicitar movimiento</ActionButton>}
          </>}
          {role === 'Administrador' && <>
            <ActionButton icon={FiEdit2} onClick={() => { detailsRef.current?.removeAttribute('open'); onEdit?.() }}>Editar equipo</ActionButton>
            <ActionButton icon={FiTrash2} onClick={() => { detailsRef.current?.removeAttribute('open'); onDelete?.() }}>Eliminar equipo</ActionButton>
          </>}
        </div>
      </details>
    </div>
  )
}
