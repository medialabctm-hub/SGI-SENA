import { useEffect } from 'react'
import { unstable_useBlocker as useBlocker } from 'react-router-dom'
import { useDuplicados } from '../contexts/DuplicadosContext'

/**
 * Componente que bloquea la navegación cuando hay duplicados pendientes
 * Usamos el blocker de react-router y un guardado manual de history
 */
export default function NavigationBlocker() {
  const { tieneDuplicadosPendientes } = useDuplicados()
  const blocker = useBlocker(tieneDuplicadosPendientes)
  const mensajeBloqueo = 'No puedes cambiar de página mientras haya registros con placas duplicadas pendientes de revisión. Por favor, aprueba o rechaza todos los registros antes de continuar.'

  // Bloqueo a nivel de react-router (Links, navigate, etc.)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      alert(mensajeBloqueo)
      blocker.reset() // Cancela la navegación bloqueada
    }
  }, [blocker, mensajeBloqueo])

  // Bloqueo de back/forward y cualquier cambio manual de history
  useEffect(() => {
    if (!tieneDuplicadosPendientes) return

    const rutaActual = window.location.pathname + window.location.search + window.location.hash

    const handlePopState = (event) => {
      if (!tieneDuplicadosPendientes) return
      event?.preventDefault?.()
      // Volver a la ruta actual y avisar
      window.history.pushState(null, '', rutaActual)
      alert(mensajeBloqueo)
    }

    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    window.history.pushState = function (state, title, url) {
      if (tieneDuplicadosPendientes && url && url !== rutaActual) {
        alert(mensajeBloqueo)
        return
      }
      return originalPushState.apply(this, arguments)
    }

    window.history.replaceState = function (state, title, url) {
      if (tieneDuplicadosPendientes && url && url !== rutaActual) {
        alert(mensajeBloqueo)
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
  }, [tieneDuplicadosPendientes, mensajeBloqueo])

  return null
}

