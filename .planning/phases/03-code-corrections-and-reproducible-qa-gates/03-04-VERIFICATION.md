---
phase: 03-code-corrections-and-reproducible-qa-gates
plan: 04
status: verified-local
---

# 03-04 — Verificación

## PASS local

| Comando | Resultado |
|---|---|
| `npm test --prefix backend -- --runInBand tests/middleware/fileValidation.test.js tests/scripts/smoke-test.test.js` | PASS — 2 suites, 39 tests |
| `npm test --prefix backend -- --runInBand tests/routes/importRoutes.test.js` | PASS — 1 suite, 5 tests |
| `npm test --prefix frontend -- --run --pool=threads --maxWorkers=1 src/hooks/useAuthenticatedEvidenceImages.test.jsx` | PASS — 1 suite, 2 tests |
| `npm run test:e2e` | PASS — 3 specs Chromium; servidor Vite aislado en `127.0.0.1:4173` |
| `npm run build --prefix frontend` | PASS — Vite build completado; solo warning de tamaño de chunk |
| `npm run lint --prefix frontend` | PASS — 0 errores; 100 warnings preexistentes fuera del alcance |
| `git diff --check` | PASS |

## Evidencia de seguridad y alcance

- La firma OLE/ZIP se valida en memoria antes de ejecutar los controladores de
  importación; los casos vacío, `.xls` con ZIP y `.xlsx` con OLE están cubiertos.
- El smoke default solo consulta health, shell, validación pública de lectura y
  el endpoint de préstamo con body vacío (respuesta de validación 400). El
  préstamo real permanece condicionado a `SMOKE_LOAN=1` y fixtures explícitos.
- Los specs E2E no introducen credenciales, no simulan una sesión autenticada y
  no envían requests API cuando la validación cliente rechaza formularios
  vacíos.

## HUMAN / BLOCKED

Quedan HUMAN/BLOCKED los gates que requieren infraestructura o datos externos:
MySQL real y concurrencia, Docker, Railway, staging, CI remoto, login con
credenciales autorizadas, navegador/dispositivos externos y UAT físico. El
smoke de red contra un servicio desplegado no se ejecutó en este worktree.
