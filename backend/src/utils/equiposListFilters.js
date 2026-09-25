/**
 * Normalización compartida de filtros del listado de equipos.
 *
 * La tabla de «Consultar inventario» y su exportación a Excel usan el mismo
 * endpoint (GET /api/equipos) y, por tanto, esta misma interpretación de los
 * parámetros: lo que se filtra en pantalla es exactamente lo que se cuenta y
 * lo que se exporta. El alcance por rol lo aplica después EquipoService.
 */

export const PRESTAMO_FILTRO_VALUES = Object.freeze(['si', 'no']);

const aLista = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const lista = (Array.isArray(valor) ? valor : [valor])
    .map((v) => String(v).trim())
    .filter(Boolean);
  return lista.length > 0 ? lista : null;
};

const aTexto = (valor) => {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto || null;
};

const aEnteroPositivo = (valor) => {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * Convierte el query string ya validado en { filters, pagination, sorting }.
 * @param {Object} query - req.query (tras validateQuery)
 */
export function parseListarEquiposQuery(query = {}) {
  const prestamo = aTexto(query.en_prestamo);

  const filters = {
    search: aTexto(query.search),
    estado_fisico: aLista(query.estado_fisico),
    estado_operativo: aLista(query.estado_operativo),
    categoria: aTexto(query.categoria),
    tipo: aTexto(query.tipo),
    fecha_desde: aTexto(query.fecha_desde),
    fecha_hasta: aTexto(query.fecha_hasta),
    valor_min: query.valor_min ?? null,
    valor_max: query.valor_max ?? null,
    status_verificacion: aTexto(query.status_verificacion),
    ambiente: aLista(query.ambiente),
    // Vista inventario para Cuentadante con ambientes: ambientes | inventario_total | todos
    vista_inventario: aTexto(query.vista_inventario),
    // Filtros por columna de la tabla (coincidencia parcial, sin comodines del usuario)
    placa: aTexto(query.placa),
    tipo_texto: aTexto(query.tipo_texto),
    modelo: aTexto(query.modelo),
    en_prestamo: PRESTAMO_FILTRO_VALUES.includes(prestamo) ? prestamo : null,
    // Solo el Administrador puede filtrar por cuentadante (EquipoService lo descarta para otros roles)
    id_cuentadante: aEnteroPositivo(query.id_cuentadante),
  };

  const pagination = {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 50,
  };

  const sorting = {
    field: query.sort || 'codigo_equipo',
    order: query.order || 'asc',
  };

  return { filters, pagination, sorting };
}

/**
 * Resuelve referencias de ambiente (id numérico, código o nombre) a id_ambiente.
 * Las referencias que no existen se descartan; si ninguna existe devuelve [].
 */
export async function resolverAmbientesIds(db, referencias) {
  const ids = [];
  for (const ref of referencias || []) {
    if (/^\d+$/.test(ref)) {
      ids.push(Number.parseInt(ref, 10));
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const [[fila]] = await db.execute(
      'SELECT id_ambiente FROM Ambientes WHERE codigo_ambiente = ? OR nombre_ambiente = ? LIMIT 1',
      [ref, ref]
    );
    if (fila?.id_ambiente) ids.push(fila.id_ambiente);
  }
  return [...new Set(ids)];
}

/**
 * Escapa los comodines de LIKE para que el texto del usuario se busque literal.
 */
export function escaparLike(texto) {
  return String(texto).replace(/[\\%_]/g, (c) => `\\${c}`);
}
