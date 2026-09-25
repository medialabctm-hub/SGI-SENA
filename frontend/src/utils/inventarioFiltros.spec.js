import { describe, expect, it } from 'vitest'
import {
  VISTAS,
  estadoInventarioAUrl,
  hayFiltrosActivos,
  leerEstadoInventario,
  parametrosApiInventario,
  vistaInventarioServidor,
  vistasDisponibles,
} from './inventarioFiltros'

const claves = vistas => vistas.map(v => v.key)

describe('vistasDisponibles', () => {
  it('ofrece a cada rol solo vistas de su alcance, siempre con «Bajo mi responsabilidad»', () => {
    expect(claves(vistasDisponibles('Administrador'))).toEqual([VISTAS.TODOS, VISTAS.MI_RESPONSABILIDAD])
    expect(claves(vistasDisponibles('Instructor'))).toEqual([VISTAS.MIS_AMBIENTES, VISTAS.MI_RESPONSABILIDAD])
    expect(claves(vistasDisponibles('Aprendiz'))).toEqual([VISTAS.HABILITADOS, VISTAS.MI_RESPONSABILIDAD])
    expect(claves(vistasDisponibles('Cuentadante', true))).toEqual([
      VISTAS.TODOS, VISTAS.MIS_AMBIENTES, VISTAS.A_CARGO, VISTAS.MI_RESPONSABILIDAD,
    ])
    expect(claves(vistasDisponibles('Cuentadante', false))).toEqual([VISTAS.A_CARGO, VISTAS.MI_RESPONSABILIDAD])
    expect(claves(vistasDisponibles(''))).toEqual([VISTAS.TODOS])
  })

  it('solo el Cuentadante con ambientes envía vista_inventario al servidor', () => {
    expect(vistaInventarioServidor(VISTAS.MIS_AMBIENTES, 'Cuentadante', true)).toBe('ambientes')
    expect(vistaInventarioServidor(VISTAS.A_CARGO, 'Cuentadante', true)).toBe('inventario_total')
    expect(vistaInventarioServidor(VISTAS.TODOS, 'Cuentadante', true)).toBe('todos')
    expect(vistaInventarioServidor(VISTAS.TODOS, 'Cuentadante', false)).toBeNull()
    expect(vistaInventarioServidor(VISTAS.TODOS, 'Administrador', true)).toBeNull()
  })
})

describe('estado del inventario en la URL', () => {
  const vistas = vistasDisponibles('Administrador')

  it('lee vista, búsqueda, filtros múltiples y paginación descartando lo desconocido', () => {
    const estado = leerEstadoInventario(
      new URLSearchParams('vista=inventada&q=%20latitude%20&ambiente=12&ambiente=14&ambiente=12&estado_operativo=En%20Uso&placa=%20&pagina=3&limite=77&otro=x'),
      vistas,
    )
    expect(estado).toEqual({
      vista: VISTAS.TODOS,
      q: 'latitude',
      filtros: { ambiente: ['12', '14'], estado_operativo: ['En Uso'] },
      pagina: 3,
      limite: 25,
    })
  })

  it('ida y vuelta sin perder filtros y omitiendo valores por defecto', () => {
    const estado = {
      vista: VISTAS.MI_RESPONSABILIDAD,
      q: 'dell',
      filtros: { ambiente: ['12', '14'], en_prestamo: 'si' },
      pagina: 2,
      limite: 50,
    }
    const url = estadoInventarioAUrl(estado, VISTAS.TODOS)
    expect(url.toString()).toBe('vista=mi_responsabilidad&q=dell&ambiente=12&ambiente=14&en_prestamo=si&pagina=2&limite=50')
    expect(leerEstadoInventario(url, vistas)).toEqual(estado)

    const porDefecto = estadoInventarioAUrl({ vista: VISTAS.TODOS, q: '', filtros: {}, pagina: 1, limite: 25 }, VISTAS.TODOS)
    expect(porDefecto.toString()).toBe('')
  })

  it('arma los parámetros del API; sin paginación sirven para exportar lo mismo', () => {
    const estado = { vista: VISTAS.MIS_AMBIENTES, q: 'hp', filtros: { ambiente: ['12', '14'], id_cuentadante: '7' }, pagina: 2, limite: 25 }

    const conPagina = parametrosApiInventario(estado, { rol: 'Cuentadante', cuentadanteConAmbientes: true })
    expect(conPagina.toString()).toBe('vista_inventario=ambientes&search=hp&ambiente=12&ambiente=14&page=2&limit=25')

    const exportacion = parametrosApiInventario(estado, { rol: 'Administrador', conPaginacion: false })
    expect(exportacion.toString()).toBe('search=hp&ambiente=12&ambiente=14&id_cuentadante=7')
  })

  it('detecta filtros activos', () => {
    expect(hayFiltrosActivos({ q: '', filtros: {} })).toBe(false)
    expect(hayFiltrosActivos({ q: 'x', filtros: {} })).toBe(true)
    expect(hayFiltrosActivos({ q: '', filtros: { placa: '1' } })).toBe(true)
  })
})
