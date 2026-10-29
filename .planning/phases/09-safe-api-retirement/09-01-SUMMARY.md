---
phase: 09-safe-api-retirement
plan: 01
issue: MDL-241
status: audit_local_complete_partial_implementation
date: 2026-09-29
base: 1e0800ebfaa6a42e6130aaf0ed247c98c1e0b70c
---

# MDL-241 — Evidencia de auditoría

## Entrega local

Branch codex/mdl-241-api-audit desde FETCH_HEAD Encuentro, limpio al inicio. Código funcional y tests existentes intactos. Documentos: docs/audits/MDL-241-API-AUDIT.md, MDL-241-API-MATRIX.md y este PLAN/SUMMARY; STATE/ROADMAP se actualizan sin cerrar hito.

125 rutas activas/11 routers: 31 conservar, 17 conservar de apoyo, 70 adaptar, 7 deprecar condicionado. Retirar ahora: 0. Los siete candidatos son POST login-placa, POST equipos/asignar, PUT/DELETE equipos/asignaciones/:id, POST equipos/uso/inicio-fin y GET reportes/pdf. No eliminar tablas Responsables_Equipo/Elementos.id_cuentadante. La última revisión principal reclasificó GET cuentadante-principal a Adaptar por su resultado global DISTINCT/LIMIT 1, no titularidad del importador.

Hallazgos: 7 Important, 2 Minor. No se afirma hallazgo Critical validado en remoto ni auditoría exhaustiva de seguridad de toda aplicación. Riesgos defaults condicionados a permisos efectivos BD. Conflicto manual/scheduler y nueva autorización aula/horario por resolver.

## Ejecución de pruebas

Todas desde backend del worktree, Node bundled `C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`, Jest instalado en checkout (npm existente; sin instalación).

Prefijo de comando: `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --silent --runTestsByPath` (tandas 2/3 agregan `--verbose=false`).

### Tanda 1: 13 suites, 661 aserciones PASS; runner NO terminó limpio

Paths relativos a backend:

```
tests/controllers/equiposController.test.js
tests/controllers/equiposAssignmentAutoservicio.test.js
tests/controllers/novedadesController.test.js
tests/controllers/mantenimientoController.test.js
tests/controllers/reportesController.test.js
tests/controllers/importController.test.js
tests/controllers/clasesController.test.js
tests/controllers/horariosController.test.js
tests/services/equipoService.test.js
tests/repositories/EquipoRepository.test.js
tests/validators/equiposValidator.test.js
tests/routes/importRoutes.test.js
tests/routes/reportesRoutes.policy.test.js
```

Jest: `Test Suites: 13 passed, 13 total`, `Tests: 661 passed, 661 total`, tiempo 39.77s. Advertencia de recursos asincrónicos abiertos; se detuvo el proceso tras resultado (salida 1). No se empleó forceExit para presentar éxito limpio. Posible contribuyente: intervalo importController.js:88, sin atribución definitiva por detectOpenHandles.

### Tanda 2: 8 suites, 170 aserciones PASS, salida 0

```
tests/controllers/authController.test.js
tests/services/authService.test.js
tests/middleware/authorization.test.js
tests/middleware/equipmentEvidenceScope.test.js
tests/utils/verificacionInventarioScope.test.js
tests/utils/prestamosInformeQuery.test.js
tests/controllers/prestamosInformeController.test.js
tests/utils/equipoVerification.test.js
```

Tiempo Jest 2.243s. No prueba de esquema/roles efectivos Railway.

### Tanda 3: 4 suites, 69 aserciones PASS, salida 0

```
tests/services/schedulerService.test.js
tests/migrations/autoservicioMigration.test.js
tests/scripts/migrateAutoservicioCierreClase.test.js
tests/repositories/UserRepository.test.js
```

Tiempo Jest 8.148s. Validan mocks/estructura/migración; NO procedimiento MySQL real en esta ejecución.

Total: 25 suites / 900 aserciones PASS; una tanda con runner detenido, dos con exit 0. PASS del contrato heredado no prueba conformidad de la nueva política. No tests nuevos ni fixes.

Comprobación adicional pura con `node --input-type=module` importando hasPermission/PERMISSIONS (sin BD): default Cuentadante UPDATE/DELETE/CREATE = true; Instructor UPDATE/DELETE/CREATE = false, NOVEDADES.CREATE = true, MANTENIMIENTO.UPDATE = false; Aprendiz CREATE_OWN = true pero NOVEDADES.CREATE = false. Confirma discrepancias de guardas/UI, no permisos efectivos del despliegue. No se suma como suite/aserción Jest.

## Revisión independiente

Dos subagentes GPT6-Luna/high de solo lectura entregaron consumidores y dependencias históricas. Principal contrastó evidencias en rutas/controllers y rechazó interpretar ausencia de permiso en router como bypass si handler comprueba autorizador. El tercer revisor independiente confirmó los hallazgos A1–A7 y la matriz de 125 declaraciones; pidió precisar el alcance de `GET /equipos/cuentadante-principal` (A5), incorporado al informe. No revisó runtime autenticado ni MySQL real.

## Continuación de implementación — primera tajada

En el mismo worktree se inició la adaptación A5 sin retirar contratos: Cuentadante no puede señalar un `id_cuentadante` ajeno al importar, cada job en memoria conserva el ID del creador y el status responde 404 a otro usuario, y GET/PUT `cuentadante-principal` requieren rol Administrador. La ruta general PUT/DELETE de equipos, los duplicados y la separación del permiso de importación continúan pendientes; no se atribuye a esta tajada el cierre de A1/A5.

Se observaron fallar primero las pruebas negativas de destino, status y GET/PUT administrativos, luego pasar con el cambio. Regresión focal: 3 suites/74 tests PASS. Backend integral: 130 suites/2326 tests PASS, 2 suites/10 tests skipped, salida 0 con `--forceExit`; ese flag no prueba cierre limpio del runner. Primera corrida en sandbox: cuatro tests de imágenes fallaron con EPERM al escribir un PNG temporal; suite focal de imágenes 4/4 y corrida integral pasaron al autorizar solo esa escritura de prueba. Revisor independiente: ningún Critical/Important contra el contrato de la tajada; Minor: falta prueba HTTP autenticada de importación propia/status, aunque controladores y rutas tienen cobertura separada. Lint focal de rutas/tests: 0 errores, 2 advertencias heredadas; lint con importController: 2 errores `import/first` ya presentes en HEAD (imports en líneas 58/62), 51 advertencias. Sin MySQL real ni despliegue.

## Gates pendientes

SQL real/índices/FK/procedimientos, roles efectivos de entorno, clientes externos/telemetría, clases manuales, aprobación/traslado, nuevas pruebas negativas, CI, Railway y UAT. Préstamo abierto: producto decidió conservarlo hasta devolución y bloquear nuevos usos; implementación y pruebas pendientes. Build no ejecutado (cambio backend/documental); lint y sus límites se consignan arriba. No afirmar despliegue o ship formal. MDL-241 sigue In Progress por alcance de implementación pendiente.
