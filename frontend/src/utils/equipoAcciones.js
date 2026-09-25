import { canManageEquipoAssignments, canUpdateEquipos } from './permissions'

/**
 * Acciones sobre UN equipo, agrupadas por tipo (decisión D10, opción A):
 * cada grupo es una columna de la tabla de inventario. Solo decide qué se
 * MUESTRA; el backend sigue autorizando cada operación.
 */

export const GRUPOS_ACCION = Object.freeze([
  { key: 'consultar', titulo: 'Consultar' },
  { key: 'gestionar', titulo: 'Gestionar' },
  { key: 'registrar', titulo: 'Registrar' },
  { key: 'administrar', titulo: 'Administrar' },
])

const PERSONAL = ['Administrador', 'Instructor', 'Cuentadante']
const esVerificado = equipo => equipo?.status_verificacion === 'Verificado'

/**
 * @param {Object} equipo - fila del inventario (codigo_equipo, status_verificacion…)
 * @param {Object} usuario - usuario de la sesión (nombre_rol, permisos?)
 * @returns {Array<{key: string, grupo: string, etiqueta: string, ayuda: string}>}
 */
export function accionesDeEquipo(equipo, usuario) {
  const rol = usuario?.nombre_rol
  const personal = PERSONAL.includes(rol)
  const acciones = [
    { key: 'ver-detalle', grupo: 'consultar', etiqueta: 'Ver detalle', ayuda: 'Ver la ficha completa del equipo', visible: true },
    { key: 'historial', grupo: 'consultar', etiqueta: 'Historial', ayuda: 'Verificaciones, movimientos, responsables, préstamos, novedades y mantenimiento', visible: true },
    {
      key: 'verificar',
      grupo: 'gestionar',
      etiqueta: 'Verificar',
      ayuda: 'Registrar la verificación física en tu ambiente',
      visible: rol === 'Instructor' || rol === 'Cuentadante',
    },
    {
      key: 'asignar',
      grupo: 'gestionar',
      etiqueta: 'Asignar',
      ayuda: rol === 'Administrador' ? 'Asignar un responsable' : 'Asignar a un aprendiz',
      visible: canManageEquipoAssignments(usuario),
    },
    {
      key: 'mover',
      grupo: 'gestionar',
      etiqueta: 'Mover',
      ayuda: esVerificado(equipo)
        ? 'Equipo verificado: el cambio de ambiente requiere una autorización aprobada'
        : 'Cambiar el equipo de ambiente',
      // Verificado: cualquier persona del equipo puede pedir autorización.
      // Sin verificar: solo quien puede editar equipos lo mueve directamente.
      visible: personal && (esVerificado(equipo) || canUpdateEquipos(usuario)),
    },
    { key: 'novedad', grupo: 'registrar', etiqueta: 'Novedad', ayuda: 'Registrar una novedad de este equipo', visible: personal },
    { key: 'registrar-uso', grupo: 'registrar', etiqueta: 'Registrar uso', ayuda: 'Registrar el uso por un aprendiz', visible: personal },
    {
      key: 'mantenimiento',
      grupo: 'registrar',
      etiqueta: 'Mantenimiento',
      ayuda: 'Registrar un mantenimiento de este equipo',
      visible: rol === 'Administrador' || rol === 'Cuentadante',
    },
    { key: 'editar', grupo: 'administrar', etiqueta: 'Editar', ayuda: 'Editar los datos del equipo', visible: rol === 'Administrador' },
    { key: 'eliminar', grupo: 'administrar', etiqueta: 'Eliminar', ayuda: 'Eliminar el equipo', visible: rol === 'Administrador' },
  ]
  return acciones.filter(a => a.visible).map(({ visible: _visible, ...accion }) => accion)
}

/**
 * Grupos que el rol puede usar con algún equipo. Se calcula con un equipo
 * verificado y otro sin verificar para que las columnas no cambien entre filas.
 */
export function gruposDeAccionVisibles(usuario) {
  const presentes = new Set([
    ...accionesDeEquipo({ status_verificacion: 'Verificado' }, usuario),
    ...accionesDeEquipo({ status_verificacion: 'No Verificado' }, usuario),
  ].map(a => a.grupo))
  return GRUPOS_ACCION.filter(g => presentes.has(g.key))
}

/**
 * Ruta interna segura para «volver» (evita redirecciones abiertas).
 */
export function rutaVolverSegura(valor, porDefecto = '/equipos/consultar') {
  if (typeof valor !== 'string') return porDefecto
  if (!valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) return porDefecto
  return valor
}
