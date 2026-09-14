# 03-05 — MDL-13: alcance fail-closed en GET /:codigo/uso/historial

## Contexto

`03-05-PLAN.md` no existía en este worktree al iniciar (tampoco el directorio
de fase `03-code-corrections-and-reproducible-qa-gates/`, ni entradas de fase
3 en `.planning/ROADMAP.md` o `.planning/STATE.md`, que solo documentan la
fase 1 ya cerrada). Se trabajó directamente sobre la instrucción de la
Dispatch (brecha MDL-13) con ownership exclusivo de:

- `backend/src/controller/equiposController.js`
- `backend/tests/controllers/equiposController.test.js`

## Brecha corregida

La ruta `GET /:codigo/uso/historial` (`equiposRoutes.js:369`) acepta
`EQUIPOS.VIEW` **o** `EQUIPOS.VIEW_OWN`. El rol `Aprendiz` solo tiene
`EQUIPOS.VIEW_OWN` (`permissions.js:216`), pero el controlador
`obtenerHistorialEquipoUso` no aplicaba ningún filtro por rol/propietario:
cualquier usuario autenticado con ese permiso podía enumerar el historial de
uso y la metadata de **cualquier** equipo por código o placa.

## Cambio implementado

En `backend/src/controller/equiposController.js`, función
`obtenerHistorialEquipoUso`:

1. Se define `ROLES_HISTORIAL_USO_AMPLIO = ['Administrador', 'Instructor', 'Cuentadante']`,
   los tres roles que en `permissions.js` tienen `EQUIPOS.VIEW`. Coincide con
   el patrón de alcance ya usado en `obtenerEquipoPorCodigo` para Cuentadante/Instructor.
2. **Fail-closed por falta de identidad**: si el rol no está en la lista
   amplia y no hay `req.user.id`, se responde `404 { error: 'Equipo no
   encontrado' }` antes de tocar la base de datos (no se ejecuta ninguna
   consulta).
3. El equipo se resuelve primero (por placa o por `codigo_equipo`, igual que
   antes) para obtener el `codigo_equipo` canónico, sin exponer historial
   todavía.
4. **Alcance de Aprendiz**: si el rol no es de acceso amplio, se exige un
   vínculo activo en `Responsables_Equipo` (`codigo_equipo` + `id_usuario` +
   `estado_responsabilidad = 'Activo'`). Si no existe, se responde el mismo
   `404 { error: 'Equipo no encontrado' }` que usa el caso "no existe" —
   misma forma de respuesta para no permitir distinguir equipos ajenos de
   equipos inexistentes (no enumeración).
5. Si el vínculo existe, la consulta de `Historial_Uso_Equipos` añade
   `AND hu.id_usuario = ?` con el `id` del usuario autenticado, de modo que
   un Aprendiz solo ve sus propias sesiones incluso dentro de un equipo
   autorizado.
6. Los roles de acceso amplio (Admin/Instructor/Cuentadante) conservan la
   consulta original sin restricción de propietario.
7. Filtros (`fecha_desde`, `fecha_hasta`) y paginación (`limit`, tope 1000)
   se mantienen sin cambios para ambos casos.

No se tocó `registrarInicioUso`, `registrarFinUso`, importación, filas
externas `NULL` (`Responsables_Equipo.documento_externo`), autoservicio
(`iniciarUsoAutoservicio`) ni ninguna otra ruta/controlador.

## Pruebas añadidas

`backend/tests/controllers/equiposController.test.js`, nuevo bloque
`describe('obtenerHistorialEquipoUso', ...)` con 9 casos:

- 400 cuando falta `codigo` (sin tocar la BD).
- Consulta amplia (Administrador) sin filtro por `hu.id_usuario` y sin
  consultar `Responsables_Equipo`.
- Alcance propio de Aprendiz: vínculo activo verificado y filtro
  `hu.id_usuario = ?` aplicado con los parámetros correctos.
- Fail-closed 404 sin enumeración cuando el Aprendiz no tiene vínculo activo
  (y se verifica que **no** se consultó `Historial_Uso_Equipos`).
- Fail-closed 404 cuando falta `id` de usuario válido (rol restringido sin
  identidad) — sin ninguna consulta a la BD.
- Fail-closed 404 cuando `req.user` es `undefined`.
- Regresión: 404 cuando el equipo no existe, para un rol de acceso amplio.
- Regresión: filtros de fecha y `limit` se preservan para un rol amplio
  (Instructor).
- 500 ante error de base de datos.

## Comandos ejecutados

```
npm ci                                        # dependencias no estaban instaladas en el worktree
npm test --prefix backend -- --runInBand --forceExit \
  tests/controllers/equiposController.test.js \
  tests/controllers/aprendicesController.test.js \
  tests/controllers/importController.test.js
npx eslint src/controller/equiposController.js tests/controllers/equiposController.test.js   # (dentro de backend/)
git diff --check
```

Ver `03-05-VERIFICATION.md` para resultados PASS/FAIL detallados.

## Límites y alcance

- No se modificó Linear, no se hizo `git push`, no se delegó a subagentes ni
  se inició otra Run Orca.
- No se tocaron archivos fuera del ownership exclusivo indicado.
- No se creó ni modificó `.planning/ROADMAP.md`/`.planning/STATE.md` (no
  formaban parte del ownership de este worker); se documenta aquí que esos
  archivos no reflejan la fase 3 en este worktree.
- No se validó contra MySQL real ni contra producción: las pruebas son
  deterministas sobre mocks de `defaultDb.execute`, siguiendo el patrón ya
  usado en el resto de la suite de `equiposController.test.js`.
- La brecha equivalente sin filtrar por Aprendiz también existe en
  `obtenerEquipoPorCodigo` y `obtenerHistorialEquipo` (`historial-verificaciones`),
  pero quedan fuera del alcance de esta Dispatch (ownership exclusivo a
  `obtenerHistorialEquipoUso`).

## Commit

Un commit atómico con referencia a MDL-13 sobre los dos archivos indicados.
