/**
 * MDL-230 — Sanitizer mínimo para respuestas de usuario.
 *
 * Nunca serializar hash de contraseña ni tokens al cliente.
 * MDL-203 podrá extender esto a un usuarioDto.js con enmascarado PII por rol;
 * este helper se limita a secretos de autenticación.
 */

/** Nombres de columna/campo que nunca deben salir en JSON de API. */
export const CAMPOS_SECRETOS_USUARIO = Object.freeze([
  'contrasena',
  'password',
  'password_hash',
  'hash',
  'salt',
  'refresh_token',
  'access_token',
  'session_token',
  'reset_token',
  'token_version',
  'token_reset',
  'token_recuperacion',
]);

/**
 * Columnas públicas de Usuarios (+ join Roles) para SELECT explícitos
 * hacia respuestas HTTP. No incluye contrasena ni tokens.
 */
export const USUARIO_COLUMNAS_PUBLICAS_SQL = Object.freeze([
  'u.id_usuario',
  'u.nombre_usuario',
  'u.cedula',
  'u.tipo_documento',
  'u.tipo_documento_otro',
  'u.telefono',
  'u.correo',
  'u.id_rol',
  'u.estado',
  'u.requiere_cambio_contrasena',
  'u.foto_perfil',
  'u.fecha_registro',
  'u.ultimo_acceso',
  'u.creado_por',
  'r.nombre_rol',
]);

/**
 * Columnas para autenticación interna (login / cambio de contraseña).
 * Incluye contrasena a propósito; el caller DEBE pasar por toPublicUser
 * antes de responder al cliente.
 */
export const USUARIO_COLUMNAS_AUTH_SQL = Object.freeze([
  ...USUARIO_COLUMNAS_PUBLICAS_SQL,
  'u.contrasena',
]);

const SECRET_KEY_SET = new Set(CAMPOS_SECRETOS_USUARIO.map((k) => k.toLowerCase()));

/**
 * Devuelve una copia del usuario sin campos secretos.
 * No muta el original. Idempotente.
 *
 * @param {object|null|undefined} row
 * @returns {object|null|undefined}
 */
export function toPublicUser(row) {
  if (row == null || typeof row !== 'object') return row;

  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (SECRET_KEY_SET.has(String(key).toLowerCase())) {
      delete out[key];
    }
  }
  return out;
}

/**
 * @param {Array|*} rows
 * @returns {Array|*}
 */
export function toPublicUserList(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((r) => toPublicUser(r));
}

/**
 * True si el payload (objeto/array) contiene nombres de campo secretos
 * o un string con aspecto bcrypt ($2a$/$2b$/$2y$).
 */
export function payloadContainsUserSecrets(payload) {
  const blob = JSON.stringify(payload);
  if (!blob) return false;

  if (/\$2[aby]\$\d{2}\$/.test(blob)) return true;

  try {
    const walk = (node) => {
      if (node == null) return false;
      if (Array.isArray(node)) return node.some(walk);
      if (typeof node !== 'object') return false;
      for (const key of Object.keys(node)) {
        if (SECRET_KEY_SET.has(String(key).toLowerCase())) return true;
        if (walk(node[key])) return true;
      }
      return false;
    };
    return walk(payload);
  } catch {
    return /"(contrasena|password|password_hash|refresh_token|reset_token|token_version)"\s*:/i.test(
      blob
    );
  }
}
