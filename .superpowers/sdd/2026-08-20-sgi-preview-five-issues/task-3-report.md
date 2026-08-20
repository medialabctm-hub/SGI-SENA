# MDL-77 — bootstrap y readiness de autoservicio

## Estado y commits

Ronda inicial: `c3f45509070708d0764795ce952f42b3b6647acc`.

Corrección de compatibilidad MySQL 8: `5f5431a5632aed1f461183b1dce516c0c98aca4a`.

## Causa raíz

La ronda inicial construía un `CREATE PROCEDURE` dentro de una variable y lo
enviaba por `PREPARE`. MySQL 8 no admite `CREATE PROCEDURE` entre las sentencias
preparables; el script podía ejecutar el `DROP` de `sp_finalizar_clase` y fallar
después, dejando la rutina ausente.

También readiness solo comprobaba los nombres de índices. Un índice con el
nombre correcto sobre otra columna, con `SEQ_IN_INDEX` distinto de 1, o el índice
de idempotencia no único, era aceptado erróneamente.

## Implementación de la corrección

- `backend/scripts/migrate-autoservicio-cierre-clase.sql` ahora es una única
  definición `CREATE PROCEDURE` sin `DELIMITER`, `PREPARE`, `EXECUTE` ni `DROP`.
- `backend/scripts/migrate-autoservicio-cierre-clase.js` es el runner MySQL 8.
  Primero valida la definición creando y limpiando una rutina temporal. Obtiene
  `SHOW CREATE PROCEDURE` como respaldo, hace `DROP` solo después de esa
  validación y restaura el respaldo si el `CREATE` definitivo falla.
- `backend/scripts/README.md` contiene el contrato y la limitación no atómica.
- `ensureAutoservicioSchema` ya no intenta recrear la rutina desde el usuario de
  aplicación. Readiness valida nullable, columnas, índice/columna/orden y
  unicidad, además del marcador `AUTOSERVICIO_CIERRE_V1`.
- `backend/server.js` usa `buildAutoservicioHealth`; el helper tiene pruebas
  explícitas para 503/not_ready y 200/ok.

## Invocación administrativa

Desde `D:\sgi\SGI-SENA\backend`, con variables `DB_*` o `MYSQL*` que apunten a
un usuario MySQL administrador:

```powershell
node scripts/migrate-autoservicio-cierre-clase.js
```

No ejecutar el archivo `.sql` directamente con el cliente `mysql`; es la
definición que mysql2 envía al servidor como un único `CREATE PROCEDURE`.

## TDD — RED exacto

Comando:

```powershell
npm test -- tests/migrations/autoservicioMigration.test.js --runInBand
```

Resultado: 3 fallos esperados.

1. El archivo contenía `PREPARE`/`EXECUTE`.
2. Readiness resolvía listo con `idx_documento_externo` sobre `id_aprendiz` y el
   índice de idempotencia no único.
3. `backend/server.js` no usaba `buildAutoservicioHealth`.

Después se añadieron pruebas RED del runner y del helper de health antes de
crear ambos módulos; cubren no-op por marcador, restauración tras fallo de
creación, limpieza de la rutina temporal y ambas ramas HTTP.

## GREEN y verificación

```powershell
node --check scripts/migrate-autoservicio-cierre-clase.js
node --check src/utils/autoservicioHealth.js
node --check server.js

npm test -- tests/migrations/autoservicioMigration.test.js tests/scripts/migrateAutoservicioCierreClase.test.js tests/server/autoservicioHealth.test.js tests/controllers/equiposAssignmentAutoservicio.test.js --runInBand
# Exit 0: 4 suites, 22 pruebas

npm test -- --runInBand --forceExit
# Exit 0: 83 suites, 1824 pruebas
```

La suite completa sí terminó con exit code 0. Jest emitió su aviso de
manejadores asíncronos y `--forceExit` fue explícito; no fue una ejecución
interrumpida ni se afirma que esté libre de handles abiertos.

## Criterios cubiertos

- No hay `PREPARE` para `CREATE PROCEDURE`.
- La rutina existente se respalda y se restaura ante el fallo posterior al
  `DROP`; la validación previa falla sin tocar la rutina destino y limpia el
  temporal.
- Readiness exige `id_usuario` nullable; las cuatro columnas; índices con la
  columna y orden correctos; y unicidad de `idempotency_key`.
- Health expone 503/not_ready o 200/ok según readiness y publica el marcador.

## Concerns

- MySQL no proporciona reemplazo atómico de procedimientos. El runner reduce
  el riesgo con validación previa y restauración, pero una caída de conexión o
  del servidor entre `DROP` y `CREATE` requiere restauración administrativa.
- No se ejecutó el runner contra una instancia MySQL 8 no productiva en este
  entorno; las pruebas son deterministas con mysql2 simulado y no se presenta
  una validación textual como ejecución de SQL. Antes de producción, ejecutar
  el comando anterior dos veces en staging con administrador y comprobar el
  marcador mediante `INFORMATION_SCHEMA.ROUTINES`.
- Jest conserva manejadores asíncronos al finalizar la suite completa; el
  resultado de aserciones y exit code provienen de `--forceExit`.

## Fix round 2 — semántica exacta e independencia administrativa

Commit funcional de la ronda: `8ff68de` (`fix: tighten autoservicio migration readiness`).

### Hallazgos corregidos

- El predicado anterior de readiness aceptaba `uq_autoservicio_idempotency_key`
  si `idempotency_key` era solo su primera columna. Ahora cada índice requerido
  debe tener exactamente una fila en `INFORMATION_SCHEMA.STATISTICS`, con
  `SEQ_IN_INDEX = 1`, la columna esperada y `NON_UNIQUE` esperado: 1 para
  `idx_documento_externo`/`documento_externo` e `idx_id_aprendiz`/`id_aprendiz`,
  y 0 para `uq_autoservicio_idempotency_key`/`idempotency_key`.
- El runner importaba `src/config/dbconfig.js`, por lo que su carga podía exigir
  configuración global ajena a la migración. Ahora usa directamente
  `mysql2/promise`; `getMigrationDbConfig` y `createMigrationConnection` solo
  consumen `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` o sus
  equivalentes `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`,
  `MYSQLPORT`. No carga Brevo, JWT, cookies, CORS ni frontend.
- El README conserva la invocación exacta `cd backend` seguido de
  `node scripts/migrate-autoservicio-cierre-clase.js` e incorpora ese contrato
  limitado de variables de entorno.

### TDD — RED exacto de la ronda 2

Primero se añadieron una prueba de índice único compuesto (con
`idempotency_key` en `SEQ_IN_INDEX = 1` y una segunda columna) y una prueba de
creación de conexión con solo `DB_*`, además del recorrido estatal de creación
sin rutina y no-op en la segunda ejecución.

```powershell
cd D:\sgi\SGI-SENA\backend
npm test -- tests/migrations/autoservicioMigration.test.js tests/scripts/migrateAutoservicioCierreClase.test.js --runInBand
```

Resultado RED: exit 1, 2 fallos esperados. La prueba del índice compuesto
recibió `{ ready: true }` y la prueba administrativa falló con
`createMigrationConnection is not a function`. La prueba estatal ya verificaba
el contrato existente: sin rutina, crea y elimina la rutina temporal, crea la
definitiva, y la segunda llamada devuelve no-op.

### GREEN y evidencia de la ronda 2

```powershell
cd D:\sgi\SGI-SENA\backend
node --check scripts/migrate-autoservicio-cierre-clase.js
node --check src/controller/equiposController.js
node --check src/utils/autoservicioHealth.js
node --check server.js

npm test -- tests/migrations/autoservicioMigration.test.js tests/scripts/migrateAutoservicioCierreClase.test.js tests/server/autoservicioHealth.test.js tests/controllers/equiposAssignmentAutoservicio.test.js --runInBand
# Exit 0: 4 suites, 25 pruebas

npm test -- --runInBand --forceExit
# Exit 0: 83 suites, 1827 pruebas
```

Se mantienen las pruebas de rollback y limpieza: fallo en preflight sin tocar
la rutina destino, restauración tras fallo de creación, y `DROP` de la rutina
temporal desde `finally`. El test nuevo de conexión inyecta una fábrica mysql2
simulada y demuestra que no se importa configuración global.

### Concerns vigentes tras la ronda 2

- La sustitución de una rutina MySQL sigue sin ser atómica: una caída del
  proceso o del servidor entre `DROP` y `CREATE` puede requerir restauración
  administrativa desde el respaldo consultado. No se mutó producción.
- La semántica se prueba de forma determinista contra el protocolo mysql2
  simulado; falta ejecutar el comando dos veces contra MySQL 8 de staging.
- La suite completa pasó con código 0, pero Jest mostró el aviso de handles
  abiertos y se ejecutó explícitamente con `--forceExit`; no se interpreta
  como ausencia de handles.
