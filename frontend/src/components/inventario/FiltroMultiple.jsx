import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiChevronDown } from 'react-icons/fi'

/**
 * Filtro de columna con selección múltiple (p. ej. dos ambientes a la vez).
 * La lista se pinta en un portal para no quedar recortada por el scroll
 * horizontal de la tabla. Sigue a su botón al desplazarse y se cierra con
 * Escape, un clic fuera o cuando el botón sale de la pantalla.
 */
const MARGEN = 8

function calcularPosicion(boton) {
  const rect = boton.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > window.innerHeight) return null
  const ancho = Math.max(rect.width, 200)
  const izquierda = Math.min(rect.left, window.innerWidth - ancho - MARGEN)
  return { top: rect.bottom + 4, left: Math.max(MARGEN, izquierda), minWidth: ancho }
}

export default function FiltroMultiple({ etiqueta, opciones, valores = [], onCambiar }) {
  const [posicion, setPosicion] = useState(null)
  const boton = useRef(null)
  const lista = useRef(null)
  const idLista = useId()
  const abierto = posicion !== null

  const cerrar = () => setPosicion(null)

  useEffect(() => {
    if (!abierto) return undefined
    const cerrarFuera = evento => {
      if (boton.current?.contains(evento.target) || lista.current?.contains(evento.target)) return
      cerrar()
    }
    const cerrarConEscape = evento => {
      if (evento.key === 'Escape') {
        cerrar()
        boton.current?.focus()
      }
    }
    const reubicar = evento => {
      if (evento?.target && lista.current?.contains(evento.target)) return
      if (boton.current) setPosicion(calcularPosicion(boton.current))
    }
    document.addEventListener('mousedown', cerrarFuera)
    document.addEventListener('keydown', cerrarConEscape)
    window.addEventListener('scroll', reubicar, true)
    window.addEventListener('resize', reubicar)
    lista.current?.querySelector('input')?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('mousedown', cerrarFuera)
      document.removeEventListener('keydown', cerrarConEscape)
      window.removeEventListener('scroll', reubicar, true)
      window.removeEventListener('resize', reubicar)
    }
  }, [abierto])

  const alternarLista = () => {
    if (abierto) {
      cerrar()
      return
    }
    setPosicion(calcularPosicion(boton.current))
  }

  const seleccionadas = opciones.filter(o => valores.includes(o.value))
  const resumen = seleccionadas.length === 0
    ? 'Todos'
    : seleccionadas.length === 1
      ? seleccionadas[0].label
      : `${seleccionadas.length} seleccionados`

  const alternar = valor => {
    const nuevos = valores.includes(valor) ? valores.filter(v => v !== valor) : [...valores, valor]
    onCambiar(nuevos)
  }

  return (
    <div className="filtro-multiple">
      <button
        ref={boton}
        type="button"
        className={`filtro-columna-control filtro-multiple-boton${valores.length ? ' activo' : ''}`}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-label={`Filtrar por ${etiqueta}: ${resumen}`}
        onClick={alternarLista}
      >
        <span className="filtro-multiple-resumen">{resumen}</span>
        <FiChevronDown aria-hidden="true" />
      </button>
      {abierto && createPortal(
        <fieldset
          id={idLista}
          ref={lista}
          className="filtro-multiple-lista"
          style={{ top: posicion.top, left: posicion.left, minWidth: posicion.minWidth }}
        >
          <legend className="sr-only">{etiqueta}</legend>
          {opciones.length === 0 && <p className="filtro-multiple-vacio">Sin opciones</p>}
          {opciones.map(opcion => (
            <label key={opcion.value} className="filtro-multiple-opcion">
              <input
                type="checkbox"
                checked={valores.includes(opcion.value)}
                onChange={() => alternar(opcion.value)}
              />
              <span>{opcion.label}</span>
            </label>
          ))}
          {valores.length > 0 && (
            <button type="button" className="filtro-multiple-limpiar" onClick={() => onCambiar([])}>
              Quitar filtro
            </button>
          )}
        </fieldset>,
        document.body
      )}
    </div>
  )
}
