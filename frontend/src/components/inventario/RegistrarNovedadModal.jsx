import React, { useEffect, useId, useRef, useState } from 'react'
import { FiAlertTriangle, FiX } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage, descargarPDFNovedadRoboPerdida } from '../../utils/api'
import '../../styles/components/modals.css'

const TIPOS_POR_DEFECTO = ['Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Daño Físico', 'Falta de Componente', 'Otro']
const MIN_DESCRIPCION = 10
const MAX_DESCRIPCION = 2000

/**
 * Registrar una novedad de UN equipo sin salir del inventario (decisión D13:
 * la pantalla de Novedades queda solo de consulta).
 */
export default function RegistrarNovedadModal({ equipo, onCerrar, onRegistrada }) {
  const [tipos, setTipos] = useState(TIPOS_POR_DEFECTO)
  const [tipo, setTipo] = useState('Mal Funcionamiento')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const idTitulo = useId()
  const idDescripcion = useId()
  const primerCampo = useRef(null)

  useEffect(() => {
    primerCampo.current?.focus()
    let activo = true
    fetch('/api/novedades/tipos', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(lista => {
        if (activo && Array.isArray(lista) && lista.length > 0) setTipos(lista)
      })
      .catch(() => {})
    return () => { activo = false }
  }, [])

  useEffect(() => {
    const cerrarConEscape = evento => {
      if (evento.key === 'Escape' && !enviando) onCerrar()
    }
    document.addEventListener('keydown', cerrarConEscape)
    return () => document.removeEventListener('keydown', cerrarConEscape)
  }, [enviando, onCerrar])

  const placa = equipo?.codigo_inventario || equipo?.placa || `ID ${equipo?.codigo_equipo}`

  async function guardar(evento) {
    evento.preventDefault()
    const texto = descripcion.trim()
    if (texto.length < MIN_DESCRIPCION) {
      setError(`La descripción debe tener al menos ${MIN_DESCRIPCION} caracteres`)
      return
    }
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/novedades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ codigo_equipo: equipo.codigo_equipo, tipo_novedad: tipo, descripcion: texto }),
      })
      const data = await parseApiResponse(res, 'No se pudo registrar la novedad')
      let aviso = null
      if (data?.id && (tipo === 'Robo' || tipo === 'Pérdida')) {
        try {
          await descargarPDFNovedadRoboPerdida(data.id)
        } catch {
          aviso = 'La novedad quedó registrada, pero no se pudo descargar el acta. Descárgala desde el detalle de la novedad.'
        }
      }
      onRegistrada({ novedad: data, tipo, aviso })
    } catch (err) {
      setError(buildErrorMessage(err, 'No se pudo registrar la novedad'))
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
        <form onSubmit={guardar} noValidate>
          <div className="modal-header">
            <h3 id={idTitulo} className="inventario-modal-titulo">
              <FiAlertTriangle aria-hidden="true" />
              Registrar novedad
            </h3>
            <button type="button" className="inventario-modal-cerrar" onClick={onCerrar} disabled={enviando} aria-label="Cerrar">
              <FiX aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body">
            <p className="inventario-modal-equipo">
              Equipo <strong>{placa}</strong>
              {equipo?.tipo ? ` · ${equipo.tipo}` : ''}
              {equipo?.modelo ? ` ${equipo.modelo}` : ''}
              {equipo?.nombre_ambiente ? ` · ${equipo.nombre_ambiente}` : ''}
            </p>
            <label className="form-label" htmlFor={`${idDescripcion}-tipo`}>Tipo de novedad</label>
            <select
              id={`${idDescripcion}-tipo`}
              ref={primerCampo}
              className="form-input"
              value={tipo}
              onChange={evento => setTipo(evento.target.value)}
              disabled={enviando}
            >
              {tipos.map(opcion => <option key={opcion} value={opcion}>{opcion}</option>)}
            </select>
            {(tipo === 'Robo' || tipo === 'Pérdida') && (
              <p className="inventario-modal-nota">Al guardar se descargará el acta en PDF.</p>
            )}
            <label className="form-label inventario-modal-campo" htmlFor={idDescripcion}>Descripción</label>
            <textarea
              id={idDescripcion}
              className="form-input"
              rows={4}
              maxLength={MAX_DESCRIPCION}
              value={descripcion}
              onChange={evento => { setDescripcion(evento.target.value); setError('') }}
              aria-invalid={Boolean(error)}
              aria-describedby={`${idDescripcion}-ayuda`}
              disabled={enviando}
              placeholder="Qué le pasa al equipo y desde cuándo"
            />
            <p id={`${idDescripcion}-ayuda`} className={error ? 'inventario-modal-error' : 'inventario-modal-ayuda'} role={error ? 'alert' : undefined}>
              {error || `Mínimo ${MIN_DESCRIPCION} caracteres.`}
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-verde" disabled={enviando}>
              {enviando ? 'Guardando...' : 'Registrar novedad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
