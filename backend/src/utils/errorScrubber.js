/**
 * Scrubber de errores orientados al cliente (MDL-204 / auditoría H-04).
 *
 * Objetivo: la respuesta HTTP nunca debe filtrar identificadores internos
 * (tablas, SPs, rutas de scripts, SQL, Knex, stacks, motor de BD).
 * El detalle completo sigue en logs server-side (logger.error).
 *
 * Reutilización prevista: MDL-193 (H-05 / H-08) puede ampliar
 * INTERNAL_LEAK_PATTERNS y seguir usando resolveClientErrorMessage /
 * buildClientErrorBody desde errorHandler y handleControllerError.
 */

export const GENERIC_CLIENT_MESSAGES = Object.freeze({
  400: 'Solicitud inválida.',
  401: 'No autorizado.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'Recurso no encontrado.',
  409: 'Conflicto con el estado actual del recurso.',
  429: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
  500: 'Error en el servidor',
  503: 'El servicio no está disponible temporalmente. Inténtalo de nuevo más tarde.',
  default: 'No se pudo completar la operación. Inténtalo de nuevo.',
});

/** Patrones que delatan detalle interno (schema, SP, SQL, paths, motor). */
export const INTERNAL_LEAK_PATTERNS = Object.freeze([
  /\bHistorial_Uso_Equipos\b/i,
  /\bElementos\b/,
  /\bAprendices\b/,
  /\bUsuarios\b/,
  /\bAmbientes\b/,
  /\bsp_[a-z0-9_]+\b/i,
  /\bAUTOSERVICIO_CIERRE_V\d+\b/i,
  /\bmigrate-autoservicio[a-z0-9_-]*\.js\b/i,
  /\bINFORMATION_SCHEMA\b/i,
  /Knex/i,
  /\bsqlMessage\b/i,
  /\bER_[A-Z0-9_]+\b/,
  /\bECONNREFUSED\b/i,
  /\bPROTOCOL_CONNECTION_LOST\b/i,
  /\bETIMEDOUT\b/i,
  /\bFOREIGN KEY\b/i,
  /\bCONSTRAINT\b/i,
  /`[A-Za-z_][A-Za-z0-9_]*`/,
  /\bSELECT\b[\s\S]{0,80}\bFROM\b/i,
  /\bALTER TABLE\b/i,
  /\bINSERT INTO\b/i,
  /(?:^|[\s(/])(?:\/?(?:workspace|home|var|app|usr)\/|[A-Za-z]:\\)[^\s)"']+/i,
  /\b[\w./-]+\.(?:js|ts|mjs|cjs|sql):\d+/i,
  /\bnode_modules\b/i,
  /\bat\s+\S+\s+\([^)]+:\d+:\d+\)/,
  /\bBD\/[\w./-]+\.sql\b/i,
  /\bTabla\s+[A-Za-z_][A-Za-z0-9_]*/i,
  /\bColumna\s+[A-Za-z_][A-Za-z0-9_]*/i,
  /fecha_proximo_mantenimiento/i,
  /pedidos_externos/i,
  /actualizar_tipo_novedad\.sql/i,
  /historial_uso_equipos\.sql/i,
]);

/** Claves que nunca deben aparecer en respuestas, detalles de error o meta de logs. */
export const SENSITIVE_FIELD_KEYS = Object.freeze([
  'contrasena',
  'contrasena_actual',
  'nuevaContrasena',
  'nueva_contrasena',
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'refresh_token',
  'refreshToken',
  'sgi_session',
  'authorization',
]);

const SENSITIVE_KEY_RE = /^(contrasena(_actual)?|nueva_?contrasena|password(_hash)?|token|refresh_?token|sgi_session|authorization)$/i;

/**
 * Redacta campos sensibles de un objeto (recursivo, profundidad limitada).
 * Sustituye el valor por "[REDACTED]". No muta el original.
 *
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function redactSensitiveFields(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item, depth + 1));
  }
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key) || SENSITIVE_FIELD_KEYS.includes(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactSensitiveFields(child, depth + 1);
    }
  }
  return out;
}

/**
 * True si el texto contiene un valor que parece secreto en claro
 * (p. ej. sentinel de contraseña en tests o hash bcrypt filtrado).
 * @param {unknown} text
 * @param {string[]} [sentinels]
 */
export function containsSensitivePlaintext(text, sentinels = []) {
  if (text == null) return false;
  const value = typeof text === 'string' ? text : JSON.stringify(text);
  if (!value) return false;
  if (/\$2[aby]\$[0-9]{2}\$/i.test(value)) return true;
  return sentinels.some((s) => s && value.includes(s));
}


/**
 * @param {unknown} text
 * @returns {boolean}
 */
export function containsInternalErrorDetail(text) {
  if (text == null) return false;
  const value = typeof text === 'string' ? text : JSON.stringify(text);
  if (!value) return false;
  return INTERNAL_LEAK_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Resuelve el mensaje seguro para el cliente.
 * Preferencia: error.clientMessage → mensaje operacional sin fugas → genérico.
 *
 * @param {Error & { clientMessage?: string, statusCode?: number, message?: string }} error
 * @param {{ defaultMessage?: string, statusCode?: number }} [options]
 * @returns {string}
 */
export function resolveClientErrorMessage(error, options = {}) {
  if (error?.clientMessage && !containsInternalErrorDetail(error.clientMessage)) {
    return error.clientMessage;
  }

  const statusCode = options.statusCode || error?.statusCode || 500;
  const candidate = error?.message;

  if (candidate && !containsInternalErrorDetail(candidate)) {
    return candidate;
  }

  return (
    options.defaultMessage
    || GENERIC_CLIENT_MESSAGES[statusCode]
    || GENERIC_CLIENT_MESSAGES.default
  );
}

/**
 * Construye el cuerpo JSON de error para respuestas HTTP.
 *
 * @param {Error & { clientMessage?: string, statusCode?: number, details?: unknown, stack?: string }} error
 * @param {{
 *   defaultMessage?: string,
 *   statusCode?: number,
 *   includeSuccess?: boolean,
 *   includeUserMessage?: boolean,
 *   includeStack?: boolean,
 * }} [options]
 * @returns {{ statusCode: number, body: Record<string, unknown> }}
 */
export function buildClientErrorBody(error, options = {}) {
  const statusCode = options.statusCode || error?.statusCode || 500;
  const message = resolveClientErrorMessage(error, {
    defaultMessage: options.defaultMessage,
    statusCode,
  });

  const body = {};
  if (options.includeSuccess !== false) {
    body.success = false;
  }
  body.error = message;
  if (options.includeUserMessage !== false) {
    body.userMessage = message;
  }

  if (
    error?.details != null
    && !containsInternalErrorDetail(error.details)
  ) {
    body.details = redactSensitiveFields(error.details);
  }

  // Stack solo en development y solo si se pide explícitamente (errorHandler).
  // Nunca se adjunta si el mensaje original era interno (evita filtrar rutas).
  if (
    options.includeStack
    && process.env.NODE_ENV === 'development'
    && error?.stack
    && !containsInternalErrorDetail(error.message)
  ) {
    body.stack = error.stack;
  }

  return { statusCode, body };
}

export default {
  GENERIC_CLIENT_MESSAGES,
  INTERNAL_LEAK_PATTERNS,
  SENSITIVE_FIELD_KEYS,
  containsInternalErrorDetail,
  containsSensitivePlaintext,
  redactSensitiveFields,
  resolveClientErrorMessage,
  buildClientErrorBody,
};
