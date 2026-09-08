---
phase: 01-hardening-wave
plan: 03
subsystem: deployment/database
tags: [MDL-134, Railway, nginx, MySQL, idempotencia]

requires:
  - phase: 01-hardening-wave
    provides: plan de hardening de arranque y cierre de clase
provides:
  - contrato separado PORT/NGINX_PORT/BACKEND_PORT para el contenedor Railway
  - rutina V2 de finalización transaccional e idempotente
  - evidencia focalizada y runbook de despliegue reproducible
affects: [Railway, start.sh, sp_finalizar_clase, healthcheck]

actuals:
  tokens: 3500
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns: [variables públicas e internas separadas, bloqueo FOR UPDATE, no-op de reintento]

key-files:
  created:
    - backend/tests/scripts/startScript.test.js
    - .planning/phases/01-hardening-wave/01-03-SUMMARY.md
  modified:
    - start.sh
    - Documentation/DEPLOY_RAILWAY.md
    - backend/src/config/config.js
    - backend/scripts/migrate-autoservicio-cierre-clase.sql
    - backend/tests/integration/equipmentClaim.mysql.test.js
    - BD/SGI_SENA.sql

key-decisions:
  - Se preserva PORT sin exportarlo ni reasignarlo; NGINX_PORT hereda PORT y BACKEND_PORT queda en 3000 por defecto.
  - Se sube el marcador de la rutina de V1 a V2 para que una BD con la rutina anterior no pase readiness sin la guarda de idempotencia.
  - Se conserva el bloque existente de BD/SGI_SENA.sql y solo se modifica el procedimiento sp_finalizar_clase; no se hizo una conversión de line endings del archivo completo.
  - La idempotencia se implementa en la rutina, que es la frontera transaccional usada por finalizarClase: FOR UPDATE serializa cierres concurrentes y un estado Finalizada no vuelve a escribir fecha ni estados.

patterns-established:
  - PORT es el puerto público de Railway; NGINX_PORT y BACKEND_PORT son variables explícitas del proceso interno.
  - La rutina de cierre debe actualizar clase, ambiente, responsabilidades e historial en una sola transacción con rollback ante SQLEXCEPTION.

requirements-completed: [MDL-134]

coverage:
  - id: D1
    description: start.sh conserva PORT y separa NGINX_PORT/BACKEND_PORT con defaults, validación y reescritura determinista de nginx.
    requirement: MDL-134
    verification:
      - kind: unit
        ref: backend/tests/scripts/startScript.test.js
        status: pass
      - kind: other
        ref: Git Bash -n start.sh
        status: pass
      - kind: other
        ref: fixture temporal con los dos comandos sed ejecutados dos veces
        status: pass
    human_judgment: false
  - id: D2
    description: backend/server.js recibe BACKEND_PORT desde config.server.PORT aun cuando PORT conserva el valor público.
    requirement: MDL-134
    verification:
      - kind: unit
        ref: backend/tests/config/config.test.js
        status: pass
      - kind: other
        ref: node --input-type=module -e con PORT=8080 y BACKEND_PORT=4321 ficticios
        status: pass
    human_judgment: false
  - id: D3
    description: sp_finalizar_clase V2 bloquea la clase, mantiene rollback y deja un reintento Finalizada como no-op.
    requirement: MDL-134
    verification:
      - kind: unit
        ref: backend/tests/migrations/autoservicioMigration.test.js#serializa el cierre y hace no-op un reintento
        status: pass
      - kind: integration
        ref: backend/tests/integration/equipmentClaim.mysql.test.js#conserva la fecha del primer cierre en un reintento posterior
        status: unknown
    human_judgment: true
    rationale: El test MySQL real no pudo ejecutarse: Docker no tiene daemon, mysql no está instalado y 127.0.0.1:3306 no es accesible.
  - id: D4
    description: DEPLOY_RAILWAY documenta defaults, ownership de puertos, healthcheck y la brecha de verificación sin Docker/Railway.
    requirement: MDL-134
    verification:
      - kind: other
        ref: git diff --check
        status: pass
    human_judgment: true
    rationale: No se hizo despliegue Railway ni UAT de red por alcance explícito; debe verificarse en infraestructura.

duration: 50min
completed: 2026-09-07
status: complete
---

# Phase 01 Plan 03: hardening de Railway y finalización

Se implementó MDL-134 con un contrato de puertos reproducible y una rutina de
cierre V2 que conserva la fecha del primer cierre y evita escrituras repetidas.

## Performance

- Duration: aproximadamente 50 min.
- Tasks: 3/3.
- Commits: 1 commit atómico de MDL-134; el hash se reporta al coordinador al cerrar.
- No se ejecutaron instalaciones adicionales ni se modificaron package-lock.json.

## Accomplishments

- start.sh usa NGINX_PORT con fallback a PORT, BACKEND_PORT con fallback 3000,
  valida puertos distintos y exporta solo las variables internas; PORT queda
  intacto para Railway y su healthcheck público.
- config.server.PORT y backend/server.js usan BACKEND_PORT antes que PORT; el
  fixture de Git Bash confirmó que ambas sustituciones sed convergen después de
  una segunda ejecución.
- sp_finalizar_clase V2 agrega FOR UPDATE, transacción con handler de rollback y
  rama no-op para Finalizada; se sincronizó el SQL de migración con el esquema
  fuente y se añadió un retry que comprueba que fecha_fin_real no cambia.
- DEPLOY_RAILWAY.md documenta defaults, healthcheck interno/externo, no
  despliegue real y la brecha de infraestructura cuando Docker/Railway no está
  disponible.

## Evidence and focused verification

- PASS: npm test --prefix backend -- --runInBand tests/scripts/startScript.test.js tests/config/config.test.js — 2 suites, 18 tests.
- PASS: npm test --prefix backend -- --runInBand tests/migrations/autoservicioMigration.test.js tests/scripts/migrateAutoservicioCierreClase.test.js — 2 suites, 14 tests.
- PASS: npm test --prefix backend -- --runInBand tests/controllers/clasesController.test.js — 1 suite, 57 tests.
- PASS: batería focalizada previa — 9 suites, 110 tests; Jest informó los resultados PASS pero dejó handles abiertos y fue interrumpido después de recoger la salida. Las suites críticas se repitieron de forma aislada y terminaron con exit code 0.
- PASS: fixture temporal ejecutando los comandos sed extraídos de start.sh dos veces — resultado convergente listen=9090 y api_backend=3200.
- PASS: import directo de config con valores ficticios — config.server.PORT leyó BACKEND_PORT=4321 mientras PORT=8080.
- PASS: Git Bash -n start.sh.
- PASS: git diff --check.
- PASS: test integration/equipmentClaim.mysql.test.js sin RUN_MYSQL_INTEGRATION — 1 suite y 7 tests skip por opt-in.
- BLOCKED: la ejecución MySQL real de concurrencia/reintento queda pendiente porque docker info no encuentra el pipe dockerDesktopLinuxEngine, mysql no está instalado y localhost:3306 devuelve false.
- BLOCKED: shellcheck no está instalado; la sintaxis fue validada con Git Bash.
- No se ejecutó despliegue real, Docker build, Railway UAT ni smoke de red.

## Scope and diff hygiene

- El diff queda limitado a start.sh, Documentation/DEPLOY_RAILWAY.md,
  backend/src, backend/scripts, backend/tests, BD/SGI_SENA.sql únicamente en
  el bloque sp_finalizar_clase, y este SUMMARY.
- git diff --numstat y git diff --ignore-space-at-eol mostraron cambios
  localizados; no hubo conversión completa de BD/SGI_SENA.sql.
- No hay archivos package-lock.json nuevos/modificados ni cambios de MDL-127 o
  MDL-131.

## Decisions Made

- El marcador V2 es necesario para no declarar lista una rutina V1 que carece
  de bloqueo y no-op; el runner y los gates de readiness exigen V2.
- El endpoint mantiene su validación de autorización/estado; la atomicidad e
  idempotencia de escrituras permanecen en el CALL a la rutina, única frontera
  de persistencia de finalizarClase.

## Deviations from Plan

Se actualizó BD/SGI_SENA.sql solo en la definición fuente de sp_finalizar_clase,
porque dejar V1 allí reintroduciría la regresión al importar un esquema limpio.
También se actualizó el marcador en los fixtures/gates existentes para que el
readiness pruebe la versión que realmente se despliega. No hubo otras
desviaciones ni scope creep.

## Issues Encountered

- La batería combinada dejó handles asíncronos abiertos por tests de app/health;
  se recogieron 110 resultados PASS y se repitieron las suites MDL-134 aisladas,
  todas con salida exitosa.
- La verificación de integración real requiere MySQL 8 accesible y queda
  pendiente para el coordinador o CI con infraestructura.

## Next Phase Readiness

Código, documentación y pruebas focalizadas están listos para revisión e
integración. Antes de declarar cobertura runtime completa, ejecutar el test
MySQL opt-in con RUN_MYSQL_INTEGRATION=1 contra un fixture desechable y validar
healthcheck/proxy en un contenedor o servicio Railway de prueba, sin reutilizar
credenciales ni hacer despliegue desde este worker.

---
Phase: 01-hardening-wave
Completed: 2026-09-07
