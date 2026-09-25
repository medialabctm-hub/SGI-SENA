import React from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

/**
 * Paginación con total del servidor: «Mostrando 26–50 de 312».
 */
export default function Paginacion({
  pagina,
  totalPaginas,
  total,
  limite,
  limites = [25, 50, 100],
  onPagina,
  onLimite,
  deshabilitado = false,
  nombre = 'registros',
}) {
  const desde = total === 0 ? 0 : (pagina - 1) * limite + 1
  const hasta = Math.min(total, pagina * limite)
  const paginas = Math.max(1, totalPaginas || 1)

  return (
    <nav className="paginacion" aria-label={`Paginación de ${nombre}`}>
      <p className="paginacion-resumen" aria-live="polite">
        Mostrando <strong>{desde}–{hasta}</strong> de <strong>{total}</strong> {nombre}
      </p>
      <div className="paginacion-controles">
        <button
          type="button"
          className="paginacion-boton"
          onClick={() => onPagina(pagina - 1)}
          disabled={deshabilitado || pagina <= 1}
          aria-label="Página anterior"
        >
          <FiChevronLeft aria-hidden="true" />
          <span>Anterior</span>
        </button>
        <span className="paginacion-pagina">
          Página {Math.min(pagina, paginas)} de {paginas}
        </span>
        <button
          type="button"
          className="paginacion-boton"
          onClick={() => onPagina(pagina + 1)}
          disabled={deshabilitado || pagina >= paginas}
          aria-label="Página siguiente"
        >
          <span>Siguiente</span>
          <FiChevronRight aria-hidden="true" />
        </button>
        {onLimite && (
          <label className="paginacion-limite">
            <span>Por página</span>
            <select
              value={limite}
              onChange={evento => onLimite(Number(evento.target.value))}
              disabled={deshabilitado}
            >
              {limites.map(valor => (
                <option key={valor} value={valor}>{valor}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </nav>
  )
}
