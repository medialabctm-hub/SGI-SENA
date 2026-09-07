---
phase: 01-hardening-wave
status: complete
verified: 2026-09-07
requirements: [MDL-127, MDL-131, MDL-134]
---

# Phase 1 Verification

## Verdict

PASS para el alcance local de la fase. Los tres commits atómicos se integraron
en el worktree coordinador y la PR #29 permanece abierta para revisión humana.
Las garantías que dependen de MySQL real, Docker, Railway o UAT de navegador
quedan separadas como gaps y no se presentan como verificadas.

## Must-haves

| Requirement | Evidence | Result |
|---|---|---|
| MDL-127 | Cookie `sgi_session` httpOnly; frontend con `credentials: include`; escaneo sin lecturas/escrituras funcionales de JWT; 5 archivos focalizados, 17/17 tests; build Vite | PASS |
| MDL-131 | Rate limit por IP/identificador; consumo con `SELECT ... FOR UPDATE` y update condicional; 10 suites, 170/170 tests | PASS |
| MDL-134 | `PORT` preservado; `NGINX_PORT`/`BACKEND_PORT` explícitos; rutina V2 con rollback, lock y no-op; shell/config y 14 tests focalizados | PASS |

## Commands and results

- `git diff --check`: PASS en la integración.
- Frontend: `ProtectedRoute.test.jsx` 5/5, `Header.test.jsx` 3/3,
  `Login.test.jsx` 3/3, `config/api.test.js` 3/3 y
  `useLocalStorage.test.js` 3/3.
- Frontend: `pnpm --dir frontend build`: PASS, 423 módulos transformados.
- Backend auth/cookies: 5 suites, 69/69 tests PASS.
- Backend invitation/Railway: 10 suites, 170/170 tests PASS.
- `git diff --check` y revisión de nombres: no hay lockfiles nuevos ni cambios
  ajenos al alcance de la wave.

## Corrections during verification

- `ProtectedRoute` ahora distingue un 401 inicial sin perfil local de una sesión
  previamente establecida que expiró.
- `Login.test.jsx` monta explícitamente el componente antes de interactuar con
  el formulario.

## Human-needed gaps

- La suite frontend completa quedó pendiente: la batería agrupada se encoló y se
  interrumpió tras superar el umbral; los cinco archivos focalizados sí pasan.
- La validación ESLint completa fue reportada PASS por el worker; el intento del
  coordinador con la instalación pnpm aislada no pudo resolver `globals`, que la
  configuración importa como dependencia transitiva no enlazada.
- No se ejecutó el caso MySQL real de concurrencia/idempotencia: Docker daemon,
  cliente mysql y puerto 3306 no estaban disponibles.
- No se ejecutaron Docker build, despliegue Railway, shellcheck ni UAT de red o
  navegador.

## Integrated commits

- `35a55bc` — MDL-131 rate limit y consumo atómico.
- `a85232b` — MDL-134 contrato de Railway e idempotencia de cierre.
- `bf43f42` — MDL-127 cookies httpOnly y migración frontend/backend.
- `b893066` — correcciones detectadas por la verificación coordinada.
