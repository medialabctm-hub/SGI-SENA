---
phase: 03
slug: code-corrections-and-reproducible-qa-gates
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-14
---

# Phase 3 — Validation Strategy

> Contrato de validación retroactivo: todas las tareas de código tienen una
> comprobación automatizada local; los gates externos se mantienen manuales.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest ESM, Playwright Chromium, ESLint, Vite |
| **Config file** | `backend/package.json`, `backend/jest.config.js`, `playwright.config.js` |
| **Quick run command** | `npm test --prefix backend -- --runInBand --forceExit tests/scripts/run-mysql-integration.test.js` |
| **Full suite command** | `npm test --prefix backend -- --runInBand --forceExit --silent` |
| **Estimated runtime** | ~194 seconds backend observado; frontend/E2E se ejecutan por separado |

## Sampling Rate

- Después de cada commit de tarea: ejecutar la suite focal del plan.
- Después de la wave: ejecutar backend/frontend completos, lint, build y E2E
  público.
- Antes de `gsd-verify-work`: el barrido local debe quedar verde y los gates
  externos deben tener un responsable humano.
- Latencia máxima observada del feedback focal: menor a 30 segundos; suite
  backend completa: ~111 segundos.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 03-05-01 | 03-05 | 1 | MDL-13 | Aprendiz solo consulta su historial en equipo vinculado; roles amplios conservan consulta | unit/controller | `npm test --prefix backend -- --runInBand --forceExit tests/controllers/equiposController.test.js tests/controllers/aprendicesController.test.js tests/controllers/importController.test.js` | ✅ | ✅ green |
| 03-05-02 | 03-05 | 1 | MDL-13 | Falta de identidad o vínculo responde 404 sin enumeración | security regression | mismo comando 03-05 | ✅ | ✅ green |
| 03-01-01 | 03-01 | 1 | MDL-138 | Esperar MySQL listo sin exponer secreto y limpiar recursos | unit/integration | `npm test --prefix backend -- --runInBand --forceExit tests/scripts/run-mysql-integration.test.js` | ✅ | ✅ green |
| 03-01-02 | 03-01 | 1 | MDL-73 | Compose monta SQL existente sin secretos ficticios | config | `docker compose config --quiet` | ✅ | ✅ green |
| 03-02-01 | 03-02 | 1 | MDL-130 | Request público sin DDL ni metadata | unit/integration mock | `npm test --prefix backend -- --runInBand --forceExit tests/controllers/equiposAssignmentAutoservicio.test.js tests/controllers/equiposAutoservicioAmbiente.integration.test.js tests/routes/health.test.js` | ✅ | ✅ green |
| 03-02-02 | 03-02 | 1 | MDL-129 | Readiness no disponible produce 503 antes de conexión | unit/integration mock | mismo comando 03-02 | ✅ | ✅ green |
| 03-03-01 | 03-03 | 1 | MDL-126 | Límites independientes por IP e identificador hasheado | unit/route | `npm test --prefix backend -- --runInBand --forceExit tests/middleware/rateLimiter.test.js tests/routes/equiposRoutes.test.js` | ✅ | ✅ green |
| 03-03-02 | 03-03 | 1 | MDL-15 | 429 estable sin enumerar documento/placa | route | mismo comando 03-03 | ✅ | ✅ green |
| 03-04-01 | 03-04 | 1 | MDL-135 | Firma Excel coherente antes del parser y rutas fail-closed | unit/route | `npm test --prefix backend -- --runInBand --forceExit tests/middleware/fileValidation.test.js tests/routes/importRoutes.test.js tests/scripts/smoke-test.test.js` | ✅ | ✅ green |
| 03-04-02 | 03-04 | 1 | MDL-11/14 | Contratos públicos E2E sin credenciales ni mutación | E2E | `npm run test:e2e` | ✅ | ✅ green |
| 03-04-03 | 03-04 | 1 | MDL-11 | Sesión de imágenes usa cookie `httpOnly` | unit frontend | `npm test --prefix frontend -- --run --pool=threads --maxWorkers=1 src/hooks/useAuthenticatedEvidenceImages.test.jsx` | ✅ | ✅ green |
| 03-06-01 | 03-06 | 2 | MDL-13 | Aprendiz solo consulta detalle de equipo vinculado y no recibe responsables ajenos | unit/controller | `npm test --prefix backend -- --runInBand --forceExit --no-cache tests/controllers/equiposController.test.js` | ✅ | ✅ green |
| 03-06-02 | 03-06 | 2 | MDL-13 | Aprendiz solo consulta verificaciones y movimientos tras vínculo activo; equipo ajeno e identidad inválida fallan cerrado | security regression | mismo comando 03-06 | ✅ | ✅ green |
| 03-06-03 | 03-06 | 2 | MDL-13 | Administrador, Instructor y Cuentadante conservan visibilidad amplia en las tres lecturas | unit/controller | `npm test --prefix backend -- --runInBand --forceExit --no-cache tests/controllers/equiposController.test.js tests/controllers/aprendicesController.test.js tests/controllers/importController.test.js` | ✅ | ✅ green |

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No Wave 0 stubs were
needed.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| E2E autenticado de login, upload y cierre en despliegue | MDL-11/14/15/135 | Requiere Railway/staging y credenciales autorizadas | Ejecutar contra URL autorizada, usar datos de prueba y adjuntar request/response, logs y captura sin PII |
| Concurrencia/readiness de arranque en Railway | MDL-129/138/73 | Infraestructura externa | Desplegar imagen limpia, reiniciar dos instancias y adjuntar health, logs y resultado MySQL |
| Política de `registro-externo` | MDL-126/15 | Requiere decisión de producto sobre identidad/capability/cuota | Aprobar contrato; luego probar API key/firma, cuota diaria y límites multipart en staging |
| Evidencia física de aulas 303/304 | MDL-15 | Requiere presencia física | Realizar toma en sitio cuando el responsable esté presente; excluida de esta ejecución |

## Validation Sign-Off

- [x] Todas las tareas tienen verificación automatizada local.
- [x] No hay tres tareas consecutivas sin una comprobación automatizada.
- [x] No se usan flags de watch.
- [x] `nyquist_compliant: true` está establecido para la cobertura local.
- [ ] Despliegue, staging, CI remoto y UAT físico completados.

**Approval:** validated-local 2026-09-14; external gates pending
