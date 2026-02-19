import { useEffect } from 'react'
import { useDuplicados } from '../contexts/DuplicadosContext'

/**
 * Bloquea la navegación cuando hay duplicados pendientes o una importación en curso.
 * Intercepta pushState/replaceState y el botón atrás/adelante.
 * Durante importación solo se impide el cambio de ruta; el modal de duplicados se muestra solo por duplicados.
 */
export default function NavigationBlocker() {
  const { tieneDuplicadosPendientes, importacionEnCurso, mostrarModalBloqueo } = useDuplicados()
  const debeBloquear = tieneDuplicadosPendientes || importacionEnCurso

  useEffect(() => {
    if (!debeBloquear) return

    const rutaActual = window.location.pathname + window.location.search + window.location.hash

    const handlePopState = (event) => {
      if (!debeBloquear) return
      event?.preventDefault?.()
      window.history.pushState(null, '', rutaActual)
      if (tieneDuplicadosPendientes) mostrarModalBloqueo()
    }

    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    window.history.pushState = function (state, title, url) {
      if (debeBloquear && url && url !== rutaActual) {
        if (tieneDuplicadosPendientes) mostrarModalBloqueo()
        return
      }
      return originalPushState.apply(this, arguments)
    }

    window.history.replaceState = function (state, title, url) {
      if (debeBloquear && url && url !== rutaActual) {
        if (tieneDuplicadosPendientes) mostrarModalBloqueo()
        return
      }
      return originalReplaceState.apply(this, arguments)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
    }
  }, [debeBloquear, tieneDuplicadosPendientes, mostrarModalBloqueo])

  return null
}

