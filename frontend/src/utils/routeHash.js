/**
 * Utilidad para manejar el hash de rutas
 * Convierte rutas simples en rutas con hash para mayor seguridad
 */

// Hash base secreto para generar rutas únicas
const ROUTE_HASH_BASE = 'f263fefa-eb20-4093-8628-255c0e02d672';

/**
 * Genera un hash único para una ruta
 * @param {string} route - Ruta original (ej: '/dashboard')
 * @returns {string} - Hash único para la ruta
 */
function generateRouteHash(route) {
  // Usar crypto para generar un hash determinístico
  const encoder = new TextEncoder();
  const data = encoder.encode(ROUTE_HASH_BASE + route);
  
  // Generar hash usando Web Crypto API
  return crypto.subtle.digest('SHA-256', data)
    .then(buffer => {
      const hashArray = Array.from(new Uint8Array(buffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Convertir a formato UUID-like (8-4-4-4-12)
      return `${hashHex.substring(0, 8)}-${hashHex.substring(8, 12)}-${hashHex.substring(12, 16)}-${hashHex.substring(16, 20)}-${hashHex.substring(20, 32)}`;
    });
}

/**
 * Mapeo de rutas a hashes (cache para evitar regenerar)
 */
const routeHashCache = new Map();

/**
 * Obtiene el hash para una ruta (con cache)
 * @param {string} route - Ruta original
 * @returns {Promise<string>} - Hash de la ruta
 */
async function getRouteHash(route) {
  if (routeHashCache.has(route)) {
    return routeHashCache.get(route);
  }
  
  const hash = await generateRouteHash(route);
  routeHashCache.set(route, hash);
  return hash;
}

/**
 * Convierte una ruta simple a una ruta con hash
 * @param {string} route - Ruta original (ej: '/dashboard')
 * @returns {Promise<string>} - Ruta con hash (ej: '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/dashboard')
 */
export async function hashRoute(route) {
  if (!route || route === '/') {
    const hash = await getRouteHash('/dashboard');
    return `/${hash}/dashboard`;
  }
  
  // Extraer la ruta base (sin parámetros)
  const baseRoute = route.split('?')[0].split('#')[0];
  const hash = await getRouteHash(baseRoute);
  
  // Reconstruir la ruta con hash
  const queryString = route.includes('?') ? route.substring(route.indexOf('?')) : '';
  return `/${hash}${baseRoute}${queryString}`;
}

/**
 * Convierte una ruta con hash a una ruta simple
 * @param {string} hashedRoute - Ruta con hash
 * @returns {string} - Ruta original
 */
export function unhashRoute(hashedRoute) {
  if (!hashedRoute) return '/';
  
  // Extraer query string si existe
  const queryString = hashedRoute.includes('?') ? hashedRoute.substring(hashedRoute.indexOf('?')) : '';
  
  // Remover el hash del inicio (formato: /hash/ruta)
  const parts = hashedRoute.split('/').filter(p => p);
  
  // Si no tiene hash, retornar la ruta original
  if (parts.length < 2) {
    return hashedRoute;
  }
  
  // El hash es el primer segmento, la ruta es el resto
  const routeParts = parts.slice(1);
  const route = '/' + routeParts.join('/');
  
  return route + queryString;
}

/**
 * Verifica si una ruta tiene hash
 * @param {string} route - Ruta a verificar
 * @returns {boolean} - True si tiene hash
 */
export function hasRouteHash(route) {
  if (!route) return false;
  const parts = route.split('/').filter(p => p);
  // Verificar si el primer segmento parece un UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  if (parts.length < 2) return false;
  const firstPart = parts[0];
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstPart);
}

/**
 * Versión síncrona usando un hash simple (para casos donde no se puede usar async)
 * Genera un hash más simple pero determinístico
 */
function generateSimpleHash(route) {
  let hash = 0;
  const str = ROUTE_HASH_BASE + route;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convertir a formato UUID-like
  const hashStr = Math.abs(hash).toString(16).padStart(32, '0');
  return `${hashStr.substring(0, 8)}-${hashStr.substring(8, 12)}-${hashStr.substring(12, 16)}-${hashStr.substring(16, 20)}-${hashStr.substring(20, 32)}`;
}

/**
 * Versión síncrona de hashRoute (usa hash simple)
 * @param {string} route - Ruta original
 * @returns {string} - Ruta con hash
 */
export function hashRouteSync(route) {
  if (!route || route === '/') {
    const hash = generateSimpleHash('/dashboard');
    return `/${hash}/dashboard`;
  }
  
  const baseRoute = route.split('?')[0].split('#')[0];
  const hash = generateSimpleHash(baseRoute);
  
  const queryString = route.includes('?') ? route.substring(route.indexOf('?')) : '';
  return `/${hash}${baseRoute}${queryString}`;
}

