# Phase 9: Safe API retirement — Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Aplicar la **autorización común por recurso** definida en ADR-241 a las APIs de equipos de SGI-SENA (MDL-241, hallazgos A1–A7; MDL-235): escrituras limitadas por patrimonio (Cuentadante) o aula+franja (Instructor), movimientos como solicitud con aprobación, historiales acotados y sin PII de terceros, importación con permiso propio. La **retirada** de contratos desktop (login-placa, asignar, uso inicio-fin, reportes/pdf) queda **diferida**: en esta fase solo se cierra el hueco de seguridad de inicio de uso (A6). La base de código es `PR3S1G4zZ/Encuentro`.

Corresponde a las tareas de la inspección 2026-10-01: SGI-D03 (escrituras), SGI-D04 (historiales/PII), SGI-D06 (importación), SGI-D07 (horario/disponibilidad). No incluye cronología integral (D08), ficha de ambiente (D09) ni informe de préstamos (D10).

</domain>

<decisions>
## Implementation Decisions

### Movimiento de equipos (A3)
- **D-01:** Aprueba la solicitud el **Cuentadante titular del equipo** (`Elementos.id_cuentadante`, destinatario derivado como hoy); el Administrador puede aprobar como respaldo.
- **D-02:** Al aprobar, **el sistema ejecuta el traslado de forma atómica** (misma transacción: cambia ambiente, registra movimiento, consume la autorización). El solicitante nunca llama a una edición general. — **Reversibility:** costly — reemplaza el consumo de autorización por `PUT` (`equiposController.js:537/664`) y los flujos de frontend que lo usan.
- **D-03:** Si el solicitante **es** el cuentadante titular, **mueve directo** con registro en historial (actor y motivo). Es la única excepción a «no traslado directo».
- **D-04:** El flujo de **solicitud aplica a equipos verificados y no verificados**; se elimina el cambio directo de ambiente por edición general para no verificados.

### Alcance temporal del Instructor (A4, D07)
- **D-05:** «Durante su horario autorizado» = **franja exacta** (día + `hora_inicio`/`hora_fin` del horario o clase del instructor en ese ambiente), evaluada en `America/Bogota`. «Activa»/jornada del reloj no sustituye la franja.
- **D-06:** **Margen fijo de 15 minutos** antes y después de la franja (constante en código, no configurable).
- **D-07:** Con clases simultáneas en el mismo ambiente, **cualquier instructor con franja vigente** en ese ambiente puede actuar; el historial registra quién actuó.
- **D-08:** **Se desactiva el inicio/cierre automático de clases** del scheduler; las clases son manuales (alinea con `docs/armonizacion-inventario.md`). Los tests que hoy verifican la automatización deben actualizarse. — **Reversibility:** costly — cambia comportamiento operativo en `server.js`/`schedulerService.js` y las sesiones abiertas dependen de cierres manuales.
- **D-09 (ya decidido por producto):** al bloquear uso con préstamo abierto, **se conserva la sesión y su devolución pendiente** y se impiden nuevos usos; no se finaliza automáticamente.

### Historiales y datos personales (A7, MDL-235)
- **D-10:** Leen el historial (verificaciones, movimientos, uso/préstamos): **Admin + Cuentadante titular + Instructor del aula del equipo**. El alcance se aplica en listado, detalle, `COUNT`, paginación y exportación/PDF, antes de consultar. El Aprendiz conserva el alcance de MDL-13.
- **D-11:** **Al terminar el vínculo se pierde el acceso** (ex-titular, instructor sin responsabilidad vigente). El Admin reconstruye la historia.
- **D-12:** Terceros ven **solo nombre y rol**; **cédula y correo solo Admin** (alineado con MDL-203).
- **D-13:** Un usuario sin vínculo recibe **404 genérico** (no revela si el equipo existe) y se deniega antes de consultar el historial.

### Acciones permitidas y allowlist (A1, A2)
- **D-14:** El Instructor, sobre equipos de su aula y dentro de su franja, **solo puede solicitar mantenimiento** (queda pendiente de aprobar); no agenda ni cambia fechas. Las acciones ya acordadas (cambio de estado, daño, deshabilitar uso, solicitar cambio de ambiente) se mantienen para Instructor/Cuentadante sobre su alcance.
- **D-15:** **Edición general solo Administrador** (placa, modelo, valor, descripción, ambiente, titularidad). El Cuentadante no edita campos; usa acciones limitadas y solicitudes.
- **D-16:** **`DELETE` de equipo solo Administrador**; se retira `EQUIPOS.DELETE` del default del Cuentadante.
- **D-17:** Importación con **permiso nuevo `EQUIPOS.IMPORT`**, separado de CREATE/UPDATE/DELETE. El handler fija el destino al cuentadante de la sesión (Admin selecciona por documento/ID validado); jobs, status, duplicados y operación masiva conservan el dueño. — **Reversibility:** costly — requiere sembrar el permiso en `Rol_Permisos` y en defaults; quitarlo después rompe la importación propia.

### Modelo de datos de mantenimiento
- **D-18:** Se agrega el estado **`Solicitado`** al ENUM `Mantenimiento.estado_mantenimiento` mediante migración idempotente; el titular/Admin lo pasa a `Programado` o `Cancelado`. — **Reversibility:** one-way — `ALTER ... ENUM` en datos productivos y contratos de API/UI que enumeran estados; revertir exige migración.

### Permisos efectivos y despliegue
- **D-19:** La política **decide por rol + recurso en código** y no depende de lo que haya en `Rol_Permisos`: aunque la BD conceda UPDATE/DELETE al Cuentadante, el handler exige titular/aula+franja. Se ajustan los defaults de `permissions.js`; la única migración de permisos es sembrar `EQUIPOS.IMPORT`.
- **D-20:** Activación **desde el inicio, sin flags**, en **PRs pequeños por acción** con pruebas negativas por rol en `pruebasdeseguridad` (corren en el CI `backend-unit`/`backend-mysql` ya activo). No hay modo observación.

### Contratos desktop (A6, A8)
- **D-21:** En esta fase **solo se cierra el hueco de A6**: impedir nuevos inicios de uso (`POST uso/inicio`) sin disponibilidad ni alcance, conservando el cierre de sesiones existentes y la historia; **registrar uso (log) de los siete candidatos** a deprecación. La **retirada se difiere a D11** y exige confirmar clientes externos (Flutter) con el responsable externo.

### Claude's Discretion
- Diseño de la **política compartida** (módulo/middleware de autorización por recurso), nombres de funciones y organización de pruebas.
- Forma exacta de la respuesta 404 y de los mensajes de error, siempre sin filtrar PII ni detalles SQL.
- Orden interno de los PRs dentro de la regla de «PR pequeño por acción».
- Estructura del log de uso de los contratos desktop (sin PII).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contrato y auditoría
- `docs/armonizacion-inventario.md` — reglas acordadas por rol, navegación, historial, informe y gates.
- `docs/audits/MDL-241-API-AUDIT.md` — hallazgos A1–A9, ADR-241 propuesto, prioridades y decisiones previas.
- `docs/audits/MDL-241-API-MATRIX.md` — matriz de 125 rutas (conservar/adaptar/deprecar).
- `.planning/phases/09-safe-api-retirement/09-01-PLAN.md` y `09-01-SUMMARY.md` — plan de auditoría y evidencia.

### Linear (issues base)
- MDL-241 — auditar y adaptar APIs; MDL-235 — historial de verificaciones (IDOR/PII); MDL-203 — matriz PII; MDL-237 — Roles y Áreas (separada).

### Informe de inspección
- `D:/sgi/inspeccion-sgi-2026-10-01.md` — tareas SGI-D03/D04/D06/D07/D11 con criterios de aceptación.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/utils/verificacionInventarioScope.js` y `backend/src/middleware/equipmentEvidenceScope.js`: alcance por responsabilidad/patrimonio ya existente; base para la política común.
- `backend/src/utils/prestamosInformeQuery.js`: filtro de alcance compartido entre WHERE y COUNT; patrón a replicar en historiales.
- `backend/src/middleware/authorization.js`: `requireOwnership`, guardas por rol.
- `backend/src/utils/usuarioPublico.js` (`toPublicUser`): DTO que oculta campos privados; extender a respuestas de historial.
- `backend/src/controller/autorizacionMovimientoController.js`: destinatario derivado, consumo transaccional de un uso.
- `backend/src/utils/sessionVersion.js` y `UserRepository.bumpTokenVersion` (MDL-229): revocación de sesiones al cambiar rol/identidad.
- CI: `.github/workflows/backend-tests.yml` (`backend-unit`, `backend-mysql`) y `backend/scripts/run-mysql-integration.js`.

### Established Patterns
- Permisos por defecto en `backend/src/config/permissions.js` con `hasPermissionFromDB` (asignación explícita > default); la política nueva no debe depender de ellos (D-19).
- Migraciones SQL idempotentes en `backend/migrations/` aplicadas antes del despliegue.
- Pruebas negativas de seguridad en `backend/tests/pruebasdeseguridad/`.
- `ROLES_EQUIPOS_VISTA_AMPLIA` (`equiposController.js:27`) es el patrón a reemplazar por alcance por recurso.

### Integration Points
- `backend/src/routes/equiposRoutes.js` (PUT :256, DELETE :265, movimiento :170, uso/inicio :345, cuentadante-principal :143/:151).
- `backend/src/controller/equiposController.js` (:476, :537, :600, :632, :664, :717, :1786, :1865, :1904, :2549, :2943).
- `novedadesController.js` (:38, :174, :824), `mantenimientoController.js` (:96, :300, :355, :526), `importController.js` (:427, :499, :561, :655, :787), `clasesController.js`/`schedulerService.js`/`server.js:70`.
- Frontend `frontend/src/components/EquipoActions.jsx` (:74): ocultar botones no protege la API; debe alinearse con las nuevas acciones.

</code_context>

<specifics>
## Specific Ideas

- La política común debe poder responder, por (usuario, equipo, acción): permitido/denegado y por qué (patrimonio, aula+franja, admin), reutilizable en PUT, DELETE, novedades, mantenimiento, movimientos, historiales, PDF y COUNT.
- Estado de trabajo previo sin commit en `codex/mdl-241-api-audit` (importación propia, status de job solo al creador, `cuentadante-principal` solo Admin): partir de él sin sobrescribirlo (D06).

</specifics>

<deferred>
## Deferred Ideas

- **Retirada de contratos desktop (D11):** pendiente de confirmar clientes externos (Flutter); decisión 4 de la auditoría sin resolver.
- **Rotación/limpieza de `--forceExit` y DDL en request path (D16/MDL-130):** deuda estructural, otra fase.
- **Cronología integral, ficha de ambiente, informe de préstamos (D08–D10):** fases 06–08.
- **Snapshot de titularidad/ambiente al prestar** para el informe: capturar contexto futuro, sin reconstruir el pasado.
- **Franja exacta en lecturas y flujos heredados (A4/D-05) — pendiente de confirmación del usuario:** en la fase 09 la franja exacta ±15 min (America/Bogota) se aplica a las acciones que consumen la política común (09-03). Queda diferido alinearla en `backend/src/utils/verificacionInventarioScope.js` (verificación de inventario, alcance MDL-234), en `backend/src/services/equipoService.js` (catálogo por jornada del reloj del servidor) y en los GET de `backend/src/middleware/equipmentEvidenceScope.js` (lectura de evidencias). Mientras tanto conservan su alcance actual. Diferencia aceptada documentada en 09-10: una responsabilidad `Activa` ya vencida puede listarse en el catálogo y dar 404 en el detalle.
- **UI de acciones limitadas (D-14) — fase UI posterior:** la entrada de «Solicitar mantenimiento» del Instructor (hoy `Mantenimientos.jsx` redirige al Instructor) y la del cambio de estado limitado (`PATCH /api/equipos/:codigo/estado`). El backend queda implementado en la fase 09 (planes 09-05 y 09-11).

</deferred>

---

*Phase: 9-Safe API retirement*
*Context gathered: 2026-10-01*
