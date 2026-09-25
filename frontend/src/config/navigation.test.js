import { describe, expect, it } from 'vitest'
import { NAV_MENU, ROLES, entradaActiva, grupoDeEntrada, menuParaRol } from './navigation'

const { ADMIN, INSTRUCTOR, CUENTADANTE, APRENDIZ } = ROLES
const TODOS_LOS_ROLES = [ADMIN, INSTRUCTOR, CUENTADANTE, APRENDIZ]

// Entradas del sidebar ANTERIOR (antes de la armonización), con sus roles.
const SIDEBAR_ANTERIOR = [
  { path: '/equipos', roles: [ADMIN, CUENTADANTE] },
  { path: '/equipos/consultar', roles: TODOS_LOS_ROLES },
  { path: '/mis-equipos', roles: TODOS_LOS_ROLES },
  { path: '/equipos/asignar', roles: [ADMIN, INSTRUCTOR, CUENTADANTE] },
  { path: '/equipos/prestados', roles: [ADMIN, INSTRUCTOR, CUENTADANTE] },
  { path: '/equipos/verificar', roles: [INSTRUCTOR, CUENTADANTE] },
  { path: '/equipos/autorizaciones', roles: [ADMIN, INSTRUCTOR, CUENTADANTE] },
  { path: '/equipos/cuentadantes/buscar', roles: [ADMIN] },
  { path: '/ambientes', roles: [ADMIN, CUENTADANTE] },
  { path: '/ambientes/asignar', roles: [ADMIN] },
  { path: '/novedades', roles: [ADMIN, INSTRUCTOR, CUENTADANTE] },
  { path: '/mantenimientos', roles: [ADMIN, CUENTADANTE] },
  { path: '/horarios', roles: [ADMIN, INSTRUCTOR, CUENTADANTE] },
]

// Acciones que salen del menú (decisión D9) y desde dónde se llega ahora.
const ACCIONES_FUERA_DEL_MENU = {
  '/equipos': 'botón «Registrar equipo» en la cabecera de Consultar inventario',
  '/mis-equipos': 'vista «Bajo mi responsabilidad» de Consultar inventario',
  '/equipos/asignar': 'botón «Asignar» de cada equipo',
  '/equipos/verificar': 'botón «Verificar» de cada equipo',
  '/ambientes/asignar': 'botón «Asignar ambientes» en la cabecera de Ambientes',
}

const rutasDelMenu = rol =>
  menuParaRol(rol).flatMap(entrada => (entrada.items || [entrada]).map(item => item.path))

describe('navegación: ninguna capacidad del sidebar anterior se pierde', () => {
  it.each(TODOS_LOS_ROLES)('%s sigue llegando a todo lo que tenía', rol => {
    const rutas = rutasDelMenu(rol)
    for (const entrada of SIDEBAR_ANTERIOR.filter(e => e.roles.includes(rol))) {
      const enMenu = rutas.includes(entrada.path)
      const reubicada = Boolean(ACCIONES_FUERA_DEL_MENU[entrada.path])
      expect(enMenu || reubicada, `${rol} perdió acceso a ${entrada.path}`).toBe(true)
    }
  })

  it('las acciones reubicadas no aparecen en el menú de consulta', () => {
    for (const rol of TODOS_LOS_ROLES) {
      const rutas = rutasDelMenu(rol)
      for (const ruta of Object.keys(ACCIONES_FUERA_DEL_MENU)) {
        expect(rutas).not.toContain(ruta)
      }
    }
  })

  it('no amplía lo que cada rol ve respecto del sidebar anterior', () => {
    const permitidasAntes = rol => [
      '/dashboard',
      '/usuarios', '/aprendices', '/config',
      ...SIDEBAR_ANTERIOR.filter(e => e.roles.includes(rol)).map(e => e.path),
    ]
    for (const rol of TODOS_LOS_ROLES) {
      for (const ruta of rutasDelMenu(rol)) {
        const base = ruta.split('?')[0]
        expect(permitidasAntes(rol)).toContain(base)
      }
    }
  })
})

describe('menuParaRol', () => {
  it('Aprendiz ve Inicio, Consultar inventario y su configuración personal', () => {
    const menu = menuParaRol(APRENDIZ)
    expect(menu.map(e => e.key)).toEqual(['inicio', 'inventario', 'config'])
    expect(menu.find(e => e.key === 'inventario').items.map(i => i.key)).toEqual(['consultar'])
    expect(menu.find(e => e.key === 'config').items.map(i => i.key)).toEqual(['seguridad', 'notificaciones'])
  })

  it('Instructor ve horarios pero no la gestión de ambientes ni mantenimientos', () => {
    const menu = menuParaRol(INSTRUCTOR)
    expect(menu.find(e => e.key === 'ambientes-horarios').items.map(i => i.key)).toEqual(['horarios'])
    expect(menu.find(e => e.key === 'inventario').items.map(i => i.key)).not.toContain('mantenimientos')
  })

  it('solo el Administrador ve «Buscar cuentadante»', () => {
    expect(rutasDelMenu(ADMIN)).toContain('/equipos/cuentadantes/buscar')
    for (const rol of [INSTRUCTOR, CUENTADANTE, APRENDIZ]) {
      expect(rutasDelMenu(rol)).not.toContain('/equipos/cuentadantes/buscar')
    }
  })

  it('un rol desconocido solo ve las entradas abiertas a todos', () => {
    expect(rutasDelMenu('Invitado')).toEqual([
      '/dashboard',
      '/equipos/consultar',
      '/config?section=security',
      '/config?section=notifications',
    ])
  })
})

describe('entradaActiva', () => {
  it.each([
    ['/equipos/consultar', 'consultar'],
    ['/equipos', 'consultar'],
    ['/mis-equipos', 'consultar'],
    ['/equipos/detalle/62', 'consultar'],
    ['/equipos/62/historial', 'consultar'],
    ['/equipos/verificar', 'consultar'],
    ['/equipos/asignar', 'consultar'],
    ['/equipos/historial-movimientos/5', 'consultar'],
    ['/equipos/prestados', 'prestados'],
    ['/equipos/autorizaciones', 'autorizaciones'],
    ['/equipos/cuentadantes/buscar', 'buscar-cuentadante'],
    ['/novedades', 'novedades'],
    ['/reportes', 'novedades'],
    ['/mantenimientos', 'mantenimientos'],
    ['/ambientes/12', 'ambientes'],
    ['/ambientes/asignar', 'ambientes'],
    ['/horarios', 'horarios'],
    ['/dashboard', 'inicio'],
  ])('%s resalta %s para el Administrador', (ruta, clave) => {
    expect(entradaActiva(ADMIN, ruta)).toBe(clave)
  })

  it('distingue las secciones de Configuración por ?section=', () => {
    expect(entradaActiva(ADMIN, '/config', '?section=roles')).toBe('roles')
    expect(entradaActiva(ADMIN, '/config', '')).toBe('seguridad')
  })

  it('no resalta entradas que el rol no puede ver', () => {
    expect(entradaActiva(INSTRUCTOR, '/ambientes/12')).toBeNull()
    expect(entradaActiva(APRENDIZ, '/equipos/prestados')).toBeNull()
  })

  it('grupoDeEntrada encuentra el grupo contenedor', () => {
    expect(grupoDeEntrada('prestados')).toBe('inventario')
    expect(grupoDeEntrada('horarios')).toBe('ambientes-horarios')
    expect(grupoDeEntrada('inicio')).toBeNull()
    expect(grupoDeEntrada(null)).toBeNull()
  })

  it('todas las entradas tienen título, ícono y ruta', () => {
    for (const entrada of NAV_MENU) {
      for (const item of entrada.items || [entrada]) {
        expect(item.title).toBeTruthy()
        expect(item.icon).toBeTruthy()
        expect(item.path).toMatch(/^\//)
      }
    }
  })
})
