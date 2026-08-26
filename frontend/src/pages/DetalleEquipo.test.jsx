import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DetalleEquipo from './DetalleEquipo';

// Regresión: imagenes-equipos-blob-csp
//
// Root cause: el <img> de "Imagen Principal" y cada thumbnail de galería se montaban con
// src="" mientras el hook useAuthenticatedEvidenceImages todavía resolvía su fetch()
// autenticado asíncrono. src="" dispara onError inmediato, cuyo handler oculta el <img>
// mutando style.display de forma imperativa (fuera de React). Cuando el fetch+blob real
// completaba después y React re-renderizaba el mismo <img> con la blob: URL correcta, el
// display:none seteado a mano nunca se revertía porque React no controla ese atributo, por
// lo que la imagen quedaba oculta para siempre pese a cargar con éxito.
//
// Fix: no montar el <img> hasta tener una url autenticada válida; mostrar un placeholder en
// su lugar mientras se resuelve. Esto evita que el onError transitorio de src="" se dispare.

vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Sidebar', () => ({ default: () => null }));

const EQUIPO_RESPONSE = {
  codigo_equipo: 62,
  nombre: 'Portátil Dell',
  specs_completas: '',
};

const IMAGEN_URL = '/api/equipos/imagenes/archivo/1787075246545-62-image.jpg';

const IMAGENES_RESPONSE = {
  codigo_equipo: 62,
  total: 1,
  imagenes: [
    {
      id_imagen_equipo: 1,
      codigo_equipo: 62,
      ruta_imagen: IMAGEN_URL,
      nombre_archivo: '1787075246545-62-image.jpg',
      tipo_imagen: 'Detalle',
      descripcion: 'Foto del equipo',
      fecha_subida: '2026-08-20T00:00:00.000Z',
      es_principal: true,
    },
  ],
};

const renderDetalleEquipo = () => render(
  <MemoryRouter initialEntries={['/equipos/62']}>
    <Routes>
      <Route path="/equipos/:codigoEquipo" element={<DetalleEquipo />} />
    </Routes>
  </MemoryRouter>
);

describe('DetalleEquipo - imágenes autenticadas', () => {
  let resolveImageFetch;

  beforeEach(() => {
    localStorage.setItem('token', 'jwt-test');
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:evidence-principal'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
    });

    const imageFetchPromise = new Promise((resolve) => {
      resolveImageFetch = resolve;
    });

    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === `/api/equipos/62`) {
        return Promise.resolve(new Response(JSON.stringify(EQUIPO_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      if (url === `/api/equipos/62/imagenes`) {
        return Promise.resolve(new Response(JSON.stringify(IMAGENES_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      if (url === IMAGEN_URL) {
        return imageFetchPromise;
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('no dispara onError con src vacío mientras la imagen autenticada carga, y la muestra al resolver', async () => {
    renderDetalleEquipo();

    // Mientras el fetch autenticado de la imagen sigue pendiente, no debe existir un <img>
    // con src="" en el documento (esa es la causa raíz del bug: src="" dispara onError).
    await screen.findByText('Imagen Principal');
    const imgsWhileLoading = document.querySelectorAll('.detalle-equipo-image-wrapper img');
    imgsWhileLoading.forEach((img) => {
      expect(img.getAttribute('src')).not.toBe('');
    });

    // Resolver el fetch autenticado de la imagen con éxito.
    resolveImageFetch(new Response(new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' }), {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg' },
    }));

    // La imagen principal debe terminar visible con la blob URL real, no oculta.
    const principalImg = await waitFor(() => {
      const img = document.querySelector('.detalle-equipo-image-wrapper img');
      if (!img || img.getAttribute('src') !== 'blob:evidence-principal') {
        throw new Error('imagen principal todavía no resuelta');
      }
      return img;
    });

    expect(principalImg.style.display).not.toBe('none');
  });

  it('no oculta la imagen para siempre tras un onError transitorio si luego llega una url nueva', async () => {
    // Regresión específica de la causa raíz (b): antes del fix, onError mutaba
    // style.display='none' imperativamente y React nunca lo revertía en un re-render
    // posterior con una blob: url distinta para la misma imagen. Este test simula
    // exactamente ese re-render (refetch tras marcar una imagen de galería como
    // principal, que produce una ruta_imagen/blob: url nueva para el mismo
    // id_imagen_equipo) y verifica que la imagen vuelve a mostrarse en su thumbnail.
    localStorage.setItem('user', JSON.stringify({ nombre_rol: 'Administrador' }));

    const SECONDARY_ID = 2;
    const SECONDARY_URL = '/api/equipos/imagenes/archivo/1787075246545-62-image-2.jpg';
    const SECONDARY_URL_REFRESHED =
      '/api/equipos/imagenes/archivo/1787075246545-62-image-2-refreshed.jpg';

    const blobUrlByRealUrl = {
      [IMAGEN_URL]: 'blob:evidence-1',
      [SECONDARY_URL]: 'blob:evidence-2',
      [SECONDARY_URL_REFRESHED]: 'blob:evidence-2-refreshed',
    };
    let currentFetchingUrl = null;
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => blobUrlByRealUrl[currentFetchingUrl]),
      configurable: true,
    });

    let imagenesCallCount = 0;

    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url === `/api/equipos/62`) {
        return Promise.resolve(new Response(JSON.stringify(EQUIPO_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      if (url === `/api/equipos/62/imagenes`) {
        imagenesCallCount += 1;
        const secondaryRuta =
          imagenesCallCount === 1 ? SECONDARY_URL : SECONDARY_URL_REFRESHED;
        return Promise.resolve(new Response(JSON.stringify({
          codigo_equipo: 62,
          total: 2,
          imagenes: [
            IMAGENES_RESPONSE.imagenes[0],
            {
              id_imagen_equipo: SECONDARY_ID,
              codigo_equipo: 62,
              ruta_imagen: secondaryRuta,
              nombre_archivo: 'image-2.jpg',
              tipo_imagen: 'Detalle',
              descripcion: 'Segunda foto',
              fecha_subida: '2026-08-20T00:00:00.000Z',
              es_principal: false,
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      if (url in blobUrlByRealUrl) {
        currentFetchingUrl = url;
        return Promise.resolve(new Response(new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' }), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        }));
      }
      if (url === `/api/equipos/imagenes/${SECONDARY_ID}/principal` && options?.method === 'PATCH') {
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }));

    renderDetalleEquipo();

    const getSecondaryThumbnail = () =>
      document.querySelectorAll('.detalle-equipo-gallery-thumbnail')[1];

    const secondaryImg = await waitFor(() => {
      const img = getSecondaryThumbnail()?.querySelector('img');
      if (!img || img.getAttribute('src') !== 'blob:evidence-2') {
        throw new Error('imagen secundaria todavía no resuelta');
      }
      return img;
    });
    expect(secondaryImg.style.display).not.toBe('none');

    // Simular un fallo de carga transitorio (p.ej. blob revocado, error de decodificación).
    act(() => {
      fireEvent.error(secondaryImg);
    });

    // El fix reemplaza la mutación permanente por un estado por-url: el <img> se deja de
    // renderizar (y el placeholder se muestra) mientras la url siga marcada como rota.
    await waitFor(() => {
      expect(getSecondaryThumbnail().querySelector('img')).toBeNull();
    });
    const placeholder = getSecondaryThumbnail().querySelector(
      '.detalle-equipo-gallery-thumbnail-placeholder'
    );
    expect(placeholder.style.display).toBe('flex');

    // Disparar el refetch real (marcar como principal) que produce una blob: url NUEVA
    // para la misma imagen (mismo id_imagen_equipo, ruta_imagen distinta).
    const starButton = getSecondaryThumbnail().querySelector(
      '.detalle-equipo-gallery-thumbnail-btn:not(.detalle-equipo-gallery-thumbnail-btn-delete)'
    );
    expect(starButton).not.toBeNull();
    await act(async () => {
      fireEvent.click(starButton);
    });

    // La imagen debe reaparecer con la url nueva, no quedar oculta para siempre.
    const refreshedImg = await waitFor(() => {
      const img = document.querySelectorAll('.detalle-equipo-gallery-thumbnail')[1]
        ?.querySelector('img');
      if (!img || img.getAttribute('src') !== 'blob:evidence-2-refreshed') {
        throw new Error('imagen secundaria todavía no refrescada');
      }
      return img;
    });
    expect(refreshedImg.style.display).not.toBe('none');
  });
});
