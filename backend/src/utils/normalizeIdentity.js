/**
 * Normalización compartida de identidad (cédula / correo).
 *
 * Usado por MDL-192 fase 1 (PUT /auth/user/:id) para decidir si un valor
 * “cambió” respecto al almacenado. El PR de import (alcance B) reutilizará
 * las mismas reglas para no omitir filas por casing/espacios.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCedula(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCorreo(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

/**
 * @param {{ cedula?: unknown, correo?: unknown }} [input]
 * @returns {{ cedula: string, correo: string }}
 */
export function normalizeIdentity(input = {}) {
  return {
    cedula: normalizeCedula(input.cedula),
    correo: normalizeCorreo(input.correo),
  };
}

export default {
  normalizeCedula,
  normalizeCorreo,
  normalizeIdentity,
};
