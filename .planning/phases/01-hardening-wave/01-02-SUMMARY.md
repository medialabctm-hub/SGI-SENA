---
phase: 01-hardening-wave
plan: 02
subsystem: invitation-codes
tags: [MDL-131, rate-limit, mysql, concurrency, crypto]
key-files:
  - backend/src/middleware/rateLimiter.js
  - backend/src/routes/invitationCodeRoutes.js
  - backend/src/repositories/InvitationCodeRepository.js
  - backend/src/services/invitationCodeService.js
  - backend/tests/middleware/invitationRateLimiter.integration.test.js
  - backend/tests/repositories/InvitationCodeRepository.test.js
metrics:
  files_modified: 11
  focused_test_suites: 10
---

# MDL-131 — Rate limit y consumo atómico de invitaciones

## Resultado

PASS. La validación pública de `/api/invitation-codes/validate` aplica dos
límites independientes: 10 intentos por IP cada 15 minutos y 5 intentos por
identificador de invitación cada 15 minutos. El identificador se normaliza y
se almacena como huella SHA-256; no se registran códigos completos en logs.

PASS. El consumo usado por `authService` ya no hace `incrementUsage` seguido de
un segundo `findByCode`: `InvitationCodeRepository.consumeCode()` abre la
transacción del `BaseRepository`, bloquea la fila con `SELECT ... FOR UPDATE`,
comprueba estado/expiración/cupo y ejecuta un `UPDATE` condicional que aumenta
el contador y marca `Agotado` en la misma operación. El driver real es
`mysql2/promise` sobre MySQL/InnoDB y el pool expuesto por `dbWrapper`, por lo
que la primitiva corresponde a las capacidades configuradas.

PASS. La generación usa `crypto.randomBytes(16)` (128 bits, 32 caracteres hex
mayúsculos) y conserva el contrato de respuesta que devuelve el código al
administrador/flujo existente.

## Evidencia de pruebas

| Estado | Comando | Resultado |
|---|---|---|
| PASS | `pnpm --dir backend test -- --runInBand tests/middleware/invitationRateLimiter.integration.test.js` | 1 suite, 2 tests; IP: intento 11 bloqueado, identificador: intento 6 bloqueado |
| PASS | `pnpm --dir backend test -- --runInBand tests/middleware/rateLimiter.test.js tests/routes/invitationCodeRoutes.test.js tests/services/invitationCodeService.test.js tests/repositories/InvitationCodeRepository.test.js` | suites focalizadas de configuración, ruta, servicio y repositorio en verde |
| PASS | `pnpm --dir backend test -- --runInBand tests/middleware/middleware.test.js tests/routes/moreRoutes.test.js tests/routes/routes.test.js tests/controllers/invitationCodeController.test.js tests/services/authService.test.js` | regresión focalizada de integraciones relacionadas en verde |
| PASS | `pnpm --dir backend exec eslint src/middleware/rateLimiter.js src/repositories/InvitationCodeRepository.js src/routes/invitationCodeRoutes.js src/services/invitationCodeService.js tests/middleware/rateLimiter.test.js tests/middleware/invitationRateLimiter.integration.test.js tests/repositories/InvitationCodeRepository.test.js tests/routes/invitationCodeRoutes.test.js tests/routes/moreRoutes.test.js tests/routes/routes.test.js tests/services/invitationCodeService.test.js` | sin errores ESLint |
| PASS | `git diff --check` | sin errores de whitespace |
| PASS | revisión `git diff`/`rg` | sin trazas de depuración ni códigos completos en los logs nuevos |

La prueba del repositorio simula dos conexiones concurrentes y la serialización
del lock: con `max_usos=1`, exactamente una operación consume y la otra recibe
`exhausted`; el contador final permanece en 1.

## Fallos y gaps documentados

- FAIL inicial de test (corregido, no es un fallo de producto): la primera
  versión de `invitationCodeRoutes.test.js` comparaba con `toBe()` la identidad
  de funciones mockeadas. En este Jest ESM Express recibe una función envuelta
  y la identidad referencial no se conserva; la prueba falló 1/6. Se sustituyó
  por una comprobación estructural de las cuatro capas (dos limitadores,
  validador y controlador); la suite final quedó PASS 6/6.
- WARN de formato preexistente: `prettier --check` advierte en los archivos
  tocados y también en archivos de invitaciones sin modificar. No se ejecutó un
  reformat masivo porque habría introducido cambios ajenos al alcance; ESLint y
  `git diff --check` pasan.
- BLOCKED: ninguno para MDL-131. No se ejecutó una base MySQL/Railway real ni
  UAT de registro contra servicios externos; la evidencia de concurrencia es
  una prueba focalizada con el comportamiento de locking simulado, además de
  la inspección de SQL/driver real.
- Los `package-lock.json` existentes no fueron modificados ni se agregó otro
  lockfile.
- MDL-127 y MDL-134 no fueron tocados.

## Commits

| Commit | Descripción |
|---|---|
| este commit (hash reportado en `worker_done`) | `fix(MDL-131): rate-limit and atomically consume invitation codes` — implementación, pruebas y este SUMMARY en un commit atómico |

## Deviations

Se agregó `backend/src/repositories/InvitationCodeRepository.js` al diff,
aunque el frontmatter del plan solo enumeraba `backend/src/middleware`, rutas,
servicio y pruebas: es la capa necesaria para usar la transacción/`FOR UPDATE`
del driver real sin mover SQL al servicio. No hubo cambios de producto fuera de
la defensa de invitaciones.

## Self-Check

PASSED — el alcance queda limitado a MDL-131, las suites focalizadas pasan, el
diff es revisable, no se agregaron lockfiles y el commit final se reportará al
coordinador junto con su hash.
