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
]);

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
    body.details = error.details;
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
  containsInternalErrorDetail,
  resolveClientErrorMessage,
  buildClientErrorBody,
};
