---
phase: 02-followup-wave
plan: 01
status: passed_with_external_gaps
---

# 02-01 — Verificación

## Comandos ejecutados

### Suites focalizadas

```text
npm test --prefix backend -- --runInBand tests/serverPublicUploads.test.js tests/controllers/privateUploadController.test.js tests/utils/privateUpload.test.js tests/utils/privateUpload.symlink.test.js tests/services/JwtService.test.js tests/validators/authValidator.test.js tests/routes/authRoutes.test.js tests/config/config.test.js
```

**PASS** — 8/8 suites, 98/98 tests, 0 snapshots. Se ejecutó con el runner
backend en modo `--runInBand`; no se ejecutó la suite frontend agrupada ni una
suite completa conocida por colgarse.

### Sintaxis

```text
node --check backend/src/services/JwtService.js
node --check backend/src/config/config.js
node --check backend/src/di/setup.js
node --check backend/src/validators/authValidator.js
node --check backend/src/routes/authRoutes.js
node --check backend/scripts/check-env.js
node --check backend/tests/services/JwtService.test.js
node --check backend/tests/validators/authValidator.test.js
node --check backend/tests/routes/authRoutes.test.js
node --check backend/tests/config/config.test.js
```

**PASS** — todos los archivos finalizaron sin error de sintaxis.

### ESLint focalizado

```text
npm exec eslint src/app.js src/controller/privateUploadController.js src/utils/privateUpload.js src/services/JwtService.js src/di/setup.js src/config/config.js src/validators/authValidator.js src/routes/authRoutes.js scripts/check-env.js tests/setUpEnv.js tests/serverPublicUploads.test.js tests/controllers/privateUploadController.test.js tests/utils/privateUpload.test.js tests/utils/privateUpload.symlink.test.js tests/services/JwtService.test.js tests/validators/authValidator.test.js tests/routes/authRoutes.test.js tests/config/config.test.js
```

**PASS** — 0 errores. El comando informa tres warnings no bloqueantes:
`no-console` en `scripts/check-env.js` y dos `import/order` preexistentes en
`src/di/setup.js` y `src/routes/authRoutes.js`.

### Diff y alcance

```text
git diff --check
git status --short
git log -2 --format="%H%n%s"
```

**PASS** — `git diff --check` no reportó problemas. Los únicos commits de
implementación son los tres hashes declarados en el SUMMARY; no se modificó
`package-lock.json` y no hubo push.

## Evidencia funcional local

- MDL-133: no hay `express.static` para `perfiles` o `ambientes`; las rutas
  delegan en `authenticate`, metadata parametrizada y `requirePermission` para
  ambientes. La ruta de perfil mantiene propietario/`users:view_detail` y
  responde 404 para no enumerar.
- MDL-133: `getSafeUploadFilename`, `lstat`, `realpath` y `stat` acotan el
  archivo al directorio esperado; el response fija `private, no-store`.
- MDL-132: `JwtService` emite y verifica HS256 con expiración, issuer y
  audience; tests negativos rechazan issuer/audience/algoritmo incorrectos y
  tokens vencidos.
- MDL-132: `login-placa` tiene cadena `authLimiter -> validate(loginPlacaSchema)
  -> loginUserWithPlaca`; los límites de body y campos obligatorios tienen
  cobertura.
- MDL-132: la configuración, `check-env`, ejemplos, Compose y runbook ya no
  exigen secreto de cookie adicional; `cookie-parser` permanece deliberadamente
  sin firma y la cookie contiene un JWT firmado.

## Gaps explícitos

No se puede afirmar con esta verificación que MySQL real, Docker, Railway, CI
remoto, navegador, staging, UAT, firewall, instalación o rutas de despliegue
funcionen. La prueba de symlink usa mock porque la creación de symlink real fue
rechazada por permisos del entorno Windows; queda como validación de release.
