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
