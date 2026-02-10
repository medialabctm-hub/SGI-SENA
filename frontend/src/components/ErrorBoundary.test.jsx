/**
 * Tests para ErrorBoundary: muestra UI de error cuando un hijo lanza
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const ComponenteQueFalla = () => {
  throw new Error('Error de prueba');
};

describe('ErrorBoundary', () => {
  it('renderiza los hijos cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <div>Contenido normal</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Contenido normal')).toBeInTheDocument();
  });

  it('muestra la UI de error cuando un hijo lanza', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ComponenteQueFalla />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Algo salió mal/)).toBeInTheDocument();
    expect(screen.getByText(/Ha ocurrido un error inesperado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Intentar de nuevo/ })).toBeInTheDocument();
    console.error.mockRestore();
  });
});
