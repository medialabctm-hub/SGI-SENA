import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import MisEquipos from './MisEquipos'

vi.mock('../components/Header', () => ({ default: () => null }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => ({ subscribe: null }) }))
vi.mock('./LoadingDemo', () => ({ LoadingScreen: () => null }))

function Destino() {
  const location = useLocation()
  return <p>Destino: {location.pathname}{location.search}</p>
}

describe('MisEquipos: compatibilidad del enlace antiguo', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id_usuario: 7, nombre_rol: 'Cuentadante' }))
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('[]') })))
  })

  it('lleva al cuentadante al inventario patrimonial sin consultar habilitaciones', async () => {
    render(
      <MemoryRouter initialEntries={['/mis-equipos']}>
        <Routes>
          <Route path="/mis-equipos" element={<MisEquipos />} />
          <Route path="/equipos/consultar" element={<Destino />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Destino: /equipos/consultar?vista_inventario=inventario_total')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalledWith('/api/equipos/mis-equipos/asignados', expect.anything())
  })
})
