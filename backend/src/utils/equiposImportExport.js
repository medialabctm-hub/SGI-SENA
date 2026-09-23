/**
 * Contrato único import/export Equipos (MDL-210).
 * Fuente de verdad = columnas de la plantilla FE (ImportarEquipos).
 *
 * Aliases documentados (export humano legacy → plantilla):
 *   Código Inventario     → placa
 *   Tipo                  → tipo
 *   Modelo                → modelo
 *   Consecutivo           → consecutivo
 *   Descripción           → descripcion
 *   Fecha Adquisición     → fecha_adquisicion
 *   Valor Ingreso         → valor_ingreso
 *   Ambiente              → ambiente
 *   Atributos             → atributos
 *   Categoría             → categoria
 *   foto / URL Imagen     → url_imagen
 */

/** Columnas exactas de la plantilla (orden de export "para reimportar"). */
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

/**
 * Mapa alias (header humano / legacy) → campo canónico de plantilla.
 * Keys en minúsculas para comparación case-insensitive.
 */
export const EQUIPOS_HEADER_ALIASES = Object.freeze({
  placa: 'placa',
  codigo_inventario: 'placa',
  'codigo inventario': 'placa',
  'código inventario': 'placa',
  tipo: 'tipo',
  categoria: 'categoria',
  categoría: 'categoria',
  modelo: 'modelo',
  consecutivo: 'consecutivo',
  descripcion: 'descripcion',
  descripción: 'descripcion',
  fecha_adquisicion: 'fecha_adquisicion',
  'fecha adquisicion': 'fecha_adquisicion',
  'fecha adquisición': 'fecha_adquisicion',
  valor_ingreso: 'valor_ingreso',
  'valor ingreso': 'valor_ingreso',
  valor: 'valor_ingreso',
  costo: 'valor_ingreso',
  r_centro: 'r_centro',
  rcentro: 'r_centro',
  centro: 'r_centro',
  codigo_centro: 'r_centro',
  atributos: 'atributos',
  especificaciones: 'atributos',
  specs: 'atributos',
  specs_completas: 'atributos',
  ambiente: 'ambiente',
  codigo_ambiente: 'ambiente',
  'codigo ambiente': 'ambiente',
  'nombre ambiente': 'ambiente',
  url_imagen: 'url_imagen',
  'url imagen': 'url_imagen',
  foto: 'url_imagen',
  imagen: 'url_imagen',
  ruta_imagen: 'url_imagen',
});

/** Encabezados conocidos (plantilla + aliases) para detectar fila de título. */
export const EQUIPOS_KNOWN_HEADERS = Object.freeze([
  ...EQUIPOS_PLANTILLA_COLUMNS,
  'Código Inventario',
  'Codigo Inventario',
  'Tipo',
  'Categoría',
  'Categoria',
  'Modelo',
  'Consecutivo',
  'Descripción',
  'Descripcion',
  'Fecha Adquisición',
  'Fecha Adquisicion',
  'Valor Ingreso',
  'Ambiente',
  'Atributos',
  'foto',
  'URL Imagen',
  'Placa',
]);

const API_IMAGEN_PREFIX = '/api/equipos/imagenes/archivo/';
const LEGACY_UPLOADS_PREFIX = '/uploads/equipos/';
const SAFE_FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Convierte cualquier referencia de evidencia a ruta relativa autorizada.
 * Nunca devuelve `/uploads/equipos/...` (estático público).
 * Acepta: path API, legacy uploads, o basename seguro.
 */
export function toSecureEquipoImageUrl(rutaOrFilename) {
  if (rutaOrFilename === null || rutaOrFilename === undefined) return '';
  const raw = String(rutaOrFilename).trim()
  if (!raw || raw === '-') return ''
  if (raw.includes('..')) return ''

  // Extraer basename de URLs/paths conocidos
  let filename = raw;
  const apiIdx = raw.indexOf(API_IMAGEN_PREFIX);
  if (apiIdx !== -1) {
    filename = decodeURIComponent(raw.slice(apiIdx + API_IMAGEN_PREFIX.length).split(/[?#]/)[0]);
  } else if (raw.includes(LEGACY_UPLOADS_PREFIX)) {
    filename = decodeURIComponent(raw.slice(raw.indexOf(LEGACY_UPLOADS_PREFIX) + LEGACY_UPLOADS_PREFIX.length).split(/[?#]/)[0]);
  } else if (/^https?:\/\//i.test(raw)) {
    // URL absoluta ajena: no reexportar (podría ser pública o filtrar auth)
    try {
      const u = new URL(raw);
      if (u.pathname.includes(API_IMAGEN_PREFIX)) {
        filename = decodeURIComponent(u.pathname.slice(u.pathname.indexOf(API_IMAGEN_PREFIX) + API_IMAGEN_PREFIX.length));
      } else if (u.pathname.includes(LEGACY_UPLOADS_PREFIX)) {
        filename = decodeURIComponent(u.pathname.split('/').pop() || '');
      } else {
        return '';
      }
    } catch {
      return '';
    }
  } else if (raw.includes('/')) {
    filename = raw.split('/').pop() || '';
  }

  filename = String(filename).trim();
  if (!SAFE_FILENAME_RE.test(filename)) return '';
  return `${API_IMAGEN_PREFIX}${encodeURIComponent(filename)}`;
}

function pickField(row, canonical) {
  if (!row || typeof row !== 'object') return '';

  if (row[canonical] !== undefined && row[canonical] !== null && String(row[canonical]).trim() !== '') {
    return row[canonical];
  }

  for (const [key, value] of Object.entries(row)) {
    const norm = String(key).trim().toLowerCase();
    if (EQUIPOS_HEADER_ALIASES[norm] === canonical) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
  }
  return '';
}

function emptyToBlank(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s === '-' ? '' : s;
}

/**
 * Normaliza una fila de Excel al shape de plantilla (incl. aliases humanos).
 * `url_imagen` se normaliza a ruta API autorizada o queda vacío.
 */
export function mapEquipoImportRow(row) {
  const urlRaw = pickField(row, 'url_imagen');
  return {
    placa: String(pickField(row, 'placa') || '').trim(),
    tipo: String(pickField(row, 'tipo') || '').trim(),
    categoria: String(pickField(row, 'categoria') || '').trim(),
    modelo: String(pickField(row, 'modelo') || '').trim(),
    consecutivo: String(pickField(row, 'consecutivo') || '').trim(),
    descripcion: (() => {
      const v = pickField(row, 'descripcion');
      const s = String(v ?? '').trim();
      return s && s !== '-' ? s : null;
    })(),
    fecha_adquisicion: (() => {
      const v = pickField(row, 'fecha_adquisicion');
      const s = String(v ?? '').trim();
      return s && s !== '-' ? s : null;
    })(),
    valor_ingreso: (() => {
      const v = pickField(row, 'valor_ingreso');
      const s = String(v ?? '').trim();
      return s && s !== '-' ? s : null;
    })(),
    r_centro: (() => {
      const v = pickField(row, 'r_centro');
      const s = String(v ?? '').trim();
      return s && s !== '-' ? s : null;
    })(),
    atributos: (() => {
      const v = pickField(row, 'atributos');
      const s = String(v ?? '').trim();
      return s && s !== '-' ? s : null;
    })(),
    ambiente: String(pickField(row, 'ambiente') || '').trim(),
    url_imagen: toSecureEquipoImageUrl(urlRaw),
  };
}

/**
 * Fila de export reimportable. Omite valor financiero si no viene en el DTO (H-01).
 * Incluye url_imagen solo como ruta relativa autorizada cuando hay evidencia.
 */
export function buildEquipoExportRow(eq) {
  const hasValor =
    eq?.valor_ingreso !== undefined &&
    eq?.valor_ingreso !== null &&
    String(eq.valor_ingreso).trim() !== '' &&
    String(eq.valor_ingreso).trim() !== '-';
  const hasCosto =
    eq?.costo !== undefined &&
    eq?.costo !== null &&
    String(eq.costo).trim() !== '' &&
    String(eq.costo).trim() !== '-';

  const imagenSrc =
    eq?.url_imagen || eq?.ruta_imagen || eq?.foto || eq?.imagen_principal || '';

  return {
    placa: emptyToBlank(eq?.placa || eq?.codigo_inventario),
    tipo: emptyToBlank(eq?.tipo),
    categoria: emptyToBlank(eq?.categoria || eq?.nombre_categoria),
    modelo: emptyToBlank(eq?.modelo),
    consecutivo: emptyToBlank(eq?.consecutivo),
    descripcion: emptyToBlank(eq?.descripcion),
    fecha_adquisicion: (() => {
      const raw = eq?.fecha_adquisicion;
      if (!raw) return '';
      try {
        const d = raw instanceof Date ? raw : new Date(raw);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      } catch {
        /* fallthrough */
      }
      const s = String(raw).trim();
      return s.length >= 10 ? s.slice(0, 10) : emptyToBlank(s);
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
  };
}
