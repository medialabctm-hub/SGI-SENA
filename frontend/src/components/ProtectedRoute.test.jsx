/**
 * Tests para ProtectedRoute: redirige a login sin token, muestra hijos con token
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('redirige a /login cuando no hay token', () => {
    const Contenido = () => <div>Contenido protegido</div>;
    render(
      <MemoryRouter initialEntries={['/ruta-protegida']}>
        <Routes>
          <Route
            path="/ruta-protegida"
            element={
              <ProtectedRoute>
                <Contenido />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Página de login</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Página de login')).toBeInTheDocument();
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });

  it('muestra Cargando... inicialmente cuando hay token (antes de checkUser)', () => {
    localStorage.setItem('token', 'fake-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ user: { requiere_cambio_contrasena: false } }) }));
    const Contenido = () => <div>Contenido protegido</div>;
    render(
      <MemoryRouter initialEntries={['/ruta-protegida']}>
        <Routes>
          <Route
            path="/ruta-protegida"
            element={
              <ProtectedRoute>
                <Contenido />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });
});
