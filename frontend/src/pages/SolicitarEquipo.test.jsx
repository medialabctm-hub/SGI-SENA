import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SolicitarEquipo from './SolicitarEquipo';

vi.mock('../components/InteractiveBackground', () => ({ default: () => null }));

const renderRequestForm = () => render(
  <MemoryRouter>
    <SolicitarEquipo />
  </MemoryRouter>
);

describe('SolicitarEquipo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('vincula el error inline del documento con su etiqueta y atributos ARIA', () => {
    renderRequestForm();

    const input = screen.getByLabelText('Número de documento');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('El documento es obligatorio');
    expect(error).toHaveAttribute('id', 'documento-error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'documento-error');
  });

  it('vincula el error inline de la placa con su etiqueta y atributos ARIA', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { aprendiz: { nombre: 'Ana' } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    renderRequestForm();

    fireEvent.change(screen.getByLabelText('Número de documento'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    const input = await screen.findByLabelText('Placa del equipo');
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar equipo' }));

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('La placa del equipo es obligatoria');
    expect(error).toHaveAttribute('id', 'placa-error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'placa-error');
  });

  it.each([320, 375])('mantiene el control etiquetado y enviable a %i px', (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    renderRequestForm();

    expect(screen.getByLabelText('Número de documento')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });
});
