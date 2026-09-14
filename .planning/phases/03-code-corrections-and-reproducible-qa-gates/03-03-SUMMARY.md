---
phase: 03-code-corrections-and-reproducible-qa-gates
plan: 03
status: completed
requirements:
  - MDL-126
  - MDL-15
---

# 03-03 — Resumen de ejecución

## Alcance

`POST /autoservicio/iniciar-uso` recibía únicamente `webhookLimiter`
(100/min por IP, sin dimensión de identificador). Se añadieron dos límites
independientes y no enumerables para ese endpoint público, sin tocar el gate
de clase en curso, roster, autorización de negocio, claim transaccional ni
idempotencia del controlador (todo eso vive en
`equiposController.iniciarUsoAutoservicio`, fuera del ownership de este plan).

`POST /uso/registro-externo` (multipart) queda **PARCIAL/BLOCKED**: solo
conserva el límite por IP (`webhookLimiter`), aplicado antes de Multer. No se
añadió límite por identificador porque el body multipart todavía no está
parseado en ese punto de la cadena; y no se inventó API key, firma,
capability, cuota diaria ni identidad de kiosko, tal como exige el plan. Esa
decisión de política queda pendiente y documentada en el propio route file.

## Entrega

### `backend/src/middleware/rateLimiter.js`

- `autoservicioIpLimiter`: 20 peticiones / 15 min, clave
  `autoservicio_ip_<IP>` (más laxo que `invitationIpLimiter` porque un mismo
  ambiente de clase puede compartir salida a Internet).
- `autoservicioIdentifierLimiter`: 5 peticiones / 15 min, clave
  `autoservicio_identifier_<sha256(documento|placa normalizados)>`. El
  identificador se normaliza (trim + mayúsculas implícitas vía hash sobre el
  valor tal cual, igual que `hashIdentifier` ya usado por los limiters de
  invitación) y se hashea con SHA-256 antes de usarse como clave del store en
  memoria, de modo que ni el store ni los logs conservan documento/placa en
  claro.
- Ambos usan el mismo handler 429 estable (`success:false`,
  `retryAfter:15`), sin texto que incluya documento o placa.

### `backend/src/routes/equiposRoutes.js`

- `POST /autoservicio/iniciar-uso`: cadena reemplazada de `webhookLimiter` a
  `autoservicioIpLimiter, autoservicioIdentifierLimiter, validate(...),
  iniciarUsoAutoservicio` — los limiters corren antes del validador Zod y del
  controlador, sin modificar el controlador.
- `POST /uso/registro-externo`: sin cambios de middleware; se agregó un
  comentario que documenta el alcance PARCIAL/BLOCKED (ver arriba) referido a
  este SUMMARY.

### Tests

- `backend/tests/middleware/rateLimiter.test.js` (existente, ampliado):
  - Config de `autoservicioIpLimiter`/`autoservicioIdentifierLimiter`
    (`windowMs`, `max`).
  - Claves independientes por IP vs. por identificador; misma IP produce la
    misma clave de IP con pares documento+placa distintos; identificador
    hasheado (`/^autoservicio_identifier_[0-9a-f]{64}$/`) y sin el
    documento/placa en claro.
  - Normalización: `' 111222333 '/' eq-010 '` y `'111222333'/'EQ-010'`
    producen la misma clave hasheada.
  - `body` ausente o incompleto no rompe el `keyGenerator` (colapsa a un
    identificador `missing` constante).
  - Handler 429 estable, sin `documento`/`placa` en el payload.
  - Contador total de instancias `rateLimit(...)` actualizado de 11 a 13.

- `backend/tests/routes/equiposRoutes.test.js` (nuevo):
  - Montaje: `autoservicioIpLimiter` antes de `autoservicioIdentifierLimiter`
    antes del controlador en `/autoservicio/iniciar-uso` (comparación por
    identidad de referencia contra el router real).
  - Montaje: `/uso/registro-externo` sólo usa `webhookLimiter`, nunca los
    limiters de autoservicio (evidencia del estado BLOCKED/PARCIAL).
  - Comportamiento en vivo (con el router real montado en un `express()` +
    `supertest`, sin mockear nada): 6 peticiones con el mismo par
    documento+placa rotando la IP → las 5 primeras no son bloqueadas por el
    limiter de identificador, la 6ª recibe 429 no enumerable; 21 peticiones
    desde la misma IP con pares documento+placa distintos → las primeras 20
    no son bloqueadas por IP, la 21ª recibe 429. Volúmenes pequeños, no es
    una prueba de denegación de servicio real.

  **Nota de implementación:** en este proyecto, bajo
  `--experimental-vm-modules` (sin transform de Babel), ni `jest.mock()` ni
  `jest.unstable_mockModule()` con rutas relativas interceptan de forma
  fiable un `import()` dinámico real (se comprobó con reproducciones
  aisladas: el módulo mockeado se resuelve pero el import dinámico sigue
  devolviendo el módulo real). Por eso este archivo monta el router real sin
  mocks; como definir rutas no ejecuta handlers, no hay efecto secundario al
  cargar el módulo, y las aserciones sobre peticiones "permitidas" verifican
  únicamente que no sean bloqueadas por el rate limiter (no que devuelvan
  200), ya que en este entorno de test no hay MySQL real disponible.

## Commits

- Commit atómico único con el mensaje
  `fix(MDL-126,MDL-15): add independent rate limits to autoservicio` —
  incluye código, tests y estos documentos de fase (SHA reportado al
  coordinador junto con este resumen).

## Verificación y límites

- PASS: 2 suites focalizadas, 18/18 tests
  (`npm test --prefix backend -- --runInBand
  tests/middleware/rateLimiter.test.js tests/routes/equiposRoutes.test.js`).
- PASS: `node --check` de los 4 archivos tocados.
- PASS: ESLint focalizado — 0 errores; sólo warnings preexistentes
  (`no-underscore-dangle` en el patrón `__options` ya usado por el archivo de
  test original, y `no-await-in-loop` en el mismo patrón que ya usa
  `invitationRateLimiter.integration.test.js`).
- PASS: `git diff --check`.
- BLOCKED/decisión de producto: `POST /uso/registro-externo` no tiene límite
  por identificador ni capability de kiosko; requiere decidir si el body
  multipart se parsea antes del rate limiting (costo de I/O de archivos por
  IP) o si se define una identidad de kiosko explícita, antes de cerrar
  MDL-126/MDL-15 para ese endpoint.
- No se ejecutó MySQL real, Docker, Railway, CI remoto ni navegador. Las
  pruebas en vivo de `/autoservicio/iniciar-uso` toleran que el controlador
  real falle por `ECONNREFUSED` (no hay BD en el entorno de test): sólo
  verifican el comportamiento del rate limiter, no el resultado de negocio.
