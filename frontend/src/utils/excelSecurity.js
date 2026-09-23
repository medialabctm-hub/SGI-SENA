/**
 * Sanitización de inyección de fórmulas Excel/CSV (FE export).
 * Espejo de backend/src/utils/excelSecurity.js — MDL-211.
 */

const FORMULA_PREFIX_RE = /^[=+\-@]/;

export function sanitizeExcelValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value;

  const str = String(value);
  if (str.length === 0) return str;

  const trimmedStart = str.replace(/^\uFEFF/, '');
  const leadingWsMatch = trimmedStart.match(/^\s*/);
  const leadingWs = leadingWsMatch ? leadingWsMatch[0] : '';
  const rest = trimmedStart.slice(leadingWs.length);

  if (FORMULA_PREFIX_RE.test(rest)) {
    return `${leadingWs}'${rest}`;
  }
  return str;
}

export function sanitizeExcelRow(row) {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) {
    return row.map((v) => sanitizeExcelValue(v));
  }
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = sanitizeExcelValue(value);
  }
  return out;
}
