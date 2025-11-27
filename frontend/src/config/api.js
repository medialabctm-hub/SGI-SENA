// Configuración de la API
// En desarrollo, usa el proxy de Vite
// En producción, usa la variable de entorno o el dominio de Railway

const getApiBaseUrl = () => {
  // Si estamos en desarrollo, usar el proxy de Vite (URLs relativas)
  if (import.meta.env.DEV) {
    return '';
  }

  // En producción, usar la variable de entorno o el dominio de Railway por defecto
  const apiUrl = import.meta.env.VITE_API_URL || 'https://sgi-sena.up.railway.app';
  
  // Si la URL ya incluye http/https, usarla tal cual
  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
    return apiUrl;
  }
  
  // Si no, asumir que es un dominio y agregar https://
  return `https://${apiUrl}`;
};

export const API_BASE_URL = getApiBaseUrl();

// Función helper para construir URLs de API
export const apiUrl = (path) => {
  // Si el path ya comienza con /, mantenerlo
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

// Función helper para fetch con configuración por defecto
export const apiFetch = async (path, options = {}) => {
  const url = apiUrl(path);
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Agregar token si existe
  const token = localStorage.getItem('token');
  if (token && !defaultOptions.headers.Authorization) {
    defaultOptions.headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, defaultOptions);
};

