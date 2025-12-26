import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useDuplicados } from '../contexts/DuplicadosContext'

/**
 * Componente que bloquea la navegación cuando hay duplicados pendientes
 * Intercepta el botón de retroceso del navegador
 */
export default function NavigationBlocker() {
  const { tieneDuplicadosPendientes } = useDuplicados()
  const location = useLocation()

  useEffect(() => {
    if (!tieneDuplicadosPendientes) {
      return
    }

    // Guardar la ruta actual cuando hay duplicados
    const rutaActual = location.pathname + location.search

    // Interceptar cambios de ruta con el botón de retroceso
    const handlePopState = (event) => {
      if (tieneDuplicadosPendientes) {
        // Prevenir la navegación
        window.history.pushState(null, '', rutaActual)
        alert('No puedes cambiar de página mientras haya registros con placas duplicadas pendientes de revisión. Por favor, aprueba o rechaza todos los registros antes de continuar.')
      }
    }

    // Agregar un estado al historial para poder interceptar el botón de retroceso
    window.history.pushState(null, '', rutaActual)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [tieneDuplicadosPendientes, location.pathname, location.search])

  return null
}

