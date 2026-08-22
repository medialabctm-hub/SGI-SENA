import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';

const renderProtected = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <Routes>
      <Route path="/login" element={<div>Pantalla de login</div>} />
      <Route
        path="/dashboard"
        element={<ProtectedRoute><div>Contenido protegido</div></ProtectedRoute>}
      />
    </Routes>
  </MemoryRouter>
);

describe('ProtectedRoute', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('sin token, redirige a /login de inmediato sin llamar a la API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderProtected();

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con token y sesión válida, renderiza el contenido protegido', async () => {
    localStorage.setItem('token', 'jwt-valido');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      user: { requiere_cambio_contrasena: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    renderProtected();

    expect(await screen.findByText('Contenido protegido')).toBeInTheDocument();
  });

  it('con 401 (sesión expirada), muestra el toast, limpia la sesión y no navega antes de tiempo', async () => {
    localStorage.setItem('token', 'jwt-vencido');
    localStorage.setItem('user', JSON.stringify({ nombre_usuario: 'Ana' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'Token expirado',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } })));
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    renderProtected();

    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión expiró. Por favor inicia sesión nuevamente');
    // handleSessionExpiration (api.js) ya limpió la sesión y disparó auth:changed;
    // el hard-redirect a /login queda pendiente en un setTimeout de 1.5s que no
    // ejercitamos aquí (por diseño: el toast debe alcanzar a verse primero).
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth:changed' }));
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument();
  });

  it('con 403, deniega el acceso sin limpiar la sesión guardada ni mostrar el toast de sesión expirada', async () => {
    localStorage.setItem('token', 'jwt-sin-permiso');
    localStorage.setItem('user', JSON.stringify({ nombre_usuario: 'Ana' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'No autorizado',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } })));

    renderProtected();

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('jwt-sin-permiso');
    expect(localStorage.getItem('user')).toBe(JSON.stringify({ nombre_usuario: 'Ana' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
