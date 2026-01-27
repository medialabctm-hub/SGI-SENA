import rateLimit from 'express-rate-limit';

/**
 * Configuraciones de rate limiting reutilizables
 * Protege endpoints contra ataques de fuerza bruta y abuso
 * 
 * Mejoras implementadas:
 * - Rate limiting por usuario autenticado cuando es posible
 * - Headers estándar para información de límites
 * - Mensajes de error más descriptivos
 * - Configuración diferenciada por tipo de endpoint
 */

/**
 * Helper para obtener identificador único (IP o userId)
 */
const getIdentifier = (req) => {
  // Si el usuario está autenticado, usar su ID para rate limiting más preciso
  if (req.user?.id) {
    return `user_${req.user.id}`;
  }
  // Si no, usar IP
  return req.ip || req.connection.remoteAddress;
};

/**
 * Rate limiter estricto para endpoints de autenticación
 * 10 intentos cada 15 minutos por IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos
  standardHeaders: true, // Retornar rate limit info en headers `RateLimit-*`
  legacyHeaders: false, // No usar headers `X-RateLimit-*`
  message: { 
    success: false,
    error: 'Demasiados intentos de autenticación. Por favor intenta nuevamente en 15 minutos.',
    retryAfter: 15
  },
  skipSuccessfulRequests: false, // Contar todos los intentos
  keyGenerator: (req) => getIdentifier(req),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de autenticación. Por favor intenta nuevamente en 15 minutos.',
      retryAfter: 15
    });
  }
});

/**
 * Rate limiter para registro de usuarios
 * 5 registros por hora por IP
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 registros por hora
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiados intentos de registro. Intenta nuevamente más tarde.' 
  },
});

/**
 * Rate limiter para recuperación de contraseña
 * 3 intentos cada hora
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 intentos por hora
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiados intentos de recuperación. Intenta nuevamente más tarde.' 
  },
});

/**
 * Rate limiter para endpoints de escritura (POST, PUT, DELETE)
 * 100 peticiones por minuto por usuario/IP
 * Mejorado: Diferencia entre usuarios autenticados y anónimos
 */
export const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: (req) => {
    // Usuarios autenticados tienen límite más alto
    return req.user?.id ? 150 : 100;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiadas peticiones de escritura. Intenta nuevamente en un minuto.',
    retryAfter: 1
  },
  skipSuccessfulRequests: true, // No contar peticiones exitosas
  keyGenerator: (req) => getIdentifier(req),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiadas peticiones de escritura. Intenta nuevamente en un minuto.',
      retryAfter: 1
    });
  }
});

/**
 * Rate limiter para endpoints de lectura (GET)
 * 300 peticiones por minuto para usuarios autenticados
 * 200 peticiones por minuto para usuarios anónimos
 */
export const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: (req) => {
    // Usuarios autenticados tienen límite más alto
    return req.user?.id ? 300 : 200;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiadas peticiones de lectura. Intenta nuevamente en un minuto.',
    retryAfter: 1
  },
  skipSuccessfulRequests: true,
  keyGenerator: (req) => getIdentifier(req),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiadas peticiones de lectura. Intenta nuevamente en un minuto.',
      retryAfter: 1
    });
  }
});

/**
 * Rate limiter estricto para operaciones críticas (DELETE, operaciones sensibles)
 * 20 peticiones por minuto por usuario/IP
 */
export const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // máximo 20 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiadas peticiones en operaciones críticas. Intenta nuevamente en un minuto.',
    retryAfter: 1
  },
  keyGenerator: (req) => getIdentifier(req),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiadas peticiones en operaciones críticas. Intenta nuevamente en un minuto.',
      retryAfter: 1
    });
  }
});

/**
 * Rate limiter para búsquedas y consultas complejas
 * 50 peticiones por minuto
 */
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: (req) => {
    return req.user?.id ? 80 : 50;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiadas búsquedas. Intenta nuevamente en un minuto.',
    retryAfter: 1
  },
  keyGenerator: (req) => getIdentifier(req),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiadas búsquedas. Intenta nuevamente en un minuto.',
      retryAfter: 1
    });
  }
});

/**
 * Rate limiter para webhooks externos
 * 100 peticiones por minuto
 */
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 peticiones por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiadas peticiones. Intenta nuevamente más tarde.' 
  },
});



