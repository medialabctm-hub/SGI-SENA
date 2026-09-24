import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import crypto from 'node:crypto';

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
/**
 * Normaliza la IP del cliente para claves de rate-limit.
 * Depende de Express `trust proxy` (ver config/trustProxy.js) para que
 * `req.ip` sea la IP real detrás de Railway + nginx. `ipKeyGenerator`
 * agrupa IPv6 por subred (/56) para que no se evada el límite rotando
 * direcciones dentro del mismo prefijo.
 */
const getClientIp = (req) => {
  const raw = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (!raw) return 'unknown';
  return ipKeyGenerator(raw);
};

const getIdentifier = (req) => {
  // Si el usuario está autenticado, usar su ID para rate limiting más preciso
  if (req.user?.id) {
    return `user_${req.user.id}`;
  }
  return getClientIp(req);
};

const hashIdentifier = (value) => crypto
  .createHash('sha256')
  .update(String(value).trim().toUpperCase())
  .digest('hex');

const getInvitationIdentifier = (req) => {
  const source = req.body?.codigo
    ?? req.body?.documento
    ?? req.body?.placa
    ?? req.query?.codigo
    ?? req.query?.documento
    ?? req.query?.placa;

  return source == null || String(source).trim() === '' ? 'missing' : source;
};

const invitationRateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Demasiados intentos de validación. Por favor intenta nuevamente en 15 minutos.',
    retryAfter: 15,
  });
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
 * MDL-231 — límite por identificador (cédula|correo) en recuperación.
 * 3/hora. Clave hasheada; montar DESPUÉS de validate(solicitarRecuperacionSchema)
 * para usar el body ya normalizado. Misma respuesta 429 que passwordResetLimiter
 * (IP), exista o no el usuario. Nunca loguear cédula/correo en claro.
 */
const getPasswordResetIdentifier = (req) => {
  const cedulaRaw = req.body?.cedula;
  const correoRaw = req.body?.correo;
  // Cédula: solo dígitos. Correo: trim + lowercase (trim de email OK; passwords never trimmed).
  const normalizedCedula = cedulaRaw == null ? '' : String(cedulaRaw).replace(/\D/g, '');
  const normalizedCorreo = correoRaw == null ? '' : String(correoRaw).trim().toLowerCase();
  if (!normalizedCedula || !normalizedCorreo) {
    return 'missing';
  }
  return `${normalizedCedula}|${normalizedCorreo}`;
};

export const passwordResetIdentifierLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiados intentos de recuperación. Intenta nuevamente más tarde.',
  },
  keyGenerator: (req) =>
    `password_reset_identifier_${hashIdentifier(getPasswordResetIdentifier(req))}`,
});

/**
 * Rate limiter para endpoints de escritura (POST, PUT, DELETE)
 * 100 peticiones por minuto por usuario/IP
 * Mejorado: Diferencia entre usuarios autenticados y anónimos
 */
export const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: req => req.user?.id ? 150 : 100,
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
  max: req => req.user?.id ? 300 : 200,
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
  max: req => req.user?.id ? 80 : 50,
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
 * Rate limiters para verificación pública de documentos (GET /verificar/:documento).
 *
 * MDL-201 / H-05 (2026-09-21): la respuesta pública indica existencia del documento
 * en el roster (contrato de autoservicio), así que el control principal contra
 * enumeración útil es el rate-limit dual:
 *   - por IP (10 / 15 min): frena barridos desde un origen
 *   - por documento hasheado (5 / 15 min): frena reintentos del mismo identificador
 *     aunque el atacante rote IPs
 * El documento se normaliza (trim + mayúsculas) y se hashea para que el store del
 * limiter no conserve el valor en claro.
 */
const publicLookupRateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Demasiados intentos de verificación. Por favor intenta nuevamente en 15 minutos.',
    retryAfter: 15
  });
};

const getPublicLookupDocumento = (req) => {
  const source = req.params?.documento;
  const normalized = source == null ? '' : String(source).trim();
  return normalized === '' ? 'missing' : normalized;
};

export const publicLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    error: 'Demasiados intentos de verificación. Por favor intenta nuevamente en 15 minutos.',
    retryAfter: 15
  },
  keyGenerator: (req) => `public_lookup_ip_${getClientIp(req)}`,
  handler: publicLookupRateLimitHandler,
});

export const publicLookupDocumentoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => `public_lookup_documento_${hashIdentifier(getPublicLookupDocumento(req))}`,
  handler: publicLookupRateLimitHandler,
});

/**
 * Límites independientes para la validación pública de invitaciones.
 *
 * El primer límite evita que un cliente distribuya códigos desde una misma
 * IP; el segundo evita repetir indefinidamente un código desde IPs rotantes.
 * El identificador del código se hashea para que el store del limiter no
 * conserve el secreto en claro.
 */
export const invitationIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => `invitation_ip_${getClientIp(req)}`,
  handler: invitationRateLimitHandler,
});

export const invitationCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => `invitation_identifier_${hashIdentifier(getInvitationIdentifier(req))}`,
  handler: invitationRateLimitHandler,
});

/**
 * Límites independientes para el autoservicio de préstamo de equipos
 * (POST /autoservicio/iniciar-uso).
 *
 * El límite por IP evita que un mismo origen agote las solicitudes del
 * endpoint (por ejemplo, un ambiente de clase completo); el límite por
 * identificador evita que alguien repita rápidamente el mismo par
 * documento+placa buscando acertar una combinación válida por fuerza
 * bruta. El identificador se normaliza (trim + mayúsculas) y se hashea
 * para que el store del limiter, las claves y los logs no conserven
 * documento ni placa en claro. Ninguno de los dos límites reemplaza el
 * gate de clase en curso, roster, autorización de negocio, la
 * transacción ni la idempotencia del controlador.
 */
const getAutoservicioIdentifier = (req) => {
  const documento = req.body?.documento;
  const placa = req.body?.placa;
  const normalizedDocumento = documento == null ? '' : String(documento).trim();
  const normalizedPlaca = placa == null ? '' : String(placa).trim();

  if (!normalizedDocumento || !normalizedPlaca) {
    return 'missing';
  }

  return `${normalizedDocumento}|${normalizedPlaca}`;
};

const autoservicioRateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Demasiados intentos de autoservicio. Por favor intenta nuevamente en 15 minutos.',
    retryAfter: 15,
  });
};

export const autoservicioIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => `autoservicio_ip_${getClientIp(req)}`,
  handler: autoservicioRateLimitHandler,
});

export const autoservicioIdentifierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => `autoservicio_identifier_${hashIdentifier(getAutoservicioIdentifier(req))}`,
  handler: autoservicioRateLimitHandler,
});

/**
 * Rate limiters para re-autenticación en cambios de identidad
 * (PUT /api/auth/user/:id cuando cambia correo propio — MDL-192 / H-07 fase 1).
 *
 * skipSuccessfulRequests: solo cuentan fallos (4xx/5xx), p. ej. contraseña
 * actual incorrecta o ausente. Éxitos (200) no consumen cuota.
 * Dimensiones: IP (como authLimiter) y usuario autenticado.
 */
const identityReauthRateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Demasiados intentos. Por favor intenta nuevamente en 15 minutos.',
    retryAfter: 15,
  });
};

export const identityReauthIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `identity_reauth_ip_${getClientIp(req)}`,
  handler: identityReauthRateLimitHandler,
});

export const identityReauthUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const id = req.user?.id;
    return id != null ? `identity_reauth_user_${id}` : `identity_reauth_user_${getClientIp(req)}`;
  },
  handler: identityReauthRateLimitHandler,
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



