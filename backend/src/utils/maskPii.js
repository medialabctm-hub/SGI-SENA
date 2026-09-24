/**
 * Enmascarado de PII para respuestas/reportes (MDL-192 / MDL-232).
 * Nunca devolver cédula o correo en claro en reportes de import u omitidas.
 */

/**
 * Cédula → solo últimos 4 caracteres visibles: `***1234`.
 * @param {unknown} cedula
 * @returns {string}
 */
export function maskCedula(cedula) {
  if (cedula == null) return 'N/A';
  const s = String(cedula).trim();
  if (!s || s === 'N/A') return 'N/A';
  const last = s.slice(-Math.min(4, s.length));
  return `***${last}`;
}

/**
 * Correo → primer carácter del local + *** @ dominio.
 * @param {unknown} correo
 * @returns {string|undefined}
 */
export function maskCorreo(correo) {
  if (correo == null || correo === '') return undefined;
  const parts = String(correo).split('@');
  if (parts.length < 2) return '***';
  const [user, domain] = parts;
  const u = user.length <= 1 ? '*' : `${user[0]}***`;
  return `${u}@${domain}`;
}

/**
 * Tope de filas de datos por archivo de import (MDL-192 SECURITY).
 * Env `IMPORT_MAX_ROWS`; default 5000; inválido o ≤0 → default;
 * nunca supera IMPORT_MAX_ROWS_CEILING (10000).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export const IMPORT_MAX_ROWS_DEFAULT = 5000;
/** Techo duro: ni siquiera con env se puede superar este valor (MDL-192 SECURITY). */
export const IMPORT_MAX_ROWS_CEILING = 10000;

/**
 * Tope efectivo = min(parsed env, CEILING).
 * Default 5000 si unset / inválido / ≤0.
 */
export function getImportMaxRows(env = process.env) {
  const raw = env.IMPORT_MAX_ROWS;
  if (raw === undefined || raw === null || raw === '') {
    return IMPORT_MAX_ROWS_DEFAULT;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return IMPORT_MAX_ROWS_DEFAULT;
  }
  return Math.min(Math.floor(n), IMPORT_MAX_ROWS_CEILING);
}
