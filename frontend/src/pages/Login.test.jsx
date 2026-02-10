/**
 * Tests básicos para Login: renderizado y validación del formulario
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

// Mock de dependencias que hacen fetch o navegación
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../utils/api', () => ({
  buildErrorMessage: vi.fn((e) => e?.message || 'Error'),
  parseApiResponse: vi.fn(),
  handleError: vi.fn(),
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el formulario con título y campos', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText(/Gestión de Inventario/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Documento/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Contraseña/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar Sesión/ })).toBeInTheDocument();
  });

  it('muestra errores de validación al enviar vacío', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const btn = screen.getByRole('button', { name: /Iniciar Sesión/ });
    fireEvent.click(btn);
    expect(screen.getByText(/Documento.*obligatoria/)).toBeInTheDocument();
  });
});
