---
phase: 03-code-corrections-and-reproducible-qa-gates
plan: 04
status: completed
issues:
  - MDL-11
  - MDL-14
  - MDL-135
---

# 03-04 — Resumen de ejecución

## Entrega

- `fileValidation` mantiene los límites de 50 MB y valida el contenedor antes
  del parser: `.xls` requiere firma OLE y `.xlsx` requiere firma ZIP. Los
  archivos vacíos, con MIME/extensión incoherentes o con contenido incompatible
  se rechazan en el middleware posterior a Multer; el logger de Excel no
  registra nombre de archivo ni identidad de usuario.
- Las tres rutas de importación pasan por `validateExcel` después de
  `upload.single`, antes de llegar a `XLSX.read` en los controladores.
- `playwright.config.js` usa un servidor Vite aislado en `127.0.0.1:4173`
  cuando no se configura `BASE_URL`, evitando reutilizar un servidor de otra
  aplicación. `e2e/sgi-public-contract.spec.js` cubre shell/login y las
  validaciones públicas vacías sin credenciales ni mutaciones.
- El smoke conserva el préstamo controlado opt-in y añade una consulta pública
  de validación de solo lectura. El modo por defecto continúa sin crear
  préstamos ni usar credenciales.
- La prueba de `useAuthenticatedEvidenceImages` verifica `credentials:
  include`, ausencia de `Authorization` y ausencia de token en storage; el
  source del hook no se modificó.

## Alcance y límites

La entrega cubre evidencia local reproducible para MDL-11, MDL-14 y MDL-135.
No se ejecutaron ni se declaran satisfechos MySQL real, Docker, Railway,
staging, CI remoto, credenciales productivas, flujos autenticados o UAT físico.
