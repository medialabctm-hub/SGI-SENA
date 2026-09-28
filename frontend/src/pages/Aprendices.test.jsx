import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Aprendices from './Aprendices'

vi.mock('../components/Header', () => ({ default: () => null }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
vi.mock('../components/ImportarAprendices', () => ({ default: () => null }))
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => ({ subscribe: null }) }))

const aprendiz = {
  id_aprendiz: 21,
  nombre: 'María Ejemplo',
  documento: '10021',
  tipo_documento: 'CC',
  ficha: 'F-21',
  jornada: 'Mañana',
  tipo_aprendiz: 'Regular',
  fecha_creacion: '2026-09-01T10:00:00.000Z',
}

const response = (payload, ok = true, status = 200) => ({
  ok,
  status,
  text: () => Promise.resolve(JSON.stringify(payload)),
})

describe('eliminación de aprendices', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ nombre_rol: 'Administrador' }))
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response({ aprendices: [aprendiz] }))))
  })

  it('abre edición en un diálogo accesible y devuelve foco a Editar con Escape', async () => {
    render(<Aprendices />)
    const edit = await screen.findByRole('button', { name: 'Editar' })
    edit.focus()
    fireEvent.click(edit)
    const dialog = screen.getByRole('dialog', { name: 'Editar aprendiz' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Editar aprendiz' })).toBeNull()
    expect(edit).toHaveFocus()
  })

  it('cancela sin enviar DELETE y presenta el nombre del aprendiz en el diálogo', async () => {
    render(<Aprendices />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))

    expect(screen.getByRole('dialog', { name: 'Eliminar aprendiz' })).toHaveTextContent('María Ejemplo')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(fetch).not.toHaveBeenCalledWith('/api/aprendices/21', expect.objectContaining({ method: 'DELETE' }))
    expect(screen.getByText('María Ejemplo')).toBeInTheDocument()
  })

  it('envía DELETE una vez al confirmar y muestra el toast de éxito', async () => {
    fetch.mockImplementation((url, options) => Promise.resolve(
      options?.method === 'DELETE' ? response({}) : response({ aprendices: [aprendiz] })
    ))
    render(<Aprendices />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Escribe/ }), { target: { value: 'confirmar accion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar aprendiz' }))

    expect(await screen.findByText('Aprendiz eliminado correctamente')).toBeInTheDocument()
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
  })

  it('devuelve el foco al encabezado después de eliminar y recargar la lista', async () => {
    let finishRefresh
    let listRequests = 0
    fetch.mockImplementation((url, options) => {
      if (options?.method === 'DELETE') return Promise.resolve(response({}))
      listRequests += 1
      if (listRequests === 1) return Promise.resolve(response({ aprendices: [aprendiz] }))
      return new Promise(resolve => {
        finishRefresh = () => resolve(response({ aprendices: [] }))
      })
    })
    render(<Aprendices />)
    const heading = await screen.findByRole('heading', { name: 'Aprendices' })
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Escribe/ }), { target: { value: 'confirmar accion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar aprendiz' }))
    await waitFor(() => expect(finishRefresh).toBeTypeOf('function'))

    await act(async () => finishRefresh())

    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('conserva el registro y muestra el error si DELETE falla', async () => {
    fetch.mockImplementation((url, options) => Promise.resolve(
      options?.method === 'DELETE'
        ? response({ message: 'No se pudo eliminar el aprendiz' }, false, 500)
        : response({ aprendices: [aprendiz] })
    ))
    render(<Aprendices />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Escribe/ }), { target: { value: 'confirmar accion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar aprendiz' }))

    expect(await screen.findByText('Ocurrió un problema en el servidor. Por favor intenta de nuevo más tarde')).toBeInTheDocument()
    expect(screen.getByText('María Ejemplo')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Eliminar' })).toBeEnabled())
  })

  it('ignora un segundo clic mientras la eliminación está pendiente', async () => {
    let finishDelete
    fetch.mockImplementation((url, options) => options?.method === 'DELETE'
      ? new Promise(resolve => { finishDelete = () => resolve(response({})) })
      : Promise.resolve(response({ aprendices: [aprendiz] })))
    render(<Aprendices />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Escribe/ }), { target: { value: 'confirmar accion' } })
    const confirm = screen.getByRole('button', { name: 'Eliminar aprendiz' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
    expect(confirm).toBeDisabled()
    finishDelete()
    expect(await screen.findByText('Aprendiz eliminado correctamente')).toBeInTheDocument()
  })
})
