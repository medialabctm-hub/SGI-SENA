/**
 * Middleware de CORS para endpoints públicos
 * Permite orígenes específicos para endpoints que no requieren autenticación
 * como /api/equipos/uso/registro-externo
 */
import cors from 'cors';

// Orígenes permitidos para endpoints públicos
// Se pueden configurar mediante variable de entorno CORS_PUBLIC_ORIGINS (separados por comas)
const getAllowedPublicOrigins = () => {
  const origins = [];
  
  // Agregar orígenes desde variable de entorno
  if (process.env.CORS_PUBLIC_ORIGINS) {
    const envOrigins = process.env.CORS_PUBLIC_ORIGINS.split(',').map(o => o.trim()).filter(o => o);
    origins.push(...envOrigins);
  }
  
  return origins;
};

const allowedPublicOrigins = getAllowedPublicOrigins();

const corsPublicOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origen (Postman, curl, mobile apps, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Normalizar el origen (remover barra final si existe)
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    // Verificar si el origen está en la lista permitida
    const currentAllowedOrigins = getAllowedPublicOrigins();
    if (currentAllowedOrigins.length > 0 && currentAllowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.endsWith('/') ? allowed.slice(0, -1) : allowed;
      return normalizedOrigin === normalizedAllowed;
    })) {
      callback(null, true);
    } else if (currentAllowedOrigins.length === 0) {
      // Si no hay orígenes configurados, permitir todos en desarrollo
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('CORS_PUBLIC_ORIGINS no configurado para producción'));
      }
    } else {
      // En desarrollo, permitir cualquier origen para facilitar pruebas
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        // En producción, rechazar orígenes no permitidos
        callback(new Error(`Origen no permitido por CORS: ${origin}`));
      }
    }
  },
  credentials: false, // No necesitamos cookies para endpoints públicos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  exposedHeaders: ['Content-Type'],
};

export const corsPublic = cors(corsPublicOptions);

