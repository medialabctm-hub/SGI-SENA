import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FormDialog from './FormDialog';

describe('FormDialog', () => {
  it('wraps Tab past visible controls instead of stopping on a hidden descendant', () => {
    render(
      <FormDialog open title="Datos de prueba" onClose={() => {}}>
        <button type="button">Último control visible</button>
        <button type="button" style={{ display: 'none' }}>
          Control oculto
        </button>
      </FormDialog>
    );

    const lastVisibleControl = screen.getByRole('button', {
      name: 'Último control visible',
    });
    lastVisibleControl.focus();

    expect(fireEvent.keyDown(lastVisibleControl, { key: 'Tab' })).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Cerrar diálogo' })
    ).toHaveFocus();
  });
});
