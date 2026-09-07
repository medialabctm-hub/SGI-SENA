import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';

// El canvas 2D animado no aporta nada a este test y jsdom no implementa
// CanvasRenderingContext2D; se reemplaza por un stub inerte.
vi.mock('../components/InteractiveBackground', () => ({ default: () => null }));

const renderLogin = () => render(
  <MemoryRouter>
    <Login />
  </MemoryRouter>
);

const fillAndSubmit = async () => {
  fireEvent.change(screen.getByPlaceholderText('Documento'), { target: { value: '123' } });
  fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
};

describe('Login (MDL-127: JWT -> cookie httpOnly)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('envía credentials incluidas para que el navegador acepte la cookie httpOnly de sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      requiereCambioContrasena: false,
      user: { id_usuario: 1, nombre_usuario: 'Ana' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await fillAndSubmit();

    expect(await screen.findByText('Inicio de sesión exitoso')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
  });

  it('nunca persiste el JWT en localStorage/sessionStorage aunque el backend lo incluya en el body', async () => {
    // La respuesta real de /login ya no trae `token` (ver authController.loginUser),
    // pero este test cubre el caso defensivo: si algún día volviera a incluirse,
    // Login.jsx no debe guardarlo.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'secreto.jwt.no.debe.guardarse',
      requiereCambioContrasena: false,
      user: { id_usuario: 1, nombre_usuario: 'Ana' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await fillAndSubmit();

    await screen.findByText('Inicio de sesión exitoso');

    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain('secreto.jwt.no.debe.guardarse');
  });

  it('nunca escribe la clave "token" en localStorage/sessionStorage: solo cachea el perfil no sensible', async () => {
    // MDL-127 (revisión del coordinador): ni siquiera un indicador no sensible bajo
    // la clave "token" es aceptable. La única caché local permitida es el perfil
    // ("user"); la autorización real siempre se verifica contra /api/auth/me.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      requiereCambioContrasena: false,
      user: { id_usuario: 1, nombre_usuario: 'Ana' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await fillAndSubmit();
    await screen.findByText('Inicio de sesión exitoso');

    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(JSON.parse(localStorage.getItem('user'))).toEqual({ id_usuario: 1, nombre_usuario: 'Ana' });
  });
});
