import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hashRouteSync, hasRouteHash, unhashRoute } from '../utils/routeHash';

/**
 * Componente wrapper que maneja la conversión de rutas con hash
 * Redirige rutas sin hash a rutas con hash
 */
export default function HashRouteWrapper({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Si la ruta ya tiene hash, no hacer nada
    if (hasRouteHash(currentPath)) {
      return;
    }

    // Si es una ruta pública (login, register, etc.), no aplicar hash
    const publicRoutes = ['/login', '/register', '/olvidar-contrasena', '/restablecer-contrasena', '/cambiar-contrasena'];
    if (publicRoutes.includes(currentPath)) {
      return;
    }

    // Convertir ruta sin hash a ruta con hash
    const hashedRoute = hashRouteSync(currentPath);
    
    // Preservar query string y hash si existen
    const fullHashedRoute = hashedRoute + location.search + location.hash;
    
    // Redirigir solo si la ruta es diferente
    if (fullHashedRoute !== currentPath + location.search + location.hash) {
      navigate(fullHashedRoute, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return children;
}

