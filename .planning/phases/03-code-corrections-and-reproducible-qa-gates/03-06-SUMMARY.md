---
phase: 03-code-corrections-and-reproducible-qa-gates
plan: 06
status: completed
requirements:
  - MDL-13
---

# 03-06 — MDL-13: alcance de lectura por equipo vinculado

## Entrega

Se cerró la autorización residual de las tres lecturas de equipos que aceptan
`EQUIPOS.VIEW_OWN`:

- `obtenerEquipoPorCodigo` filtra la resolución del equipo del Aprendiz por un
  vínculo activo propio en `Responsables_Equipo`; responde 404 genérico para
  identidad ausente/inválida o equipo ajeno y solo devuelve sus responsables.
- `obtenerHistorialEquipo` exige resolver el equipo y comprobar el vínculo
  activo antes de consultar `Verificaciones_Inventario`.
- `obtenerHistorialMovimientos` exige resolver el equipo y comprobar el
  vínculo activo antes de consultar `Historial_Equipos`.
- `Administrador`, `Instructor` y `Cuentadante` conservan el acceso amplio
  que tenían; no se añade una restricción de propietario a esos roles.

La identidad restringida se normaliza como entero positivo seguro antes de
usarla en consultas. Los casos no autorizados comparten la respuesta
`{ error: 'Equipo no encontrado' }` para no enumerar equipos existentes.

## Pruebas añadidas

`backend/tests/controllers/equiposController.test.js` cubre:

- Aprendiz con vínculo activo propio en detalle, verificaciones y movimientos.
- Aprendiz con otro equipo: 404 genérico y sin consulta del historial.
- Identidad ausente, cero, negativa o no numérica: 404 sin consultar la BD.
- Responsables ajenos excluidos del detalle del Aprendiz.
- Administrador, Instructor y Cuentadante conservando visibilidad amplia en
  cada lectura.
- Regresiones existentes de filtros, errores, paginación y rutas cercanas.

## Alcance y límites

Solo se modificaron los dos archivos backend indicados y los dos artefactos
`.planning` de este plan. No se modificaron rutas, permisos, despliegues,
Linear, aulas/evidencias físicas, ni se hizo push o delegación de subagentes.

La evidencia es local y determinista con `defaultDb.execute` mockeado; no
representa validación contra MySQL real, Railway, CI remoto, navegador,
staging ni UAT físico.
