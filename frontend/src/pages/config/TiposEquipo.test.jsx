import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TiposEquipo from './TiposEquipo'

const categoria = {
  id_categoria: 31,
  nombre_categoria: 'PORTÁTIL',
  descripcion: 'Equipos móviles',
  es_componente: false,
}

const response = (payload, ok = true, status = 200) => ({
  ok,
  status,
  text: () => Promise.resolve(JSON.stringify(payload)),
})

describe('eliminación de tipos de equipo', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response([categoria]))))
  })

  it('cancela sin enviar DELETE y nombra la categoría en el diálogo', async () => {
    render(<TiposEquipo />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))

    expect(screen.getByRole('dialog', { name: 'Eliminar categoría' })).toHaveTextContent('PORTÁTIL')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(fetch).not.toHaveBeenCalledWith('/api/equipos/categorias/31', expect.objectContaining({ method: 'DELETE' }))
    expect(screen.getByText('PORTÁTIL')).toBeInTheDocument()
  })

  it('envía DELETE al confirmar y muestra el toast de éxito', async () => {
    fetch.mockImplementation((url, options) => Promise.resolve(
      options?.method === 'DELETE' ? response({}) : response([categoria])
    ))
    render(<TiposEquipo />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Escribe/ }), { target: { value: 'confirmar accion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar categoría' }))

    expect(await screen.findByText('Categoría eliminada correctamente')).toBeInTheDocument()
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
  })

  it('devuelve el foco al encabezado después de eliminar y recargar las categorías', async () => {
    let finishRefresh
    let listRequests = 0
    fetch.mockImplementation((url, options) => {
      if (options?.method === 'DELETE') return Promise.resolve(response({}))
      listRequests += 1
      if (listRequests === 1) return Promise.resolve(response([categoria]))
      return new Promise(resolve => {
        finishRefresh = () => resolve(response([]))
      })
    })
    render(<TiposEquipo />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Escribe/ }), { target: { value: 'confirmar accion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar categoría' }))
    await waitFor(() => expect(finishRefresh).toBeTypeOf('function'))

    await act(async () => finishRefresh())

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tipos de Equipos' })).toHaveFocus())
  })

  it('conserva la categoría y muestra el error si DELETE falla', async () => {
    fetch.mockImplementation((url, options) => Promise.resolve(
      options?.method === 'DELETE'
        ? response({ message: 'No se pudo eliminar la categoría' }, false, 500)
        : response([categoria])
    ))
    render(<TiposEquipo />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Escribe/ }), { target: { value: 'confirmar accion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar categoría' }))

    expect(await screen.findByText('Ocurrió un problema en el servidor. Por favor intenta de nuevo más tarde')).toBeInTheDocument()
    expect(screen.getByText('PORTÁTIL')).toBeInTheDocument()
  })

  it('ignora un segundo clic mientras la eliminación está pendiente', async () => {
    let finishDelete
    fetch.mockImplementation((url, options) => options?.method === 'DELETE'
      ? new Promise(resolve => { finishDelete = () => resolve(response({})) })
      : Promise.resolve(response([categoria])))
    render(<TiposEquipo />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Escribe/ }), { target: { value: 'confirmar accion' } })
    const confirm = screen.getByRole('button', { name: 'Eliminar categoría' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
    expect(confirm).toBeDisabled()
    finishDelete()
    expect(await screen.findByText('Categoría eliminada correctamente')).toBeInTheDocument()
  })
})
