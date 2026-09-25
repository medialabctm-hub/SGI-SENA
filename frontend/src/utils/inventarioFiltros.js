/**
 * Estado de «Consultar inventario»: vista, búsqueda, filtros por columna y
 * paginación. Vive en la URL para que se pueda compartir, sobreviva a «volver»
 * desde una acción y para que tabla, total y Excel pidan exactamente lo mismo.
 */

export const VISTAS = Object.freeze({
  TODOS: 'todos',
  MIS_AMBIENTES: 'mis_ambientes',
  A_CARGO: 'a_cargo',
  HABILITADOS: 'habilitados',
  MI_RESPONSABILIDAD: 'mi_responsabilidad',
})

export const LIMITES_PAGINA = Object.freeze([25, 50, 100])
export const LIMITE_POR_DEFECTO = 25

/** Filtros por columna: clave en la URL = parámetro del API. */
export const FILTROS = Object.freeze({
  placa: { tipo: 'texto' },
  tipo_texto: { tipo: 'texto' },
  modelo: { tipo: 'texto' },
  ambiente: { tipo: 'multiple' },
  estado_fisico: { tipo: 'multiple' },
  estado_operativo: { tipo: 'multiple' },
  status_verificacion: { tipo: 'unico' },
  en_prestamo: { tipo: 'unico' },
  id_cuentadante: { tipo: 'unico' },
})

/**
 * Vistas que ofrece la pantalla a cada rol. Todas se resuelven en el servidor
 * con el alcance del usuario; «Bajo mi responsabilidad» usa su propia consulta
 * personal (responsables y equipos a cargo) y conserva sus columnas.
 */
export function vistasDisponibles(rol, cuentadanteConAmbientes = false) {
  const miResponsabilidad = { key: VISTAS.MI_RESPONSABILIDAD, label: 'Bajo mi responsabilidad' }
  switch (rol) {
    case 'Administrador':
      return [{ key: VISTAS.TODOS, label: 'Todos los equipos' }, miResponsabilidad]
    case 'Instructor':
      return [{ key: VISTAS.MIS_AMBIENTES, label: 'Equipos de mis ambientes' }, miResponsabilidad]
    case 'Cuentadante':
      return cuentadanteConAmbientes
        ? [
            { key: VISTAS.TODOS, label: 'Todos (mis ambientes y a cargo)' },
            { key: VISTAS.MIS_AMBIENTES, label: 'Mis ambientes' },
            { key: VISTAS.A_CARGO, label: 'Inventario a cargo' },
            miResponsabilidad,
          ]
        : [{ key: VISTAS.A_CARGO, label: 'Inventario a cargo' }, miResponsabilidad]
    case 'Aprendiz':
      return [{ key: VISTAS.HABILITADOS, label: 'Equipos habilitados' }, miResponsabilidad]
    default:
      return [{ key: VISTAS.TODOS, label: 'Equipos' }]
  }
}

/** Parámetro vista_inventario que entiende el servidor (solo aplica al Cuentadante). */
export function vistaInventarioServidor(vista, rol, cuentadanteConAmbientes) {
  if (rol !== 'Cuentadante' || !cuentadanteConAmbientes) return null
  return { [VISTAS.TODOS]: 'todos', [VISTAS.MIS_AMBIENTES]: 'ambientes', [VISTAS.A_CARGO]: 'inventario_total' }[vista] || null
}

const enteroEn = (valor, permitidos, porDefecto) => {
  const n = Number.parseInt(valor, 10)
  return permitidos.includes(n) ? n : porDefecto
}

/** Lee el estado desde la URL, descartando valores desconocidos. */
export function leerEstadoInventario(searchParams, vistasPermitidas) {
  const claves = vistasPermitidas.map(v => v.key)
  const vista = claves.includes(searchParams.get('vista')) ? searchParams.get('vista') : claves[0]
  const filtros = {}
  for (const [clave, { tipo }] of Object.entries(FILTROS)) {
    if (tipo === 'multiple') {
      const valores = searchParams.getAll(clave).map(v => v.trim()).filter(Boolean)
      if (valores.length) filtros[clave] = [...new Set(valores)]
    } else {
      const valor = (searchParams.get(clave) || '').trim()
      if (valor) filtros[clave] = valor
    }
  }
  const pagina = Math.max(1, Number.parseInt(searchParams.get('pagina'), 10) || 1)
  return {
    vista,
    q: (searchParams.get('q') || '').trim(),
    filtros,
    pagina,
    limite: enteroEn(searchParams.get('limite'), LIMITES_PAGINA, LIMITE_POR_DEFECTO),
  }
}

/** Serializa el estado a la URL omitiendo valores por defecto. */
export function estadoInventarioAUrl(estado, vistaPorDefecto) {
  const params = new URLSearchParams()
  if (estado.vista && estado.vista !== vistaPorDefecto) params.set('vista', estado.vista)
  if (estado.q) params.set('q', estado.q)
  for (const [clave, valor] of Object.entries(estado.filtros || {})) {
    if (Array.isArray(valor)) valor.forEach(v => params.append(clave, v))
    else if (valor) params.set(clave, valor)
  }
  if (estado.pagina > 1) params.set('pagina', String(estado.pagina))
  if (estado.limite && estado.limite !== LIMITE_POR_DEFECTO) params.set('limite', String(estado.limite))
  return params
}

/**
 * Parámetros para GET /api/equipos. Sin paginación sirven para la exportación,
 * que recorre todas las páginas con el mismo criterio.
 */
export function parametrosApiInventario(estado, { rol, cuentadanteConAmbientes, conPaginacion = true } = {}) {
  const params = new URLSearchParams()
  const vistaServidor = vistaInventarioServidor(estado.vista, rol, cuentadanteConAmbientes)
  if (vistaServidor) params.set('vista_inventario', vistaServidor)
  if (estado.q) params.set('search', estado.q)
  for (const [clave, valor] of Object.entries(estado.filtros || {})) {
    if (clave === 'id_cuentadante' && rol !== 'Administrador') continue
    if (Array.isArray(valor)) valor.forEach(v => params.append(clave, v))
    else if (valor) params.set(clave, valor)
  }
  if (conPaginacion) {
    params.set('page', String(estado.pagina || 1))
    params.set('limit', String(estado.limite || LIMITE_POR_DEFECTO))
  }
  return params
}

export const hayFiltrosActivos = estado =>
  Boolean(estado.q) || Object.keys(estado.filtros || {}).length > 0
