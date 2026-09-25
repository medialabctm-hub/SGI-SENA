# Armonización de navegación, inventario, ambientes y trazabilidad — Diagnóstico (fase 0)

- **Base inspeccionada:** rama `develop` en `b50d06a` (merge de la PR #52), worktree aislado `claude/sgi-sena-navigation-inventory-b3e3a8`.
- **Método:** lectura de código (frontend, backend, esquema `BD/SGI_SENA.sql`, migraciones y scripts) y ejecución local de las suites. **No se consultó producción ni la aplicación de prueba**; todo lo que depende de datos reales queda como hipótesis y se acompaña de una consulta de solo lectura en `backend/scripts/auditoria-trazabilidad-solo-lectura.sql`.
- **Línea base local antes de cambiar código:** backend 128 suites / 2 307 pruebas OK (2 suites omitidas por diseño), frontend 16 archivos / 80 pruebas OK, lint frontend 0 errores (102 avisos), lint backend 10 errores preexistentes (440 avisos) en archivos que este trabajo no toca.

Convenciones: **Verificado** = comprobado en el código de esta rama; **Hipótesis** = requiere datos reales para confirmarse.

---

## 1. Rutas y pantallas actuales

| Entrada del sidebar | Ruta | Componente | Roles en sidebar | Endpoint principal | Entidad / proyección |
|---|---|---|---|---|---|
| Registrar Inventario | `/equipos` | `Equipos.jsx` | Admin, Cuentadante | `POST /api/equipos`, import | Alta de `Elementos` |
| Consultar Inventario | `/equipos/consultar` | `ConsultarEquipo.jsx` | todos | `GET /api/equipos` (+`vista_inventario` para Cuentadante) | `Elementos` en alcance del rol |
| Mis Equipos | `/mis-equipos` | `MisEquipos.jsx` | todos | `GET /api/equipos/mis-equipos/asignados` | `Responsables_Equipo` del usuario ∪ `Elementos.id_cuentadante = usuario` |
| Asignar Equipo | `/equipos/asignar` (+`?tab=ver`, `/asignaciones` redirige) | `AsignarEquipo.jsx` | Admin, Instructor, Cuentadante | `POST /api/equipos/asignar`, `GET /api/equipos/asignaciones` | Alta/listado de `Responsables_Equipo` (habilitaciones) |
| Equipos Prestados | `/equipos/prestados` | `EquiposPrestados.jsx` | Admin, Instructor, Cuentadante | `GET /api/equipos/uso/activas` | `Historial_Uso_Equipos` con `estado='En Uso'` |
| Verificar Inventario | `/equipos/verificar` | `VerificarInventario.jsx` | Instructor, Cuentadante | `GET /api/equipos/verificacion/ambientes`, `POST /api/equipos/verificacion` | `Verificaciones_Inventario` (alcance MDL-234) |
| Autorizaciones | `/equipos/autorizaciones` (+`#solicitar`, `#pendientes`) | `AutorizacionesMovimiento.jsx` | Admin, Instructor, Cuentadante (contador para Admin/Cuentadante) | `/api/equipos/autorizacion-movimiento/*` | `Solicitudes_Autorizacion_Movimiento` |
| Buscar Cuentadante | `/equipos/cuentadantes/buscar` | `BuscarCuentadante.jsx` | Admin | `GET /api/equipos/cuentadantes/buscar/:documento` | `Elementos` por cuentadante |
| Gestión de Ambientes | `/ambientes`, `/ambientes/:id` | `Ambientes.jsx`, `DetalleAmbiente.jsx` | Admin, Cuentadante | `/api/ambientes`, `/api/ambientes/:id` | `Ambientes` + inventario + imágenes |
| Asignar Ambientes | `/ambientes/asignar` | `AsignarAmbientes.jsx` | Admin | `/api/ambientes/asignaciones`, `/api/ambientes/asignar` | `Responsabilidades_Ambiente` permanentes |
| Novedades | `/novedades` (+`?tab=crear`, `/reportes`, `/reportes/crear`, `/novedades/crear`) | `Novedades.jsx` (pestaña interna Reportes) | Admin, Instructor, Cuentadante | `/api/novedades`, `/api/reportes` | `Novedades`, `Reportes` |
| Historial de Mantenimientos | `/mantenimientos` (+`?tab=crear`, `/mantenimientos/crear`) | `Mantenimientos.jsx` | Admin, Cuentadante | `/api/mantenimiento` | `Mantenimiento` |
| Mis Horarios / Gestión de Horarios | `/horarios` | `Horarios.jsx` | Instructor+Cuentadante / Admin | `/api/clases`, `/api/horarios/importar`, `/api/horarios/plantilla` | `Clases` |
| (sin entrada) | `/equipos/detalle/:codigoEquipo` | `DetalleEquipo.jsx` | — | `GET /api/equipos/:codigo`, `/:codigo/imagenes` | Ficha + responsables activos + imágenes |
| (sin entrada) | `/equipos/historial-verificaciones/:codigo` | `HistorialVerificaciones.jsx` | — | `GET /api/equipos/:codigo/historial-verificaciones` | Solo verificaciones |
| (sin entrada) | `/equipos/historial-movimientos/:codigo` | `HistorialMovimientos.jsx` | — | `GET /api/equipos/:codigo/historial-movimientos` | Solo `Historial_Equipos` tipo movimiento |
| Accesos rápidos del dashboard | `/equipos/documento` | `DocumentoEquipos.jsx` | Admin, Cuentadante | `GET /api/reportes/equipos/pdf` | PDF de inventario por ambiente/cuentadante (no es un informe de uso) |
| Config (7 subentradas) | `/usuarios`, `/aprendices`, `/config?section=…` | varios | según rol | — | fuera de alcance |

Rutas desactivadas: `/equipos/uso/historial` y `/equipos/:codigo/uso/historial` en el frontend; `GET /api/equipos/uso/historial` y `/verificacion/historial` comentadas en `backend/src/routes/equiposRoutes.js`. Sí existe `GET /api/equipos/:codigo/uso/historial` (restringido para Aprendiz por MDL-13).

## 2. Matriz entrada actual → destino propuesto

Sidebar propuesto (5–6 entradas de primer nivel): **Inicio · Equipos e inventario · Ambientes y horarios · Incidencias y mantenimiento · Autorizaciones · Configuración**. Cada sección tiene una barra de pestañas interna (misma configuración que el sidebar, filtrada por rol) para que ninguna capacidad quede a más de un clic.

| Entrada actual | Destino propuesto | Permiso que manda (backend) | Ruta antigua | Decisión |
|---|---|---|---|---|
| Consultar Inventario | Equipos e inventario → pestaña **Inventario** (vista canónica) | `equipos:view` / `equipos:view_own` | `/equipos/consultar` | Se conserva como ruta canónica |
| Mis Equipos | Inventario → vista **Bajo mi responsabilidad** (conserva sus columnas propias) | autenticado (alcance personal) | `/mis-equipos` | Redirige a `/equipos/consultar?vista=mi_responsabilidad` |
| Registrar Inventario | Inventario → pestaña **Registrar** + acción del listado | `equipos:create` | `/equipos` | Se conserva |
| Asignar Equipo | Inventario → pestaña **Asignaciones** + acción contextual «Asignar» en fila/ficha (precarga el equipo) | `equipos:assign(_to_aprendiz)` | `/equipos/asignar`, `/asignaciones` | Se conservan |
| Equipos Prestados | Inventario → pestaña **Préstamos en curso** + pestaña «Responsables y préstamos» de la ficha | `equipos:view(_own)` | `/equipos/prestados` | Se conserva |
| Verificar Inventario | Inventario → pestaña **Verificar** + acción contextual | Instructor/Cuentadante (alcance MDL-234) | `/equipos/verificar` | Se conserva |
| Autorizaciones | Entrada propia con contador (quien aprueba) + acción «Solicitar movimiento» en fila/ficha | `equipos:view`/`update` + autorizador | `/equipos/autorizaciones` | Se conserva en primer nivel |
| Buscar Cuentadante | Inventario → pestaña **Buscar cuentadante** | `equipos:view` (solo Admin en UI) | `/equipos/cuentadantes/buscar` | Se conserva |
| Documento de equipos (dashboard) | Inventario → pestaña **Documento PDF** | `reportes:export` | `/equipos/documento` | Se conserva; se distingue del informe de uso |
| (nuevo) | Inventario → pestaña **Informe de uso** | `equipos:view` + `reportes:export` para exportar | — | Nuevo `/equipos/informe-uso` |
| Gestión de Ambientes | Ambientes y horarios → **Ambientes** + ficha con pestañas | `ambientes:view` | `/ambientes`, `/ambientes/:id` | Se conservan |
| Asignar Ambientes | Ambientes y horarios → pestaña **Asignar ambientes** + acción en ficha | `ambientes:update` | `/ambientes/asignar` | Se conserva |
| Mis/Gestión de Horarios | Ambientes y horarios → pestaña **Agenda** (global) + pestaña Horarios de cada ambiente | `clases:view` | `/horarios` | Se conserva; acepta `?ambiente=` |
| Novedades | Incidencias y mantenimiento → **Novedades** / **Reportes** | `novedades:*`, `reportes:*` | `/novedades`, `/reportes` | Se conservan |
| Historial de Mantenimientos | Incidencias y mantenimiento → **Mantenimientos** + acción en ficha | `mantenimiento:*` | `/mantenimientos` | Se conserva |
| Historial (verificaciones) por equipo | Ficha → pestaña **Historial** filtrada a verificaciones | ver §5 | `/equipos/historial-verificaciones/:codigo` | Redirige a la cronología con `tipos=verificacion` |
| Movimientos por equipo | Ficha → pestaña **Historial** filtrada a movimientos | ver §5 | `/equipos/historial-movimientos/:codigo` | Redirige a la cronología con `tipos=movimiento` |

## 3. Mapa de datos y solapamientos

```
Ambientes 1─* Elementos(codigo_equipo PK, placa, id_ambiente, id_cuentadante)
Elementos 1─1 Estado_Equipo (estado_operativo; puede NO existir la fila)
Elementos 1─* Responsables_Equipo (habilitación/asignación: Principal|Secundario, Activo|Finalizado, id_usuario NULL = externo)
Elementos 1─* Historial_Uso_Equipos (sesión de uso/préstamo: inicio, fin, En Uso|Finalizado, id_clase, id_aprendiz, documento_externo)
Elementos 1─* Verificaciones_Inventario (estado_verificacion, id_ambiente, id_clase, id_usuario)
Elementos 1─* Historial_Equipos (triggers: 'Cambio Estado', 'Movimiento Ambiente'; + id_autorizado_por)
Elementos 1─* Solicitudes_Autorizacion_Movimiento (─1 Historial_Equipos vía id_historial_movimiento al usarse)
Elementos 1─* Novedades, Mantenimiento, Reportes(codigo_equipo NULL = reporte general)
Ambientes 1─* Clases 1─* Responsabilidades_Ambiente (id_clase NULL = asignación permanente/jornada)
```

Pares de vistas que parecen repetidas:

| Par | Clasificación | Consecuencia |
|---|---|---|
| Consultar Inventario ↔ Mis Equipos | **Misma entidad, distinto alcance y proyección.** Mis Equipos = responsabilidades activas del usuario (última por equipo, sin las temporales de clase) ∪ inventario a cargo; añade tipo de responsabilidad, fecha, días, quién asignó y observaciones. | Se unifican en una pantalla con una vista propia que conserva sus columnas; no se mezclan filas. |
| Mis Equipos ↔ Asignar Equipo (pestaña ver) | **Misma entidad (`Responsables_Equipo`), distinto alcance**: personal vs. habilitaciones de aprendices (Instructor/Cuentadante) o todas (Admin). | Se mantienen separadas. |
| Asignaciones ↔ Equipos Prestados | **Entidades diferentes**: responsabilidad (`Responsables_Equipo`) vs. sesión de uso (`Historial_Uso_Equipos`). Una asignación no prueba uso. | El informe de uso las distingue por columna «relación». |
| Historial ↔ Movimientos (botones de fila) | **Eventos diferentes** de fuentes distintas; ninguno es «historial completo». | Se reemplazan por una cronología integral con filtros por tipo. |
| Documento de equipos (PDF) ↔ informe de uso | **Entidades diferentes**: inventario por ambiente/cuentadante vs. uso real. | Se nombran distinto y viven en pestañas distintas. |
| Reportes de incidencias ↔ Informe de uso | **Entidades diferentes** (`Reportes` vs. `Historial_Uso_Equipos`). | Ídem. |

## 4. Hallazgos verificados en código

| # | Hallazgo | Evidencia | Impacto | Tratamiento |
|---|---|---|---|---|
| H1 | El listado de inventario pide `GET /api/equipos` sin `page/limit`: el servidor corta en 50 filas y la UI no muestra total ni paginación; la exportación sí recorre todas las páginas. | `ConsultarEquipo.jsx` `urlListadoEquipos`; `EquipoRepository.findAll` (límite 50/100) | Tabla y Excel no coinciden cuando hay >50 equipos; se ven «desaparecer» equipos. | Fase A: paginación y total del servidor, mismos parámetros para tabla y exportación. |
| H2 | `GET /api/equipos/:codigo` busca primero por **placa** y luego por `codigo_equipo`; el listado navega a la ficha con el ID interno. | `equiposController.obtenerEquipoPorCodigo` | Si otra fila tiene una placa igual al ID numérico de un equipo, la ficha abre el equipo equivocado. | Fase B: modo explícito `?por=id` (compatible). |
| H3 | `GET /:codigo/historial-verificaciones` y `/historial-movimientos` solo restringen al Aprendiz; Instructor y Cuentadante pueden consultar **cualquier** equipo por código y reciben cédula y correo del verificador. | `obtenerHistorialEquipo`, `obtenerHistorialMovimientos` | Enumeración por código fuera de alcance; PII innecesaria. | La nueva cronología aplica el alcance de la ficha y minimiza PII. Los endpoints antiguos no se endurecen en esta entrega (decisión D6) para no romper integraciones. |
| H4 | `historial-movimientos`, `PUT` y `DELETE /api/equipos/:codigo` resuelven un código no numérico por `r_centro` (código de centro, compartido por muchos equipos) y `parseInt('12ABC')` = 12. | `equiposController.js` (líneas ~491, ~730, ~1806) | Resolución ambigua; en `DELETE` puede afectar un equipo arbitrario del centro si se llama a mano. | Fuera de alcance (endpoints destructivos); recomendado: ID entero estricto. |
| H5 | `GET /:codigo/uso/historial` hace `INNER JOIN Usuarios`: excluye sesiones de autoservicio y de registro externo (`id_usuario NULL`). | `obtenerHistorialEquipoUso` | El historial de uso por equipo omite préstamos reales de aprendices sin cuenta. | Cronología e informe usan `LEFT JOIN` y datos externos. |
| H6 | Solo `sp_finalizar_clase` cierra sesiones y solo las que tienen `id_clase`. Las sesiones del registro externo (`id_usuario NULL`, sin clase) no las puede cerrar ningún flujo web (`/uso/fin` exige `id_usuario` = usuario actual). | `migrate-autoservicio-cierre-clase.sql`, `registrarFinUso`, `registrarUsoEquipoExterno` | **Hipótesis fuerte** para la sesión «activa» de varias semanas vista en pruebas: registro externo nunca cerrado, no préstamo real. | No se cierran automáticamente; se marcan «revisar» (>24 h) en préstamos e informe. Consulta Q4 del script. |
| H7 | Contadores de la ficha de ambiente: `total_equipos` cuenta todos los elementos, pero disponibles/en uso/mantenimiento solo cuentan filas con `Estado_Equipo` explícito y omiten «Dañado» y «Dado de Baja». El listado de inventario trata la ausencia de estado como «Disponible». | `ambientesController.obtenerAmbiente` / `listarAmbientes` | El total no cuadra con la suma sin que haya duplicación. | Fase D: misma definición que el listado + contadores faltantes + definición visible. |
| H8 | `listarNovedades` y `listarMantenimientos` hacen `INNER JOIN Responsables_Equipo` para Instructor/Aprendiz: una asignación activa repetida multiplica cada fila. | `novedadesController.js:826`, `mantenimientoController.js:301` | Novedades/mantenimientos duplicados en pantalla y en conteos. | Se reemplaza por `EXISTS` con el mismo predicado (mismo conjunto, sin multiplicar). |
| H9 | `deshabilitarAsignacionesActivas` inserta `tipo_evento='Deshabilitación'`, que no existe en el ENUM; el error se silencia. | `utils/sqlQueries.js:205` | Esos eventos nunca quedan registrados. | Documentado; la cronología usa `Responsables_Equipo.fecha_desvinculacion` como fuente de la finalización. |
| H10 | El trigger de movimiento toma el actor de `Elementos.registrado_por`, que `actualizarEquipo` sobreescribe con quien mueve. | Trigger `trg_historial_cambio_ambiente`, `actualizarEquipo` | Movimientos hechos por otras vías pueden atribuirse al registrador original. | La cronología muestra «registrado por (según trigger)»; no se reescribe historia. |
| H11 | Hay tres definiciones de «ambientes del usuario»: listado (jornada actual o clase en curso), ficha (responsabilidad activa sin clase o clase programada/en curso futura), verificación MDL-234 (activa sin clase o clase en curso). | `equipoService.obtenerAmbientesInstructor`, `obtenerEquipoPorCodigo`, `verificacionInventarioScope.js` | El alcance cambia según pantalla y hora. La ficha ⊇ listado, por lo que todo equipo listado se puede abrir. | Nuevos endpoints reutilizan **el mismo predicado de la ficha** (helper compartido `equipoScope.js`, usado también por la ficha). Unificar el listado queda como decisión D5. |
| H12 | `obtenerEquipoPorCodigo` registra en `logger.info` nombres y documentos de responsables. | `equiposController.js:445` | PII en logs. | Se retira la PII del log (se conserva el conteo). |
| H13 | `GET /uso/activas` no aplica alcance a Instructor/Cuentadante y devuelve cédula y correo. | `obtenerSesionesActivas` | Visibilidad global de préstamos. | Sin cambio de alcance (D6); el informe nuevo sí aplica alcance. |
| H14 | Las sesiones del registro externo guardan el documento del aprendiz solo en `observaciones` («Aprendiz : …»). | `registrarUsoEquipoExterno` | Datos de identidad en texto libre. | El informe no expone `observaciones` a roles sin derecho y enmascara documentos. |
| H15 | La UI de la ficha de equipo ofrece «Cargar imágenes» a Instructor (el backend exige `equipos:update`, que Instructor no tiene) y no a Cuentadante (que sí lo tiene); la ficha de ambiente ofrece «Subir imágenes» a todos (backend exige `ambientes:update`). | `DetalleEquipo.jsx:1183`, `DetalleAmbiente.jsx:459`, rutas de imágenes | Botones que fallan con 403 o capacidades ocultas. | Se alinean los botones con los permisos por defecto. |
| H16 | `Historial_Equipos` solo recibe `Cambio Estado` y `Movimiento Ambiente` (triggers). No hay tabla de entregas/devoluciones ni de cambios en responsables (se actualizan en sitio). | esquema y controladores | Esos hechos no existen como historia. | La cronología los marca «sin datos registrados»; no se infieren del estado actual. |

## 5. Matriz rol × acción × alcance (RBAC)

Permisos por defecto de `backend/src/config/permissions.js` (la BD puede sobreescribirlos por `Rol_Permisos`).

| Acción | Administrador | Instructor | Cuentadante | Aprendiz |
|---|---|---|---|---|
| Listar inventario | todo | ambientes de su jornada actual o clase en curso | vista todos/mis ambientes/inventario a cargo | solo equipos con responsabilidad activa (MDL-189) |
| Ver ficha | todo | ambientes con responsabilidad activa o clase programada/en curso | inventario a cargo ∪ ambientes con responsabilidad activa | solo vínculo activo, responsables ajenos ocultos (MDL-13) |
| Bajo mi responsabilidad | sí | sí | sí (incluye inventario a cargo) | sí |
| Asignar | a cualquiera | solo a aprendices | solo a aprendices | no |
| Verificar | no (UI y backend) | alcance MDL-234 | alcance MDL-234 | no |
| Solicitar movimiento verificado | sí | sí | sí | no |
| Aprobar movimiento | si es autorizador | si es autorizador | si es autorizador | no |
| Novedad | crear/ver/resolver | crear/ver | crear/ver/eliminar | crear/ver sobre sus equipos |
| Mantenimiento | todo | ver | todo | ver sobre sus equipos |
| **Cronología integral (nuevo)** | todos los tipos | todos los tipos dentro del alcance de ficha | ídem | solo equipos con vínculo activo; sus sesiones y responsabilidades; verificaciones y movimientos (MDL-13); novedades/mantenimiento de sus equipos; sin autorizaciones; actores ajenos mostrados solo por rol |
| **Informe de uso (nuevo)** | todo, documento completo | alcance de ficha, documento enmascarado | alcance de ficha, documento enmascarado | **403** |
| **Exportar informe (nuevo)** | `reportes:export` | `reportes:export` | `reportes:export` | **403** |

Reglas aplicadas en los endpoints nuevos: el backend es la autoridad (el frontend solo oculta), 404 indistinguible para equipos fuera de alcance (anti‑enumeración), ID interno entero estricto, paginación con tope (25/100 por página, ventana máxima de 1 000 eventos, rango máximo de 366 días en el informe, 10 000 filas por exportación).

## 6. Propuesta visual

```
┌ Sidebar ─────────────┐  ┌ Equipos e inventario ───────────────────────────────────────────────┐
│ Inicio               │  │ [Inventario] Registrar  Verificar  Préstamos  Asignaciones  Informe │
│ Equipos e inventario │  │ Vista: (Todos) (Mis ambientes) (Bajo mi responsabilidad) (A cargo)  │
│ Ambientes y horarios │  │ Buscar placa/modelo…  Ambiente▾  Tipo  Estado físico▾ Operativo▾    │
│ Incidencias y mant.  │  │ Verificación▾  Préstamo▾  Cuentadante▾(Admin)   [Aplicar] [Limpiar] │
│ Autorizaciones  (3)  │  │ Mostrando 1–50 de 312            [Columnas] [Excel] [Informe de uso]│
│ Configuración  ▸     │  │ Placa │ Tipo │ … │ [Ficha] [Historial] [⋯ Más acciones]            │
└──────────────────────┘  │                     ⋯ → Verificar · Solicitar movimiento · Asignar  │
                          │                        · Registrar novedad · Mantenimiento · Editar │
                          └─────────────────────────────────────────────────────────────────────┘
Ficha de equipo: [Resumen] [Responsables y préstamos] [Historial] [Incidencias y mantenimiento] [Imágenes]
Ficha de ambiente: [Resumen] [Responsables] [Inventario] [Horarios] [Imágenes]
```

## 7. Plan por fases

| Fase | Contenido | Criterio de aceptación |
|---|---|---|
| A | Configuración única de navegación (sidebar + pestañas de sección), listado canónico con vistas, filtros de servidor, paginación, total y exportación con los mismos parámetros | Ninguna ruta del sidebar anterior queda inaccesible para el mismo rol; tabla, total y Excel coinciden |
| B | Ficha con pestañas y acciones contextuales; formularios aceptan `?equipo=` y `?volver=` | Abrir un formulario desde la ficha llega con el equipo cargado y ofrece volver a la ficha |
| C | `GET /api/equipos/:codigo/historial-integral` (adaptadores por fuente) + componente de cronología | Orden determinista, paginación, filtros, eventos enlazados agrupados, tipos sin datos identificados, 404 fuera de alcance |
| D | Ficha de ambiente con pestañas y horarios del `id_ambiente`; contadores coherentes | Suma de contadores = total; horarios de dos ambientes no se mezclan |
| E | Informe de uso y préstamos (vista previa, totales, CSV/Excel) | Distingue asignación de uso, zona horaria Colombia, «sin dato», sesiones largas marcadas, Aprendiz 403 |
| F | Redirecciones de rutas antiguas, accesos rápidos, limpieza de botones duplicados | Rutas antiguas llevan al destino sin bucles y conservan parámetros |

## 8. Decisiones de producto (valor provisional adoptado)

| # | Decisión | Valor provisional en esta entrega |
|---|---|---|
| D1 | Documento del usuario en el informe | Completo solo para Administrador; enmascarado `***1234` para el resto; sin correo |
| D2 | Umbral de «sesión anormalmente larga» | 24 h (constante `SESION_LARGA_MINUTOS`), solo marca, nunca cierra |
| D3 | Retención del historial de uso | Sin cambios (no se borra nada); pendiente de política institucional |
| D4 | ¿Qué es «dónde» en el informe? | Ambiente de la clase asociada a la sesión; si no hay clase, el ambiente **actual** del equipo, rotulado como tal (no existe ambiente histórico de la sesión) |
| D5 | ¿Unificar el alcance del listado del Instructor (jornada actual) con el de la ficha? | No se cambia el listado; los endpoints nuevos usan el alcance de ficha |
| D6 | ¿Endurecer `historial-verificaciones`, `historial-movimientos` y `uso/activas` (H3, H13)? | No en esta entrega; se recomienda tras validar integraciones (app Flutter) |
| D7 | ¿Rango de fechas del informe por solapamiento o por inicio? | Por **solapamiento** del intervalo de la sesión con el rango |

## 8.1 Diseño acordado con el responsable del proyecto

Resultado de seis iteraciones sobre el prototipo `prototipo-navegacion.html` (misma carpeta). **Sustituye a las §2 y §6 donde difieran.**

| # | Decisión | Detalle |
|---|---|---|
| D8 | El sidebar es para **consultar y ver el estado**, no para ejecutar acciones | Inicio · **Inventario**: Consultar inventario, Equipos prestados, Autorizaciones, Novedades y reportes, Mantenimientos, Informe de uso y préstamos, Buscar cuentadante · **Ambientes y horarios**: Ambientes, Horarios · Configuración (sin cambios). Cada entrada muestra su estado (p. ej. «3 por aprobar», «12 en uso ahora · 1 por revisar»), calculado en el servidor con el alcance del usuario. |
| D9 | Salen del sidebar las **acciones** | Registrar Inventario y Generar documento PDF → cabecera de Consultar Inventario; Mis Equipos → vista «Bajo mi responsabilidad»; Asignar Equipo y Verificar Inventario → botones de la fila; Asignar Ambientes y Nueva clase → cabecera de Ambientes. Las rutas se conservan. |
| D10 | Acciones por equipo en la fila, **opción A: columnas por tipo** con íconos SVG (`react-icons/fi`) | Consultar (Ver detalle, Historial) · Gestionar (Verificar, Asignar, Mover) · Registrar (Novedad, Registrar uso, Mantenimiento) · Administrar (Editar, Eliminar). Cada rol ve solo sus botones. |
| D11 | **Historial único** | Los botones «Historial» (verificaciones) y «Movimientos» se unen en «Historial»; movimientos pasa a ser un filtro de la cronología. |
| D12 | Filtros **dentro de la tabla** | Una fila de filtros bajo los títulos de columna; «Columnas y filtros» oculta columna y filtro a la vez; etiquetas de filtros activos y «Limpiar filtros»; filtros en la URL. |
| D13 | Novedades **solo consulta** | Se quita la pestaña «Crear» de Novedades; la novedad se registra desde el botón «Novedad» de la fila, en una ventana dentro del inventario. Los reportes generales (sin equipo) conservan su creación. |
| D14 | Autorizaciones | Aprobar y rechazar se sigue haciendo dentro de su pantalla, a la que se entra desde el sidebar. |
| D15 | Informe de préstamos **dentro de Equipos prestados** | Sin entrada propia en el sidebar. La pantalla Equipos prestados tiene botones para generar el informe (Excel y PDF) de los equipos del cuentadante que están en préstamo; por defecto «en préstamo ahora» y, opcionalmente, un rango de fechas. El Administrador puede elegir cuentadante. Se conservan las reglas del informe (uso real ≠ asignación, hora de Colombia, «sin dato», sesiones largas marcadas sin cerrarlas, documento enmascarado salvo Administrador). |

## 9. Auditoría de duplicados

Las consultas de solo lectura están en `backend/scripts/auditoria-trazabilidad-solo-lectura.sql` (Q1–Q12): duplicados de `codigo_equipo` imposibles por PK; placas duplicadas normalizadas (`UPPER(TRIM(...))`) y en blanco; asignaciones activas repetidas por equipo/usuario/tipo; sesiones activas solapadas o sin cierre y con más de 24 h; verificaciones repetidas en ventanas cortas (reintentos); novedades gemelas de verificaciones «Con Novedad»; reportes automáticos de mantenimiento; filas multiplicadas por joins de novedades; equipos sin `Estado_Equipo`; conciliación de contadores por ambiente.

No se ejecutaron contra datos reales (sin acceso autorizado). Tasa de falsos positivos esperada: Q2 puede marcar placas legítimamente vacías o genéricas («S/N»); Q7 marca como «reintento» verificaciones legítimas repetidas en menos de 2 min; Q8 empareja por texto y ventana de ±120 s (conservador: exige mismo actor, equipo y descripción idéntica). **Ninguna consulta modifica datos.** Si se necesitan restricciones únicas o deduplicación histórica se hará con migración reversible, respaldo previo y tratamiento explícito de conflictos, fuera de esta entrega.
