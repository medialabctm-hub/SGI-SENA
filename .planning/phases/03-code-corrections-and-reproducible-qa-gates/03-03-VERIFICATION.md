---
phase: 03-code-corrections-and-reproducible-qa-gates
plan: 03
status: passed_with_external_gaps
---

# 03-03 — Verificación

## Comandos ejecutados

### Suites focalizadas

```text
npm test --prefix backend -- --runInBand tests/middleware/rateLimiter.test.js tests/routes/equiposRoutes.test.js
```

**PASS** — 2/2 suites, 18/18 tests, 0 snapshots. Se ejecutó con
`node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
--forceExit` (el `--forceExit` cierra el intento de conexión a MySQL que el
controlador real deja abierto tras el `ECONNREFUSED` esperado; el propio
suite terminó en ~5 s antes de forzar la salida).

### Sintaxis

```text
node --check backend/src/middleware/rateLimiter.js
node --check backend/src/routes/equiposRoutes.js
node --check backend/tests/middleware/rateLimiter.test.js
node --check backend/tests/routes/equiposRoutes.test.js
```

**PASS** — los 4 archivos finalizaron sin error de sintaxis.

### ESLint focalizado

```text
npx eslint src/middleware/rateLimiter.js src/routes/equiposRoutes.js tests/middleware/rateLimiter.test.js tests/routes/equiposRoutes.test.js
```

**PASS** — 0 errores, 52 warnings. Todos preexistentes en el patrón del
archivo original (`no-underscore-dangle` sobre `__options`, ya presente
antes de este plan) o en un patrón ya aceptado en el repo
(`no-await-in-loop`, igual que `tests/middleware/invitationRateLimiter.integration.test.js`).

### Diff y alcance

```text
git diff --check
git status --short
```

**PASS** — `git diff --check` no reportó problemas. Archivos modificados:
`backend/src/middleware/rateLimiter.js`, `backend/src/routes/equiposRoutes.js`,
`backend/tests/middleware/rateLimiter.test.js`; archivo nuevo:
`backend/tests/routes/equiposRoutes.test.js`. No se tocó `package-lock.json`
ni ningún archivo fuera del ownership del plan 03-03. No hubo push.

## Evidencia funcional local

- `autoservicioIpLimiter` (20/15min) y `autoservicioIdentifierLimiter`
  (5/15min) están montados en ese orden, antes de `validate(...)` y del
  controlador, en `POST /autoservicio/iniciar-uso` (verificado por identidad
  de referencia sobre el `router.stack` real, sin mocks).
- El identificador de autoservicio es `sha256(documento|placa)`; nunca
  aparece documento/placa en claro en la clave ni en el payload 429.
- Petición real vía `supertest` contra el router montado: 6 intentos con el
  mismo documento+placa rotando IP → bloqueo en el 6º (limiter de
  identificador); 21 intentos con documento+placa distintos desde la misma
  IP → bloqueo en el 21º (limiter de IP). Ambos casos devuelven 429 estable
  con `retryAfter:15` y sin datos sensibles en el cuerpo.
- `POST /uso/registro-externo` sigue usando únicamente `webhookLimiter` (sin
  limiter de autoservicio): confirma el estado PARCIAL/BLOCKED documentado en
  el route file y en el SUMMARY — no se inventó identidad de kiosko, API key,
  firma, capability ni cuota diaria para ese endpoint.
- El gate de clase en curso / roster, la autorización de negocio, el claim
  transaccional y la idempotencia siguen en
  `equiposController.iniciarUsoAutoservicio`, sin cambios (fuera del
  ownership de este plan; no se tocó ese archivo).

## Nota técnica sobre el harness de test

Se comprobó mediante reproducciones aisladas que, en este proyecto, bajo
`node --experimental-vm-modules` (Jest con `transform: {}`), ni
`jest.mock('<ruta relativa>', factory, { virtual: true })` ni
`jest.unstable_mockModule('<ruta relativa>', factory, { virtual: true })`
interceptan de forma fiable un `import()` dinámico posterior del mismo
módulo: el import dinámico sigue devolviendo el módulo real (se confirmó con
`jest.isMockFunction(...)` devolviendo `false` en varios módulos:
`authMiddleware.js`, `equiposController.js`,
`autorizacionMovimientoController.js`, `equiposValidator.js`). Esto es una
limitación preexistente del harness, no introducida por este plan; los tests
`equiposRoutes.test.js` de este plan se diseñaron para no depender de esa
interceptación (montan el router real y verifican sólo lo que el rate
limiter controla).

## Gaps explícitos

No se puede afirmar con esta verificación que MySQL real, Docker, Railway, CI
remoto o navegador funcionen con este cambio. La política de
`registro-externo` (API key/firma/capability/cuota diaria/identidad de
kiosko) queda pendiente de decisión de producto antes de poder cerrarse.
