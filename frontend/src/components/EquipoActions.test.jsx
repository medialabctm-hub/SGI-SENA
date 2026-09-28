import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EquipoActions from './EquipoActions'

const equipo = { codigo_equipo: 14, codigo_inventario: 'P-14', status_verificacion: 'Verificado' }

describe('acciones contextuales de equipo', () => {
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
})
