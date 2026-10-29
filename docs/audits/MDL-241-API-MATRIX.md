# MDL-241 — Matriz de APIs y dependencias

Base `1e0800ebfaa6a42e6130aaf0ed247c98c1e0b70c`, 2026-09-29. 125 declaraciones activas en 11 routers del alcance/dependencias. Extraídas estáticamente, excluyendo comentarios, con prefijos revisados contra `backend/src/app.js:170–188`; `/api/import` no es `/api`. No es el total de la API SGI ni prueba de montaje remoto.

**Clasificación propuesta, no aplicada.** Conservar mantiene propósito/contrato; Adaptar exige alcance o separación de capacidades; Deprecar condicionado exige confirmar consumidores externos, reemplazo y ventana de compatibilidad. **Retirar ahora: ninguno.** Las tablas/consumidores/pruebas abajo corresponden al conjunto de la familia, no implican que cada handler use todas las tablas ni que todos los wrappers sean activos.

La columna guarda registra autenticación y constantes declaradas en router; no muestra límites, validadores, permisos dinámicos por ownership, optionalAuthenticate ni todos los controles del handler. Véase política de cada familia y [hallazgos A1–A9](MDL-241-API-AUDIT.md). Auth es apoyo salvo contrato login-placa; no se proclama revisión de seguridad integral.

## ambientesRoutes (11)

- Consumidores/evidencia frontend: `frontend/src/Ambientes.jsx:70,147,207,240; AsignarAmbientes.jsx:85,192,236; DetalleAmbiente.jsx:74,126` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Ambientes, Responsabilidades_Ambiente, Usuarios, Roles, Elementos.
- Política actual: Sesión + AMBIENTES.VIEW/CREATE/UPDATE/DELETE según fila; escrituras admin por defaults. Conservar asignación de AULA, no es Habilitación individual desktop.
- Pruebas bajo `backend/tests/`: controllers/ambientesController.test.js; routes/moreRoutes.test.js (existentes, no ejecutados en esta auditoría).
- Notas: Fase 07: ficha/agenda consume contratos actuales.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| GET | `/api/ambientes` | [ambientesRoutes.js:25](../../backend/src/routes/ambientesRoutes.js#L25) | Sesión + AMBIENTES.VIEW | Conservar |
| GET | `/api/ambientes/activos` | [ambientesRoutes.js:32](../../backend/src/routes/ambientesRoutes.js#L32) | Sesión + AMBIENTES.VIEW | Conservar |
| GET | `/api/ambientes/asignaciones` | [ambientesRoutes.js:40](../../backend/src/routes/ambientesRoutes.js#L40) | Sesión + AMBIENTES.VIEW | Conservar |
| GET | `/api/ambientes/:id/instructores` | [ambientesRoutes.js:47](../../backend/src/routes/ambientesRoutes.js#L47) | Sesión + AMBIENTES.VIEW | Conservar |
| POST | `/api/ambientes/cambiar-cuentadante-secundario` | [ambientesRoutes.js:54](../../backend/src/routes/ambientesRoutes.js#L54) | Sesión + AMBIENTES.UPDATE | Conservar |
| POST | `/api/ambientes/asignar` | [ambientesRoutes.js:61](../../backend/src/routes/ambientesRoutes.js#L61) | Sesión + AMBIENTES.UPDATE | Conservar |
| DELETE | `/api/ambientes/asignaciones/:id_responsabilidad` | [ambientesRoutes.js:68](../../backend/src/routes/ambientesRoutes.js#L68) | Sesión + AMBIENTES.UPDATE | Conservar |
| GET | `/api/ambientes/:id` | [ambientesRoutes.js:75](../../backend/src/routes/ambientesRoutes.js#L75) | Sesión + AMBIENTES.VIEW | Conservar |
| POST | `/api/ambientes` | [ambientesRoutes.js:82](../../backend/src/routes/ambientesRoutes.js#L82) | Sesión + AMBIENTES.CREATE | Conservar |
| PUT | `/api/ambientes/:id` | [ambientesRoutes.js:89](../../backend/src/routes/ambientesRoutes.js#L89) | Sesión + AMBIENTES.UPDATE | Conservar |
| DELETE | `/api/ambientes/:id` | [ambientesRoutes.js:96](../../backend/src/routes/ambientesRoutes.js#L96) | Sesión + AMBIENTES.DELETE | Conservar |

## authRoutes (16)

- Consumidores/evidencia frontend: `frontend/src/Login.jsx:35; AuthContext.jsx; Usuarios.jsx; Equipos.jsx y formularios que buscan por documento. login-placa: sin cliente web/desktop localizado.` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Usuarios, Roles, Rol_Permisos, Permisos; Responsables_Equipo/Elementos/Aprendices en login-placa.
- Política actual: Guardar login/logout/me y lookup. Público/sesión y permisos USERS según fila. SOLO inventario de apoyo salvo login-placa (dependencia revisada); resto no es auditoría exhaustiva auth.
- Pruebas bajo `backend/tests/`: controllers/authController.test.js; services/authService.test.js; repositories/UserRepository.test.js (ejecutados).
- Notas: No cambiar credenciales/cookies al retirar desktop.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/auth/register` | [authRoutes.js:41](../../backend/src/routes/authRoutes.js#L41) | Pública | Conservar (apoyo) |
| POST | `/api/auth/login` | [authRoutes.js:44](../../backend/src/routes/authRoutes.js#L44) | Pública | Conservar (apoyo) |
| POST | `/api/auth/logout` | [authRoutes.js:47](../../backend/src/routes/authRoutes.js#L47) | Pública (limpia cookie) | Conservar (apoyo) |
| POST | `/api/auth/login-placa` | [authRoutes.js:50](../../backend/src/routes/authRoutes.js#L50) | Pública | Deprecar condicionado |
| POST | `/api/auth/recuperar-contrasena` | [authRoutes.js:53](../../backend/src/routes/authRoutes.js#L53) | Pública | Conservar (apoyo) |
| POST | `/api/auth/validar-token` | [authRoutes.js:56](../../backend/src/routes/authRoutes.js#L56) | Pública | Conservar (apoyo) |
| POST | `/api/auth/restablecer-contrasena` | [authRoutes.js:59](../../backend/src/routes/authRoutes.js#L59) | Pública | Conservar (apoyo) |
| GET | `/api/auth/roles` | [authRoutes.js:62](../../backend/src/routes/authRoutes.js#L62) | Pública | Conservar (apoyo) |
| POST | `/api/auth/cambiar-contrasena` | [authRoutes.js:69](../../backend/src/routes/authRoutes.js#L69) | Sesión | Conservar (apoyo) |
| GET | `/api/auth/me` | [authRoutes.js:72](../../backend/src/routes/authRoutes.js#L72) | Sesión | Conservar (apoyo) |
| GET | `/api/auth/users` | [authRoutes.js:75](../../backend/src/routes/authRoutes.js#L75) | Sesión + USERS.VIEW | Conservar (apoyo) |
| GET | `/api/auth/user/cedula/:cedula` | [authRoutes.js:84](../../backend/src/routes/authRoutes.js#L84) | Sesión + USERS.VIEW | Conservar (apoyo) |
| GET | `/api/auth/user/:id` | [authRoutes.js:93](../../backend/src/routes/authRoutes.js#L93) | Sesión + USERS.VIEW_DETAIL | Conservar (apoyo) |
| PUT | `/api/auth/user/:id` | [authRoutes.js:102](../../backend/src/routes/authRoutes.js#L102) | Sesión | Conservar (apoyo) |
| DELETE | `/api/auth/user/:id` | [authRoutes.js:113](../../backend/src/routes/authRoutes.js#L113) | Sesión + USERS.DELETE | Conservar (apoyo) |
| POST | `/api/auth/user/:id/foto-perfil` | [authRoutes.js:120](../../backend/src/routes/authRoutes.js#L120) | Sesión | Conservar (apoyo) |

## clasesRoutes (15)

- Consumidores/evidencia frontend: `frontend/src/Horarios.jsx:142,163,180,216,249,374,423,448,497,529,683,746; DetalleAmbiente.jsx:74; Header.jsx:270; ClassNotificationModal.jsx:27` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Clases, Participantes_Clase, Responsabilidades_Ambiente, Responsables_Equipo, Historial_Uso_Equipos, Ambientes.
- Política actual: Sesión + CLASES/AMBIENTES según fila; handlers validan pertenencia de clase. Inicio/cierre/manual/temporal requiere resolución A4; no retirar procedimientos ni responsabilidades.
- Pruebas bajo `backend/tests/`: controllers/clasesController.test.js; services/schedulerService.test.js; migrations/autoservicioMigration.test.js; scripts/migrateAutoservicioCierreClase.test.js (ejecutados).
- Notas: Integración equipmentClaim.mysql.test.js NO ejecutada; scheduler no probado en Railway.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/clases` | [clasesRoutes.js:31](../../backend/src/routes/clasesRoutes.js#L31) | Sesión + CLASES.CREATE | Adaptar |
| GET | `/api/clases` | [clasesRoutes.js:40](../../backend/src/routes/clasesRoutes.js#L40) | Sesión + CLASES.VIEW | Adaptar |
| GET | `/api/clases/nombres` | [clasesRoutes.js:48](../../backend/src/routes/clasesRoutes.js#L48) | Sesión + CLASES.VIEW | Adaptar |
| GET | `/api/clases/:id` | [clasesRoutes.js:55](../../backend/src/routes/clasesRoutes.js#L55) | Sesión + CLASES.VIEW | Adaptar |
| PUT | `/api/clases/:id` | [clasesRoutes.js:62](../../backend/src/routes/clasesRoutes.js#L62) | Sesión + CLASES.UPDATE | Adaptar |
| POST | `/api/clases/:id/iniciar` | [clasesRoutes.js:71](../../backend/src/routes/clasesRoutes.js#L71) | Sesión + CLASES.UPDATE | Adaptar |
| POST | `/api/clases/:id/finalizar` | [clasesRoutes.js:78](../../backend/src/routes/clasesRoutes.js#L78) | Sesión + CLASES.UPDATE | Adaptar |
| POST | `/api/clases/:id/cancelar` | [clasesRoutes.js:85](../../backend/src/routes/clasesRoutes.js#L85) | Sesión + CLASES.UPDATE | Adaptar |
| POST | `/api/clases/:id/consentimiento/aceptar` | [clasesRoutes.js:92](../../backend/src/routes/clasesRoutes.js#L92) | Sesión + CLASES.UPDATE | Adaptar |
| POST | `/api/clases/:id/consentimiento/rechazar` | [clasesRoutes.js:98](../../backend/src/routes/clasesRoutes.js#L98) | Sesión + CLASES.UPDATE | Adaptar |
| POST | `/api/clases/:id/participantes` | [clasesRoutes.js:105](../../backend/src/routes/clasesRoutes.js#L105) | Sesión + CLASES.UPDATE | Adaptar |
| GET | `/api/ambientes/:id_ambiente/responsables` | [clasesRoutes.js:114](../../backend/src/routes/clasesRoutes.js#L114) | Sesión + AMBIENTES.VIEW | Adaptar |
| GET | `/api/ambientes/:id_ambiente/responsables-tiempo-real` | [clasesRoutes.js:121](../../backend/src/routes/clasesRoutes.js#L121) | Sesión + AMBIENTES.VIEW | Adaptar |
| POST | `/api/clases/sincronizar-responsabilidades` | [clasesRoutes.js:128](../../backend/src/routes/clasesRoutes.js#L128) | Sesión + CLASES.UPDATE | Adaptar |
| POST | `/api/clases/nombres` | [clasesRoutes.js:135](../../backend/src/routes/clasesRoutes.js#L135) | Sesión + CLASES.CREATE | Adaptar |

## equiposRoutes (37)

- Consumidores/evidencia frontend: `frontend/src/ConsultarEquipo.jsx:101,127,146,181,191,364,399; Equipos.jsx:252; VerificarInventario.jsx:100,127; AutorizacionesMovimiento.jsx:190,244,273,289,312,329; DetalleEquipo.jsx:141,198,251,306; EquiposPrestados.jsx:135; InformePrestamos.jsx:67; HistorialMovimientos.jsx:42; HistorialVerificaciones; TiposEquipo.jsx:37,86,128; loanRequest.js:35` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Elementos, Categorias, Estado_Equipo, Usuarios, Responsables_Equipo, Responsabilidades_Ambiente, Clases, Verificaciones_Inventario, Solicitudes_Autorizacion_Movimiento, Historial_Equipos, Historial_Uso_Equipos.
- Política actual: Guarda de ruta no garantiza propiedad. Ver A1/A3/A4/A6/A7 y controles de recurso en handlers. Públicos: registro-externo y autoservicio; el primero usa optionalAuthenticate y política externa todavía pendiente.
- Pruebas bajo `backend/tests/`: controllers/equiposController.test.js; controllers/equiposAssignmentAutoservicio.test.js; services/equipoService.test.js; repositories/EquipoRepository.test.js; validators/equiposValidator.test.js; utils/equipoVerification.test.js; utils/verificacionInventarioScope.test.js; utils/prestamosInformeQuery.test.js; controllers/prestamosInformeController.test.js (ejecutados).
- Notas: mis-solicitudes no tiene consumidor identificado; mis-equipos/asignados mezcla legado y patrimonio, no es reemplazo de vista_inventario=inventario_total. Historias individuales con UI desactivada se mantienen para futura ficha.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/equipos/uso/registro-externo` | [equiposRoutes.js:31](../../backend/src/routes/equiposRoutes.js#L31) | Pública + auth opcional + EQUIPOS.ASSIGN / EQUIPOS.ASSIGN_TO_APRENDIZ | Adaptar |
| POST | `/api/equipos/autoservicio/iniciar-uso` | [equiposRoutes.js:53](../../backend/src/routes/equiposRoutes.js#L53) | Pública | Adaptar |
| POST | `/api/equipos` | [equiposRoutes.js:65](../../backend/src/routes/equiposRoutes.js#L65) | Sesión + EQUIPOS.CREATE | Adaptar |
| GET | `/api/equipos/categorias` | [equiposRoutes.js:75](../../backend/src/routes/equiposRoutes.js#L75) | Sesión | Conservar |
| POST | `/api/equipos/categorias` | [equiposRoutes.js:82](../../backend/src/routes/equiposRoutes.js#L82) | Sesión + EQUIPOS.MANAGE_CATEGORIES | Conservar |
| PUT | `/api/equipos/categorias/:id_categoria` | [equiposRoutes.js:91](../../backend/src/routes/equiposRoutes.js#L91) | Sesión + EQUIPOS.MANAGE_CATEGORIES | Conservar |
| DELETE | `/api/equipos/categorias/:id_categoria` | [equiposRoutes.js:100](../../backend/src/routes/equiposRoutes.js#L100) | Sesión + EQUIPOS.MANAGE_CATEGORIES | Conservar |
| GET | `/api/equipos` | [equiposRoutes.js:110](../../backend/src/routes/equiposRoutes.js#L110) | Sesión + EQUIPOS.VIEW / EQUIPOS.VIEW_OWN | Adaptar |
| GET | `/api/equipos/mis-equipos/asignados` | [equiposRoutes.js:123](../../backend/src/routes/equiposRoutes.js#L123) | Sesión | Adaptar |
| GET | `/api/equipos/asignaciones` | [equiposRoutes.js:131](../../backend/src/routes/equiposRoutes.js#L131) | Sesión + EQUIPOS.VIEW / EQUIPOS.ASSIGN / EQUIPOS.ASSIGN_TO_APRENDIZ | Adaptar |
| GET | `/api/equipos/cuentadante-principal` | [equiposRoutes.js:143](../../backend/src/routes/equiposRoutes.js#L143) | Sesión + EQUIPOS.VIEW | Adaptar |
| PUT | `/api/equipos/cuentadante-principal` | [equiposRoutes.js:151](../../backend/src/routes/equiposRoutes.js#L151) | Sesión + EQUIPOS.UPDATE | Adaptar |
| GET | `/api/equipos/cuentadantes/buscar/:documento` | [equiposRoutes.js:160](../../backend/src/routes/equiposRoutes.js#L160) | Sesión + EQUIPOS.VIEW | Conservar |
| POST | `/api/equipos/autorizacion-movimiento` | [equiposRoutes.js:170](../../backend/src/routes/equiposRoutes.js#L170) | Sesión + EQUIPOS.VIEW / EQUIPOS.UPDATE | Adaptar |
| GET | `/api/equipos/autorizacion-movimiento/autorizador` | [equiposRoutes.js:178](../../backend/src/routes/equiposRoutes.js#L178) | Sesión + EQUIPOS.VIEW / EQUIPOS.UPDATE | Adaptar |
| GET | `/api/equipos/autorizacion-movimiento/pendientes/count` | [equiposRoutes.js:184](../../backend/src/routes/equiposRoutes.js#L184) | Sesión | Adaptar |
| GET | `/api/equipos/autorizacion-movimiento/pendientes` | [equiposRoutes.js:189](../../backend/src/routes/equiposRoutes.js#L189) | Sesión | Adaptar |
| GET | `/api/equipos/autorizacion-movimiento/historial` | [equiposRoutes.js:194](../../backend/src/routes/equiposRoutes.js#L194) | Sesión | Adaptar |
| GET | `/api/equipos/autorizacion-movimiento/mis-solicitudes` | [equiposRoutes.js:199](../../backend/src/routes/equiposRoutes.js#L199) | Sesión | Adaptar |
| GET | `/api/equipos/autorizacion-movimiento/disponibles` | [equiposRoutes.js:204](../../backend/src/routes/equiposRoutes.js#L204) | Sesión + EQUIPOS.VIEW / EQUIPOS.UPDATE | Adaptar |
| PUT | `/api/equipos/autorizacion-movimiento/:id/aprobar` | [equiposRoutes.js:210](../../backend/src/routes/equiposRoutes.js#L210) | Sesión | Adaptar |
| PUT | `/api/equipos/autorizacion-movimiento/:id/rechazar` | [equiposRoutes.js:215](../../backend/src/routes/equiposRoutes.js#L215) | Sesión | Adaptar |
| GET | `/api/equipos/:codigo/historial-verificaciones` | [equiposRoutes.js:223](../../backend/src/routes/equiposRoutes.js#L223) | Sesión + EQUIPOS.VIEW / EQUIPOS.VIEW_OWN | Adaptar |
| GET | `/api/equipos/:codigo/historial-movimientos` | [equiposRoutes.js:233](../../backend/src/routes/equiposRoutes.js#L233) | Sesión + EQUIPOS.VIEW / EQUIPOS.VIEW_OWN | Adaptar |
| GET | `/api/equipos/:codigo` | [equiposRoutes.js:246](../../backend/src/routes/equiposRoutes.js#L246) | Sesión + EQUIPOS.VIEW_DETAIL / EQUIPOS.VIEW_OWN | Adaptar |
| PUT | `/api/equipos/:codigo` | [equiposRoutes.js:256](../../backend/src/routes/equiposRoutes.js#L256) | Sesión + EQUIPOS.UPDATE | Adaptar |
| DELETE | `/api/equipos/:codigo` | [equiposRoutes.js:265](../../backend/src/routes/equiposRoutes.js#L265) | Sesión + EQUIPOS.DELETE | Adaptar |
| POST | `/api/equipos/asignar` | [equiposRoutes.js:275](../../backend/src/routes/equiposRoutes.js#L275) | Sesión + EQUIPOS.ASSIGN / EQUIPOS.ASSIGN_TO_APRENDIZ | Deprecar condicionado |
| PUT | `/api/equipos/asignaciones/:id` | [equiposRoutes.js:288](../../backend/src/routes/equiposRoutes.js#L288) | Sesión + EQUIPOS.ASSIGN / EQUIPOS.ASSIGN_TO_APRENDIZ | Deprecar condicionado |
| DELETE | `/api/equipos/asignaciones/:id` | [equiposRoutes.js:301](../../backend/src/routes/equiposRoutes.js#L301) | Sesión + EQUIPOS.ASSIGN / EQUIPOS.ASSIGN_TO_APRENDIZ | Deprecar condicionado |
| GET | `/api/equipos/verificacion/ambientes` | [equiposRoutes.js:312](../../backend/src/routes/equiposRoutes.js#L312) | Sesión | Adaptar |
| POST | `/api/equipos/verificacion` | [equiposRoutes.js:319](../../backend/src/routes/equiposRoutes.js#L319) | Sesión | Adaptar |
| POST | `/api/equipos/uso/inicio` | [equiposRoutes.js:345](../../backend/src/routes/equiposRoutes.js#L345) | Sesión | Deprecar condicionado |
| POST | `/api/equipos/uso/fin` | [equiposRoutes.js:354](../../backend/src/routes/equiposRoutes.js#L354) | Sesión | Deprecar condicionado |
| GET | `/api/equipos/:codigo/uso/historial` | [equiposRoutes.js:377](../../backend/src/routes/equiposRoutes.js#L377) | Sesión + EQUIPOS.VIEW / EQUIPOS.VIEW_OWN | Adaptar |
| GET | `/api/equipos/uso/informe` | [equiposRoutes.js:390](../../backend/src/routes/equiposRoutes.js#L390) | Sesión + EQUIPOS.VIEW | Adaptar |
| GET | `/api/equipos/uso/activas` | [equiposRoutes.js:397](../../backend/src/routes/equiposRoutes.js#L397) | Sesión + EQUIPOS.VIEW / EQUIPOS.VIEW_OWN | Adaptar |

## horariosRoutes (2)

- Consumidores/evidencia frontend: `frontend/src/Horarios.jsx:216,249` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Clases, Usuarios, Ambientes, nombres de clase según importación.
- Política actual: Sesión + CLASES.CREATE/VIEW. Conservar plantilla/importar; adaptar validación y autorización temporal cuando corresponda.
- Pruebas bajo `backend/tests/`: controllers/horariosController.test.js (ejecutado).
- Notas: Formación/agenda independiente de retiro desktop.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/horarios/importar` | [horariosRoutes.js:17](../../backend/src/routes/horariosRoutes.js#L17) | Sesión + CLASES.CREATE | Conservar |
| GET | `/api/horarios/plantilla` | [horariosRoutes.js:25](../../backend/src/routes/horariosRoutes.js#L25) | Sesión + CLASES.VIEW | Conservar |

## imagenesAmbienteRoutes (6)

- Consumidores/evidencia frontend: `frontend/src/DetalleAmbiente.jsx:102,166,185,196` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Imagenes_Ambiente, Ambientes.
- Política actual: Sesión + AMBIENTES.VIEW/UPDATE. No retirar imágenes por retirar Habilitaciones.
- Pruebas bajo `backend/tests/`: controllers/imagenesAmbienteController.test.js; routes/moreRoutes.test.js (no ejecutados aquí).
- Notas: Conservación estructural; no auditoría exhaustiva de upload ambiente.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/ambientes/:idAmbiente/imagenes` | [imagenesAmbienteRoutes.js:21](../../backend/src/routes/imagenesAmbienteRoutes.js#L21) | Sesión + AMBIENTES.UPDATE | Conservar |
| GET | `/api/ambientes/:idAmbiente/imagenes` | [imagenesAmbienteRoutes.js:30](../../backend/src/routes/imagenesAmbienteRoutes.js#L30) | Sesión + AMBIENTES.VIEW | Conservar |
| GET | `/api/ambientes/imagenes/:idImagen` | [imagenesAmbienteRoutes.js:37](../../backend/src/routes/imagenesAmbienteRoutes.js#L37) | Sesión + AMBIENTES.VIEW | Conservar |
| PUT | `/api/ambientes/imagenes/:idImagen` | [imagenesAmbienteRoutes.js:44](../../backend/src/routes/imagenesAmbienteRoutes.js#L44) | Sesión + AMBIENTES.UPDATE | Conservar |
| PATCH | `/api/ambientes/imagenes/:idImagen/principal` | [imagenesAmbienteRoutes.js:51](../../backend/src/routes/imagenesAmbienteRoutes.js#L51) | Sesión + AMBIENTES.UPDATE | Conservar |
| DELETE | `/api/ambientes/imagenes/:idImagen` | [imagenesAmbienteRoutes.js:58](../../backend/src/routes/imagenesAmbienteRoutes.js#L58) | Sesión + AMBIENTES.UPDATE | Conservar |

## imagenesEquipoRoutes (7)

- Consumidores/evidencia frontend: `frontend/src/DetalleEquipo.jsx:160,504,549,568; useAuthenticatedEvidenceImages.js:17; wrappers de API` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Imagenes_Equipo, Elementos, Responsabilidades_Ambiente, Responsables_Equipo.
- Política actual: Sesión + VIEW/VIEW_OWN o UPDATE, validatorParams y equipmentEvidenceScope. Scope actual permite responsabilidad/asignación activa sin horario; adaptar A4 y permiso de evidencia separado de edición general.
- Pruebas bajo `backend/tests/`: middleware/equipmentEvidenceScope.test.js (ejecutado); controllers/imagenesEquipoController.test.js, routes/imagenesEquipo.resilience.test.js (no ejecutados aquí).
- Notas: Preservar descarga privada de evidencias; no mover a static público.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/equipos/:codigoEquipo/imagenes` | [imagenesEquipoRoutes.js:43](../../backend/src/routes/imagenesEquipoRoutes.js#L43) | Sesión + EQUIPOS.UPDATE | Adaptar |
| GET | `/api/equipos/imagenes/archivo/:filename` | [imagenesEquipoRoutes.js:58](../../backend/src/routes/imagenesEquipoRoutes.js#L58) | Sesión + EQUIPOS.VIEW / EQUIPOS.VIEW_OWN | Adaptar |
| GET | `/api/equipos/:codigoEquipo/imagenes` | [imagenesEquipoRoutes.js:72](../../backend/src/routes/imagenesEquipoRoutes.js#L72) | Sesión + EQUIPOS.VIEW / EQUIPOS.VIEW_OWN | Adaptar |
| GET | `/api/equipos/imagenes/:idImagen` | [imagenesEquipoRoutes.js:87](../../backend/src/routes/imagenesEquipoRoutes.js#L87) | Sesión + EQUIPOS.VIEW / EQUIPOS.VIEW_OWN | Adaptar |
| PUT | `/api/equipos/imagenes/:idImagen` | [imagenesEquipoRoutes.js:102](../../backend/src/routes/imagenesEquipoRoutes.js#L102) | Sesión + EQUIPOS.UPDATE | Adaptar |
| PATCH | `/api/equipos/imagenes/:idImagen/principal` | [imagenesEquipoRoutes.js:114](../../backend/src/routes/imagenesEquipoRoutes.js#L114) | Sesión + EQUIPOS.UPDATE | Adaptar |
| DELETE | `/api/equipos/imagenes/:idImagen` | [imagenesEquipoRoutes.js:126](../../backend/src/routes/imagenesEquipoRoutes.js#L126) | Sesión + EQUIPOS.UPDATE | Adaptar |

## importRoutes (7)

- Consumidores/evidencia frontend: `frontend/src/ImportarEquipos.jsx:197,210; RevisarDuplicados.jsx:28,54,103; ImportarUsuarios.jsx:47; ImportarAprendices.jsx:51; integrados en Equipos/Usuarios/Aprendices` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Elementos, Categorias, Ambientes, Usuarios, Importaciones, Importaciones_Duplicados; Aprendices para importación de apoyo.
- Política actual: Sesión; CREATE para equipos/status, USERS.CREATE para usuarios/aprendices, rol Admin/Cuentadante para duplicados. Adaptar A5: dueño job/duplicado y destino derivado de sesión.
- Pruebas bajo `backend/tests/`: controllers/importController.test.js; routes/importRoutes.test.js (ejecutados).
- Notas: Descarga de plantilla equipos se genera en frontend; no inventar endpoint nuevo de plantilla.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/import/equipos` | [importRoutes.js:37](../../backend/src/routes/importRoutes.js#L37) | Sesión + EQUIPOS.CREATE | Adaptar |
| GET | `/api/import/equipos/status/:job_id` | [importRoutes.js:46](../../backend/src/routes/importRoutes.js#L46) | Sesión + EQUIPOS.CREATE | Adaptar |
| POST | `/api/import/usuarios` | [importRoutes.js:53](../../backend/src/routes/importRoutes.js#L53) | Sesión + USERS.CREATE | Conservar (apoyo) |
| POST | `/api/import/aprendices` | [importRoutes.js:62](../../backend/src/routes/importRoutes.js#L62) | Sesión + USERS.CREATE | Conservar (apoyo) |
| GET | `/api/import/duplicados` | [importRoutes.js:71](../../backend/src/routes/importRoutes.js#L71) | Sesión + Admin/Cuentadante | Adaptar |
| POST | `/api/import/duplicados/procesar` | [importRoutes.js:78](../../backend/src/routes/importRoutes.js#L78) | Sesión + Admin/Cuentadante | Adaptar |
| POST | `/api/import/duplicados/procesar-masivo` | [importRoutes.js:85](../../backend/src/routes/importRoutes.js#L85) | Sesión + Admin/Cuentadante | Adaptar |

## mantenimientoRoutes (9)

- Consumidores/evidencia frontend: `frontend/src/Mantenimientos.jsx:144,159,203,299,341,472,1034,1123; CrearMantenimiento.jsx:61,81,227 sin ruta activa. GET /:id: sin consumidor web de lectura identificado.` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Mantenimiento, Elementos, Estado_Equipo, Responsables_Equipo, Usuarios, Reportes.
- Política actual: Sesión + MANTENIMIENTO por fila. GET catálogos solo sesión. DELETE controlador admin. Scope patrimonial y operaciones de fechas/estado requieren A2.
- Pruebas bajo `backend/tests/`: controllers/mantenimientoController.test.js (ejecutado).
- Notas: Listar/detalle ejecutan actualización automática de estados (efecto lateral de GET); mover a proceso explícito/servicio transaccional en adaptación.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/mantenimiento` | [mantenimientoRoutes.js:14](../../backend/src/routes/mantenimientoRoutes.js#L14) | Sesión + MANTENIMIENTO.CREATE | Adaptar |
| GET | `/api/mantenimiento` | [mantenimientoRoutes.js:23](../../backend/src/routes/mantenimientoRoutes.js#L23) | Sesión + MANTENIMIENTO.VIEW / MANTENIMIENTO.VIEW_OWN | Adaptar |
| GET | `/api/mantenimiento/tipos` | [mantenimientoRoutes.js:32](../../backend/src/routes/mantenimientoRoutes.js#L32) | Sesión | Conservar |
| GET | `/api/mantenimiento/estados` | [mantenimientoRoutes.js:35](../../backend/src/routes/mantenimientoRoutes.js#L35) | Sesión | Conservar |
| GET | `/api/mantenimiento/:id` | [mantenimientoRoutes.js:38](../../backend/src/routes/mantenimientoRoutes.js#L38) | Sesión + MANTENIMIENTO.VIEW / MANTENIMIENTO.VIEW_OWN | Adaptar |
| PUT | `/api/mantenimiento/:id/fecha-proximo` | [mantenimientoRoutes.js:47](../../backend/src/routes/mantenimientoRoutes.js#L47) | Sesión + MANTENIMIENTO.UPDATE | Adaptar |
| PUT | `/api/mantenimiento/:id/fecha-mantenimiento` | [mantenimientoRoutes.js:56](../../backend/src/routes/mantenimientoRoutes.js#L56) | Sesión + MANTENIMIENTO.UPDATE | Adaptar |
| PUT | `/api/mantenimiento/:id/estado` | [mantenimientoRoutes.js:65](../../backend/src/routes/mantenimientoRoutes.js#L65) | Sesión + MANTENIMIENTO.UPDATE | Adaptar |
| DELETE | `/api/mantenimiento/:id` | [mantenimientoRoutes.js:74](../../backend/src/routes/mantenimientoRoutes.js#L74) | Sesión + MANTENIMIENTO.DELETE | Conservar |

## novedadesRoutes (7)

- Consumidores/evidencia frontend: `frontend/src/Novedades.jsx:79,98,213,285,377; helper api.js:363 y VerificarInventario.jsx:211 para PDF. GET /:id: sin fetch detalle identificado, no retirarlo por ello.` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Novedades, Elementos, Estado_Equipo, Responsables_Equipo, Usuarios; notificaciones.
- Política actual: Sesión + NOVEDADES.CREATE/VIEW/VIEW_OWN/RESOLVE según fila. Metadata solo sesión. RESOLVE handler admin; CREATE_OWN Aprendiz no coincide con guarda CREATE de ruta (gap existente, no ampliar en silencio). Adaptar A2/A7.
- Pruebas bajo `backend/tests/`: controllers/novedadesController.test.js (ejecutado).
- Notas: Novedad daño bloquea uso/asignaciones, no elimina patrimonio.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/novedades` | [novedadesRoutes.js:15](../../backend/src/routes/novedadesRoutes.js#L15) | Sesión + NOVEDADES.CREATE | Adaptar |
| GET | `/api/novedades` | [novedadesRoutes.js:27](../../backend/src/routes/novedadesRoutes.js#L27) | Sesión + NOVEDADES.VIEW / NOVEDADES.VIEW_OWN | Adaptar |
| GET | `/api/novedades/tipos` | [novedadesRoutes.js:36](../../backend/src/routes/novedadesRoutes.js#L36) | Sesión | Conservar |
| GET | `/api/novedades/estados` | [novedadesRoutes.js:39](../../backend/src/routes/novedadesRoutes.js#L39) | Sesión | Conservar |
| GET | `/api/novedades/:id/pdf` | [novedadesRoutes.js:42](../../backend/src/routes/novedadesRoutes.js#L42) | Sesión + NOVEDADES.VIEW / NOVEDADES.VIEW_OWN | Adaptar |
| GET | `/api/novedades/:id` | [novedadesRoutes.js:51](../../backend/src/routes/novedadesRoutes.js#L51) | Sesión + NOVEDADES.VIEW / NOVEDADES.VIEW_OWN | Adaptar |
| PUT | `/api/novedades/:id/estado` | [novedadesRoutes.js:60](../../backend/src/routes/novedadesRoutes.js#L60) | Sesión + NOVEDADES.RESOLVE | Conservar |

## reportesRoutes (8)

- Consumidores/evidencia frontend: `frontend/src/Novedades.jsx:413,485,542,572 (CRUD activo); DocumentoEquipos.jsx:88 (PDF equipos); Reportes.jsx usa tipos/pdf pero no está en App; GET /:id sin consumidor web de detalle identificado.` (referencias abreviadas; páginas bajo pages/, utilidades bajo utils/ y componentes bajo components/).
- Tablas/dependencias: Reportes, Elementos, Responsables_Equipo, Responsabilidades_Ambiente, Usuarios, Imagenes_Equipo.
- Política actual: Sesión + REPORTES según fila; tipos solo sesión. UPDATE/DELETE handler admin aunque defaults Cuentadante concedan permiso. PDF equipos comprueba rol Admin/Cuentadante + alcance propio/responsable ambiente.
- Pruebas bajo `backend/tests/`: controllers/reportesController.test.js; routes/reportesRoutes.policy.test.js (ejecutados).
- Notas: Reportes y Novedades son entidades distintas; vista conjunta no autoriza borrar un dominio.

| Método | Ruta completa | Declaración | Guarda en ruta | Propuesta |
|---|---|---|---|---|
| POST | `/api/reportes` | [reportesRoutes.js:32](../../backend/src/routes/reportesRoutes.js#L32) | Sesión + REPORTES.CREATE | Adaptar |
| GET | `/api/reportes` | [reportesRoutes.js:43](../../backend/src/routes/reportesRoutes.js#L43) | Sesión + REPORTES.VIEW | Adaptar |
| GET | `/api/reportes/tipos` | [reportesRoutes.js:50](../../backend/src/routes/reportesRoutes.js#L50) | Sesión | Conservar |
| GET | `/api/reportes/pdf` | [reportesRoutes.js:54](../../backend/src/routes/reportesRoutes.js#L54) | Sesión + REPORTES.EXPORT | Deprecar condicionado |
| GET | `/api/reportes/equipos/pdf` | [reportesRoutes.js:62](../../backend/src/routes/reportesRoutes.js#L62) | Sesión + REPORTES.EXPORT | Adaptar |
| GET | `/api/reportes/:id` | [reportesRoutes.js:70](../../backend/src/routes/reportesRoutes.js#L70) | Sesión + REPORTES.VIEW | Adaptar |
| PUT | `/api/reportes/:id` | [reportesRoutes.js:77](../../backend/src/routes/reportesRoutes.js#L77) | Sesión + REPORTES.UPDATE | Adaptar |
| DELETE | `/api/reportes/:id` | [reportesRoutes.js:86](../../backend/src/routes/reportesRoutes.js#L86) | Sesión + REPORTES.DELETE | Adaptar |

## Exclusiones y limpieza propuesta

`GET /api/equipos/verificacion/historial` y `GET /api/equipos/uso/historial` están comentados: NO son rutas activas de esta matriz. Los helpers/pantallas que los invoquen deben limpiarse o migrar a historias individuales; no reportar eliminación de una API que ya no está montada. Roles/configuración (MDL-237), permisos globales, notificaciones, estadísticas, webhook e invitation-codes no son auditoría exhaustiva de MDL-241. Registro-externo con identidad externa queda condicionado a política específica; no introducir una API key ficticia.

Ningún 'sin consumidor web' certifica ausencia de clientes externos. Tabla SQL y APIs de asignaciones aún son dependencias de uso/clases/VIEW_OWN; deprecar gestión no implica DROP ni DELETE de datos. En imágenes/evidencia preservamos sesión y descarga privada.
