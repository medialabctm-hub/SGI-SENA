import React from 'react'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiEye,
  FiMonitor,
  FiRepeat,
  FiTool,
  FiTrash2,
  FiUserPlus,
} from 'react-icons/fi'
import { accionesDeEquipo } from '../../utils/equipoAcciones'

const ICONOS = {
  'ver-detalle': FiEye,
  historial: FiClock,
  verificar: FiCheckCircle,
  asignar: FiUserPlus,
  mover: FiRepeat,
  novedad: FiAlertTriangle,
  'registrar-uso': FiMonitor,
  mantenimiento: FiTool,
  editar: FiEdit2,
  eliminar: FiTrash2,
}

const placaDe = equipo => equipo?.codigo_inventario || equipo?.placa || `ID ${equipo?.codigo_equipo}`

/** Títulos de las columnas de acciones (uno por grupo visible). */
export function CabeceraAcciones({ grupos }) {
  return grupos.map(grupo => (
    <th key={grupo.key} scope="col" className="inventario-th-acciones">
      {grupo.titulo}
    </th>
  ))
}

/** Botón de una acción, con el estilo de los botones de fila existentes. */
export function BotonAccion({ accion, equipo, onAccion, disabled = false, compacto = false }) {
  const Icono = ICONOS[accion.key]
  return (
    <button
      type="button"
      className={`accion-equipo accion-equipo--${accion.key}${compacto ? ' accion-equipo--compacto' : ''}`}
      title={accion.ayuda}
      aria-label={`${accion.etiqueta} · ${placaDe(equipo)}`}
      onClick={() => onAccion(accion.key, equipo)}
      disabled={disabled}
    >
      {Icono && <Icono aria-hidden="true" className="consultar-equipo-action-icon" />}
      <span>{accion.etiqueta}</span>
    </button>
  )
}

/** Una celda por grupo visible con las acciones de ese grupo para este equipo. */
export function CeldasAcciones({ equipo, usuario, grupos, onAccion, disabled = false }) {
  const acciones = accionesDeEquipo(equipo, usuario)
  return grupos.map(grupo => (
    <td key={grupo.key} className="inventario-td-acciones" data-label={grupo.titulo}>
      <div className="inventario-acciones-grupo">
        {acciones
          .filter(accion => accion.grupo === grupo.key)
          .map(accion => (
            <BotonAccion key={accion.key} accion={accion} equipo={equipo} onAccion={onAccion} disabled={disabled} />
          ))}
      </div>
    </td>
  ))
}
