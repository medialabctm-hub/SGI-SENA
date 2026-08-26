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

  it('muestra la hora de inicio del préstamo en la confirmación (regresión: solicitud sin horas)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { aprendiz: { nombre: 'Ana' } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          equipo: { placa: 'P-1', tipo: 'Portátil', modelo: 'Latitude' },
          aprendiz: { nombre: 'Ana' },
          clase: { nombre_clase: 'Matemáticas' },
          fecha_hora_inicio: '2026-08-26T14:05:00-05:00',
        },
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    renderRequestForm();

    fireEvent.change(screen.getByLabelText('Número de documento'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    const placaInput = await screen.findByLabelText('Placa del equipo');
    fireEvent.change(placaInput, { target: { value: 'P-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar equipo' }));

    await screen.findByText('Equipo asignado');
    expect(screen.getByText(/a las/i)).toBeInTheDocument();
  });
});
