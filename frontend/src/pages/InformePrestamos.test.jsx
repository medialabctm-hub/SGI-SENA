import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InformePrestamos from './InformePrestamos'

vi.mock('../components/Header', () => ({ default: () => null }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/Toast', () => ({ default: () => null }))

const response = payload => ({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(payload)) })

describe('InformePrestamos', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ nombre_rol: 'Cuentadante' }))
    vi.stubGlobal('fetch', vi.fn(url => Promise.resolve(response(String(url).startsWith('/api/ambientes') ? [] : {
      sesiones: [{ id_historial: 9, codigo_inventario: 'P-9', estado: 'Finalizado', fecha_hora_inicio: '2026-09-20T12:00:00.000Z', fecha_hora_fin: '2026-09-20T13:00:00.000Z' }],
      pagination: { page: 1, total: 1, totalPages: 1 },
    }))))
  })

  it('muestra sesiones finalizadas y permite generar el documento', async () => {
    render(<MemoryRouter><InformePrestamos /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('P-9')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Descargar PDF completo' }).disabled).toBe(false)
  })

  it('oculta datos del informe para rol sin permiso', () => {
    localStorage.setItem('user', JSON.stringify({ nombre_rol: 'Aprendiz' }))
    render(<MemoryRouter><InformePrestamos /></MemoryRouter>)
    expect(screen.getByText('No tiene acceso a este informe.')).toBeTruthy()
    expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/equipos/uso/informe'))).toBe(false)
  })
})
