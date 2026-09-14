# 03-02 — Verificación

## Resultado global: PASS (mocks) / BLOCKED (MySQL/Railway real, fuera de alcance)

## 1. Guard fuera del request path

```text
rg -n "ensureAutoservicioSchema|INFORMATION_SCHEMA|CREATE TABLE|ALTER TABLE" backend/src/controller/equiposController.js backend/tests/controllers
```

PASS. Dentro de `iniciarUsoAutoservicio` (líneas 4424–4657) no hay ninguna
coincidencia: la única línea del handler es la llamada síncrona
`assertAutoservicioReady(getAutoservicioReadiness())`. Todas las coincidencias
restantes en `equiposController.js` pertenecen a: (a) funciones de boot/admin
(`verificarReadinessAutoservicio`, `ensureAutoservicioSchema`,
`ensureAutoservicioSchemaInternal`, líneas 4231–4365) que siguen siendo
invocadas únicamente desde `backend/server.js` (sin cambios); o (b) otras
rutas del controlador fuera del ownership de este plan (`asignarEquipo`,
`actualizarCuentadantePrincipal`, `registrarInicioUso`,
`consultarHistorialUso`, `registrarUsoEquipoExterno`, etc.), no modificadas.
Las coincidencias en `backend/tests/controllers` son mocks/aserciones de los
tests ajustados (ver sección 3) y de otras suites no tocadas
(`aprendicesController.test.js`, `equiposController.test.js`).

## 2. Suites focales

```text
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --forceExit --testTimeout=20000 \
  tests/controllers/equiposAssignmentAutoservicio.test.js \
  tests/controllers/equiposAutoservicioAmbiente.integration.test.js \
  tests/routes/health.test.js
```

PASS — 3 suites, 21/21 tests.

- `equiposAssignmentAutoservicio.test.js` (14 tests, 13.0s): incluye los dos
  casos nuevos de fail-closed sin conexión (estado inicial y post-boot
  fallido) y conserva 404/409/claim/idempotencia/rollback.
- `equiposAutoservicioAmbiente.integration.test.js` (3 tests): camino "listo"
  primado explícitamente vía `ensureAutoservicioSchema` en `beforeAll`;
  incluye aserción de que el 201 no toca metadatos/DDL.
- `tests/routes/health.test.js` (4 tests, 47.0s — el tiempo alto es por
  reintentos reales de conexión de la app exportada contra una base de datos
  no disponible en este entorno, comportamiento preexistente no modificado
  por este plan): confirma que `/health` sigue siendo la fuente de readiness
  y que la app real conserva el gate.

Nota operativa: la primera ejecución de esta suite (vía `npm test`, sin
`--forceExit`) quedó colgada tras completar los tests porque `app.js` deja
handles abiertos (intento de conexión MySQL/scheduler) — comportamiento
preexistente de `tests/routes/health.test.js`, no introducido por este plan.
Se interrumpió esa ejecución y se repitió con
`node ... jest.js --forceExit --testTimeout=20000` invocado directamente
(evitando el wrapper `npm test`), lo que permitió observar el resultado
completo: los 21 tests pasan; solo se forzó la salida del proceso jest al
terminar, no se acotó ningún test individual.

## 3. Cobertura de fail-closed y camino listo (detalle)

- **Sin conexión, estado inicial**: `iniciarUsoAutoservicio` sin que el boot
  haya corrido `ensureAutoservicioSchema` responde `503` con
  `userMessage` que menciona `migrate-autoservicio-cierre-clase.js`, y no
  llama a `mockGetConnection` ni a `mockExecute` (0 llamadas).
- **Sin conexión, boot fallido**: se invoca `ensureAutoservicioSchema`
  explícitamente contra un schema sin el marcador `AUTOSERVICIO_CIERRE_V2`
  (rechaza con `503`, como simulación de `server.js` logueando el error sin
  detener el arranque); acto seguido, `iniciarUsoAutoservicio` sigue
  fallando cerrado sin abrir conexión ni volver a consultar
  `INFORMATION_SCHEMA` — la migración fallida no se reintenta en la petición
  pública.
- **Camino listo**: tras un `ensureAutoservicioSchema` explícito exitoso
  (simulando el boot real), `iniciarUsoAutoservicio` abre conexión, respeta
  claim/idempotencia/rollback y los 404/409 existentes, y ninguna llamada
  del request (ni por `defaultDb` ni por la conexión de transacción) coincide
  con `INFORMATION_SCHEMA|CREATE TABLE|ALTER TABLE`.
- **Migración explícita conservada**: `ensureAutoservicioSchema` sigue
  probado de forma directa (no vía el request path) para el caso exitoso
  (columnas/índices/rutina ya migrados) y el caso de rechazo por rutina sin
  marcador.

## 4. git diff --check

```text
git diff --check
```

PASS. Sin salida (sin conflictos de espacio en blanco).

## 5. Límites conocidos (MySQL/Railway)

BLOCKED / fuera de alcance de este plan:

- No se ejecutó la suite contra un MySQL 8 real ni contra Railway; toda la
  cobertura de este plan usa mocks de `mysql2`. La verificación de
  `ensureAutoservicioSchema` bajo concurrencia real (múltiples procesos de
  boot compitiendo por el `ALTER TABLE`) se reporta en el plan 03-01
  (`npm run test:mysql --prefix backend`), no en este.
- Este plan no valida qué ocurre si el boot de `server.js` nunca corre (por
  ejemplo, un proceso worker que importe el controlador sin pasar por
  `server.js`): en ese caso el guard queda permanentemente en `503` hasta que
  algo invoque `ensureAutoservicioSchema`. Es el comportamiento buscado
  (fail-closed), pero su operación en Railway con múltiples réplicas no se
  verificó aquí.

## Archivos verificados

- `backend/src/controller/equiposController.js`
- `backend/tests/controllers/equiposAssignmentAutoservicio.test.js`
- `backend/tests/controllers/equiposAutoservicioAmbiente.integration.test.js`
