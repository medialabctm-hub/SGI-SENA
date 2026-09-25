/**
 * Texto de estado que el sidebar muestra bajo cada entrada de consulta,
 * a partir de GET /api/navegacion/estado.
 *
 * Devuelve { texto, tono } o null si no hay dato (bloque ausente o fallido):
 * sin dato no se inventa un «0».
 * Tonos: 'neutro' | 'info' | 'aviso' | 'alerta'.
 */

const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`

const TEXTOS = {
  inventario: (dato, rol) => {
    if (rol === 'Aprendiz') return { texto: plural(dato.total, 'equipo habilitado', 'equipos habilitados'), tono: 'neutro' }
    if (rol === 'Instructor') return { texto: plural(dato.total, 'equipo en tus ambientes', 'equipos en tus ambientes'), tono: 'neutro' }
    return { texto: plural(dato.total, 'equipo', 'equipos'), tono: 'neutro' }
  },
  prestados: dato => {
    const base = `${dato.en_uso} en uso ahora`
    if (dato.por_revisar > 0) return { texto: `${base} · ${dato.por_revisar} por revisar`, tono: 'aviso' }
    return { texto: base, tono: dato.en_uso > 0 ? 'info' : 'neutro' }
  },
  autorizaciones: dato => {
    if (dato.por_aprobar > 0) return { texto: `${dato.por_aprobar} por aprobar`, tono: 'alerta' }
    if (dato.mis_pendientes > 0) {
      return { texto: plural(dato.mis_pendientes, 'solicitud tuya en espera', 'solicitudes tuyas en espera'), tono: 'info' }
    }
    return { texto: 'Sin pendientes', tono: 'neutro' }
  },
  novedades: dato =>
    dato.pendientes > 0
      ? { texto: plural(dato.pendientes, 'pendiente', 'pendientes'), tono: 'alerta' }
      : { texto: 'Sin pendientes', tono: 'neutro' },
  mantenimientos: dato => ({
    texto: `${dato.en_proceso} en proceso · ${plural(dato.proximos, 'próximo', 'próximos')}`,
    tono: dato.en_proceso > 0 ? 'info' : 'neutro',
  }),
  ambientes: dato => ({
    texto: dato.en_mantenimiento > 0
      ? `${plural(dato.activos, 'activo', 'activos')} · ${dato.en_mantenimiento} en mantenimiento`
      : plural(dato.activos, 'activo', 'activos'),
    tono: 'neutro',
  }),
  horarios: (dato, rol) => {
    const hoy = rol === 'Administrador'
      ? plural(dato.hoy, 'clase hoy', 'clases hoy')
      : plural(dato.hoy, 'clase tuya hoy', 'clases tuyas hoy')
    return {
      texto: dato.en_curso > 0 ? `${hoy} · ${dato.en_curso} en curso` : hoy,
      tono: dato.en_curso > 0 ? 'info' : 'neutro',
    }
  },
}

export function estadoDeEntrada(claveEstado, estado, rol) {
  const dato = estado?.[claveEstado]
  const construir = TEXTOS[claveEstado]
  if (!dato || !construir) return null
  return construir(dato, rol)
}
