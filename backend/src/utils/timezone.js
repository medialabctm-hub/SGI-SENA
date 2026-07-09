/**
 * Utilidades para manejo de zona horaria de Colombia (UTC-5)
 * Todas las funciones devuelven fechas/horas en zona horaria de Colombia
 */

/** Offset de Colombia respecto a UTC: -5 horas en milisegundos */
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

/**
 * Obtiene la fecha/hora actual en zona horaria de Colombia (UTC-5).
 * No depende del huso horario del servidor: siempre calcula desde UTC.
 * @param {Date} date - Fecha opcional (por defecto: ahora)
 * @returns {string} Fecha/hora en formato 'YYYY-MM-DD HH:mm:ss' (hora de Colombia)
 */
export function getColombiaDateTimeString(date = new Date()) {
  // Momento UTC menos 5h → componentes UTC del resultado = hora Colombia
  const colombiaMs = date.getTime() + COLOMBIA_OFFSET_MS;
  const d = new Date(colombiaMs);

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Convierte una fecha a string en zona horaria de Colombia
 * @param {Date|string} date - Fecha a convertir
 * @returns {string|null} Fecha/hora en formato 'YYYY-MM-DD HH:mm:ss' (hora de Colombia) o null si no hay fecha
 */
export function toColombiaDateTimeString(date) {
  if (!date) return null;
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return null;
    return getColombiaDateTimeString(dateObj);
  } catch (error) {
    return null;
  }
}

/**
 * Obtiene la fecha actual en zona horaria de Colombia (UTC-5).
 * @returns {string} Fecha en formato 'YYYY-MM-DD' (hora de Colombia)
 */
export function getColombiaDateString(date = new Date()) {
  const colombiaMs = date.getTime() + COLOMBIA_OFFSET_MS;
  const d = new Date(colombiaMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

