import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';

describe('apiFetch (MDL-127: credentials de cookie httpOnly, sin JWT de localStorage)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('incluye credentials para que el navegador envíe la cookie httpOnly de sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/auth/me');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe('include');
  });

  it('nunca lee un token de localStorage para construir un header Authorization', async () => {
    localStorage.setItem('token', 'active');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/equipos');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('permite que el caller sobrescriba credentials explícitamente', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/public/endpoint', { credentials: 'omit' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe('omit');
  });
});
