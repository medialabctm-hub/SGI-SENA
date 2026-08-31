# MDL-73 — Validar reproducibilidad de Railway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar verificable que el checkout reconstruye el despliegue Railway y que el smoke test cubre el servicio publicado sin crear préstamos por accidente.

**Architecture:** Mantener el Dockerfile multi-stage y los módulos actuales. Extender únicamente el script de smoke del backend para recibir `BASE_URL`, comprobar frontend y proxy `/api`, y ejecutar el préstamo completo solo con fixtures explícitos; documentar el contrato operativo en la guía Railway.

**Tech Stack:** Node.js 20, Express, React/Vite, npm lockfiles, Docker/Nginx, Railway, Jest.

**Spec:** `TASK.md`

## Global Constraints

- No incluir `node_modules/`, `dist/` ni secretos en el release.
- Conservar `frontend/src/utils/loanRequest.js` y los archivos Docker/Railway versionados.
- El smoke por defecto solo debe hacer una validación de préstamo sin mutación; el flujo completo requiere `SMOKE_LOAN=1`, `SMOKE_DOCUMENTO` y `SMOKE_PLACA`.
- Usar cambios mínimos, pruebas mockeadas sin depender de una BD real y commits Conventional Commits en español.

---

### Task 1: Smoke reproducible de Railway

**Files:**
- Modify: `backend/scripts/smoke-test.js`
- Create: `backend/tests/scripts/smoke-test.test.js`

- [ ] Escribir pruebas Jest para `BASE_URL`, frontend, proxy/API y flujo controlado.
- [ ] Ejecutarlas y observar el fallo por la implementación actual, que solo consulta `/health`.
- [ ] Implementar helpers pequeños y exportables; usar `BASE_URL` con fallback local, exigir `/health` 200/`status: ok`, HTML con `#root`, y una petición de validación 400 al endpoint de préstamo.
- [ ] Ejecutar el flujo mutante solo con `SMOKE_LOAN=1` y documento/placa; enviar `Idempotency-Key`, aceptar 200/201 y validar el envelope del préstamo.
- [ ] Ejecutar las pruebas en verde y hacer commit atómico del smoke y sus tests.

### Task 2: Reproducibilidad y operación Railway

**Files:**
- Modify: `.gitignore`
- Modify: `Dockerfile`
- Modify: `Documentation/DEPLOY_RAILWAY.md`
- Add/track if required: `package-lock.json`

- [ ] Hacer explícito que el runbook Railway es versionable y que los artefactos generados quedan fuera del árbol/release.
- [ ] Documentar inventario de archivos raíz, locks, build desde checkout limpio, variables del smoke, rollback triggers y evidencia de commit/digest desplegado.
- [ ] Alinear el healthcheck de Docker con el puerto dinámico de Railway si la verificación lo confirma.
- [ ] Ejecutar validaciones de formato/sintaxis de los archivos modificados y commit atómico de documentación/configuración.

### Task 3: Gate final

- [ ] Ejecutar `npm run ci` desde la raíz; si faltan dependencias, instalar solo el subdirectorio indicado y repetir.
- [ ] Ejecutar `npm run test:smoke` contra un servicio disponible o dejar documentado el bloqueo; usar el modo mock para la cobertura automatizada.
- [ ] Depurar cualquier fallo antes de cerrar.
- [ ] Revisar `git status`, archivos versionados y commits; confirmar criterios de aceptación y dejar el árbol sin artefactos generados.
