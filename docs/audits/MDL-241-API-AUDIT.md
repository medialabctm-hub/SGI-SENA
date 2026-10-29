# MDL-241 — Auditoría de APIs de inventario

Fecha: 2026-09-29. Base: `PR3S1G4zZ/Encuentro`, `1e0800ebfaa6a42e6130aaf0ed247c98c1e0b70c` (fetch confirmado). Rama: `codex/mdl-241-api-audit`. Diagnóstico local; implementación y aceptación pendientes.

## Resultado ejecutivo

Equipos puede concentrar entradas de acción sin fusionar todas las APIs. Conservar los dominios de novedades, reportes, mantenimiento, movimientos, préstamos y formación; compartir autorización por equipo, no duplicar handlers según pantalla. Retirar gestión de Habilitaciones de escritorio por etapas, NO borrar `Responsables_Equipo`, `Elementos.id_cuentadante` ni historial.

La prioridad es limitar escrituras/alcance en servidor, introducir acciones limitadas de estado/uso y después desactivar contratos desktop. Ninguna eliminación inmediata de endpoint queda justificada solo por ausencia de consumidor en este repo. [Matriz](MDL-241-API-MATRIX.md) y [plan GSD](../../.planning/phases/09-safe-api-retirement/09-01-PLAN.md). Esta auditoría no satisface todavía todos los criterios de implementación de MDL-241.

## Alcance y método

- Inspección estática de montaje (`backend/src/app.js:170`), 125 declaraciones activas en 11 routers, guardas, controllers, servicios, repositorios, SQL y consumidores React. Rutas comentadas excluidas. Auth e importación de usuarios/aprendices se incluyen como dependencias de apoyo, no como revisión exhaustiva de todos sus handlers. No es un inventario de toda la API de SGI.
- Cruce con App/sidebar, pantallas activas, wrappers y código no enrutado. No se encontró cliente Flutter/desktop en el repo inspeccionado; consumidores externos SIN VERIFICAR.
- Dos revisiones paralelas GPT6-Luna/high: consumidores web y dependencias históricas; revisión independiente de entregables antes de entrega.
- En la auditoría inicial: sin instalar, modificar código funcional, credenciales, consultar MySQL/Railway, desplegar, commit, push o PR. Después se autorizó una primera adaptación local acotada, documentada al final.
- `hasPermissionFromDB` consulta Rol_Permisos: asignación explícita prevalece; ausencia recurre a defaults (`backend/src/config/permissions.js:334`). Riesgos dependientes de defaults son CONDICIONALES respecto al entorno desplegado, no acceso remoto demostrado.

## Hallazgos

### Important — A1. Escrituras generales del cuentadante contradicen la política

Defaults Cuentadante conceden CREATE/UPDATE/DELETE (`backend/src/config/permissions.js:243`). PUT equipo exige UPDATE pero acepta placa, modelo, valor, descripción y ambiente sin validar propietario/rol (`backend/src/routes/equiposRoutes.js:256`, `backend/src/controller/equiposController.js:476`, `:600`, `:632`). DELETE exige DELETE y elimina por código sin propiedad (`equiposRoutes.js:265`, `equiposController.js:717`). Ocultar botones en `frontend/src/components/EquipoActions.jsx:74` no protege API.

Si defaults vigentes, cuentadante puede editar datos generales/eliminar equipo ajeno. Mantener edición general administrativa y crear operación limitada con allowlist y alcance. Importar su inventario es un caso permitido separado: NO quitar CREATE sin reemplazar autorización de importación.

### Important — A2. Novedades y mantenimiento no comprueban propiedad patrimonial

Crear novedad limita solo Aprendiz, no Instructor/Cuentadante (`backend/src/controller/novedadesController.js:38`); novedad crítica escribe estados/finaliza asignaciones (`:174`, `:203`). Lectura/detalle limita Instructor/Aprendiz por asignación, no cuentadante (`:824`, `:877`, `:929`). Mantenimiento repite esa asimetría (`backend/src/controller/mantenimientoController.js:96`, `:300`, `:355`, `:526`); fechas solo verifican rol Admin/Cuentadante (`:389`, `:448`).

Puede reportarse daño/gestionarse mantenimiento ajeno; Instructor puede crear una novedad que luego no puede consultar. Reutilizar alcance patrimonial/aula-horario antes de efectos. Resolución de novedades/eliminación de mantenimiento sí comprueban rol admin: conservar. Registrar mantenimiento por Instructor NO fue acordado; definir si solicita o programa, sin ampliar permisos por armonizar UI.

### Important — A3. Solicitud de movimiento omite alcance y mezcla aprobación/traslado

Ruta admite VIEW o UPDATE (`backend/src/routes/equiposRoutes.js:170`); handler valida existencia, verificación, destino y autorizador, no propiedad/aula/horario del solicitante (`backend/src/controller/autorizacionMovimientoController.js:111`). Para no verificado dice cambiar directamente (`:140`); si solicitante es autorizador dice no necesita solicitud (`:167`). Contradice que Instructor/Cuentadante solicitan, no trasladan. Edición general mueve no verificados y consume autorización para verificados.

No concluir que aprobar/rechazar están desprotegidos por no ver permiso en router: handlers comprueban id_autorizador/estado (`:290`, `:334`). Preservar destinatario derivado y consumo transaccional de un uso (`equiposController.js:537`, `:664`). Adaptar solicitud a ambos estados de verificación, separar solicitante/aprobador/ejecutor; confirmar si cuentadante sigue aprobando.

### Important — A4. Alcance temporal divergente y scheduler frente a contrato manual

Catálogo usa Activa con jornada del reloj del servidor o clase En Curso, no fecha/hora exactas (`backend/src/services/equipoService.js:25`). Verificación acepta responsabilidad permanente activa sin jornada/horario o propiedad (`backend/src/utils/verificacionInventarioScope.js:11`, `:129`). Evidencia admite responsabilidad/asignación activa sin clase/horario (`backend/src/middleware/equipmentEvidenceScope.js:5`). Login-placa comprueba asignación activa, no intervalo (`backend/src/services/authService.js:380`, `backend/src/repositories/UserRepository.js:367`).

`backend/server.js:70` activa scheduler fuera de test; `backend/src/services/schedulerService.js:119`, `:316`, `:410` puede iniciar/cerrar clases automáticamente. Contrato manual: `docs/armonizacion-inventario.md:63`, `BD/SGI_SENA.sql:845`, migración de cierre. Tests todavía verifican automatización. Aplicar reloj/zona America/Bogota y aula/horario explícitos; Activa no sustituye autorización temporal. Resolver manual/automático sin cambiarlo silenciosamente.

También `POST /api/clases/sincronizar-responsabilidades` permite CLASES.UPDATE (por default Instructor/Cuentadante) e invoca scheduler global sin limitarlo a sus clases (`backend/src/routes/clasesRoutes.js:128`, `backend/src/controller/clasesController.js:1556`). La adaptación debe separar sincronización administrativa/global de actuación formativa propia.

### Important — A5. Importación: destino elegible, jobs y duplicados sin dueño

Importación usa CREATE (`backend/src/routes/importRoutes.js:37`). Handler acepta body.id_cuentadante antes de resolver rol: cuentadante puede elegir otro activo en vez de importar a su cargo (`backend/src/controller/importController.js:427`). Job se guarda sin dueño autorizado; status busca solo job_id (`:499`, `:523`). Duplicados valida roles/id_importacion opcional, no dueño del job/equipo (`:561`, `:655`, `:787`).

Además, `GET /api/equipos/cuentadante-principal` exigía `EQUIPOS.VIEW`, no rol Admin (`backend/src/routes/equiposRoutes.js:143`). Los defaults de Instructor y Cuentadante incluyen `VIEW` (`backend/src/config/permissions.js:183`, `:239`); cuando no existe una denegación explícita en `Rol_Permisos`, el handler devuelve un nombre/cédula obtenidos de cualquier titular global (`backend/src/controller/equiposController.js:2090`, `:2102`, `:2110`). `PUT` también exigía `EQUIPOS.UPDATE`, default de Cuentadante, y puede reasignar titularidad sobre IDs enviados por el cliente (`equiposRoutes.js:151`, `equiposController.js:2036`). La interfaz de importación solo se muestra a Admin, pero eso no limitaba las APIs. En la primera adaptación local se restringieron GET/PUT a Administrador mediante rol en servidor; no se ha comprobado runtime remoto.

Adaptar: admin selecciona cuentadante por documento/ID validado; cuentadante deriva de sesión y rechaza otro destino; permiso específico de importación sin UPDATE/DELETE general; autorización de job/status/duplicados/masivo. Entropía de job_id no reemplaza autorización. Preservar plantilla y responsabilidad, no mezclarlas con Habilitaciones.

### Important — A6. Inicio de uso legado no comprueba disponibilidad ni alcance

POST uso/inicio pide autenticación/validación, no permiso por equipo (`backend/src/routes/equiposRoutes.js:345`). Bloquea Elementos y busca solo sesión del mismo usuario/equipo antes de insertar; no valida disponibilidad, asignación, propietario o aula (`backend/src/controller/equiposController.js:2549`, `:2568`). beginEquipmentClaim solo abre transacción/bloquea fila (`backend/src/utils/equipmentClaim.js:68`). No es equivalente a autoservicio/registro-externo.

Sin consumidor web activo, pero comentarios indican Flutter: deprecar/instrumentar, confirmar externo y proteger admisión de nuevos inicios antes de retirar. Conservar cierre de sesiones existentes/historia. Índices/esquema real no probados: no se afirma haber creado préstamos duplicados remotos.

### Important — A7. Seguimiento/cronología no comparte alcance del catálogo

Catálogo restringe Instructor a ambientes y Cuentadante a inventario/ambientes según vista (`equipoService.js:66`). Historias de movimientos/verificación/uso usan vista amplia para ambos (`backend/src/controller/equiposController.js:27`, `:1786`, `:1865`, `:2943`); sesiones activas solo filtra Aprendiz (`:3102`). Reportes Instructor/Aprendiz dependen de asignación activa, cuentadante no se filtra (`backend/src/controller/reportesController.js:189`).

Compartir alcance en detalle/historia/PDF/listas antes de COUNT/paginación. Separar lectura histórica de actuación actual para no perder historia al finalizar asignación. Informe de préstamos sí fuerza cuentadante conectado y comparte WHERE con COUNT (`backend/src/utils/prestamosInformeQuery.js:27`, `:67`): conservar patrón. Sus filtros usan ambiente/cuentadante ACTUALES del equipo, no snapshot al prestar; explicitarlo y capturar contexto futuro sin inventar pasado.

### Minor — A8. Código desconectado no demuestra API eliminable

App redirige MisEquipos/AsignarEquipo/Asignaciones; Reportes/CrearReporte/CrearMantenimiento no son pantallas activas. Novedades integra reportes, Mantenimientos integra alta. DetalleEquipo conserva handlers/modales de asignación sin entrada visible de habilitación. Historial general uso/historial está COMENTADO en backend, no es API activa; historias individuales son necesarias para ficha/cronología.

Limpiar componentes/wrappers tras comprobar imports/deep links/tests/externos. mis-solicitudes y algunos GET detalle sin consumidor web se conservan hasta confirmar producto. PDF general reportes/pdf es candidato a deprecación frente a documentos específicos, no retirado.

Las capacidades visuales también divergen: EquipoActions.jsx:35 solo ofrece registro a Admin/Cuentadante aunque Instructor tiene NOVEDADES.CREATE; DetalleEquipo.jsx:1159 ofrece carga de imagen a Instructor, pero la API exige EQUIPOS.UPDATE que no tiene por default. Mantenimientos.jsx:978 ofrece editar estado al Instructor mientras la ruta exige MANTENIMIENTO.UPDATE; Novedades.jsx:1561 ofrece resolución al Instructor pero su handler solo permite Admin. Armonizar con capacidades verificadas del servidor, no ampliar permisos para que el botón funcione.

`GET /api/equipos/cuentadante-principal` devuelve un DISTINCT/LIMIT 1 global y resuelve cédula por nombre (`backend/src/controller/equiposController.js:2090`), consumido por `frontend/src/components/ImportarEquipos.jsx:93`. No representa el inventario del usuario ni contempla correctamente múltiples titulares. Adaptar como parte de A5 (destino derivado de sesión/admin seleccionado), no usarlo como fuente de «Equipos a mi cargo».

### Minor — A9. DDL en request y runner con recursos abiertos

DDL en alta/import/reportes/cuentadante (`backend/src/services/equipoService.js:246`, `backend/src/controller/importController.js:99`, `:270`, `backend/src/controller/reportesController.js:76`, `backend/src/controller/equiposController.js:1999`). Una estructura retirada puede recrearse. Sustituir por migraciones/readiness antes de retirar.

Jest tanda 1: 13 suites/661 aserciones PASS pero no cerró; detenido, salida final 1. Existe intervalo sin unref en importController.js:88 (posible contribuyente, sin detectOpenHandles no atribución definitiva). Tanda 2: 8/170, salida 0; tanda 3: 4/69, salida 0. PASS refleja contrato existente, no política nueva implementada.

## Dependencias a conservar

| Concepto | Fuente | Consumidores | Decisión |
|---|---|---|---|
| Patrimonio | Elementos.id_cuentadante | Alta/import, catálogo/búsqueda, documentos, autorizador, informe | Conservar; no migrar titularidad sin necesidad |
| Habilitación individual/temporal | Responsables_Equipo | Login-placa, VIEW_OWN Aprendiz, novedades/mantenimiento/reportes, inicio/cierre clase, uso | Conservar tabla/historia; deprecar gestión exclusiva desktop |
| Aula | Responsabilidades_Ambiente + Clases | Instructor, verificación, evidencia, responsables/formación | Adaptar autorización temporal |
| Préstamo real | Historial_Uso_Equipos | PDF/informe, sesiones, autoservicio, cierre clase | Conservar independiente de desbloqueo desktop |
| Movimiento | Solicitudes_Autorizacion_Movimiento + Historial_Equipos | Solicitar/aprobar/rechazar, consumo, cronología | Conservar/adaptar actores |

SQL: `BD/SGI_SENA.sql:203`, `:302`, `:334`, `:399`, `:687`, `:1160`, `:1272`; `backend/scripts/migrate-autoservicio-cierre-clase.sql:55`, `:84`. Esquema versionado no demuestra desplegado. FK CASCADE/SET NULL pueden destruir relaciones/historia; no autoriza eliminación.

## ADR-241 (propuesto)

**Decisión:** un catálogo, dominios separados y autorización común por recurso. Lectura histórica, actuación patrimonial, formativa y traslado son capacidades separadas. Contratos desktop quedan en compatibilidad temporal observable.

**Alternativas:** borrar asignaciones ahora (rompe acceso/clases, rechazada); fusionar todos los endpoints (cambia contratos sin resolver permisos, rechazada); conservar dominios y centralizar autorización (esfuerzo medio, recomendada). La skill de arquitectura orientó esta separación y deuda técnica orientó priorización.

**Consecuencias:** menos duplicación UI/controllers, más pruebas por acción; aplicar la decisión sobre préstamo abierto, decidir aprobador/ejecutor y comprobar externos. No endpoint genérico que admita cualquier mutación.

## Prioridades propuestas

Deuda técnica: `(impacto + riesgo) × (6 - esfuerzo)`, escala 1–5, esfuerzo relativo, no horas. Orden condicionado por compatibilidad/seguridad, no solo puntuación.

| Orden | Cambio | I/R/E | Puntuación | Gate |
|---|---|---|---|---|
| 1 | Separar importación de edición general, A1/A5 | 5/5/3 | 30 | Negativos cuentadante ajeno + importación propia/admin |
| 2 | Política compartida estados/daños/novedad/movimiento A2/A3 | 5/5/4 | 20 | Aula/horario/propiedad, rechazo de campos generales |
| 3 | Uso/disponibilidad, manual/temporal A4/A6 | 5/5/4 | 20 | Fuera horario/bloqueo/préstamo abierto, MySQL/concurrencia |
| 4 | Alcance lectura/cronología/exportación A7 | 4/4/3 | 24 | COUNT/PDF mismo alcance; historia retenida |
| 5 | Deprecación desktop y limpieza A8/A9 | 3/4/3 | 21 | Externos confirmados, readiness, rollback |

## Decisiones antes de implementar

1. Decidido por el usuario: al bloquear uso con préstamo abierto, conservar la sesión y su devolución pendiente; impedir nuevos usos. No finalizar el préstamo automáticamente.
2. ¿Cuentadante sigue aprobando solicitudes de otros sobre su inventario? No trasladar directamente no equivale a no aprobar.
3. Confirmar modelo manual frente a scheduler actual; horario exacto/zona/clases simultáneas y lectura histórica tras cierre.
4. Responsable externo confirma consumidores de login-placa/uso inicio-fin/asignación antes de retirar. App pausada no demuestra ausencia de integraciones.

## Evidencia y cierre

Auditoría inicial: 25 suites/900 aserciones locales PASS en tres tandas (13/661 proceso detenido; 8/170 y 4/69 salida 0). No runner integral limpio. Comandos/suites en `09-01-SUMMARY.md`. En esa etapa no hubo fixes ni tests nuevos.

Continuación local autorizada: restricción de importación ajena para Cuentadante; estado de job visible solo a su creador; GET/PUT de `cuentadante-principal` solo a Administrador. Pruebas negativas observadas RED→GREEN y regresión focal 74/74 PASS. Backend integral: 130 suites/2326 tests PASS, 2 suites/10 tests skipped, salida 0 con `--forceExit` (no prueba cierre limpio). Revisión independiente sin Critical/Important; Minor: falta flujo HTTP autenticado de importación. A1/A5 siguen parciales: no se han adaptado PUT/DELETE generales, permiso específico de importación ni duplicados. Siete candidatos a deprecación permanecen activos.

Sin MySQL real, roles efectivos Railway, UAT, telemetría externa ni CI remoto. Auditoría local entregable, MDL-241 NO Done: adaptación/retirada y aceptación pendientes. No ship formal GSD ni despliegue. Roles y Áreas (MDL-237) separado.
