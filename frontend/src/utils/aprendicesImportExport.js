/**
 * Contrato plantilla Aprendices (debe coincidir con backend).
 * MDL-211 — export "para reimportar".
 */

export const APRENDICES_PLANTILLA_COLUMNS = Object.freeze([
  'Ficha',
  'Nombre',
  'Documento',
  'Tipo Documento',
  'Tipo Documento Otro',
  'Jornada',
  'Tipo Aprendiz',
  'Días',
  'Hora Inicio',
  'Hora Fin',
]);

const emptyToBlank = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s === '-' ? '' : s;
};

export function buildAprendizExportRow(item) {
  return {
    Ficha: emptyToBlank(item?.ficha),
    Nombre: emptyToBlank(item?.nombre),
    Documento: emptyToBlank(item?.documento),
    'Tipo Documento': emptyToBlank(item?.tipo_documento) || 'CC',
    'Tipo Documento Otro': emptyToBlank(item?.tipo_documento_otro),
    Jornada: emptyToBlank(item?.jornada),
    'Tipo Aprendiz': emptyToBlank(item?.tipo_aprendiz),
    Días: emptyToBlank(item?.dias_semana),
    'Hora Inicio': emptyToBlank(item?.hora_inicio),
    'Hora Fin': emptyToBlank(item?.hora_fin),
  };
}

export function buildAprendicesExportAoa(aprendices, sanitizeRow) {
  const headers = [...APRENDICES_PLANTILLA_COLUMNS];
  const rows = (aprendices || []).map((item) => {
    const row = buildAprendizExportRow(item);
    const values = headers.map((h) => row[h] ?? '');
    return typeof sanitizeRow === 'function' ? sanitizeRow(values) : values;
  });
  return [headers, ...rows];
}
