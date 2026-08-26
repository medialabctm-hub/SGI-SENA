---
status: awaiting_human_verify
trigger: >-
  Tras desplegar los fixes de la sesión equipos-fotos-404-uploads (backfill de rutas +
  ^~ en nginx /api), el usuario reporta que las fotos de equipos SIGUEN sin mostrarse
  visualmente en producción, aunque la ruta ya cambió de /uploads/equipos/... a la
  correcta /api/equipos/imagenes/archivo/.... Consola del navegador (index-CvVLcgcv.js:178):
  "Error al cargar imagen: /api/equipos/imagenes/archivo/1787075246545-62-image.jpg"
  (y 1787075219760-62-image.jpg), repetido dos veces cada una.
created: 2026-08-26
updated: 2026-08-26
---

## Symptoms

- expected: Las fotos de equipos deberían renderizarse visualmente en la vista de detalle del equipo.
- actual: El navegador sigue disparando el evento onError de la etiqueta <img> para las fotos de equipos, aunque la ruta ya es la correcta (/api/equipos/imagenes/archivo/...). El usuario confirma explícitamente "la visual no me muestra las imágenes" — no es solo un log de consola, la imagen no aparece.
- errors: |
  Error al cargar imagen: /api/equipos/imagenes/archivo/1787075246545-62-image.jpg
  Error al cargar imagen: /api/equipos/imagenes/archivo/1787075246545-62-image.jpg
  Error al cargar imagen: /api/equipos/imagenes/archivo/1787075219760-62-image.jpg
- timeline: Reportado 2026-08-26, inmediatamente después de confirmar (vía railway logs) que el endpoint /api/equipos/imagenes/archivo/<file> responde 200 con el cuerpo del archivo completo (2.9-3.3MB) para exactamente estas rutas — el problema NO es de red/routing esta vez.
- reproduction: Abrir la vista de detalle de un equipo con fotos (ej. equipo 62) en producción y observar que la imagen no se renderiza, con "Error al cargar imagen" en consola pese a que el endpoint responde 200.

## Current Focus

hypothesis: "CONFIRMADO: el <img> de Imagen Principal y de cada thumbnail de galería en DetalleEquipo.jsx monta con src=\"\" durante la ventana de carga (imagenPrincipal/imagenes ya están seteados síncronamente, pero authenticatedPrincipal.url / imagen.url del hook useAuthenticatedEvidenceImages todavía es undefined porque su fetch autenticado es asíncrono). src=\"\" dispara onError inmediato, cuyo handler hace e.target.style.display='none' de forma imperativa (no vía prop style de React). Cuando el fetch+blob real completa poco después y React re-renderiza el mismo <img> con la blob: URL correcta, el display:none seteado a mano NUNCA se revierte porque React no controla ese atributo -- la imagen queda oculta para siempre pese a cargar con éxito."
test: "Ya verificado por lectura directa de código (DetalleEquipo.jsx líneas 1356-1370, 1421-1444; useAuthenticatedEvidenceImages.js completo). Reasoning checkpoint pendiente antes de aplicar el fix."
expecting: "El fix debe evitar (a) que el <img> se monte con src vacío antes de tener una URL válida, y (b) que un onError transitorio deje el elemento oculto permanentemente vía mutación de estilo no controlada por React."
next_action: "Fix aplicado, verificado (tests+lint+build) y desplegado a producción (commit 9373ce8, push a origin/develop, Railway redeployado y saludable). Falta que el usuario confirme visualmente en producción que las fotos del equipo (ej. equipo 62) ahora se muestran antes de archivar la sesión como resuelta."
reasoning_checkpoint:
  hypothesis: "El <img> de Imagen Principal y de cada thumbnail de galería monta con src=\"\" mientras el hook useAuthenticatedEvidenceImages todavía no resuelve su fetch asíncrono. src=\"\" dispara onError inmediato que hace e.target.style.display='none' de forma imperativa (fuera de React). Cuando la blob: URL real llega y React re-renderiza el mismo <img> con el nuevo src, React no toca style (no es una prop controlada) por lo que display:none queda permanente, ocultando la imagen aunque cargue con éxito."
  confirming_evidence:
    - "Lectura directa: authenticatedPrincipal/imagen.url provienen de useAuthenticatedEvidenceImages, cuyo useEffect dispara un fetch() async DESPUÉS de que imagenes/imagenPrincipal ya están en estado (fetchImagenes setea imagenes síncronamente antes de que el hook resuelva nada) -> ventana real de src vacío."
    - "Lectura directa: ni el <img> de línea 1359 ni el de línea 1430 tienen prop style={...} en JSX -- toda mutación de display es imperativa vía onError, por lo que React nunca la revierte en el siguiente render con src válido."
    - "Railway logs confirmaron 200 + bytes correctos para las URLs exactas reportadas como fallidas -- descarta problema de red/CSP/servidor, consistente con un fallo puramente de timing+estado en el cliente."
  falsification_test: "Si se agrega key={imagen.url} al <img> (forzando montaje de un nodo DOM nuevo, sin el display:none heredado, cada vez que cambia la url) o se evita renderizar el <img> hasta tener una url no vacía, y el problema persiste, la hipótesis es falsa."
  fix_rationale: "El fix ataca la causa raíz (mutación de estilo no controlada por React sobre un elemento cuyo src cambia de vacío a válido) en vez del síntoma (agregar 'blob:' a un CSP que ni siquiera aplica al documento, como se creía inicialmente). Se reemplaza la mutación imperativa por estado de React (useState por imagen) que se resetea automáticamente cuando el src cambia, y se evita montar <img src=''> renderizando el placeholder mientras la url autenticada no esté lista."
  blind_spots: "No se ha reproducido visualmente en un navegador real (no hay acceso a producción/staging desde este entorno) -- la confirmación es por lectura de código + comprensión del comportamiento estándar de <img src=''>/onError/reconciliación de React, no por observación directa en runtime. No se descartó al 100% que exista además un problema intermitente de red (aunque los logs de railway ya lo hacen muy improbable)."
  candidate_causes:
    - "code: <img src=''> transitorio + mutación imperativa de estilo no revertida por React (categoría: code)"
    - "config: CSP sin 'blob:' en el backend (categoría: config) -- YA ELIMINADA con evidencia (el backend no sirve el documento HTML, nginx no propaga CSP al documento)"
  and_gate: "no -- una sola causa (timing de montaje + mutación de estilo no controlada) explica el síntoma completo de forma suficiente; no se requieren múltiples condiciones simultáneas. La hipótesis de CSP fue una causa candidata separada ya descartada por evidencia directa, no una causa concurrente."
tdd_checkpoint: null

## Evidence

- timestamp: 2026-08-26T16:50:00Z
  checked: railway logs --lines 300 (producción) para las URLs exactas reportadas por el usuario
  found: "GET /api/equipos/imagenes/archivo/1787075219760-62-image.jpg HTTP/1.1\" 200 3338390" y "...1787075246545-62-image.jpg HTTP/1.1\" 200 2905561" — ambas con 200 y tamaños de cuerpo consistentes con fotos reales (no error JSON). Peticiones posteriores devuelven 304 (cache).
  implication: El fetch de red YA funciona correctamente (routing + auth + archivo físico todos correctos). El fallo está en el navegador DESPUÉS de recibir la respuesta exitosa — descarta de nuevo problemas de red/BD/nginx, apunta a algo en el pipeline de renderizado del frontend (blob URL, CSP, tipo MIME).

- timestamp: 2026-08-26T16:52:00Z
  checked: frontend/src/hooks/useAuthenticatedEvidenceImages.js
  found: "const objectUrl = URL.createObjectURL(await response.blob()); ... return [image.id_imagen_equipo, objectUrl];" — el patrón de carga es fetch autenticado -> blob -> URL.createObjectURL -> esa URL blob: se usa como src de <img> en DetalleEquipo.jsx (líneas 1360, 1431: src={authenticatedPrincipal?.url || ''}).
  implication: Cualquier <img> que reciba esta blob: URL depende de que el navegador la acepte según la Content-Security-Policy vigente.

- timestamp: 2026-08-26T16:53:00Z
  checked: backend/src/app.js línea 75-91 (config de helmet/CSP)
  found: "imgSrc: [\"'self'\", 'data:', 'https:']" — NO incluye 'blob:'.
  implication: Coincide exactamente con el patrón del bug — el navegador debe estar rechazando la carga de la imagen por violación de CSP (img-src), lo cual dispara el evento onError del <img> pese a que la petición de red subyacente (el fetch()) fue exitosa y no está sujeta a la misma restricción de CSP que el <img src>.

- timestamp: 2026-08-26T16:54:00Z
  checked: git log -p --follow -- backend/src/app.js | grep imgSrc
  found: La línea imgSrc actual fue introducida en el commit 2ddeb3f ("fix(uploads): protect equipment evidence access", 2026-08-20) — el mismo commit que cambió el flujo de imágenes de equipos de URLs públicas directas a fetch+blob autenticado.
  implication: Refuerza la hipótesis — 2ddeb3f introdujo el patrón blob: para <img> pero no actualizó el CSP para permitirlo, dejando esta ruptura latente desde esa fecha (probablemente afecta TODAS las fotos de equipos, no solo las legadas, aunque solo se haya reportado explícitamente para equipos con fotos antiguas).

## Evidence (cont.)

- timestamp: 2026-08-26T17:15:00Z
  checked: "frontend/src/pages/DetalleEquipo.jsx líneas 1356-1370 (Imagen Principal) y 1421-1444 (galería de thumbnails), más frontend/src/hooks/useAuthenticatedEvidenceImages.js completo"
  found: "El <img> de 'Imagen Principal' se renderiza en cuanto imagenPrincipal es truthy (seteado síncronamente por fetchImagenes() al recibir la lista de imágenes), PERO src={authenticatedPrincipal?.url || ''} depende de un hook aparte (useAuthenticatedEvidenceImages) que dispara su PROPIO fetch() asíncrono (con Authorization Bearer) y solo resuelve la blob: URL después. Existe una ventana de tiempo real donde imagenPrincipal ya es truthy (así que el <img> ya está montado) pero authenticatedPrincipal?.url todavía es undefined -> src=\"\". Mismo patrón en la galería: src={imagen.url || ''} (línea 1431)."
  implication: "src=\"\" en un <img> monta una URL que el navegador interpreta como la página actual, dispara una petición fallida y por tanto onError INMEDIATAMENTE, antes de que el fetch autenticado real siquiera complete. Esto coincide con 'Error al cargar imagen: <ruta_imagen>' apareciendo pese a que el endpoint real devuelve 200 poco después — el error no es sobre la petición real, es sobre el src vacío transitorio."

- timestamp: 2026-08-26T17:18:00Z
  checked: "Los onError handlers en DetalleEquipo.jsx (líneas 1362-1368 y 1433-1443)"
  found: "Ambos onError hacen e.target.style.display = 'none' (mutación imperativa directa del DOM). Ninguno de los dos <img> tiene la prop JSX style={...} — React NO gestiona/controla el atributo style de estos elementos, por lo que nunca lo resetea en reconciliaciones posteriores. Cuando el hook luego resuelve la blob: URL real y React re-renderiza el mismo <img> (misma posición/key) con el nuevo src, React solo actualiza el atributo src -- el display:none que quedó seteado imperativamente por onError PERSISTE indefinidamente, incluso después de que la imagen real cargue exitosamente por debajo (invisible)."
  implication: "Root cause confirmado: el onError transitorio disparado por src=\"\" dispara un side-effect permanente (display:none) que React nunca revierte, dejando la imagen oculta para siempre aunque el fetch+blob posterior tenga éxito. Esto explica exactamente el síntoma reportado: consola muestra el error, el endpoint responde 200 (confirmado en logs), pero la imagen visualmente NUNCA aparece."

- timestamp: 2026-08-26T17:35:00Z
  checked: "Estado del working tree al reanudar la sesión (git diff / git status) antes de tocar código"
  found: "Un run previo interrumpido ya había aplicado la parte (a) del fix (guard de montaje: no renderizar <img> hasta que authenticatedPrincipal?.url / imagen.url sea truthy, mostrando placeholder en su lugar) tanto en Imagen Principal como en la galería, y ya existía frontend/src/pages/DetalleEquipo.test.jsx cubriendo ese escenario. La parte (b) (reemplazar e.target.style.display='none' imperativo por estado de React) NO estaba aplicada todavía."
  implication: "Se procedió a aplicar solo la parte (b) pendiente: se agregó estado brokenImageUrls (Set de blob: urls que fallaron) en DetalleEquipo.jsx, consultado como imagen.url && !brokenImageUrls.has(imagen.url) tanto para decidir si renderizar el <img> como para decidir si mostrar el placeholder de la galería. Al usar la propia blob: url como clave, una url nueva (tras refetch) invalida automáticamente la marca de 'roto' sin necesidad de limpiar el Set manualmente."

- timestamp: 2026-08-26T17:45:00Z
  checked: "Nuevo test de regresión agregado a DetalleEquipo.test.jsx: onError real sobre una blob: url ya resuelta + refetch (marcar como principal) que produce una blob: url NUEVA para el mismo id_imagen_equipo"
  found: "Ejecutado en RED contra el código pre-fix (git stash del cambio en DetalleEquipo.jsx): el test falla con 'expected null not to be null' -- el <img> permanece en el DOM con style=\"display: none\" fijado permanentemente, incluso tras la url nueva no llegar a probarse porque el <img> roto nunca desaparece. Confirma que el test reproduce el mecanismo exacto del bug. Ejecutado en GREEN tras restaurar el fix: el <img> roto se reemplaza por el placeholder (display:flex) mientras la url sigue marcada como rota, y al llegar la blob: url nueva (post-refetch) el <img> reaparece con style.display !== 'none'."
  implication: "El fix (b) queda verificado como regresión real, no vacía -- diferencia comportamiento observable entre pre-fix y post-fix exactamente en el punto que la hipótesis predice."

- timestamp: 2026-08-26T17:50:00Z
  checked: "npx vitest run (suite completa frontend) y npx eslint sobre los archivos modificados, comparado antes/después del fix vía git stash"
  found: "Suite completa: 8 archivos de test, 27 tests, 0 fallos (incluye los 2 tests de DetalleEquipo.test.jsx y el hook useAuthenticatedEvidenceImages.test.jsx preexistente, no tocado por este fix). ESLint sobre DetalleEquipo.jsx: 0 errores, 3 warnings preexistentes e idénticos (mismo texto, solo shift de número de línea) al comparar pre-fix vs post-fix -- ninguno introducido por el cambio."
  implication: "Sin regresiones detectables en la suite de tests ni en lint. Fix listo para checkpoint de verificación humana (no reproducible visualmente en este entorno sin acceso a producción)."

## Eliminated

- hypothesis: "El header CSP img-src del backend (helmet, backend/src/app.js) bloquea las blob: URLs usadas por <img src={blobUrl}>, causando onError pese al fetch exitoso."
  evidence: "El frontend NO es servido por el backend Express — es servido por un nginx independiente (frontend/nginx-server.conf) cuyo location / (que sirve index.html y el bundle JS que contiene los <img>) NO agrega ningún header Content-Security-Policy (solo X-Frame-Options, X-Content-Type-Options, X-XSS-Protection). No existe tampoco <meta http-equiv=\"Content-Security-Policy\"> en el HTML del frontend. El helmet CSP en app.js SOLO se aplica a las respuestas del backend (JSON de /api/*, estáticos de /uploads/ambientes y /uploads/perfiles) — y CSP img-src se evalúa contra la política del DOCUMENTO que contiene el <img>, no contra headers de la respuesta individual de la imagen. Como el documento (servido por nginx) no tiene CSP alguna, no hay policy que pueda bloquear blob: ahí. La hipótesis original confundió "el header CSP existe en el backend" con "el header CSP gobierna el documento que renderiza el <img>" — son procesos/orígenes de respuesta distintos.
  timestamp: 2026-08-26T17:05:00Z

## Resolution

root_cause: "El <img> de 'Imagen Principal' y de cada thumbnail de galería en DetalleEquipo.jsx montaba (o podía montar) con src vacío mientras el hook useAuthenticatedEvidenceImages resolvía su fetch autenticado asíncrono; src=\"\" dispara onError inmediato. Ese onError mutaba style.display='none' imperativamente sobre el nodo DOM, fuera del control de React. Cuando el fetch+blob real completaba y React re-renderizaba el mismo <img> con la blob: URL correcta, el display:none manual nunca se revertía (React no gestiona ese atributo porque no hay prop style en JSX), dejando la imagen oculta para siempre pese a cargar con éxito. La hipótesis inicial de CSP (imgSrc sin 'blob:' en helmet) fue eliminada con evidencia: el documento HTML que contiene los <img> es servido por un nginx independiente sin ningún header CSP, así que la policy de helmet en el backend no gobierna la carga de imágenes en el documento."
fix: "Dos cambios en frontend/src/pages/DetalleEquipo.jsx: (a) no montar el <img> hasta que exista una url autenticada no vacía (authenticatedPrincipal?.url / imagen.url) -- se muestra un placeholder mientras tanto, evitando el src=\"\" transitorio que disparaba onError inmediato; (b) se reemplazó la mutación imperativa e.target.style.display='none' (y su equivalente sobre nextElementSibling en la galería) por un estado de React brokenImageUrls (Set de urls que fallaron), consultado en el JSX vía imagen.url && !brokenImageUrls.has(imagen.url). Como la clave es la propia blob: url (regenerada por el hook cada vez que cambia la imagen o se re-resuelve el fetch), la marca de 'broken' queda automáticamente obsoleta cuando llega una url nueva, permitiendo que React vuelva a intentar renderizar el <img> en el siguiente render en vez de quedar oculto para siempre."
verification: |
  1. Regression test agregado en frontend/src/pages/DetalleEquipo.test.jsx cubriendo el escenario (b)
     (onError real sobre una blob: url ya resuelta, seguido de un refetch real -- marcar imagen
     como principal -- que produce una blob: url NUEVA para el mismo id_imagen_equipo). Verificado
     en RED contra el código pre-fix (git stash): el test falla mostrando <img style="display: none">
     permanentemente en el DOM, confirmando que reproduce el mecanismo exacto del bug. Verificado en
     GREEN contra el código con el fix aplicado: el <img> roto se reemplaza por el placeholder, y al
     llegar la url nueva la imagen reaparece visible (style.display !== 'none').
  2. Test preexistente (creado en el run anterior interrumpido) que cubre el escenario (a) --
     no debe existir <img src=""> mientras el fetch autenticado está pendiente -- sigue en GREEN.
  3. Suite completa de frontend (`npx vitest run`): 8 archivos, 27 tests, 0 fallos. Sin regresiones
     en otras páginas/componentes/hooks (incluye useAuthenticatedEvidenceImages.test.jsx, no
     modificado por este fix).
  4. `npx eslint src/pages/DetalleEquipo.jsx src/pages/DetalleEquipo.test.jsx`: 0 errores. Los 3
     warnings preexistentes (useEffect deps, unused var, prefer-destructuring) se confirmaron
     idénticos en el código pre-fix vía git stash -- no introducidos por este cambio.
  Pendiente: confirmación humana de que las fotos se ven correctamente en producción (no
  reproducible desde este entorno -- ver blind_spots del reasoning_checkpoint).
  5. Commit 9373ce8 creado y pusheado a origin/develop. `railway logs` confirma rebuild y
     redeploy limpio (nginx config validada, backend respondiendo, contenedor healthy) poco
     después del push. El fix ya está live en producción, pendiente solo de confirmación
     visual humana.
files_changed:
  - frontend/src/pages/DetalleEquipo.jsx
  - frontend/src/pages/DetalleEquipo.test.jsx
