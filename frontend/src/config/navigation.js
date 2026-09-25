import {
  FiAlertCircle,
  FiBell,
  FiCalendar,
  FiClipboard,
  FiHome,
  FiKey,
  FiMapPin,
  FiMonitor,
  FiPackage,
  FiSearch,
  FiSettings,
  FiShield,
  FiTool,
  FiUser,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi'

/**
 * Navegación principal de SGI.
 *
 * El sidebar sirve para CONSULTAR y ver el ESTADO de cada área (contadores).
 * Las acciones que crean o cambian algo (registrar, verificar, asignar, mover,
 * registrar novedad o mantenimiento…) están en la cabecera de cada pantalla y
 * en los botones de cada equipo. Las rutas de esas acciones se conservan; solo
 * dejan de tener entrada propia en el menú.
 *
 * Los roles aquí solo deciden qué se MUESTRA: la autorización real la aplica el
 * backend en cada endpoint.
 */

export const ROLES = Object.freeze({
  ADMIN: 'Administrador',
  INSTRUCTOR: 'Instructor',
  CUENTADANTE: 'Cuentadante',
  APRENDIZ: 'Aprendiz',
})

const { ADMIN, INSTRUCTOR, CUENTADANTE } = ROLES
const TODOS = 'all'
const PERSONAL = [ADMIN, INSTRUCTOR, CUENTADANTE]
const GESTION = [ADMIN, CUENTADANTE]

const exacta = (...rutas) => pathname => rutas.includes(pathname)
const prefijo = (...rutas) => pathname =>
  rutas.some(ruta => pathname === ruta || pathname.startsWith(`${ruta}/`))

/**
 * Entradas del menú. `activa` decide qué entrada queda resaltada: las pantallas
 * de acción (registrar, verificar, asignar, documento…) resaltan la entrada de
 * consulta desde la que se abren.
 */
export const NAV_MENU = [
  {
    key: 'inicio',
    title: 'Inicio',
    icon: FiHome,
    path: '/dashboard',
    roles: [TODOS],
    activa: exacta('/', '/dashboard'),
  },
  {
    key: 'inventario',
    title: 'Inventario',
    icon: FiPackage,
    roles: [TODOS],
    items: [
      {
        key: 'consultar',
        title: 'Consultar inventario',
        icon: FiSearch,
        path: '/equipos/consultar',
        roles: [TODOS],
        estado: 'inventario',
        activa: pathname =>
          exacta('/equipos', '/mis-equipos', '/asignaciones')(pathname) ||
          prefijo(
            '/equipos/consultar',
            '/equipos/detalle',
            '/equipos/verificar',
            '/equipos/asignar',
            '/equipos/documento',
            '/equipos/historial-verificaciones',
            '/equipos/historial-movimientos'
          )(pathname) ||
          /^\/equipos\/\d+\/historial$/.test(pathname),
      },
      {
        key: 'prestados',
        title: 'Equipos prestados',
        icon: FiMonitor,
        path: '/equipos/prestados',
        roles: PERSONAL,
        estado: 'prestados',
        activa: prefijo('/equipos/prestados'),
      },
      {
        key: 'autorizaciones',
        title: 'Autorizaciones',
        icon: FiClipboard,
        path: '/equipos/autorizaciones',
        roles: PERSONAL,
        estado: 'autorizaciones',
        activa: prefijo(
          '/equipos/autorizaciones',
          '/equipos/solicitar-autorizacion',
          '/equipos/autorizaciones-pendientes'
        ),
      },
      {
        key: 'novedades',
        title: 'Novedades y reportes',
        icon: FiAlertCircle,
        path: '/novedades',
        roles: PERSONAL,
        estado: 'novedades',
        activa: prefijo('/novedades', '/reportes'),
      },
      {
        key: 'mantenimientos',
        title: 'Mantenimientos',
        icon: FiTool,
        path: '/mantenimientos',
        roles: GESTION,
        estado: 'mantenimientos',
        activa: prefijo('/mantenimientos'),
      },
      {
        key: 'buscar-cuentadante',
        title: 'Buscar cuentadante',
        icon: FiUserCheck,
        path: '/equipos/cuentadantes/buscar',
        roles: [ADMIN],
        activa: prefijo('/equipos/cuentadantes/buscar'),
      },
    ],
  },
  {
    key: 'ambientes-horarios',
    title: 'Ambientes y horarios',
    icon: FiMapPin,
    roles: PERSONAL,
    items: [
      {
        key: 'ambientes',
        title: 'Ambientes',
        icon: FiMapPin,
        path: '/ambientes',
        roles: GESTION,
        estado: 'ambientes',
        activa: prefijo('/ambientes'),
      },
      {
        key: 'horarios',
        title: 'Horarios',
        icon: FiCalendar,
        path: '/horarios',
        roles: PERSONAL,
        estado: 'horarios',
        activa: prefijo('/horarios', '/clases'),
      },
    ],
  },
  {
    key: 'config',
    title: 'Configuración',
    icon: FiSettings,
    roles: [TODOS],
    colapsadoPorDefecto: true,
    items: [
      { key: 'usuarios', title: 'Usuarios', icon: FiUsers, path: '/usuarios', roles: PERSONAL, activa: prefijo('/usuarios') },
      { key: 'aprendices', title: 'Aprendices', icon: FiUser, path: '/aprendices', roles: [ADMIN], activa: prefijo('/aprendices') },
      { key: 'seguridad', title: 'Seguridad', icon: FiShield, path: '/config?section=security', roles: [TODOS] },
      { key: 'codigos', title: 'Códigos de Seguridad', icon: FiKey, path: '/config?section=invitation-codes', roles: [ADMIN] },
      { key: 'tipos-equipo', title: 'Tipos de Equipos', icon: FiPackage, path: '/config?section=tipos-equipo', roles: [ADMIN] },
      { key: 'roles', title: 'Roles y Áreas', icon: FiSettings, path: '/config?section=roles', roles: GESTION },
      { key: 'notificaciones', title: 'Notificaciones', icon: FiBell, path: '/config?section=notifications', roles: [TODOS] },
    ],
  },
]

export const puedeVer = (entrada, rol) =>
  entrada.roles.includes(TODOS) || entrada.roles.includes(rol)

/**
 * Menú filtrado por rol: quita entradas no permitidas y grupos vacíos.
 */
export function menuParaRol(rol) {
  return NAV_MENU.filter(entrada => puedeVer(entrada, rol))
    .map(entrada =>
      entrada.items
        ? { ...entrada, items: entrada.items.filter(item => puedeVer(item, rol)) }
        : entrada
    )
    .filter(entrada => !entrada.items || entrada.items.length > 0)
}

/** Las entradas de Configuración se distinguen por `?section=`. */
function coincideConfig(item, pathname, search) {
  if (!item.path.startsWith('/config?')) return false
  if (pathname !== '/config') return false
  const esperado = new URLSearchParams(item.path.split('?')[1]).get('section')
  const actual = new URLSearchParams(search).get('section') || 'security'
  return esperado === actual
}

/**
 * Clave de la entrada que debe resaltarse para la ruta actual (o null).
 */
export function entradaActiva(rol, pathname, search = '') {
  for (const entrada of menuParaRol(rol)) {
    const candidatas = entrada.items || [entrada]
    for (const item of candidatas) {
      if (item.activa?.(pathname) || coincideConfig(item, pathname, search)) {
        return item.key
      }
    }
  }
  return null
}

/** Grupo que contiene una entrada (para abrirlo automáticamente). */
export function grupoDeEntrada(clave) {
  return NAV_MENU.find(entrada => entrada.items?.some(item => item.key === clave))?.key || null
}
