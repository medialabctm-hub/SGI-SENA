/**
 * Contrato plantilla Usuarios (debe coincidir con backend).
 * MDL-211 — export "para reimportar".
 */

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

const emptyToBlank = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s === '-' ? '' : s;
};

/**
 * Fila de export reimportable (mismas columnas que la plantilla).
 * Sin hashes, tokens, IDs internos ni columnas de reporte.
 */
export function buildUsuarioExportRow(user) {
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

/**
 * Convierte usuarios API → matriz AOA lista para XLSX (header + filas),
 * con sanitización de fórmulas.
 */
export function buildUsuariosExportAoa(usuarios, sanitizeRow) {
  const headers = [...USUARIOS_PLANTILLA_COLUMNS];
  const rows = (usuarios || []).map((u) => {
    const row = buildUsuarioExportRow(u);
    const values = headers.map((h) => row[h] ?? '');
    return typeof sanitizeRow === 'function' ? sanitizeRow(values) : values;
  });
  return [headers, ...rows];
}
