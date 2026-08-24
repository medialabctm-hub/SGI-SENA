import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Header from './Header';
import { SidebarProvider } from '../contexts/SidebarContext';
import { DuplicadosProvider } from '../contexts/DuplicadosContext';

vi.mock('./NotificationsModal', () => ({ default: () => null }));
vi.mock('./ClassNotificationModal', () => ({ default: () => null }));

// jsdom no implementa matchMedia; SidebarContext lo usa para el layout inicial.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

const renderHeader = () => render(
  <MemoryRouter>
    <SidebarProvider>
      <DuplicadosProvider>
        <Header />
      </DuplicadosProvider>
    </SidebarProvider>
  </MemoryRouter>
);

describe('Header', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('limpia el usuario mostrado cuando se dispara auth:changed en la misma pestaña (logout/401)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      notifications: [], unreadCount: 0,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    localStorage.setItem('token', 'jwt-test');
    localStorage.setItem('user', JSON.stringify({ nombre_usuario: 'Ana Bermudez' }));

    renderHeader();

    const perfilBtn = screen.getByRole('button', { name: 'perfil' });
    expect(perfilBtn).toHaveTextContent('AB');

    // Simula lo que hacen confirmLogout (Header) y handleSessionExpiration (api.js):
    // limpiar localStorage y disparar el evento en la misma pestaña.
    act(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:changed'));
    });

    expect(perfilBtn).toHaveTextContent('US');
  });

  it('vuelve a mostrar el usuario si auth:changed llega con una sesión nueva (login en la misma pestaña)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      notifications: [], unreadCount: 0,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    renderHeader();

    const perfilBtn = screen.getByRole('button', { name: 'perfil' });
    expect(perfilBtn).toHaveTextContent('US');

    act(() => {
      localStorage.setItem('token', 'jwt-nuevo');
      localStorage.setItem('user', JSON.stringify({ nombre_usuario: 'Carlos Ruiz' }));
      window.dispatchEvent(new Event('auth:changed'));
    });

    expect(perfilBtn).toHaveTextContent('CR');
  });
});
