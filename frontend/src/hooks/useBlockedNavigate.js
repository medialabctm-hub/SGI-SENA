import { useNavigate as useReactRouterNavigate } from 'react-router-dom'
import { useDuplicados } from '../contexts/DuplicadosContext'
import { useLocation } from 'react-router-dom'

/**
 * Hook personalizado que bloquea la navegación cuando hay duplicados pendientes
 */
export function useBlockedNavigate() {
  const navigate = useReactRouterNavigate()
  const { tieneDuplicadosPendientes } = useDuplicados()
  const location = useLocation()

  const blockedNavigate = (to, options) => {
    // Si hay duplicados pendientes y se intenta navegar a otra ruta
    if (tieneDuplicadosPendientes) {
      const rutaDestino = typeof to === 'string' ? to : (typeof to === 'number' ? null : to?.pathname || location.pathname)
      const rutaActual = location.pathname
      
      // Si es navegación numérica (back/forward), bloquear
      if (typeof to === 'number') {
        alert('No puedes cambiar de página mientras haya registros con placas duplicadas pendientes de revisión. Por favor, aprueba o rechaza todos los registros antes de continuar.')
        return
      }
      
      // Permitir navegación solo si es a la misma ruta o si es una ruta de login/logout
      const rutasPermitidas = ['/login', '/logout']
      const esRutaPermitida = rutasPermitidas.some(ruta => rutaDestino && rutaDestino.startsWith(ruta))
      
      // Normalizar rutas para comparación (sin query params)
      const rutaDestinoNormalizada = rutaDestino ? rutaDestino.split('?')[0] : rutaActual
      const rutaActualNormalizada = rutaActual.split('?')[0]
      
      if (rutaDestinoNormalizada !== rutaActualNormalizada && !esRutaPermitida) {
        alert('No puedes cambiar de página mientras haya registros con placas duplicadas pendientes de revisión. Por favor, aprueba o rechaza todos los registros antes de continuar.')
        return
      }
    }
    
    return navigate(to, options)
  }

  return blockedNavigate
}

