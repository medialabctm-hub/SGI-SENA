import React, { useEffect, useRef } from 'react'
import { FiEye, FiMoreHorizontal } from 'react-icons/fi'

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
          <button type="button" onClick={() => go(`/equipos/historial-verificaciones/${codigo}`)}>Historial de verificaciones</button>
          <button type="button" onClick={() => go(`/equipos/historial-movimientos/${codigo}`)}>Historial de movimientos</button>
          {canRegister && <>
            <button type="button" onClick={() => go(`/novedades?tab=crear&equipo=${codigo}`)}>Registrar novedad</button>
            <button type="button" onClick={() => go(`/reportes/crear?equipo=${codigo}`)}>Registrar reporte</button>
            <button type="button" onClick={() => go(`/mantenimientos?tab=crear&equipo=${codigo}`)}>Registrar mantenimiento</button>
            {equipo.status_verificacion === 'Verificado' && <button type="button" onClick={() => go(`/equipos/autorizaciones?tab=solicitar&equipo=${codigo}`)}>Solicitar movimiento</button>}
          </>}
          {role === 'Administrador' && <>
            <button type="button" onClick={() => { detailsRef.current?.removeAttribute('open'); onEdit?.() }}>Editar equipo</button>
            <button type="button" onClick={() => { detailsRef.current?.removeAttribute('open'); onDelete?.() }}>Eliminar equipo</button>
          </>}
        </div>
      </details>
    </div>
  )
}
