/**
 * Contrato único import/export Usuarios (MDL-211).
 * Fuente de verdad = columnas de la plantilla FE.
 *
 * Aliases documentados (export humano legacy → plantilla):
 *   Documento              → cedula
 *   Nombre Completo        → nombre_usuario
 *   Nombre                 → nombre_usuario
 *   Correo Electrónico     → correo
 *   Teléfono               → telefono
 *   Rol                    → rol
 *   Estado                 → estado
 *   Tipo Documento         → tipo_documento
 *   Tipo Documento (Otro)  → tipo_documento_otro
 *   Tipo Documento Otro    → tipo_documento_otro
 */

/** Columnas exactas de la plantilla (orden de export "para reimportar"). */
import { normalizeCedula, normalizeCorreo } from './normalizeIdentity.js';

export const USUARIOS_PLANTILLA_COLUMNS = Object.freeze([
  'nombre_usuario',
  'cedula',
  'tipo_documento',
  'tipo_documento_otro',
  'telefono',
  'correo',
  'rol',
  'estado',
]);

/**
 * Mapa alias (header humano / legacy) → campo canónico de plantilla.
 * Keys en minúsculas para comparación case-insensitive.
 */
export const USUARIOS_HEADER_ALIASES = Object.freeze({
  nombre_usuario: 'nombre_usuario',
  nombre: 'nombre_usuario',
  'nombre completo': 'nombre_usuario',
  cedula: 'cedula',
  cédula: 'cedula',
  documento: 'cedula',
  'documento identidad': 'cedula',
  tipo_documento: 'tipo_documento',
  'tipo documento': 'tipo_documento',
  'tipo de documento': 'tipo_documento',
  tipo_documento_otro: 'tipo_documento_otro',
  'tipo documento otro': 'tipo_documento_otro',
  'tipo documento (otro)': 'tipo_documento_otro',
  telefono: 'telefono',
  teléfono: 'telefono',
  correo: 'correo',
  'correo electrónico': 'correo',
  'correo electronico': 'correo',
  email: 'correo',
  rol: 'rol',
  estado: 'estado',
});

/** Encabezados conocidos (plantilla + aliases) para detectar fila de título. */
export const USUARIOS_KNOWN_HEADERS = Object.freeze([
  ...USUARIOS_PLANTILLA_COLUMNS,
  'Documento',
  'Nombre Completo',
  'Nombre',
  'Correo Electrónico',
  'Teléfono',
  'Rol',
  'Estado',
  'Tipo Documento',
  'Tipo Documento (Otro)',
  'Tipo Documento Otro',
  'Cédula',
]);

/** Roles que NO pueden crearse ni asignarse vía import (create o update) sin invitación/UI. */
export const USUARIOS_ROLES_BLOQUEADOS_IMPORT = Object.freeze([
  'Administrador',
  'Cuentadante',
]);

/** Columnas sensibles que nunca deben exportarse ni aceptarse como datos de negocio. */
export const USUARIOS_COLUMNAS_SENSIBLES = Object.freeze([
  'contrasena',
  'contraseña',
  'password',
  'hash',
  'token',
  'refresh_token',
  'access_token',
]);

function pickField(row, canonical) {
  if (!row || typeof row !== 'object') return '';

  // 1) Exact plantilla key
  if (row[canonical] !== undefined && row[canonical] !== null && String(row[canonical]).trim() !== '') {
    return row[canonical];
  }

  // 2) Case-insensitive + alias scan
  for (const [key, value] of Object.entries(row)) {
    const norm = String(key).trim().toLowerCase();
    if (USUARIOS_HEADER_ALIASES[norm] === canonical) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
  }
  return '';
}

/**
 * Normaliza una fila de Excel al shape de plantilla.
 * Ignora columnas sensibles (password/hash/token).
 */
export function mapUsuarioImportRow(row) {
  const mapped = {
    nombre_usuario: String(pickField(row, 'nombre_usuario') || '').trim(),
    cedula: normalizeCedula(pickField(row, 'cedula') || ''),
    tipo_documento: String(pickField(row, 'tipo_documento') || 'CC').trim() || 'CC',
    tipo_documento_otro: (() => {
      const v = pickField(row, 'tipo_documento_otro');
      const s = String(v ?? '').trim();
      return s && s !== '-' ? s : null;
    })(),
    telefono: (() => {
      const v = pickField(row, 'telefono');
      const s = String(v ?? '').trim();
      return s && s !== '-' ? s : null;
    })(),
    // MDL-192 B: trim + lowercase antes de comparar/insertar (shared util)
    correo: (() => {
      const v = pickField(row, 'correo');
      const s = normalizeCorreo(v);
      return s && s !== '-' ? s : null;
    })(),
    rol: String(pickField(row, 'rol') || 'Aprendiz').trim() || 'Aprendiz',
    estado: String(pickField(row, 'estado') || 'Activo').trim() || 'Activo',
  };

  // LEGACY (MDL-211 residual): plaintext password opcional en Excel (contrasena/Contraseña/password).
  // Compat onboarding antiguo; no rediseñar aquí. Preferible a medio plazo: solo generación server-side.
  // Nunca se exporta; se rechazan hashes bcrypt / tokens opacos.
  const rawPass =
    row?.contrasena ?? row?.['Contraseña'] ?? row?.password ?? row?.PASSWORD ?? null;
  if (rawPass && String(rawPass).trim()) {
    const pass = String(rawPass).trim();
    // Rechazar aspecto de hash bcrypt / token largo opaco
    if (!pass.startsWith('$2') && pass.length < 200) {
      mapped.contrasena = pass;
    }
  }

  return mapped;
}

/**
 * Gate de privilegio: Admin/Cuentadante no se crean NI se asignan en update por importación.
 * Aplica al mismo camino create y update (upsert por cédula).
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function assertUsuarioImportRoleAllowed(rol) {
  const nombre = String(rol || '').trim();
  if (USUARIOS_ROLES_BLOQUEADOS_IMPORT.some((r) => r.toLowerCase() === nombre.toLowerCase())) {
    return {
      ok: false,
      error:
        `El rol "${nombre}" no puede crearse ni asignarse por importación (create/update). Use el registro con código de invitación o la gestión de usuarios autorizada.`,
    };
  }
  return { ok: true };
}

/**
 * Construye una fila de export "para reimportar" a partir de un usuario de API.
 * Sin hashes, tokens, ni columnas de reporte.
 */
export function buildUsuarioExportRow(user) {
  const emptyToBlank = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    return s === '-' ? '' : s;
  };

  return {
    nombre_usuario: emptyToBlank(user?.nombre_usuario),
    cedula: emptyToBlank(user?.cedula),
    tipo_documento: emptyToBlank(user?.tipo_documento) || 'CC',
    tipo_documento_otro: emptyToBlank(user?.tipo_documento_otro),
    telefono: emptyToBlank(user?.telefono),
    correo: emptyToBlank(user?.correo),
    rol: emptyToBlank(user?.nombre_rol || user?.rol) || 'Aprendiz',
    estado: emptyToBlank(user?.estado) || 'Activo',
  };
}
