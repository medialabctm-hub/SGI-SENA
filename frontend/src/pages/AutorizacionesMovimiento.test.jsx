import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AutorizacionesMovimiento from './AutorizacionesMovimiento'

vi.mock('../components/Header', () => ({ default: () => null }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Toast', () => ({ default: () => null }))
vi.mock('../components/CustomSelect', () => ({
  default: ({ options = [], ...props }) => (
    <select {...props}>
      {options.map(option => (
        <option key={option.value || option} value={option.value || option}>
          {option.label || option}
        </option>
      ))}
    </select>
  )
}))
vi.mock('./LoadingDemo', () => ({ LoadingScreen: () => null }))

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(payload)),
  }
}

describe('AutorizacionesMovimiento', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ nombre_rol: 'Instructor' }))
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/api/ambientes/activos') return Promise.resolve(jsonResponse([]))
      if (String(url).startsWith('/api/equipos?')) {
        const busquedaSoloVerificados = String(url).includes('status_verificacion=Verificado')
        return Promise.resolve(jsonResponse({
          equipos: busquedaSoloVerificados ? [
            { codigo_equipo: 1, placa: '92051011721', tipo: 'Laptop', status_verificacion: 'Verificado' },
          ] : [
            { codigo_equipo: 2, placa: '92051011722', tipo: 'Laptop', status_verificacion: 'No Verificado' },
          ],
        }))
      }
      return Promise.resolve(jsonResponse({ autorizador: null }))
    }))
  })

  it('busca la placa en backend con filtro de verificación antes del límite', async () => {
    render(
      <MemoryRouter>
        <AutorizacionesMovimiento />
      </MemoryRouter>
    )

    const input = await screen.findByPlaceholderText('Escriba la placa o código del equipo')
    fireEvent.change(input, { target: { value: '92051011721' } })

    await waitFor(() => {
      const searchCall = fetch.mock.calls.find(([url]) => String(url).startsWith('/api/equipos?'))
      expect(searchCall).toBeDefined()
      expect(searchCall[0]).toBe('/api/equipos?search=92051011721&status_verificacion=Verificado&limit=20')
      expect(searchCall[1]).toEqual({ credentials: 'include' })
    })

    expect(await screen.findByText(/92051011721/)).toBeInTheDocument()
    expect(screen.queryByText(/92051011722/)).not.toBeInTheDocument()
  })

  it('avisa cuando la placa coincide con un equipo no verificado', async () => {
    fetch.mockImplementation((url) => {
      if (url === '/api/ambientes/activos') return Promise.resolve(jsonResponse([]))
      if (String(url).includes('status_verificacion=Verificado')) {
        return Promise.resolve(jsonResponse({ equipos: [] }))
      }
      if (String(url).startsWith('/api/equipos?')) {
        return Promise.resolve(jsonResponse({
          equipos: [
            { codigo_equipo: 2, placa: '92051011722', tipo: 'Laptop', status_verificacion: 'No Verificado' },
          ],
        }))
      }
      return Promise.resolve(jsonResponse({ autorizador: null }))
    })

    render(
      <MemoryRouter>
        <AutorizacionesMovimiento />
      </MemoryRouter>
    )

    const input = await screen.findByPlaceholderText('Escriba la placa o código del equipo')
    fireEvent.change(input, { target: { value: '92051011722' } })

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('92051011722')
    expect(alerta).toHaveTextContent('no está verificado')
    expect(alerta).toHaveTextContent('Consulte al cuentadante')
    expect(screen.queryByRole('button', { name: /92051011722/ })).not.toBeInTheDocument()
  })
})
