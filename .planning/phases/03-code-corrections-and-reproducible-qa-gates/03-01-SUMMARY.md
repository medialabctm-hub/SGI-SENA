# 03-01 — MySQL y Compose reproducibles

## Resultado

PASS para MDL-138/MDL-73 en el alcance del plan. El runner de integración ahora
espera readiness real mediante `mysqladmin ping` dentro del contenedor, con
timeout e intervalo configurables, sin exponer la contraseña en argumentos o
diagnósticos, y elimina el contenedor y el archivo temporal de credenciales en
éxito, timeout y error.

## Cambios

- `backend/scripts/run-mysql-integration.js`
  - Sustituye la espera fija de 45 segundos por polling acotado.
  - Usa `MYSQL_TEST_READY_TIMEOUT_MS` (120000 ms por defecto) y
    `MYSQL_TEST_READY_INTERVAL_MS` (1000 ms por defecto).
  - Usa `docker exec` + `mysqladmin ping`; la contraseña viaja por entorno o
    por un archivo temporal `--env-file`, nunca como valor de argumento.
  - Limpia el contenedor temporal y el archivo de entorno en `finally`.
  - Expone funciones inyectables para pruebas deterministas y no ejecuta el
    runner al importarlo desde Jest.
- `backend/tests/scripts/run-mysql-integration.test.js`
  - Añade cobertura sin Docker real para polling exitoso, timeout, uso seguro
    de `MYSQL_PWD` y cleanup en éxito/timeout/error.
- `docker-compose.yml`
  - Corrige exclusivamente el montaje de inicialización a
    `./BD/SGI_SENA.sql`, el SQL rastreado existente.
  - No añade defaults ni secretos de Brevo.

## Evidencia principal

- PASS: suite focal, 1 suite / 4 tests.
- PASS: integración real con Docker y MySQL 8, 1 suite / 7 tests.
- PASS: `docker compose config` (exit 0) y `git diff --check`.
- PASS: ESLint focal sin errores; permanecen tres warnings de estilo en el
  polling (`no-constant-condition` y `no-await-in-loop`).
- PASS: después de la integración no quedaron contenedores `sgi-mdl71-mysql-*`
  ni directorios temporales `sgi-mdl71-*`.

## Gaps

- FAIL: el lint completo heredado del backend mantiene tres errores fuera del
  alcance de este corte (`backend/tests/scripts/startScript.test.js` líneas 13-14
  y `backend/tests/services/invitationCodeService.test.js` línea 265), además
  de warnings preexistentes.
- BLOCKED/pending: no se ejecutaron Railway, CI remoto, staging ni UAT físico;
  esta fase solo aporta gates locales y la integración MySQL disponible.

El commit atómico de este corte se reporta en la entrega de coordinación con
referencias `MDL-138` y `MDL-73`.
