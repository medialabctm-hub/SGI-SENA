import { describe, expect, it } from 'vitest'
import { accionesDeEquipo, gruposDeAccionVisibles, rutaVolverSegura } from './equipoAcciones'

const verificado = { codigo_equipo: 1, status_verificacion: 'Verificado' }
const sinVerificar = { codigo_equipo: 2, status_verificacion: 'No Verificado' }
const claves = (equipo, usuario) => accionesDeEquipo(equipo, usuario).map(a => a.key)

describe('accionesDeEquipo', () => {
  it('Administrador: todo menos verificar', () => {
    expect(claves(sinVerificar, { nombre_rol: 'Administrador' })).toEqual([
      'ver-detalle', 'historial', 'asignar', 'mover', 'novedad', 'registrar-uso', 'mantenimiento', 'editar', 'eliminar',
    ])
  })

  it('Cuentadante: verifica, asigna a aprendices, mueve y registra mantenimiento; no edita en línea', () => {
    expect(claves(sinVerificar, { nombre_rol: 'Cuentadante' })).toEqual([
      'ver-detalle', 'historial', 'verificar', 'asignar', 'mover', 'novedad', 'registrar-uso', 'mantenimiento',
    ])
  })

  it('Instructor solo ofrece «Mover» en equipos verificados (vía autorización)', () => {
    const usuario = { nombre_rol: 'Instructor' }
    expect(claves(verificado, usuario)).toContain('mover')
    expect(claves(sinVerificar, usuario)).not.toContain('mover')
    expect(claves(sinVerificar, usuario)).not.toContain('mantenimiento')
    expect(claves(sinVerificar, usuario)).toContain('verificar')
  })

  it('Aprendiz solo consulta', () => {
    expect(claves(verificado, { nombre_rol: 'Aprendiz' })).toEqual(['ver-detalle', 'historial'])
  })

  it('respeta la lista de permisos explícita cuando la sesión la trae', () => {
    const sinAsignar = { nombre_rol: 'Instructor', permisos: ['equipos:view'] }
    expect(claves(verificado, sinAsignar)).not.toContain('asignar')
    const conUpdate = { nombre_rol: 'Instructor', permisos: ['equipos:update'] }
    expect(claves(sinVerificar, conUpdate)).toContain('mover')
  })

  it('cada acción tiene grupo, etiqueta y ayuda', () => {
    for (const accion of accionesDeEquipo(verificado, { nombre_rol: 'Administrador' })) {
      expect(accion.grupo).toBeTruthy()
      expect(accion.etiqueta).toBeTruthy()
      expect(accion.ayuda).toBeTruthy()
    }
  })
})

describe('gruposDeAccionVisibles', () => {
  it('columnas estables por rol', () => {
    const titulos = usuario => gruposDeAccionVisibles(usuario).map(g => g.titulo)
    expect(titulos({ nombre_rol: 'Administrador' })).toEqual(['Consultar', 'Gestionar', 'Registrar', 'Administrar'])
    expect(titulos({ nombre_rol: 'Cuentadante' })).toEqual(['Consultar', 'Gestionar', 'Registrar'])
    expect(titulos({ nombre_rol: 'Instructor' })).toEqual(['Consultar', 'Gestionar', 'Registrar'])
    expect(titulos({ nombre_rol: 'Aprendiz' })).toEqual(['Consultar'])
  })
})

describe('rutaVolverSegura', () => {
  it('solo acepta rutas internas', () => {
    expect(rutaVolverSegura('/equipos/consultar?ambiente=12')).toBe('/equipos/consultar?ambiente=12')
    expect(rutaVolverSegura('//evil.example')).toBe('/equipos/consultar')
    expect(rutaVolverSegura('https://evil.example')).toBe('/equipos/consultar')
    expect(rutaVolverSegura('/\\evil')).toBe('/equipos/consultar')
    expect(rutaVolverSegura(null, '/dashboard')).toBe('/dashboard')
  })
})
