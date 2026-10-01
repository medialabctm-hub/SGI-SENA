import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Equipos from './Equipos'

vi.mock('../components/Header', () => ({ default: () => null }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/ImportarEquipos', () => ({ default: () => <p>Formulario de importación</p> }))
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => ({ subscribe: null }) }))

const jsonResponse = payload => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(JSON.stringify(payload)),
})

describe('Equipos: acceso contextual al formulario', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id_usuario: 7, nombre_rol: 'Cuentadante' }))
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse([]))))
  })

  it('abre la pestaña Importar desde el enlace de Equipos', async () => {
    render(<MemoryRouter initialEntries={['/equipos?tab=importar']}><Equipos /></MemoryRouter>)
    expect(await screen.findByText('Formulario de importación')).toBeInTheDocument()
  })
})
