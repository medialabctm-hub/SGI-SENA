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

describe('ProtectedRoute (MDL-127: sesión verificada por cookie httpOnly, sin token local)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('sin cookie de sesión (backend responde 401 en /api/auth/me), redirige a /login', async () => {
    // No hay ningún indicador local: la guarda NO decide nada por sí misma,
    // siempre pregunta al backend.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'No autorizado',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    renderProtected();

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', { credentials: 'include' });
  });

  it('con cookie de sesión válida, renderiza el contenido protegido', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      user: { requiere_cambio_contrasena: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    renderProtected();

    expect(await screen.findByText('Contenido protegido')).toBeInTheDocument();
  });

  it('verifica la sesión vía cookie httpOnly (credentials incluidas, sin header Authorization ni token local)', async () => {
    // MDL-127: la guarda de ruta no lee ni envía ningún secreto/indicador del
    // navegador; la sesión se valida exclusivamente con la cookie httpOnly del
    // backend, incluso sin nada en localStorage.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      user: { requiere_cambio_contrasena: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    renderProtected();
    await screen.findByText('Contenido protegido');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(options).toEqual({ credentials: 'include' });
    expect(options.headers).toBeUndefined();
  });

  it('con 401 (sesión expirada), muestra el toast, limpia la sesión y no navega antes de tiempo', async () => {
    // "user" es el único indicador local no sensible; se usa aquí solo para
    // que handleSessionExpiration (api.js) sepa que había una sesión que limpiar.
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
    localStorage.setItem('user', JSON.stringify({ nombre_usuario: 'Ana' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'No autorizado',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } })));

    renderProtected();

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
    expect(localStorage.getItem('user')).toBe(JSON.stringify({ nombre_usuario: 'Ana' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
