import React from 'react'
import { FiInbox } from 'react-icons/fi'
import { CabeceraAcciones, CeldasAcciones } from './AccionesEquipo'

const claseEstadoFisico = estado => ({
  Nuevo: 'badge-success',
  Bueno: 'badge-info',
  Regular: 'badge-warning',
  Malo: 'badge-warning',
  Dañado: 'badge-error',
})[estado] || 'badge-info'

const formatearFecha = valor => {
  if (!valor) return '-'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? '-' : fecha.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
}

/**
 * Vista «Bajo mi responsabilidad»: la consulta personal que antes era la pantalla
 * «Mis Equipos», con sus columnas propias (responsabilidad, fecha, días, quién
 * asignó, observaciones). No mezcla filas con el inventario general.
 */
export default function MisEquiposTabla({ equipos, usuario, grupos, onAccion }) {
  if (equipos.length === 0) {
    return (
      <div className="users-empty mis-equipos-vacio">
        <FiInbox size={40} aria-hidden="true" />
        <strong>No tienes equipos bajo tu responsabilidad</strong>
        <p className="consultar-equipo-help-text">
          Cuando te asignen un equipo como responsable principal o secundario, o quede a tu cargo, aparecerá aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="consultar-equipo-table-wrapper">
      <table className="users-table consultar-equipo-table inventario-tabla">
        <caption className="sr-only">Equipos bajo mi responsabilidad</caption>
        <thead>
          <tr>
            <th scope="col">Código Inventario</th>
            <th scope="col">Tipo</th>
            <th scope="col">Modelo</th>
            <th scope="col">Consecutivo</th>
            <th scope="col">Estado</th>
            <th scope="col">Ambiente</th>
            <th scope="col">Responsabilidad</th>
            <th scope="col">Fecha de registro</th>
            <th scope="col">Días habilitado</th>
            <th scope="col">Asignado por</th>
            <th scope="col">Observaciones</th>
            <CabeceraAcciones grupos={grupos} />
          </tr>
        </thead>
        <tbody>
          {equipos.map(eq => (
            <tr key={eq.codigo_equipo}>
              <td data-label="Código inventario"><strong>{eq.codigo_inventario || '-'}</strong></td>
              <td data-label="Tipo">{eq.tipo || '-'}</td>
              <td data-label="Modelo">{eq.modelo || '-'}</td>
              <td data-label="Consecutivo">{eq.consecutivo || '-'}</td>
              <td data-label="Estado">
                <span className={`badge ${claseEstadoFisico(eq.estado_fisico)}`}>{eq.estado_fisico || '-'}</span>
              </td>
              <td data-label="Ambiente">
                {eq.nombre_ambiente || 'Sin ambiente'}
                {eq.codigo_ambiente && <div className="mis-equipos-info-text">({eq.codigo_ambiente})</div>}
              </td>
              <td data-label="Responsabilidad">
                <span className={eq.tipo_responsabilidad === 'Principal' ? 'mis-equipos-responsabilidad-badge' : 'mis-equipos-responsabilidad-secundario'}>
                  {eq.tipo_responsabilidad}
                </span>
              </td>
              <td data-label="Fecha de registro">{formatearFecha(eq.fecha_asignacion || eq.fecha_adquisicion)}</td>
              <td data-label="Días habilitado">{eq.dias_asignado ?? '-'}</td>
              <td data-label="Asignado por">
                {eq.origen_responsabilidad === 'inventario_cuentadante' ? 'Inventario a cargo' : eq.asignado_por_nombre || 'Sistema'}
              </td>
              <td data-label="Observaciones" className="mis-equipos-observaciones">{eq.observaciones || '-'}</td>
              <CeldasAcciones equipo={eq} usuario={usuario} grupos={grupos} onAccion={onAccion} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
