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

- Las etiquetas `<img>` existentes del frontend usan `ruta_imagen` directamente y no pueden enviar el Bearer token al nuevo endpoint privado. Es necesario adaptar el cliente para descargar un blob autenticado (o introducir una sesión cookie segura) antes de habilitar esta ruta en preview visual.
- La verificación de firmas cubre los formatos permitidos y elimina el temporal antes del `INSERT`, pero no realiza análisis antivirus ni decodificación completa de imágenes.
- No se accedió a producción ni se crearon archivos reales en `uploads`; las verificaciones se ejecutaron con fixtures y mocks.
