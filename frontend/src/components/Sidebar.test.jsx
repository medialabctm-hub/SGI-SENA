import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './Sidebar'

vi.mock('../contexts/SidebarContext', () => ({
  useSidebar: () => ({ isOpen: true, closeSidebar: vi.fn() }),
}))
vi.mock('../hooks/useBlockedNavigate', () => ({
  useBlockedNavigate: () => vi.fn(),
}))

describe('Sidebar de seguimiento', () => {
  it('reúne el inventario y elimina las entradas de habilitación y alta', () => {
    render(
      <MemoryRouter initialEntries={['/equipos/consultar']}>
        <Sidebar user={{ nombre_rol: 'Cuentadante' }} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Inventario' }))
    expect(screen.getByRole('button', { name: 'Equipos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Equipos prestados' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Autorizaciones/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novedades y reportes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mantenimientos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar Inventario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignar Equipo' })).not.toBeInTheDocument()
  })
})
