/**
 * Contrato único import/export Aprendices (MDL-211).
 * Fuente de verdad = columnas de la plantilla FE.
 *
 * Aliases documentados (export legacy → plantilla):
 *   Tipo de aprendiz → Tipo Aprendiz
 *   (orden distinto aceptado; "Registrado" se ignora en import)
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

export const APRENDICES_HEADER_ALIASES = Object.freeze({
  ficha: 'Ficha',
  nombre: 'Nombre',
  documento: 'Documento',
  cedula: 'Documento',
  cédula: 'Documento',
  'documento identidad': 'Documento',
  'tipo documento': 'Tipo Documento',
  tipo_documento: 'Tipo Documento',
  'tipo de documento': 'Tipo Documento',
  'tipo documento otro': 'Tipo Documento Otro',
  tipo_documento_otro: 'Tipo Documento Otro',
  jornada: 'Jornada',
  'tipo aprendiz': 'Tipo Aprendiz',
  'tipo de aprendiz': 'Tipo Aprendiz',
  tipo_aprendiz: 'Tipo Aprendiz',
  días: 'Días',
  dias: 'Días',
  dias_semana: 'Días',
  'hora inicio': 'Hora Inicio',
  hora_inicio: 'Hora Inicio',
  'hora fin': 'Hora Fin',
  hora_fin: 'Hora Fin',
});

export const APRENDICES_KNOWN_HEADERS = Object.freeze([
  ...APRENDICES_PLANTILLA_COLUMNS,
  'Tipo de aprendiz',
  'tipo_aprendiz',
  'Dias',
  'dias_semana',
  'hora_inicio',
  'hora_fin',
  'CEDULA',
  'Documento Identidad',
]);

function pickField(row, canonical) {
  if (!row || typeof row !== 'object') return '';

  if (row[canonical] !== undefined && row[canonical] !== null && String(row[canonical]).trim() !== '') {
    return row[canonical];
  }

  for (const [key, value] of Object.entries(row)) {
    const norm = String(key).trim().toLowerCase();
    if (APRENDICES_HEADER_ALIASES[norm] === canonical) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
  }
  return '';
}

const emptyToNull = (v) => {
  const s = String(v ?? '').trim();
  if (!s || s === '-') return null;
  return s;
};

/**
 * Normaliza fila Excel al shape canónico de plantilla (keys humanas plantilla).
 */
export function mapAprendizImportRow(row) {
  return {
    Ficha: emptyToNull(pickField(row, 'Ficha')),
    Nombre: String(pickField(row, 'Nombre') || '').trim(),
    Documento: String(pickField(row, 'Documento') || '').trim(),
    'Tipo Documento': String(pickField(row, 'Tipo Documento') || 'CC').trim() || 'CC',
    'Tipo Documento Otro': emptyToNull(pickField(row, 'Tipo Documento Otro')),
    Jornada: emptyToNull(pickField(row, 'Jornada')) || '',
    'Tipo Aprendiz': emptyToNull(pickField(row, 'Tipo Aprendiz')),
    Días: emptyToNull(pickField(row, 'Días')) || '',
    'Hora Inicio': pickField(row, 'Hora Inicio'),
    'Hora Fin': pickField(row, 'Hora Fin'),
  };
}

/**
 * Fila de export reimportable (mismas columnas/orden que la plantilla).
 * No incluye "Registrado" ni otros campos de reporte.
 */
export function buildAprendizExportRow(item) {
  const emptyToBlank = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    return s === '-' ? '' : s;
  };

  const tipoDoc = emptyToBlank(item?.tipo_documento) || 'CC';
  // Si el export legacy concatenó "CC (OtroX)", separar
  let tipoDocumento = tipoDoc;
  let tipoDocumentoOtro = emptyToBlank(item?.tipo_documento_otro);
  const concatMatch = tipoDoc.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (concatMatch && !item?.tipo_documento_otro) {
    tipoDocumento = concatMatch[1].trim();
    tipoDocumentoOtro = concatMatch[2].trim();
  }

  return {
    Ficha: emptyToBlank(item?.ficha),
    Nombre: emptyToBlank(item?.nombre),
    Documento: emptyToBlank(item?.documento),
    'Tipo Documento': tipoDocumento || 'CC',
    'Tipo Documento Otro': tipoDocumentoOtro,
    Jornada: emptyToBlank(item?.jornada),
    'Tipo Aprendiz': emptyToBlank(item?.tipo_aprendiz),
    Días: emptyToBlank(item?.dias_semana),
    'Hora Inicio': emptyToBlank(item?.hora_inicio),
    'Hora Fin': emptyToBlank(item?.hora_fin),
  };
}
