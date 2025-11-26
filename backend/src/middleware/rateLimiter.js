import rateLimit from 'express-rate-limit';

/**
 * Configuraciones de rate limiting reutilizables
 * Protege endpoints contra ataques de fuerza bruta y abuso
 */

/**
 * Rate limiter estricto para endpoints de autenticación
 * 10 intentos cada 15 minutos
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiados intentos. Por favor intenta nuevamente en 15 minutos.' 
  },
  skipSuccessfulRequests: false, // Contar todos los intentos
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
 * 100 peticiones por minuto
 */
export const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiadas peticiones. Intenta nuevamente más tarde.' 
  },
  skipSuccessfulRequests: true, // No contar peticiones exitosas
});

/**
 * Rate limiter para endpoints de lectura (GET)
 * 200 peticiones por minuto
 */
export const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // máximo 200 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiadas peticiones. Intenta nuevamente más tarde.' 
  },
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter estricto para operaciones críticas
 * 20 peticiones por minuto
 */
export const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // máximo 20 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false,
    error: 'Demasiadas peticiones. Intenta nuevamente más tarde.' 
  },
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



