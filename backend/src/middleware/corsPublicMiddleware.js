/**
 * Middleware de CORS para endpoints públicos
 * Permite orígenes específicos para endpoints que no requieren autenticación
 * como /api/equipos/uso/registro-externo
 */
import cors from 'cors';

// Orígenes permitidos para endpoints públicos
const allowedPublicOrigins = [
  'https://sgi-senadata.up.railway.app',
  'https://sgi-senadata.up.railway.app/', // Con barra final
  // Agregar más orígenes si es necesario
];

const corsPublicOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origen (Postman, curl, mobile apps, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Normalizar el origen (remover barra final si existe)
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    // Verificar si el origen está en la lista permitida
    if (allowedPublicOrigins.some(allowed => {
      const normalizedAllowed = allowed.endsWith('/') ? allowed.slice(0, -1) : allowed;
      return normalizedOrigin === normalizedAllowed;
    })) {
      callback(null, true);
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

