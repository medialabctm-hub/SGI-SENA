import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Toast from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('termina el cierre una vez si cambia la identidad de onClose durante la transición', () => {
    const firstOnClose = vi.fn();
    const currentOnClose = vi.fn();
    const { rerender } = render(<Toast message="Error de préstamo" onClose={firstOnClose} type="error" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
    rerender(<Toast message="Error de préstamo" onClose={currentOnClose} type="error" />);

    act(() => vi.advanceTimersByTime(300));

    expect(firstOnClose).not.toHaveBeenCalled();
    expect(currentOnClose).toHaveBeenCalledTimes(1);
  });

  it('reinicia el autocierre cuando cambia el mensaje', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Toast message="Primer mensaje" onClose={onClose} />);

    act(() => vi.advanceTimersByTime(4900));
    rerender(<Toast message="Segundo mensaje" onClose={onClose} />);
    act(() => vi.advanceTimersByTime(400));

    expect(onClose).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(4900));
    act(() => vi.advanceTimersByTime(300));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('expone el mensaje largo y un cierre accesible', () => {
    const message = 'No se pudo registrar el préstamo porque el equipo sigue en uso. Intenta de nuevo cuando esté disponible.';
    render(<Toast message={message} onClose={vi.fn()} type="error" />);

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Cerrar notificación' })).toBeEnabled();
  });
});
