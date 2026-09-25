import { describe, expect, it } from 'vitest'
import { estadoDeEntrada } from './navigationEstado'

describe('estadoDeEntrada', () => {
  it('sin dato no inventa un cero', () => {
    expect(estadoDeEntrada('prestados', null, 'Administrador')).toBeNull()
    expect(estadoDeEntrada('prestados', { prestados: null }, 'Administrador')).toBeNull()
    expect(estadoDeEntrada('desconocido', { desconocido: {} }, 'Administrador')).toBeNull()
  })

  it('inventario cambia el texto según el alcance del rol', () => {
    expect(estadoDeEntrada('inventario', { inventario: { total: 312 } }, 'Administrador')).toEqual({ texto: '312 equipos', tono: 'neutro' })
    expect(estadoDeEntrada('inventario', { inventario: { total: 1 } }, 'Aprendiz').texto).toBe('1 equipo habilitado')
    expect(estadoDeEntrada('inventario', { inventario: { total: 64 } }, 'Instructor').texto).toBe('64 equipos en tus ambientes')
  })

  it('préstamos avisa cuando hay sesiones por revisar', () => {
    expect(estadoDeEntrada('prestados', { prestados: { en_uso: 12, por_revisar: 1 } })).toEqual({ texto: '12 en uso ahora · 1 por revisar', tono: 'aviso' })
    expect(estadoDeEntrada('prestados', { prestados: { en_uso: 0, por_revisar: 0 } })).toEqual({ texto: '0 en uso ahora', tono: 'neutro' })
  })

  it('autorizaciones prioriza lo que hay por aprobar', () => {
    expect(estadoDeEntrada('autorizaciones', { autorizaciones: { por_aprobar: 3, mis_pendientes: 1 } })).toEqual({ texto: '3 por aprobar', tono: 'alerta' })
    expect(estadoDeEntrada('autorizaciones', { autorizaciones: { por_aprobar: 0, mis_pendientes: 1 } }).texto).toBe('1 solicitud tuya en espera')
    expect(estadoDeEntrada('autorizaciones', { autorizaciones: { por_aprobar: 0, mis_pendientes: 0 } }).texto).toBe('Sin pendientes')
  })

  it('novedades, mantenimientos, ambientes y horarios', () => {
    expect(estadoDeEntrada('novedades', { novedades: { pendientes: 5 } })).toEqual({ texto: '5 pendientes', tono: 'alerta' })
    expect(estadoDeEntrada('novedades', { novedades: { pendientes: 0 } }).texto).toBe('Sin pendientes')
    expect(estadoDeEntrada('mantenimientos', { mantenimientos: { en_proceso: 2, proximos: 1 } }).texto).toBe('2 en proceso · 1 próximo')
    expect(estadoDeEntrada('ambientes', { ambientes: { activos: 3, en_mantenimiento: 1 } }).texto).toBe('3 activos · 1 en mantenimiento')
    expect(estadoDeEntrada('ambientes', { ambientes: { activos: 1, en_mantenimiento: 0 } }).texto).toBe('1 activo')
    expect(estadoDeEntrada('horarios', { horarios: { hoy: 6, en_curso: 2 } }, 'Administrador')).toEqual({ texto: '6 clases hoy · 2 en curso', tono: 'info' })
    expect(estadoDeEntrada('horarios', { horarios: { hoy: 1, en_curso: 0 } }, 'Instructor').texto).toBe('1 clase tuya hoy')
  })
})
