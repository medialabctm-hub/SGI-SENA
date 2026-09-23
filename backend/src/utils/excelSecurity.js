/**
 * Seguridad / límites estructurales para importación y exportación XLSX.
 * MDL-211/MDL-210: sanitizar inyección de fórmulas y acotar hojas/filas/celdas.
 */

export const EXCEL_STRUCTURAL_LIMITS = Object.freeze({
  maxSheets: 10,
  maxRowsPerSheet: 50_000,
  maxColsPerSheet: 100,
  maxCellsPerSheet: 500_000,
});

const FORMULA_PREFIX_RE = /^[=+\-@]/;

/**
 * Neutraliza inyección de fórmulas Excel/CSV en valores de celda.
 * Prefija con comilla simple si el valor (tras trim) empieza por = + - @.
 * No altera números ni booleanos ni null/undefined.
 */
export function sanitizeExcelValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value;

  const str = String(value);
  if (str.length === 0) return str;

  // BOM / espacios iniciales no deben ocultar el prefijo peligroso
  const trimmedStart = str.replace(/^\uFEFF/, '');
  const leadingWsMatch = trimmedStart.match(/^\s*/);
  const leadingWs = leadingWsMatch ? leadingWsMatch[0] : '';
  const rest = trimmedStart.slice(leadingWs.length);

  if (FORMULA_PREFIX_RE.test(rest)) {
    return `${leadingWs}'${rest}`;
  }
  return str;
}

/**
 * Aplica sanitizeExcelValue a todas las celdas string de un objeto fila.
 */
export function sanitizeExcelRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = sanitizeExcelValue(value);
  }
  return out;
}

/**
 * Valida límites estructurales de un workbook ya leído con XLSX.read.
 * @throws {Error} con mensaje seguro para el cliente
 */
export function assertWorkbookLimits(workbook, limits = EXCEL_STRUCTURAL_LIMITS) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    throw new Error('Formato de archivo inválido');
  }
  if (workbook.SheetNames.length === 0) {
    throw new Error('Archivo Excel sin hojas');
  }
  if (workbook.SheetNames.length > limits.maxSheets) {
    throw new Error(`El Excel supera el máximo de ${limits.maxSheets} hojas`);
  }

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const ref = sheet['!ref'];
    if (!ref) continue;

    // Lazy import-free decode: parse A1:B2 style refs roughly via XLSX if available on sheet
    // We accept a decodeRange fn injected or compute from !ref manually.
    const range = decodeRef(ref);
    if (!range) continue;

    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;
    if (rowCount > limits.maxRowsPerSheet) {
      throw new Error(`La hoja "${name}" supera el máximo de ${limits.maxRowsPerSheet} filas`);
    }
    if (colCount > limits.maxColsPerSheet) {
      throw new Error(`La hoja "${name}" supera el máximo de ${limits.maxColsPerSheet} columnas`);
    }
    if (rowCount * colCount > limits.maxCellsPerSheet) {
      throw new Error(`La hoja "${name}" supera el máximo de ${limits.maxCellsPerSheet} celdas`);
    }
  }
}

/**
 * Decodifica un rango A1 simple (p.ej. "A1:N100") sin depender del runtime XLSX
 * para poder unit-testear este módulo en aislamiento.
 */
export function decodeRef(ref) {
  if (!ref || typeof ref !== 'string') return null;
  const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return {
    s: { c: colLettersToIndex(m[1]), r: Number(m[2]) - 1 },
    e: { c: colLettersToIndex(m[3]), r: Number(m[4]) - 1 },
  };
}

function colLettersToIndex(letters) {
  let n = 0;
  const up = String(letters).toUpperCase();
  for (let i = 0; i < up.length; i += 1) {
    n = n * 26 + (up.charCodeAt(i) - 64);
  }
  return n - 1;
}

/**
 * Convierte la primera hoja a objetos fila, omitiendo una fila de título si
 * no contiene ninguno de los encabezados conocidos, y sanitizando celdas.
 *
 * @param {object} worksheet hoja XLSX
 * @param {object} XLSX módulo xlsx
 * @param {string[]} knownHeaders candidatos de encabezado (plantilla + aliases)
 * @returns {{ rows: object[], headerRowIndex: number, headers: string[] }}
 */
export function sheetToSanitizedObjects(worksheet, XLSX, knownHeaders = []) {
  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });

  if (!Array.isArray(aoa) || aoa.length === 0) {
    return { rows: [], headerRowIndex: -1, headers: [] };
  }

  const known = new Set(knownHeaders.map((h) => String(h).trim().toLowerCase()));
  let headerRowIndex = 0;

  const maxProbe = Math.min(5, aoa.length);
  for (let i = 0; i < maxProbe; i += 1) {
    const cells = (aoa[i] || []).map((c) => String(c ?? '').trim().toLowerCase());
    const hit = cells.some((c) => known.has(c));
    if (hit) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = (aoa[headerRowIndex] || []).map((h) => String(h ?? '').trim());
  const rows = [];

  for (let r = headerRowIndex + 1; r < aoa.length; r += 1) {
    const line = aoa[r] || [];
    const obj = {};
    let hasValue = false;
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c];
      if (!key) continue;
      const raw = line[c];
      const sanitized = sanitizeExcelValue(raw === undefined || raw === null ? '' : raw);
      obj[key] = sanitized;
      if (String(sanitized ?? '').trim() !== '') hasValue = true;
    }
    if (hasValue) rows.push(obj);
  }

  return { rows, headerRowIndex, headers };
}
