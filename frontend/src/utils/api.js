export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message || 'Error inesperado en la solicitud');
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

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
 * Mapea errores técnicos a mensajes amigables para el usuario
 * No revela información sensible del backend
 */
const getUserFriendlyError = (error, status, originalMessage) => {
  // Errores de red/conexión
  if (status === 0 || error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
    return 'No pudimos conectar con el servidor. Verifica tu conexión a internet';
  }

  // Errores del servidor (500, 502, 503, 504) - NO revelar detalles técnicos
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
    if (msg.length > 0 && msg.length < 120 && !/error|exception|sql|query|undefined/i.test(msg)) {
      return msg;
    }
    return 'No se encontró el recurso solicitado';
  }

  // Errores de validación del usuario (400) - estos SÍ pueden mostrar mensajes específicos
  if (status === 400) {
    // Si el mensaje original es amigable y no técnico, usarlo
    const message = originalMessage || error?.message || '';
    
    // Lista de mensajes técnicos que NO deben mostrarse
    const technicalPatterns = [
      /error/i,
      /exception/i,
      /stack/i,
      /trace/i,
      /sql/i,
      /database/i,
      /query/i,
      /undefined/i,
      /null/i,
      /cannot read/i,
      /typeerror/i,
      /referenceerror/i,
      /\d{3}/, // Códigos HTTP
      /code \d+/i,
      /status \d+/i,
    ];

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
    if (msg.length > 0 && msg.length < 150 && !/error|exception|sql|query|undefined/i.test(msg)) {
      return msg;
    }
    return 'Ya existe un registro con estos datos';
  }

  // Error desconocido - mensaje genérico seguro
  return 'Ocurrió un problema. Por favor intenta de nuevo más tarde';
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
    // Si hay detalles de validación, extraer los mensajes
    if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
      const validationMessages = data.details
        .map(d => d.message)
        .filter(Boolean)
        .join('. ');
      const message = validationMessages || data?.error || data?.message || defaultErrorMessage;
      throw new ApiError(message, response.status, data);
    }
    
    const message =
      data?.error ||
      data?.message ||
      data?.detalle ||
      defaultErrorMessage;

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
    return getUserFriendlyError(error, error.status, error.message);
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
