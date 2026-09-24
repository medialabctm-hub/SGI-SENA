/**
 * Política de contraseñas del frontend — espejo exacto de
 * backend PasswordValidationStrategy (H-10 / MDL-232):
 * longitud 8–128, minúscula, mayúscula, dígito y especial /[^A-Za-z0-9]/.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
/** Cualquier carácter que no sea letra ni dígito ASCII (igual que el backend). */
export const PASSWORD_SPECIAL_REGEX = /[^A-Za-z0-9]/;

export const PASSWORD_POLICY_HELP =
  'Entre 8 y 128 caracteres. Debe incluir minúscula, mayúscula, número y carácter especial.';

/**
 * @param {unknown} value
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validatePassword(value) {
  if (!value) {
    return { valid: false, error: 'La contraseña es requerida' };
  }

  if (typeof value !== 'string') {
    return { valid: false, error: 'La contraseña es requerida' };
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    };
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `La contraseña no debe superar los ${PASSWORD_MAX_LENGTH} caracteres`,
    };
  }

  if (!/[a-z]/.test(value)) {
    return { valid: false, error: 'La contraseña debe incluir al menos una letra minúscula' };
  }

  if (!/[A-Z]/.test(value)) {
    return { valid: false, error: 'La contraseña debe incluir al menos una letra mayúscula' };
  }

  if (!/[0-9]/.test(value)) {
    return { valid: false, error: 'La contraseña debe incluir al menos un número' };
  }

  if (!PASSWORD_SPECIAL_REGEX.test(value)) {
    return { valid: false, error: 'La contraseña debe incluir al menos un carácter especial' };
  }

  return { valid: true, error: null };
}

/**
 * @param {unknown} value
 * @returns {string|null} Mensaje de error o null si es válida.
 */
export function getPasswordError(value) {
  const result = validatePassword(value);
  return result.valid ? null : result.error;
}
