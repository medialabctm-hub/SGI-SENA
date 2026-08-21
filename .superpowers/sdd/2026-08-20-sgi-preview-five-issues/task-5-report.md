# MDL-80 — Evidencias de equipos

## Root cause

Las imágenes de equipos se persistían tras validar solamente el MIME declarado y la extensión de forma independiente. La subida privada tenía RBAC por permiso, pero no comprobaba el ambiente del equipo; además, `express.static('/uploads')` exponía directamente `uploads/equipos`, por lo que una URL conocida evitaba el RBAC. El flujo de verificación externa también podía adjuntar evidencias sin aplicar alcance de ambiente.

## Cambio

- Se exige correspondencia MIME–extensión y se verifica la firma de JPEG, PNG, GIF o WEBP antes del `INSERT`.
- Los nombres de evidencia se restringen a un basename seguro; `getImagePath` ahora produce una URL de API privada y la ruta estática de equipos devuelve 404.
- Se añadió `requireEquipmentEvidenceScope`: administrador tiene alcance total; los demás deben ser cuentadante, tener responsabilidad activa del ambiente o una asignación activa del equipo.
- Las subidas privadas verifican permiso y alcance antes de Multer; el controlador vuelve a exigir el marcador de alcance y limpia temporales en rechazo, código inválido o error de persistencia.
- La verificación externa sigue siendo pública sin adjuntos; si adjunta evidencias exige usuario autenticado autorizado y alcance del equipo. El contenido se valida y limpia antes de persistir.
- Las evidencias se descargan mediante `GET /api/equipos/imagenes/archivo/:filename`, protegido por autenticación, permisos y alcance.

## Archivos

- `backend/src/app.js`
- `backend/src/middleware/fileValidation.js`
- `backend/src/middleware/uploadMiddleware.js`
- `backend/src/middleware/equipmentEvidenceScope.js`
- `backend/src/routes/equiposRoutes.js`
- `backend/src/routes/imagenesEquipoRoutes.js`
- `backend/src/controller/imagenesEquipoController.js`
- Pruebas de middleware y controlador de imágenes de equipo.

## Commits

- `2ddeb3f fix(uploads): protect equipment evidence access`
- Este informe se registra en un commit de documentación separado.

## Pruebas

- RED observado: MIME JPEG con `.png`, URL pública de evidencia, filename traversal, ausencia de alcance y cleanup en código inválido fallaban antes de la defensa.
- Focales y relacionadas: 8 suites, 210 pruebas pasaron.
- Backend completo: `npm test -- --runInBand` terminó con código 0.
- El diff de MDL-80 no reportó errores de whitespace. El índice compartido contiene errores de whitespace ajenos en `frontend/package.json` y `Header.jsx`, que no se modificaron.

## Riesgos y gaps

- La verificación de firmas cubre los formatos permitidos y elimina el temporal antes del `INSERT`, pero no realiza análisis antivirus ni decodificación completa de imágenes.
- No se accedió a producción ni se crearon archivos reales en `uploads`; las verificaciones se ejecutaron con fixtures y mocks.

## Ronda 2 — correcciones NEEDS_FIX

Se cerraron los hallazgos P1/P2 de revisión:

- Se eliminó el montaje global `express.static('/uploads')`; solo `ambientes` y `perfiles` conservan mounts específicos. Las evidencias de equipos se sirven únicamente desde la API autenticada.
- El guard de alcance se aplica a listado, lectura de metadata, actualización, principal y eliminación. Las rutas por `idImagen` resuelven primero el equipo asociado.
- `handleUploadError` elimina temporales ya escritos cuando Multer rechaza la petición, tanto en la ruta privada como en el flujo externo que comparte el handler.
- `DetalleEquipo` usa `useAuthenticatedEvidenceImages`: descarga cada evidencia con Bearer, entrega object URLs al `<img>` y a `ImageViewer`, y los revoca al cambiar/desmontar.

### Pruebas de la ronda

- RED: ausencia de alcance en listado/metadata y temporales tras rechazo Multer fallaban; el hook inexistente impedía cargar blobs autenticados.
- GREEN focal/backend relacionado: 188 pruebas en 8 suites.
- Frontend relevante: 10 pruebas; `npm run build` finalizó correctamente.
- Backend completo: `npm test -- --runInBand` finalizó con código 0.

### Commits de la ronda

- `fa50bbc fix(uploads): close evidence access review gaps` (hook y prueba de blobs)
- `5204b2f fix(uploads): scope every equipment image operation`
- `8b3551e fix(frontend): render evidence from authenticated blobs`

### Riesgo residual real

La carga de blobs exige que el navegador pueda alcanzar el endpoint API y que el token almacenado sea válido; ante 401/403 la imagen queda vacía, sin volver a abrir una ruta pública. La revocación de object URLs ocurre al cambiar el conjunto de evidencias o desmontar la vista.

## Ronda 2 — re-revisión NEEDS_FIX

### Hallazgos cerrados

- `backend/server.js`, que es el entrypoint de npm y Docker, ya no monta `/uploads` de forma global. Conserva únicamente los mounts públicos de `ambientes` y `perfiles`; las evidencias de equipos quedan detrás del endpoint autenticado.
- En `registrarUsoEquipoExterno`, un error al insertar `Imagenes_Equipo` borra el archivo temporal/renombrado y se propaga al manejador general para responder 500; el flujo ya no continúa con evidencia huérfana.
- `useAuthenticatedEvidenceImages` usa `AbortController` y, aun si un fetch que ignora el abort resuelve después del desmontaje, revoca inmediatamente el object URL tardío y no actualiza estado.
- Se normalizó el whitespace de las líneas de renderizado autenticado en `DetalleEquipo.jsx`. Un hunk funcional ajeno que apareció en el índice compartido se restauró al worktree y quedó fuera del resultado funcional de MDL-80.

### RED/GREEN y verificación

- RED backend: el test del entrypoint encontraba `express.static('/uploads')`; el INSERT externo fallido devolvía 400 y no llamaba a cleanup.
- RED frontend: una respuesta tardía creaba `blob:late-evidence` después de cleanup sin revocarlo.
- GREEN focal: 111 pruebas backend y 2 pruebas del hook frontend.
- Backend relacionado: 157 pruebas en 6 suites (scope, controlador de imágenes, middleware y controlador externo).
- Frontend: `npm run build` completó; Vite dejó únicamente su advertencia existente de chunk grande.
- Backend completo: `npm test -- --runInBand --forceExit` se ejecutó sin fallos en las pasadas de esta ronda. La opción `--forceExit` sigue siendo necesaria por handles abiertos preexistentes de Jest.

### Commits de la ronda 2

- `1dc9576 fix(uploads): close runtime evidence exposure`
- `417babf fix(frontend): format authenticated evidence rendering`
- `dbf96b2 chore(frontend): preserve shared detail changes`

### Riesgo residual real

- La protección depende de que todos los despliegues usen `backend/server.js` o `backend/src/app.js` actuales; un entrypoint alternativo futuro no debe volver a montar `/uploads` de forma global.
- El flujo externo borra el archivo local antes de devolver el error, pero la consistencia entre filesystem y BD ante caídas de proceso fuera de la transacción sigue sin ser atómica. No se tocó producción ni se utilizaron datos o archivos reales.
