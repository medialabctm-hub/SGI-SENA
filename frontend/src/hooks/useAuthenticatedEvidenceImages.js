import { useEffect, useMemo, useState } from 'react';

export function useAuthenticatedEvidenceImages(images = []) {
  const [urls, setUrls] = useState({});
  const imageKey = useMemo(
    () => images.map((image) => `${image.id_imagen_equipo}:${image.ruta_imagen}`).join('|'),
    [images]
  );

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];
    const controller = new AbortController();

    async function load() {
      const entries = await Promise.all(images.map(async (image) => {
        const response = await fetch(image.ruta_imagen, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) return [image.id_imagen_equipo, null];
        const objectUrl = URL.createObjectURL(await response.blob());
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return [image.id_imagen_equipo, null];
        }
        objectUrls.push(objectUrl);
        return [image.id_imagen_equipo, objectUrl];
      }));

      if (cancelled) return;
      setUrls(Object.fromEntries(entries));
    }

    setUrls({});
    load().catch(() => {
      if (!cancelled) setUrls({});
    });

    return () => {
      cancelled = true;
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageKey]);

  return images.map((image) => ({ ...image, url: urls[image.id_imagen_equipo] || null }));
}
