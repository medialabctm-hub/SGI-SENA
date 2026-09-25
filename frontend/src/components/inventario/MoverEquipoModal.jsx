import React, { useEffect, useId, useRef, useState } from 'react'
import { FiRepeat, FiX } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../../utils/api'
import { canUpdateEquipos } from '../../utils/permissions'
import '../../styles/components/modals.css'

const formatearFecha = fecha => {
  if (!fecha) return ''
  const d = new Date(fecha)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
}

/**
 * Cambiar un equipo de ambiente desde su fila.
 * - Sin verificar: quien puede editar equipos lo mueve directamente.
 * - Verificado: se necesita una autorización aprobada de un solo uso; si no
 *   hay, o si el usuario no puede ejecutar el movimiento, se le lleva a
 *   solicitarla. La regla la vuelve a aplicar el backend en PUT /api/equipos/:codigo.
 */
export default function MoverEquipoModal({ equipo, usuario, onCerrar, onMovido, onSolicitarAutorizacion }) {
  const [ambientes, setAmbientes] = useState([])
  const [destino, setDestino] = useState('')
  const [autorizaciones, setAutorizaciones] = useState([])
  const [autorizacion, setAutorizacion] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const idTitulo = useId()
  const idDestino = useId()
  const primerCampo = useRef(null)

  const verificado = equipo?.status_verificacion === 'Verificado'
  const puedeEjecutar = canUpdateEquipos(usuario)
  const placa = equipo?.codigo_inventario || equipo?.placa || `ID ${equipo?.codigo_equipo}`

  useEffect(() => {
    let activo = true
    fetch('/api/ambientes/activos', { credentials: 'include' })
      .then(res => parseApiResponse(res, 'No se pudieron cargar los ambientes'))
      .then(lista => {
        if (activo) setAmbientes((Array.isArray(lista) ? lista : []).filter(a => Number(a.id_ambiente) !== Number(equipo?.id_ambiente)))
      })
      .catch(err => { if (activo) setError(buildErrorMessage(err, 'No se pudieron cargar los ambientes')) })
      .finally(() => {
        if (activo) {
          setCargando(false)
          setTimeout(() => primerCampo.current?.focus(), 0)
        }
      })
    return () => { activo = false }
  }, [equipo?.id_ambiente])

  useEffect(() => {
    if (!verificado || !destino) return undefined
    let activo = true
    const qs = new URLSearchParams({ codigo_equipo: String(equipo.codigo_equipo), id_ambiente_destino: destino })
    fetch(`/api/equipos/autorizacion-movimiento/disponibles?${qs}`, { credentials: 'include' })
      .then(res => parseApiResponse(res, ''))
      .then(data => { if (activo) setAutorizaciones(data?.autorizaciones || []) })
      .catch(() => { if (activo) setAutorizaciones([]) })
    return () => { activo = false }
  }, [verificado, destino, equipo?.codigo_equipo])

  useEffect(() => {
    const cerrarConEscape = evento => {
      if (evento.key === 'Escape' && !enviando) onCerrar()
    }
    document.addEventListener('keydown', cerrarConEscape)
    return () => document.removeEventListener('keydown', cerrarConEscape)
  }, [enviando, onCerrar])

  const cambiarDestino = valor => {
    setDestino(valor)
    setAutorizacion('')
    setAutorizaciones([])
    setError('')
  }

  const necesitaSolicitud = verificado && destino && (!puedeEjecutar || autorizaciones.length === 0)
  const puedeMover = Boolean(destino) && puedeEjecutar && (!verificado || Boolean(autorizacion))

  async function mover(evento) {
    evento.preventDefault()
    if (!puedeMover) return
    setEnviando(true)
    setError('')
    try {
      const payload = { id_ambiente: Number(destino) }
      if (verificado) payload.id_solicitud_autorizacion = Number(autorizacion)
      const res = await fetch(`/api/equipos/${encodeURIComponent(equipo.codigo_equipo)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      await parseApiResponse(res, 'No se pudo mover el equipo')
      onMovido(ambientes.find(a => String(a.id_ambiente) === destino) || null)
    } catch (err) {
      setError(buildErrorMessage(err, 'No se pudo mover el equipo'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={enviando ? undefined : onCerrar}>
      <div
        className="modal-sheet form-modal-small inventario-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={evento => evento.stopPropagation()}
      >
        <form onSubmit={mover} noValidate>
          <div className="modal-header">
            <h3 id={idTitulo} className="inventario-modal-titulo">
              <FiRepeat aria-hidden="true" />
              Mover equipo
            </h3>
            <button type="button" className="inventario-modal-cerrar" onClick={onCerrar} disabled={enviando} aria-label="Cerrar">
              <FiX aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body">
            <p className="inventario-modal-equipo">
              Equipo <strong>{placa}</strong> · ambiente actual <strong>{equipo?.nombre_ambiente || 'sin ambiente'}</strong>
            </p>
            {verificado && (
              <p className="inventario-modal-nota">
                Este equipo está verificado: para moverlo se necesita una autorización aprobada (un solo uso).
              </p>
            )}
            <label className="form-label" htmlFor={idDestino}>Ambiente destino</label>
            <select
              id={idDestino}
              ref={primerCampo}
              className="form-input"
              value={destino}
              onChange={evento => cambiarDestino(evento.target.value)}
              disabled={cargando || enviando}
            >
              <option value="">{cargando ? 'Cargando ambientes…' : 'Selecciona un ambiente'}</option>
              {ambientes.map(a => (
                <option key={a.id_ambiente} value={String(a.id_ambiente)}>
                  {a.codigo_ambiente} · {a.nombre_ambiente}
                </option>
              ))}
            </select>

            {verificado && destino && puedeEjecutar && autorizaciones.length > 0 && (
              <>
                <label className="form-label inventario-modal-campo" htmlFor={`${idDestino}-aut`}>Autorización aprobada</label>
                <select
                  id={`${idDestino}-aut`}
                  className="form-input"
                  value={autorizacion}
                  onChange={evento => setAutorizacion(evento.target.value)}
                  disabled={enviando}
                >
                  <option value="">Selecciona la autorización</option>
                  {autorizaciones.map(a => (
                    <option key={a.id_solicitud} value={String(a.id_solicitud)}>
                      #{a.id_solicitud} · {a.autorizador_nombre || 'Autorizador'} {formatearFecha(a.fecha_resolucion)}
                    </option>
                  ))}
                </select>
              </>
            )}

            {necesitaSolicitud && (
              <p className="inventario-modal-ayuda">
                {puedeEjecutar
                  ? 'No hay autorizaciones aprobadas para este destino.'
                  : 'Puedes solicitar la autorización; quien la apruebe ejecutará el movimiento.'}
              </p>
            )}
            {error && <p className="inventario-modal-error" role="alert">{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </button>
            {necesitaSolicitud ? (
              <button type="button" className="btn btn-verde" onClick={() => onSolicitarAutorizacion(destino)}>
                Solicitar autorización
              </button>
            ) : (
              <button type="submit" className="btn btn-verde" disabled={!puedeMover || enviando}>
                {enviando ? 'Moviendo...' : 'Mover equipo'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
