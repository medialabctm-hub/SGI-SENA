export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message || 'Error inesperado en la solicitud');
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    // Mensaje que el backend marcó como apto para mostrar tal cual al usuario.
    // Lo emiten errorHandler y handleControllerError solo para errores de dominio
    // controlados, nunca para fallos técnicos inesperados.
    this.userMessage = payload?.userMessage || null;
  }
}

const getFirstStructuredMessage = payload => {
  const details = payload?.details;
  if (!Array.isArray(details) || details.length === 0) return '';
  const detail = details[0];
  if (typeof detail === 'string') return detail.trim();
  return String(detail?.userMessage || detail?.message || detail?.error || detail?.detail || '').trim();
};

const getPreferredApiMessage = (payload, fallback = '') =>
  payload?.userMessage?.trim?.() ||
  payload?.message?.trim?.() ||
  getFirstStructuredMessage(payload) ||
  payload?.error?.trim?.() ||
  payload?.detalle?.trim?.() ||
  fallback;

export const isIdempotentApiResponse = data => Boolean(
  data?.idempotent === true ||
  data?.alreadyRegistered === true ||
  data?.reused === true ||
  ((data?.success === true || data?.ok === true) &&
    Boolean(data?.aprendiz || data?.data?.aprendiz))
);

export const buildEquipoAssignmentPayload = form => {
  const payload = {
    codigo_equipo: form.codigo_equipo,
    tipo_responsabilidad: form.tipo_responsabilidad,
  };

  if (form.observaciones) payload.observaciones = form.observaciones;

  if (form.id_usuario) {
    payload.id_usuario = form.id_usuario;
  } else {
    if (form.id_aprendiz) payload.id_aprendiz = form.id_aprendiz;
    if (form.documento_externo) payload.documento_externo = form.documento_externo;
  }

  return payload;
};

const extractJson = async (response) => {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Patrones que delatan un detalle de implementación del backend.
 * Un mensaje que los contenga nunca se muestra al usuario.
 */
const TECHNICAL_PATTERNS = [
  /exception/i,
  /stack/i,
  /\btrace\b/i,
  /\bsql\b/i,
  /database/i,
  /\bquery\b/i,
  /undefined/i,
  /cannot read/i,
  /typeerror/i,
  /referenceerror/i,
  /constraint/i,
  /foreign key/i,
  /\bER_[A-Z_]+/,
  /at row \d+/i,
];

/**
 * Mapea errores técnicos a mensajes amigables para el usuario
 * No revela información sensible del backend
 */
const getUserFriendlyError = (error, status, originalMessage) => {
  // Errores de red/conexión
  if (status === 0 || error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
    return 'No pudimos conectar con el servidor. Verifica tu conexión a internet';
  }

  // El backend marcó explícitamente este mensaje como apto para el usuario:
  // es una regla de negocio, no un detalle técnico. Se muestra tal cual.
  // Sin esto, el motivo real ("tiene equipos asociados") se perdía y el usuario
  // solo veía un error de servidor genérico.
  if (error?.userMessage) {
    return error.userMessage;
  }

  // Errores del servidor (500, 502, 504) - NO revelar detalles técnicos
  // El 503 lo emite el backend cuando la base de datos está ocupada o caída,
  // siempre con userMessage; si llega sin él, se usa el genérico.
  if (status >= 500) {
    return 'Ocurrió un problema en el servidor. Por favor intenta de nuevo más tarde';
  }

  // Timeout
  if (status === 408 || error?.message?.includes('timeout') || error?.message?.includes('ETIMEDOUT')) {
    return 'La solicitud tardó demasiado. Por favor intenta de nuevo';
  }

  // Token expirado o no autorizado
  if (status === 401 || status === 403) {
    if (status === 401) {
      // Verificar si es un error de credenciales inválidas (login) o sesión expirada
      const message = (originalMessage || error?.message || '').toLowerCase();
      if (message.includes('credenciales inválidas') || 
          message.includes('credenciales invalidas') ||
          message.includes('usuario o contraseña incorrectos') ||
          message.includes('contraseña incorrecta') ||
          message.includes('contraseña actual') ||
          message.includes('la contraseña actual es incorrecta') ||
          message.includes('usuario no encontrado')) {
        // Si es un error de contraseña actual, mostrar el mensaje específico
        if (message.includes('contraseña actual')) {
          return originalMessage || error?.message || 'La contraseña actual es incorrecta';
        }
        return 'Usuario o contraseña incorrectos';
      }
      // Para otros errores 401 (token expirado, etc.)
      return 'Tu sesión expiró. Por favor inicia sesión nuevamente';
    }
    return 'No tienes permiso para realizar esta acción';
  }

  // Recurso no encontrado: mostrar mensaje del backend si es amigable (ej. aprendiz no existe)
  if (status === 404) {
    const msg = (originalMessage || '').trim();
    if (msg.length > 0 && msg.length <= 300 && !TECHNICAL_PATTERNS.some(p => p.test(msg))) {
      return msg;
    }
    return 'No se encontró el recurso solicitado';
  }

  // Errores de validación del usuario (400/422) - estos SÍ pueden mostrar mensajes específicos
  if (status === 400 || status === 422) {
    // Si el mensaje original es amigable y no técnico, usarlo
    const message = originalMessage || error?.message || '';
    
    // Patrones que delatan un detalle de implementación y NO deben mostrarse.
    // Se excluyeron a propósito /error/i, /null/i y /\d{3}/: descartaban mensajes
    // de negocio legítimos ("Error de validación", "No hay 100 cupos disponibles").
    const technicalPatterns = TECHNICAL_PATTERNS;

    // Si el mensaje parece técnico, usar uno genérico
    if (technicalPatterns.some(pattern => pattern.test(message))) {
      return 'Los datos proporcionados no son válidos. Por favor verifica e intenta de nuevo';
    }

    // Mensajes específicos comunes que SÍ deben mostrarse
    const friendlyMessages = {
      'credenciales inválidas': 'Usuario o contraseña incorrectos',
      'usuario o contraseña incorrectos': 'Usuario o contraseña incorrectos',
      'contraseña incorrecta': 'Contraseña incorrecta',
      'usuario no encontrado': 'No encontramos una cuenta con ese correo',
      'email no registrado': 'No encontramos una cuenta con ese correo',
      'campos vacíos': 'Debes completar todos los campos',
      'campos requeridos': 'Debes completar todos los campos',
      'código de invitación inválido': 'El código de invitación no es válido',
      'código expirado': 'El código de invitación ha expirado',
      'email ya registrado': 'Este correo electrónico ya está registrado',
      'cédula ya registrada': 'Esta cédula ya está registrada',
    };

    // Buscar mensaje amigable en el mensaje original (case insensitive)
    const lowerMessage = message.toLowerCase();
    for (const [key, friendly] of Object.entries(friendlyMessages)) {
      if (lowerMessage.includes(key)) {
        return friendly;
      }
    }

    // Si el mensaje es corto y no parece técnico, usarlo
    if (message.length < 100 && !technicalPatterns.some(pattern => pattern.test(message))) {
      return message;
    }

    // Por defecto, mensaje genérico para errores 400
    return 'Los datos proporcionados no son válidos. Por favor verifica e intenta de nuevo';
  }

  // Errores de conflicto (409): mostrar mensaje del backend si viene (ej. sesión activa, equipo no disponible)
  if (status === 409) {
    const msg = (originalMessage || '').trim();
    if (msg.length > 0 && msg.length <= 300 && !TECHNICAL_PATTERNS.some(p => p.test(msg))) {
      return msg;
    }
    return 'Ya existe un registro con estos datos';
  }

  // El límite público de autoservicio es recuperable: informar al usuario
  // para que espere en vez de mostrar un error genérico de servidor.
  if (status === 429) {
    const msg = (originalMessage || '').trim();
    if (msg.length > 0 && msg.length <= 300 && !TECHNICAL_PATTERNS.some(p => p.test(msg))) {
      return msg;
    }
    return 'Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.';
  }

  // Error desconocido - mensaje genérico seguro
  return 'Ocurrió un problema. Por favor intenta de nuevo más tarde';
};

// Frases de errores 401 que NO son sesión expirada (login / cambio de contraseña)
const CREDENTIAL_ERROR_HINTS = [
  'credenciales inválidas',
  'credenciales invalidas',
  'usuario o contraseña incorrectos',
  'contraseña incorrecta',
  'contraseña actual',
  'usuario no encontrado',
];

// Rutas de autenticación donde NO se debe redirigir (ya estamos ahí)
const AUTH_PATHS = ['/login', '/register', '/olvidar-contrasena', '/restablecer-contrasena'];

let sessionExpirationTriggered = false;

/**
 * Determina si un 401 corresponde a una sesión expirada (token vencido),
 * excluyendo los 401 de credenciales inválidas del login o cambio de contraseña.
 */
const isSessionExpired = (status, message = '') => {
  if (status !== 401) return false;
  const lower = message.toLowerCase();
  return !CREDENTIAL_ERROR_HINTS.some((hint) => lower.includes(hint));
};

/**
 * Limpia la sesión y redirige al login. Se ejecuta una sola vez y nunca desde
 * las pantallas de autenticación. Es el manejo global de sesión expirada.
 */
export const handleSessionExpiration = () => {
  if (typeof window === 'undefined' || sessionExpirationTriggered) return;
  if (AUTH_PATHS.some((path) => window.location.pathname.startsWith(path))) return;
  if (!localStorage.getItem('token')) return;

  sessionExpirationTriggered = true;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Delay corto para que el usuario alcance a ver el toast "Tu sesión expiró"
  setTimeout(() => {
    window.location.href = '/login';
  }, 1500);
};

/**
 * Parsea la respuesta de la API y lanza un error si no es exitosa
 */
export const parseApiResponse = async (
  response,
  defaultErrorMessage = 'Error en la solicitud'
) => {
  const data = await extractJson(response);
  if (!response.ok) {
    if (response.status === 409 && isIdempotentApiResponse(data)) return data;

    // Si hay detalles de validación, extraer los mensajes
    const message = getPreferredApiMessage(data, defaultErrorMessage);

    if (isSessionExpired(response.status, message)) handleSessionExpiration();
    throw new ApiError(message, response.status, data);
  }
  return data;
};

/**
 * Construye un mensaje de error amigable para el usuario
 * NO revela información técnica ni sensible del backend
 * 
 * @param {Error|ApiError} error - El error capturado
 * @param {string} fallback - Mensaje de respaldo si no se puede determinar el error
 * @returns {string} Mensaje amigable para el usuario
 */
export const buildErrorMessage = (error, fallback = 'Ocurrió un problema. Por favor intenta de nuevo más tarde') => {
  if (!error) return fallback;

  // Si es un ApiError, usar el status y mensaje
  if (error instanceof ApiError) {
    const message = getPreferredApiMessage(error.payload, error.message);
    return getUserFriendlyError(error, error.status, message);
  }

  // Permite reutilizar el mismo formateador para errores estructurados recibidos
  // dentro de una respuesta exitosa parcial (por ejemplo, registro-externo).
  if (error?.payload && typeof error.status === 'number') {
    const message = getPreferredApiMessage(error.payload, error.message || '');
    return getUserFriendlyError(error, error.status, message);
  }

  // Si es un Error genérico, verificar si es de red
  if (error instanceof Error) {
    // Errores de red
    if (error.message?.includes('Failed to fetch') || 
        error.message?.includes('NetworkError') ||
        error.message?.includes('Network request failed')) {
      return 'No pudimos conectar con el servidor. Verifica tu conexión a internet';
    }

    // Timeouts
    if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      return 'La solicitud tardó demasiado. Por favor intenta de nuevo';
    }

    // Otros errores de Error - NO mostrar el mensaje técnico
    // Solo mostrar mensajes genéricos seguros
    return fallback;
  }

  // Para cualquier otro tipo de error, usar el fallback
  return fallback;
};

/**
 * Maneja errores de forma consistente y muestra un toast
 * Útil para usar en componentes React
 * 
 * @param {Error} error - El error capturado
 * @param {Function} setToast - Función para actualizar el estado del toast
 * @param {string} fallback - Mensaje de respaldo
 */
export const handleError = (error, setToast, fallback = 'Ocurrió un problema. Por favor intenta de nuevo más tarde') => {
  const message = buildErrorMessage(error, fallback);
  setToast({ message, type: 'error' });
  
  if (import.meta.env.DEV) {
    console.error('Error técnico (solo en desarrollo):', error);
  }
};

export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

/**
 * Descarga el PDF de acta de novedad por robo/pérdida.
 * @param {number} idNovedad - ID de la novedad (tipo Pérdida o Robo)
 * @returns {Promise<void>} Resuelve al completar la descarga o rechaza si falla
 */
export async function descargarPDFNovedadRoboPerdida(idNovedad) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/novedades/${idNovedad}/pdf`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'No se pudo generar el PDF');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Acta_Novedad_${idNovedad}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
