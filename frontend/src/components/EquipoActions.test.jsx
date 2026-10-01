import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EquipoActions from './EquipoActions'

const equipo = { codigo_equipo: 14, codigo_inventario: 'P-14', status_verificacion: 'Verificado' }

describe('acciones contextuales de equipo', () => {
  it('acompaña cada acción con un icono decorativo sin cambiar su etiqueta accesible', () => {
    render(<EquipoActions equipo={equipo} role="Administrador" navigate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)

    const summary = screen.getByText('Más acciones').closest('summary')
    fireEvent.click(summary)

    const actions = [
      screen.getByRole('button', { name: 'Ver ficha de P-14' }),
      summary,
      ...[
        'Historial de verificaciones',
        'Historial de movimientos',
        'Registrar novedad',
        'Registrar reporte',
        'Registrar mantenimiento',
        'Solicitar movimiento',
        'Editar equipo',
        'Eliminar equipo',
      ].map(name => screen.getByRole('button', { name })),
    ]

    actions.forEach(action => {
      expect(action.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Registrar novedad' })).toHaveTextContent('Registrar novedad')
  })

  it('muestra ficha y agrupa las acciones de registro con contexto', () => {
    const navigate = vi.fn()
    render(<EquipoActions equipo={equipo} role="Administrador" navigate={navigate} onEdit={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver ficha de P-14' }))
    expect(navigate).toHaveBeenCalledWith('/equipos/detalle/14')
    fireEvent.click(screen.getByText('Más acciones'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar novedad' }))
    expect(navigate).toHaveBeenCalledWith('/novedades?tab=crear&equipo=14')
  })

  it('no presenta editar ni eliminar a un cuentadante', () => {
    render(<EquipoActions equipo={equipo} role="Cuentadante" navigate={vi.fn()} />)
    fireEvent.click(screen.getByText('Más acciones'))
    expect(screen.queryByRole('button', { name: 'Eliminar equipo' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Registrar mantenimiento' })).toBeTruthy()
  })

  it('conserva rutas y callbacks de cada acción administrativa', () => {
    const navigate = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<EquipoActions equipo={equipo} role="Administrador" navigate={navigate} onEdit={onEdit} onDelete={onDelete} />)
    const summary = screen.getByText('Más acciones').closest('summary')

    const routes = [
      ['Ver ficha de P-14', '/equipos/detalle/14'],
      ['Historial de verificaciones', '/equipos/historial-verificaciones/14'],
      ['Historial de movimientos', '/equipos/historial-movimientos/14'],
      ['Registrar novedad', '/novedades?tab=crear&equipo=14'],
      ['Registrar reporte', '/reportes/crear?equipo=14'],
      ['Registrar mantenimiento', '/mantenimientos?tab=crear&equipo=14'],
      ['Solicitar movimiento', '/equipos/autorizaciones?tab=solicitar&equipo=14'],
    ]

    routes.forEach(([label, path]) => {
      if (label !== 'Ver ficha de P-14') fireEvent.click(summary)
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(navigate).toHaveBeenLastCalledWith(path)
    })

    fireEvent.click(summary)
    fireEvent.click(screen.getByRole('button', { name: 'Editar equipo' }))
    fireEvent.click(summary)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar equipo' }))
    expect(onEdit).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('oculta acciones administrativas y de registro a perfiles sin permiso', () => {
    render(<EquipoActions equipo={equipo} role="Aprendiz" navigate={vi.fn()} />)
    fireEvent.click(screen.getByText('Más acciones'))

    expect(screen.getByRole('button', { name: 'Historial de verificaciones' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Historial de movimientos' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar novedad' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Solicitar movimiento' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar equipo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Eliminar equipo' })).toBeNull()
  })

  it('no ofrece solicitar movimiento para un equipo sin verificar', () => {
    render(<EquipoActions equipo={{ ...equipo, status_verificacion: 'No verificado' }} role="Cuentadante" navigate={vi.fn()} />)
    fireEvent.click(screen.getByText('Más acciones'))

    expect(screen.queryByRole('button', { name: 'Solicitar movimiento' })).toBeNull()
  })

  it('cierra el disclosure con Escape y devuelve el foco al summary nativo', () => {
    render(<EquipoActions equipo={equipo} role="Cuentadante" navigate={vi.fn()} />)
    const summary = screen.getByText('Más acciones').closest('summary')
    const details = summary.parentElement
    expect(details.tagName).toBe('DETAILS')

    fireEvent.click(summary)
    summary.focus()
    fireEvent.keyDown(summary, { key: 'Escape' })

    expect(details).not.toHaveAttribute('open')
    expect(summary).toHaveFocus()
  })

  it('cierra el disclosure al hacer clic fuera del menú', () => {
    render(<EquipoActions equipo={equipo} role="Cuentadante" navigate={vi.fn()} />)
    const summary = screen.getByText('Más acciones').closest('summary')
    const details = summary.parentElement
    fireEvent.click(summary)
    expect(details).toHaveAttribute('open')

    fireEvent.pointerDown(document.body)

    expect(details).not.toHaveAttribute('open')
  })
})
