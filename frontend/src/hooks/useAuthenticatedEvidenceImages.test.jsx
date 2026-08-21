import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthenticatedEvidenceImages } from './useAuthenticatedEvidenceImages';

describe('useAuthenticatedEvidenceImages', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads equipment evidence with Bearer and revokes its object URL on cleanup', async () => {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    localStorage.setItem('token', 'jwt-test');
    const objectUrl = 'blob:evidence-1';
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl);
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['image']),
    });

    const { result, unmount } = renderHook(() => useAuthenticatedEvidenceImages([
      { id_imagen_equipo: 1, ruta_imagen: '/api/equipos/imagenes/archivo/private.png' },
    ]));

    await waitFor(() => expect(result.current[0].url).toBe(objectUrl));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/equipos/imagenes/archivo/private.png',
      expect.objectContaining({ headers: { Authorization: 'Bearer jwt-test' } })
    );

    unmount();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });
});
