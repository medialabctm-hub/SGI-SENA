# MDL-77 — bootstrap y readiness de autoservicio

## Estado

Implementado. Commit: `PENDIENTE_DE_AMEND`.

## Causa raíz

El script `backend/scripts/migrate-autoservicio-cierre-clase.sql` declaraba ser idempotente, pero hacía `DROP PROCEDURE IF EXISTS sp_finalizar_clase` y `CREATE PROCEDURE` en cada ejecución. Esto recreaba la rutina incluso cuando ya tenía `AUTOSERVICIO_CIERRE_V1` y explica las ejecuciones manuales repetidas: el backend no puede sustituir de forma fiable una rutina creada por un definer administrador (`root`/`SYSTEM_USER`), mientras que el script manual sí necesita esas credenciales.

Además, `ensureAutoservicioSchema` marcaba el schema listo tras añadir columnas e índices, antes de confirmar que `sp_finalizar_clase` tuviera el marcador. Por ello podía aceptarse un préstamo de autoservicio con el cierre automático incompleto. El healthcheck del proceso de producción también informaba OK sin publicar ese estado.

## Cambios

- `backend/scripts/migrate-autoservicio-cierre-clase.sql`: usa un procedimiento migrador temporal que consulta `INFORMATION_SCHEMA.ROUTINES`; solo hace `DROP`/`CREATE` dinámico si el marcador no existe. La segunda ejecución no cambia `sp_finalizar_clase`. El marcador queda documentado y observable mediante `ROUTINE_COMMENT`.
- `backend/src/controller/equiposController.js`: valida `id_usuario` nullable, las cuatro columnas de autoservicio, los tres índices y `AUTOSERVICIO_CIERRE_V1`; expone un estado de readiness y falla con instrucciones accionables si falta algún requisito.
- `backend/server.js`: `/health` devuelve 503 y `status: not_ready` hasta que autoservicio esté validado; una vez listo devuelve 200 y el marcador/estado observable.
- `backend/tests/migrations/autoservicioMigration.test.js`: pruebas deterministas para bootstrap limpio, repetición sin DROP incondicional, versión observable y esquema parcial.
- `backend/tests/controllers/equiposAssignmentAutoservicio.test.js`: ajusta el fixture ya existente al contrato completo de schema listo.

## TDD — RED exacto

Comando:

```powershell
cd D:\sgi\SGI-SENA\backend
npm test -- tests/migrations/autoservicioMigration.test.js --runInBand
```

Resultado RED: 3 fallos esperados.

1. No aparecía `INFORMATION_SCHEMA.ROUTINES` en el script para el bootstrap limpio.
2. Existía `DROP PROCEDURE IF EXISTS sp_finalizar_clase//` incondicional para la segunda ejecución.
3. `ensureAutoservicioSchema` resolvía `undefined` ante un `ROUTINE_COMMENT` sin `AUTOSERVICIO_CIERRE_V1`, en vez de rechazar readiness.

## GREEN y verificación

Comandos y resultados:

```powershell
npm test -- tests/migrations/autoservicioMigration.test.js tests/controllers/equiposAssignmentAutoservicio.test.js --runInBand
# PASS: 2 suites, 15 pruebas

node --check src/controller/equiposController.js
node --check server.js
# PASS

# Validación estructural SQL (4 checks): delimitadores, guard de versión, DDL dinámico y limpieza del migrador
# PASS: SQL estructural OK (MySQL client no disponible localmente)

npm test -- --runInBand
# PASS de aserciones: 81 suites, 1817 pruebas
```

`git diff --check` no informó errores de espacios. El lint focal sigue fallando por errores preexistentes en `server.js` y `equiposController.js`, y por la configuración actual de ESLint que no reconoce los globales de Jest; no se modificó esa configuración ajena a MDL-77.

## Criterios cubiertos

- Ejecución limpia y repetida del script cubierta estructuralmente con guard de versión.
- No hay recreación destructiva de `sp_finalizar_clase` cuando ya existe el marcador.
- Readiness comprueba columnas, índices y procedimiento antes de marcar listo.
- Esquema parcial devuelve error explícito con la ruta del script y el requisito faltante.
- La versión `AUTOSERVICIO_CIERRE_V1` se observa en tests, readiness y comentarios del script.

## Concerns

- No hay cliente/instancia MySQL 8 local, por lo que no se ejecutó el SQL dinámico contra una base no productiva. Se hizo validación estructural y se documenta el límite en el propio script. Antes de desplegar, ejecutar el script una vez en MySQL 8 de staging con un administrador y volver a ejecutarlo para comprobar el no-op.
- La suite completa termina sus aserciones en verde, pero Jest avisa de manejadores asíncronos abiertos y no sale por sí solo; se interrumpió después del resumen. Es deuda de la suite, no un fallo de aserciones de MDL-77.
