# 03-05 — Verificación (MDL-13: alcance en GET /:codigo/uso/historial)

## Resultado global: PASS

## Archivos en el ownership de esta Dispatch

- `backend/src/controller/equiposController.js` — MODIFICADO
- `backend/tests/controllers/equiposController.test.js` — MODIFICADO

`git status --porcelain` confirma que estos son los únicos dos archivos con
cambios en el worktree; no se tocó ningún archivo ajeno.

## Comandos y resultados

### 1. Instalación de dependencias (prerrequisito, no estaban instaladas)

```
cd backend && npm ci
```
Resultado: **PASS** — 699 paquetes instalados. Advertencias de deprecación
de dependencias transitorias (`inflight`, `rimraf`, `xss-clean`, etc.), no
relacionadas con este cambio.

### 2. Suites focalizadas solicitadas

```
npm test --prefix backend -- --runInBand --forceExit \
  tests/controllers/equiposController.test.js \
  tests/controllers/aprendicesController.test.js \
  tests/controllers/importController.test.js
```
Resultado: **PASS**
```
Test Suites: 3 passed, 3 total
Tests:       201 passed, 201 total
Snapshots:   0 total
Time:        18.351 s
```

Desglose relevante — nuevo bloque `obtenerHistorialEquipoUso` (9/9 PASS):
- returns 400 when codigo is missing
- allows broad roles (Administrador/Instructor/Cuentadante) to query any equipo without owner filtering
- scopes an Aprendiz to their own historial on an equipo linked via Responsables_Equipo
- fails closed (404, no enumeration) when the Aprendiz has no active link to the equipo
- fails closed (404) when there is no valid identity for a restricted role
- fails closed (404) when there is no req.user at all
- returns 404 when the equipo does not exist (regression, broad role)
- preserves date filters and limit pagination for broad-access roles (regression)
- returns 500 on DB error

`equiposController.test.js` completo: 100% PASS (incluye `obtenerEquipoPorCodigo`,
`actualizarEquipo`, `asignarEquipo`, `obtenerMisEquipos`, `registrarUsoEquipoExterno`,
etc. — sin regresiones).
`aprendicesController.test.js`: 100% PASS (26 tests).
`importController.test.js`: 100% PASS (44 tests, incluye `importarAprendices`,
`importarEquipos`, `importarUsuarios`, manejo de duplicados).

### 3. Lint focal

```
cd backend && npx eslint src/controller/equiposController.js tests/controllers/equiposController.test.js
```
Resultado: **PASS** — `0 errors, 61 warnings`. Las 61 advertencias son
preexistentes en todo el archivo (`no-nested-ternary`, `no-restricted-globals`
por `isNaN`, `no-await-in-loop`, `prefer-const`, `import/order`, etc.) y no
provienen de las líneas añadidas/modificadas en `obtenerHistorialEquipoUso`
ni en el bloque de tests nuevo — ninguna advertencia nueva fue introducida
más allá del estilo ya presente en el archivo (p. ej. el uso de `isNaN` sin
`Number.isNaN`, que ya era el patrón existente y se conservó para no alterar
el resto de la función).

### 4. Verificación de diff

```
git diff --check
```
Resultado: **PASS** — sin salida (sin errores de espacio en blanco / conflictos).

## Cobertura de casos exigidos por la Dispatch

| Caso exigido | Test | Resultado |
|---|---|---|
| Consulta amplia (Admin/Instructor/Cuentadante) | `allows broad roles ... without owner filtering` | PASS |
| Alcance propio de Aprendiz | `scopes an Aprendiz to their own historial on an equipo linked via Responsables_Equipo` | PASS |
| Falta de identidad | `fails closed (404) when there is no valid identity for a restricted role` + `... no req.user at all` | PASS |
| Equipo no asignado al Aprendiz (fail-closed, sin enumeración) | `fails closed (404, no enumeration) when the Aprendiz has no active link to the equipo` | PASS |
| Regresión de cobertura existente | resto de `equiposController.test.js` (incl. `obtenerEquipoPorCodigo`, `asignarEquipo`, `registrarUsoEquipoExterno`) + regresión explícita de 404/filtros/paginación dentro del nuevo bloque | PASS |

## Límites de la verificación (no BLOCKED, pero declarados)

- No se ejecutó contra MySQL real ni contra el entorno de Railway/producción;
  toda la verificación es sobre pruebas unitarias deterministas con
  `defaultDb.execute` mockeado (mismo patrón que el resto de la suite).
- No se validó UAT manual en la app móvil/web consumidora de esta ruta.
- `.planning/ROADMAP.md` y `.planning/STATE.md` de este worktree solo cubren
  la fase 1 (cierre anterior); no existía `03-05-PLAN.md` ni el directorio de
  fase 3 al iniciar esta Dispatch. Se creó únicamente el directorio de fase
  necesario para alojar este `SUMMARY`/`VERIFICATION`, sin reescribir
  ROADMAP/STATE (fuera del ownership exclusivo otorgado).
- Brecha de alcance equivalente (sin filtrar Aprendiz) detectada también en
  `obtenerEquipoPorCodigo` y `obtenerHistorialEquipo` (historial de
  verificaciones): fuera de alcance, no modificada, se deja registrada para
  una futura Dispatch si corresponde.

## Commit

Commit atómico creado con referencia a MDL-13. SHA reportado al coordinador
vía `worker_done`.
