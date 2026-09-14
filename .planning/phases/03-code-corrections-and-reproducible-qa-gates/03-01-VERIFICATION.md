# 03-01 — Verification

## Matriz de gates

| Gate | Estado | Comando / evidencia |
|---|---|---|
| Pruebas deterministas del runner | PASS | `npm test --prefix backend -- --runInBand tests/scripts/run-mysql-integration.test.js` — 1 suite, 4/4 tests |
| Polling y timeout | PASS | La suite cubre readiness tras reintentos y timeout determinista de 25 ms |
| Contraseña fuera de argumentos/logs | PASS | La suite verifica que `mysqladmin` no recibe la contraseña en args; Docker usa ruta de `--env-file` y `MYSQL_ROOT_PASSWORD` solo dentro del contenedor |
| Cleanup local | PASS | La suite cubre éxito, timeout y error de Jest; la ejecución real dejó cero contenedores/directorios temporales |
| Integración MySQL real | PASS | `npm run test:mysql --prefix backend` — Docker Desktop disponible, MySQL 8.0.46, 1 suite, 7/7 tests |
| Compose | PASS | `docker compose config` — exit 0; el volumen resuelve a `BD/SGI_SENA.sql` |
| Formato del diff | PASS | `git diff --check` — exit 0 |
| ESLint focal | PASS | `npm exec -- eslint scripts/run-mysql-integration.js tests/scripts/run-mysql-integration.test.js` — exit 0, 3 warnings no bloqueantes |
| ESLint backend completo | FAIL | `npm run lint --prefix backend` — 3 errores heredados fuera de este corte; no se modificaron esos archivos |
| Railway / staging / UAT físico | BLOCKED | No son gates locales disponibles en este worktree y no se ejecutaron |

## Comandos ejecutados

```text
npm test --prefix backend -- --runInBand tests/scripts/run-mysql-integration.test.js
npm run test:mysql --prefix backend
npm exec -- eslint scripts/run-mysql-integration.js tests/scripts/run-mysql-integration.test.js
docker info
docker compose config
git diff --check
npm run lint --prefix backend
```

## Notas y límites

- `docker compose config` emite warnings existentes por variables externas no
  definidas (`EMAIL_*`, `BREVO_*`) y por el atributo `version` obsoleto; no se
  añadieron secretos ni defaults de Brevo.
- La integración real valida Docker/MySQL local y el SQL rastreado, pero no
  sustituye despliegue Railway, CI remoto, staging ni UAT.
- No se agregaron ni modificaron `package-lock.json`.
