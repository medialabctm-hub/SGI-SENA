import { useEffect, useState } from 'react'

/**
 * Contadores del sidebar (GET /api/navegacion/estado).
 *
 * Cada página monta su propio Sidebar; para no pedir el estado en cada
 * navegación se guarda en memoria durante CACHE_MS y se comparte la petición
 * en curso. Tras una acción que cambia contadores (p. ej. registrar una
 * novedad) se puede llamar a invalidarEstadoNavegacion().
 */

export const CACHE_MS = 30 * 1000

let cache = { valor: null, obtenidoEn: 0, clave: null }
let peticionEnCurso = null
const suscriptores = new Set()

const claveSesion = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    return user ? `${user.id_usuario ?? user.id ?? ''}:${user.nombre_rol ?? ''}` : null
  } catch {
    return null
  }
}

async function pedirEstado(clave) {
  if (!peticionEnCurso) {
    peticionEnCurso = fetch('/api/navegacion/estado', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
      .then(valor => {
        cache = { valor, obtenidoEn: Date.now(), clave }
        suscriptores.forEach(notificar => notificar(valor))
        return valor
      })
      .finally(() => {
        peticionEnCurso = null
      })
  }
  return peticionEnCurso
}

export function invalidarEstadoNavegacion() {
  cache = { valor: cache.valor, obtenidoEn: 0, clave: cache.clave }
  const clave = claveSesion()
  if (clave) pedirEstado(clave)
}

/** Solo para pruebas. */
export function reiniciarEstadoNavegacion() {
  cache = { valor: null, obtenidoEn: 0, clave: null }
  peticionEnCurso = null
  suscriptores.clear()
}

export function useEstadoNavegacion(activo = true) {
  const clave = claveSesion()
  const [estado, setEstado] = useState(() => (cache.clave === clave ? cache.valor : null))

  useEffect(() => {
    if (!activo || !clave) return undefined
    suscriptores.add(setEstado)
    // Si la caché está vigente, el estado inicial ya la tomó; si no, se pide de nuevo.
    const vigente = cache.clave === clave && Date.now() - cache.obtenidoEn < CACHE_MS
    if (!vigente) pedirEstado(clave)
    return () => {
      suscriptores.delete(setEstado)
    }
  }, [activo, clave])

  return estado
}
