/**
 * Revocación de sesiones JWT (MDL-229).
 *
 * El JWT lleva el claim `token_version`; la columna Usuarios.token_version es
 * la versión vigente. Si no coinciden, la sesión fue revocada (logout, cambio
 * de contraseña/identidad/rol, reset) y debe responder 401.
 *
 * Fail-closed: un token sin el claim (emitido antes de MDL-229) o una fila de
 * usuario sin la columna nunca se considera vigente.
 */
export const TOKEN_VERSION_CLAIM = 'token_version';

export function sessionMatchesUser(payload, user) {
  const claim = payload?.[TOKEN_VERSION_CLAIM];
  if (!Number.isInteger(claim)) return false;
  const current = Number(user?.[TOKEN_VERSION_CLAIM]);
  return Number.isInteger(current) && current === claim;
}
