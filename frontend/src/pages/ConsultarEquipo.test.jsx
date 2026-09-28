import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ConsultarEquipo from './ConsultarEquipo'

vi.mock('../components/Header', () => ({ default: () => null }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Toast', () => ({ default: () => null }))
vi.mock('./LoadingDemo', () => ({ LoadingScreen: () => null }))

const jsonResponse = payload => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(JSON.stringify(payload)),
})

describe('ConsultarEquipo: inventario a cargo', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id_usuario: 7, nombre_rol: 'Cuentadante' }))
    vi.stubGlobal('fetch', vi.fn(url => {
      if (url === '/api/ambientes/activos') {
        return Promise.resolve(jsonResponse([
          { id_ambiente: 11, codigo_ambiente: 'A-11', nombre_ambiente: 'Aula 11' },
          { id_ambiente: 22, codigo_ambiente: 'A-22', nombre_ambiente: 'Aula 22' },
        ]))
      }
      if (url === '/api/equipos/verificacion/ambientes') {
        return Promise.resolve(jsonResponse({ ambientes: [{ id_ambiente: 11 }, { id_ambiente: 22 }] }))
      }
      if (String(url).startsWith('/api/equipos')) {
        return Promise.resolve(jsonResponse({ equipos: [], pagination: { total: 0, totalPages: 0 } }))
      }
      return Promise.resolve(jsonResponse({}))
    }))
  })

  it('filtra en el servidor por ambiente dentro de Equipos a mi cargo', async () => {
    render(<MemoryRouter><ConsultarEquipo /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Equipos a mi cargo' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Ambiente' }), { target: { value: '22' } })

    await waitFor(() => {
      const urls = fetch.mock.calls.map(([url]) => String(url))
      expect(urls).toContain('/api/equipos?vista_inventario=inventario_total&ambiente=22')
    })
  })

  it('permite recorrer páginas dentro del mismo alcance y filtro', async () => {
    fetch.mockImplementation(url => {
      if (url === '/api/ambientes/activos') return Promise.resolve(jsonResponse([{ id_ambiente: 22, nombre_ambiente: 'Aula 22' }]))
      if (url === '/api/equipos/verificacion/ambientes') return Promise.resolve(jsonResponse({ ambientes: [] }))
      return Promise.resolve(jsonResponse({ equipos: [{ codigo_equipo: String(url).includes('page=2') ? 2 : 1, codigo_inventario: 'P-01' }], pagination: { page: String(url).includes('page=2') ? 2 : 1, total: 55, totalPages: 2, hasNext: !String(url).includes('page=2'), hasPrev: String(url).includes('page=2') } }))
    })
    render(<MemoryRouter><ConsultarEquipo /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Equipos a mi cargo' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Ambiente' }), { target: { value: '22' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiente página' }))
    await waitFor(() => expect(fetch.mock.calls.map(([url]) => String(url))).toContain('/api/equipos?vista_inventario=inventario_total&ambiente=22&page=2'))
  })
})
