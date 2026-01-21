/**
 * Utilidades para manejo de zona horaria de Colombia (UTC-5)
 * Todas las funciones devuelven fechas/horas en zona horaria de Colombia
 */

/**
 * Obtiene la fecha/hora actual en zona horaria de Colombia (UTC-5)
 * @param {Date} date - Fecha opcional (por defecto: ahora)
 * @returns {string} Fecha/hora en formato 'YYYY-MM-DD HH:mm:ss' (hora de Colombia)
 */
export function getColombiaDateTimeString(date = new Date()) {
  // Convertir a hora de Colombia (UTC-5)
  const colombiaOffset = -5 * 60; // -5 horas en minutos
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const colombiaTime = new Date(utc + (colombiaOffset * 60000));
  
  const year = colombiaTime.getUTCFullYear();
  const month = String(colombiaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(colombiaTime.getUTCDate()).padStart(2, '0');
  const hours = String(colombiaTime.getUTCHours()).padStart(2, '0');
  const minutes = String(colombiaTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(colombiaTime.getUTCSeconds()).padStart(2, '0');
  
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
 * Obtiene la fecha actual en zona horaria de Colombia
 * @returns {string} Fecha en formato 'YYYY-MM-DD' (hora de Colombia)
 */
export function getColombiaDateString(date = new Date()) {
  const colombiaOffset = -5 * 60; // -5 horas en minutos
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const colombiaTime = new Date(utc + (colombiaOffset * 60000));
  
  const year = colombiaTime.getUTCFullYear();
  const month = String(colombiaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(colombiaTime.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

