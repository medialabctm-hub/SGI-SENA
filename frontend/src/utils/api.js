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

export const parseApiResponse = async (
  response,
  defaultErrorMessage = 'Error en la solicitud'
) => {
  const data = await extractJson(response);
  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      data?.detalle ||
      data?.details ||
      defaultErrorMessage;

    throw new ApiError(message, response.status, data);
  }
  return data;
};

export const buildErrorMessage = (error, fallback = 'Error inesperado') => {
  if (!error) return fallback;
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Servicio no disponible. Verifica tu conexión.';
    }
    return `${error.message}${error.status ? ` (código ${error.status})` : ''}`;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};
