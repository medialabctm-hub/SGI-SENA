import { useNavigate as useReactRouterNavigate } from 'react-router-dom';
import { hashRouteSync } from './routeHash';

/**
 * Hook personalizado que envuelve useNavigate para usar rutas con hash
 */
export function useHashNavigate() {
  const navigate = useReactRouterNavigate();

  const hashNavigate = (to, options) => {
    // Si ya es una ruta con hash, navegar directamente
    if (typeof to === 'string' && to.startsWith('/') && to.split('/').filter(p => p).length >= 2) {
      const parts = to.split('/').filter(p => p);
      const firstPart = parts[0];
      // Verificar si ya tiene hash
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstPart)) {
        navigate(to, options);
        return;
      }
    }

    // Convertir ruta simple a ruta con hash
    const hashedRoute = hashRouteSync(to);
    navigate(hashedRoute, options);
  };

  return hashNavigate;
}

