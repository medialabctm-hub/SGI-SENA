/**
 * Contrato plantilla Equipos (debe coincidir con backend).
 * MDL-210 — export "para reimportar".
 */

export const EQUIPOS_PLANTILLA_COLUMNS = Object.freeze([
  'placa',
  'tipo',
  'categoria',
  'modelo',
  'consecutivo',
  'descripcion',
  'fecha_adquisicion',
  'valor_ingreso',
  'r_centro',
  'atributos',
  'ambiente',
  'url_imagen',
]);

const API_IMAGEN_PREFIX = '/api/equipos/imagenes/archivo/'
const LEGACY_UPLOADS_PREFIX = '/uploads/equipos/'
const SAFE_FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

export function toSecureEquipoImageUrl(rutaOrFilename) {
  if (rutaOrFilename === null || rutaOrFilename === undefined) return ''
  const raw = String(rutaOrFilename).trim()
  if (!raw || raw === '-') return ''
  if (raw.includes('..')) return ''

  let filename = raw
  const apiIdx = raw.indexOf(API_IMAGEN_PREFIX)
  if (apiIdx !== -1) {
    filename = decodeURIComponent(raw.slice(apiIdx + API_IMAGEN_PREFIX.length).split(/[?#]/)[0])
  } else if (raw.includes(LEGACY_UPLOADS_PREFIX)) {
    filename = decodeURIComponent(
      raw.slice(raw.indexOf(LEGACY_UPLOADS_PREFIX) + LEGACY_UPLOADS_PREFIX.length).split(/[?#]/)[0]
    )
  } else if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      if (u.pathname.includes(API_IMAGEN_PREFIX)) {
        filename = decodeURIComponent(
          u.pathname.slice(u.pathname.indexOf(API_IMAGEN_PREFIX) + API_IMAGEN_PREFIX.length)
        )
      } else if (u.pathname.includes(LEGACY_UPLOADS_PREFIX)) {
        filename = decodeURIComponent(u.pathname.split('/').pop() || '')
      } else {
        return ''
      }
    } catch {
      return ''
    }
  } else if (raw.includes('/')) {
    filename = raw.split('/').pop() || ''
  }

  filename = String(filename).trim()
  if (!SAFE_FILENAME_RE.test(filename)) return ''
  return `${API_IMAGEN_PREFIX}${encodeURIComponent(filename)}`
}

const emptyToBlank = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return s === '-' ? '' : s
}

/**
 * Fila de export reimportable (mismas columnas que la plantilla + url_imagen).
 * valor_ingreso vacío si el DTO no lo trae (H-01).
 * url_imagen solo como ruta API autorizada — nunca /uploads públicos.
 */
export function buildEquipoExportRow(eq) {
  const hasValor =
    eq?.valor_ingreso !== undefined &&
    eq?.valor_ingreso !== null &&
    String(eq.valor_ingreso).trim() !== '' &&
    String(eq.valor_ingreso).trim() !== '-'
  const hasCosto =
    eq?.costo !== undefined &&
    eq?.costo !== null &&
    String(eq.costo).trim() !== '' &&
    String(eq.costo).trim() !== '-'

  const imagenSrc =
    eq?.url_imagen || eq?.ruta_imagen || eq?.foto || eq?.imagen_principal || ''

  return {
    placa: emptyToBlank(eq?.placa || eq?.codigo_inventario),
    tipo: emptyToBlank(eq?.tipo),
    categoria: emptyToBlank(eq?.categoria || eq?.nombre_categoria),
    modelo: emptyToBlank(eq?.modelo),
    consecutivo: emptyToBlank(eq?.consecutivo),
    descripcion: emptyToBlank(eq?.descripcion),
    fecha_adquisicion: (() => {
      const raw = eq?.fecha_adquisicion
      if (!raw) return ''
      try {
        const d = raw instanceof Date ? raw : new Date(raw)
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
      } catch {
        /* ignore */
      }
      const s = String(raw).trim()
      return s.length >= 10 ? s.slice(0, 10) : emptyToBlank(s)
    })(),
    valor_ingreso: hasValor
      ? emptyToBlank(eq.valor_ingreso)
      : hasCosto
        ? emptyToBlank(eq.costo)
        : '',
    r_centro: emptyToBlank(eq?.r_centro),
    atributos: emptyToBlank(eq?.atributos || eq?.specs_completas),
    ambiente: emptyToBlank(eq?.ambiente || eq?.nombre_ambiente || eq?.codigo_ambiente),
    url_imagen: toSecureEquipoImageUrl(imagenSrc),
  }
}

/**
 * Convierte equipos API → matriz AOA (header + filas), sin fila de título.
 * Con sanitización de fórmulas si se pasa sanitizeRow.
 */
export function buildEquiposExportAoa(equipos, sanitizeRow) {
  const headers = [...EQUIPOS_PLANTILLA_COLUMNS]
  const rows = (equipos || []).map((eq) => {
    const row = buildEquipoExportRow(eq)
    const values = headers.map((h) => row[h] ?? '')
    return typeof sanitizeRow === 'function' ? sanitizeRow(values) : values
  })
  return [headers, ...rows]
}

/** Server-side max limit for GET /api/equipos (MDL-189). Do not raise. */
export const EQUIPOS_EXPORT_PAGE_SIZE = 100

/**
 * Fetch every page of equipos for Excel export via existing GET /api/equipos.
 *
 * Gates (team-confirmed):
 * 1. Paginate with limit ≤ 100 — no uncapped dump endpoint.
 * 2. Same request path/filters as the list UI → same H-01 scope/DTO
 *    (Aprendiz cannot pull foreign inventory or valor/PII via "export all").
 * 3. Returned length equals pagination.total when the API reports total.
 *
 * Loops page=1..N until pagination.hasNext is false or collected >= total.
 *
 * @param {(params: Record<string, string|number>) => Promise<{equipos?: object[], pagination?: object}|object[]>} fetchFn
 *   Receives page, limit, and any baseParams; must return API-shaped data.
 * @param {Record<string, string|number>} [baseParams]
 *   Current list filters (e.g. vista_inventario, search). page/limit are set by this helper.
 * @param {{ pageSize?: number }} [options]
 * @returns {Promise<object[]>}
 */
export async function fetchAllEquiposForExport(fetchFn, baseParams = {}, options = {}) {
  const requested = Number(options.pageSize) || EQUIPOS_EXPORT_PAGE_SIZE
  const pageSize = Math.min(EQUIPOS_EXPORT_PAGE_SIZE, Math.max(1, requested))
  const collected = []
  let page = 1
  let total = null

  while (page <= 10_000) {
    const data = await fetchFn({
      ...baseParams,
      page,
      limit: pageSize,
    })

    const batch = data?.equipos || (Array.isArray(data) ? data : [])
    collected.push(...batch)

    const pagination = data?.pagination || {}
    if (typeof pagination.total === 'number') {
      total = pagination.total
    }

    const reachedTotal = total != null && collected.length >= total
    if (reachedTotal || pagination.hasNext === false || batch.length === 0) {
      break
    }
    if (pagination.hasNext === true) {
      page += 1
      continue
    }
    // Fallback when pagination metadata is missing
    if (batch.length < pageSize) break
    page += 1
  }

  // Gate 3: Excel row count must equal pagination.total for the filter
  if (typeof total === 'number' && total >= 0 && collected.length > total) {
    return collected.slice(0, total)
  }
  return collected
}
