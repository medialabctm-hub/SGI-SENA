import React, { useRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DestructiveConfirmModal from './DestructiveConfirmModal'

describe('DestructiveConfirmModal', () => {
  it('relaciona la frase incorrecta con el campo y marca su estado inválido', () => {
    render(
      <DestructiveConfirmModal
        open
        title="Eliminar registro"
        message="Confirma la eliminación de Registro de prueba."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const input = screen.getByRole('textbox', { name: /Escribe/ })

    fireEvent.change(input, { target: { value: 'texto incorrecto' } })

    expect(input).toHaveAttribute('aria-invalid', 'true')
    const hintId = input.getAttribute('aria-describedby')
    expect(document.getElementById(hintId)).toHaveTextContent('El texto no coincide')

    fireEvent.change(input, { target: { value: 'confirmar accion' } })

    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('devuelve el foco a un destino estable si el activador desaparece', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      const [showActivator, setShowActivator] = useState(true)
      const fallbackRef = useRef(null)
      return (
        <>
          <h2 ref={fallbackRef} tabIndex={-1}>Lista de registros</h2>
          {showActivator && <button type="button" onClick={() => setOpen(true)}>Eliminar registro</button>}
          <DestructiveConfirmModal
            open={open}
            title="Eliminar registro"
            message="Confirma la eliminación de Registro de prueba."
            onConfirm={vi.fn()}
            onCancel={() => {
              setOpen(false)
              setShowActivator(false)
            }}
            returnFocusRef={fallbackRef}
          />
        </>
      )
    }
    render(<Harness />)
    const activator = screen.getByRole('button', { name: 'Eliminar registro' })
    activator.focus()
    fireEvent.click(activator)

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Eliminar registro' }), { key: 'Escape' })

    expect(screen.getByRole('heading', { name: 'Lista de registros' })).toHaveFocus()
  })

  it('expone un diálogo accesible y devuelve el foco al activador al cancelar con Escape', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Eliminar registro</button>
          <DestructiveConfirmModal open={open} title="Eliminar registro" message="Confirma la eliminación de Registro de prueba." onConfirm={vi.fn()} onCancel={() => setOpen(false)} />
        </>
      )
    }
    render(<Harness />)

    const activator = screen.getByRole('button', { name: 'Eliminar registro' })
    activator.focus()
    fireEvent.click(activator)
    const dialog = screen.getByRole('dialog', { name: 'Eliminar registro' })
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(activator).toHaveFocus()
  })

  it('mantiene la navegación Tab dentro del diálogo', () => {
    render(
      <DestructiveConfirmModal
        open
        title="Eliminar registro"
        message="Confirma la eliminación de Registro de prueba."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const dialog = screen.getByRole('dialog', { name: 'Eliminar registro' })
    const confirm = screen.getByRole('button', { name: 'Confirmar' })
    const input = screen.getByRole('textbox', { name: /Escribe/ })
    fireEvent.change(input, { target: { value: 'confirmar accion' } })
    input.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()
    confirm.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(input).toHaveFocus()
  })

  it('bloquea Escape durante la carga y conserva el foco dentro del diálogo', () => {
    const onCancel = vi.fn()
    render(
      <DestructiveConfirmModal
        open
        loading
        title="Eliminar registro"
        message="Confirma la eliminación de Registro de prueba."
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )

    const dialog = screen.getByRole('dialog', { name: 'Eliminar registro' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.keyDown(dialog, { key: 'Tab' })

    expect(onCancel).not.toHaveBeenCalled()
    expect(dialog).toHaveFocus()
  })

  it('continúa la navegación dentro del diálogo al terminar la carga', () => {
    const props = {
      open: true,
      title: 'Eliminar registro',
      message: 'Confirma la eliminación de Registro de prueba.',
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }
    const { rerender } = render(<DestructiveConfirmModal {...props} loading />)
    const dialog = screen.getByRole('dialog', { name: 'Eliminar registro' })
    expect(dialog).toHaveFocus()

    rerender(<DestructiveConfirmModal {...props} loading={false} />)
    fireEvent.keyDown(dialog, { key: 'Tab' })

    expect(screen.getByRole('textbox', { name: /Escribe/ })).toHaveFocus()
  })

  it('asigna nombres accesibles únicos a diálogos simultáneos', () => {
    render(
      <>
        <DestructiveConfirmModal open title="Eliminar uno" message="Uno" onConfirm={vi.fn()} onCancel={vi.fn()} />
        <DestructiveConfirmModal open title="Eliminar dos" message="Dos" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </>
    )

    const titleIds = [
      screen.getByRole('heading', { name: 'Eliminar uno' }).id,
      screen.getByRole('heading', { name: 'Eliminar dos' }).id,
    ]
    expect(new Set(titleIds).size).toBe(2)
  })
})
