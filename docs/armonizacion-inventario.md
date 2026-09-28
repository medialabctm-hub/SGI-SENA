# MDL-236: armonización de inventario, ambientes y trazabilidad

Base: `develop` en `b50d06a`, verificada contra GitHub el 2026-09-26. La rama experimental de Claude es solo referencia; sus commits no forman parte de esta implementación.

## Entrega de vista previa (2026-09-28)

PR de avance hacia `PR3S1G4zZ/Encuentro`, para que el usuario revise la interfaz en su entorno Railway «Pruebas de seguridad». Este avance no declara completo el hito ni modifica la configuración de Railway.

Implementado: agrupación del sidebar; catálogo con «Equipos a mi cargo» y filtro por ambiente; acciones contextuales; enlaces antiguos compatibles; acceso al informe PDF de préstamos; enlaces entre ficha de ambiente y agenda. La API antigua de Habilitaciones y su tabla se conservan por sus dependencias compartidas.

Pendiente: cronología integral, revisión autenticada responsive, integración con MySQL, retiro controlado de API de Habilitaciones y reglas nuevas de escritura. El código residual de los modales de habilitación en DetalleEquipo también queda pendiente de limpieza; no tiene botones visibles de apertura.

Reglas acordadas para una siguiente implementación (no aplicadas en este avance):

- Instructor: acciones sobre los equipos de su aula durante su horario autorizado.
- Cuentadante: acciones sobre su inventario patrimonial, aunque abarque varios ambientes; si actúa como instructor, aplica el contexto de formación.
- Ambos: cambios de estado, registro de daños, deshabilitar uso y solicitar cambio de ambiente; no edición general de placa, modelo, valor o titularidad, ni traslado directo.
- Administrador: gestión de datos generales según permisos administrativos.
- Deshabilitar uso por daño no elimina el equipo ni su historia y no equivale a la Habilitación antigua de escritorio. Falta confirmar el tratamiento de un préstamo abierto al deshabilitar el equipo.

La auditoría estática detectó en la API heredada la conversión de horarios omitidos a NULL al actualizar y la omisión de aprendices sin cuenta en el listado de habilitaciones. Son observaciones pendientes, no correcciones incluidas en este PR. Los límites por equipo/ambiente/horario requieren validación en backend antes de dar por implementado el nuevo contrato.

## Objetivo

El usuario encuentra cada equipo o ambiente desde una entrada clara, consulta su estado e inicia acciones permitidas en su contexto. El sidebar lleva a inventario y seguimiento. Catálogo y fichas concentran las acciones de un equipo o ambiente. Se conserva la importación, la autorización de movimiento, los préstamos, los permisos y la historia registrada. No se despliega ni se altera producción.

## Modelo de datos y nombres

| Vista/concepto | Fuente | Regla |
|---|---|---|
| Equipos a mi cargo | `Elementos.id_cuentadante` | Solo equipos del cuentadante conectado. Ambiente es filtro dentro de ese conjunto. |
| Mis ambientes | responsabilidad de ambiente | Equipos ubicados allí; no equivale a responsabilidad patrimonial. |
| Todos los equipos | `GET /api/equipos` | Todos los equipos autorizados al rol, no inventario irrestricto. |
| Préstamos y uso | `Historial_Uso_Equipos` | Una fila por sesión abierta o cerrada. |
| Habilitación antigua | `Responsables_Equipo` | No acredita uso físico ni responsabilidad del cuentadante. Se retira su gestión de escritorio; se preservan historia y controles de acceso que aún la usan. |

La plantilla conserva sus columnas actuales: `placa, tipo, categoria, modelo, consecutivo, descripcion, fecha_adquisicion, valor_ingreso, r_centro, atributos, ambiente, url_imagen`. El administrador selecciona al cuentadante fuera del archivo mediante documento. El cuentadante importador queda a cargo de sus propios equipos. La vista «Equipos a mi cargo» usa la misma relación registrada por importación.

## Navegación

| Ruta anterior | Destino |
|---|---|
| `/equipos/consultar` | Catálogo Equipos, entrada principal del inventario. |
| `/equipos` | Registrar equipo o Importar plantilla desde Equipos; enlace viejo conserva su propósito. |
| `/mis-equipos` | Equipos → «Equipos a mi cargo» para cuentadante, sin mezclar habilitaciones. |
| `/equipos/verificar` | Acción desde equipo/ambiente; el flujo por lote conserva ruta y permisos. |
| `/equipos/asignar`, `/asignaciones` | Habilitaciones retiradas; enlace viejo lleva a Equipos con explicación. |
| `/equipos/prestados` | Seguimiento independiente, historial e informe de préstamos. |
| `/equipos/autorizaciones` | Pendientes e historial; solicitud contextual desde equipo. |
| `/novedades`, `/reportes` | Seguimiento global; creación contextual con equipo precargado y creación general cuando no hay equipo. |
| `/mantenimientos` | Seguimiento global; alta contextual desde equipo. |
| `/ambientes`, `/horarios` | Sección Ambientes y horarios; ficha por ambiente y agenda global. |
| Historiales por código | Cronología de la ficha filtrada por tipo, tras verificar reemplazo. |

Sidebar propuesto: Inicio; Inventario → Equipos, Equipos prestados, Autorizaciones, Novedades y reportes, Mantenimientos; Ambientes y horarios → Ambientes, Agenda; Configuración. Las entradas se muestran por rol. Buscar cuentadante pasa a acción administrativa desde Equipos. No se fija un número arbitrario de entradas si un pendiente global exige acceso visible.

## Catálogo y fichas

Pestañas de Equipos: «Todos los equipos», «Equipos a mi cargo» y «Mis ambientes», según rol. Búsqueda y filtro Ambiente se combinan con placa, tipo, modelo, estado, verificación y préstamo. El servidor aplica alcance y filtros antes de contar y paginar; exportación y detalle respetan el mismo alcance. La vista a cargo conserva los datos de responsabilidad pertinentes. Cada fila muestra «Ver ficha» y un menú «Más» con acciones permitidas. En móvil se presentan tarjetas resumidas, sin depender de una tabla ancha.

La ficha de equipo muestra Resumen, Historial, Responsables y préstamos, Novedades y mantenimiento, e Imágenes. Abre, según rol y estado: verificar, mover o pedir autorización, registrar novedad, reporte asociado, mantenimiento, uso/devolución, editar/eliminar. El formulario recibe ID interno validado, muestra placa y vuelve a la ficha después de guardar. El sidebar de seguimiento abre estado/historial por defecto.

La ficha de ambiente muestra datos, responsables, equipos, horarios y clases del `id_ambiente`. Crear/editar/asignar ambiente u horario son acciones contextuales según permisos. La agenda global permanece en la sección. No se inicia ni finaliza una clase automáticamente. Los contadores publican denominadores consistentes con los elementos incluidos.

## Historial e informe

La cronología agrega verificaciones, movimientos, cambios de responsabilidad disponibles, sesiones de uso, autorizaciones, novedades, reportes y mantenimiento. Cada evento tiene clave `tipo + id_fuente`, instante en `America/Bogota`, estado, actor permitido y enlace autorizado. Orden determinista, filtros por tipo/rango y paginación sobre el alcance del servidor. Eventos vinculados aparecen una vez con referencias relacionadas. Nunca se inventan actor o fecha faltantes.

Equipos prestados ofrece vista previa de sesiones abiertas y cerradas y botón «Generar documento» PDF. Filtros: fechas, ambiente, equipo, estado y, para administrador, cuentadante. Cada fila del informe es una sesión real: equipo, ubicación, responsable institucional, usuario permitido, inicio, fin o «En uso», duración válida y referencia. Sesiones anormalmente largas se marcan para revisión sin cerrarse. La exportación comparte filtros y alcance con la vista y no expone documentos completos innecesarios. La asignación de responsabilidad no se cuenta como préstamo.

## UI, seguridad y validación

Reutilizar tokens, tipografía, espaciados y componentes existentes. Menús y modales con nombre accesible, foco visible, teclado, cierre con Escape y devolución de foco. Verificar 320/375/768/1280 px y zoom 200%; mostrar carga, vacío y error. El backend valida identidad, rol, equipo y ambiente en consulta, escritura y exportación. La verificación vigente conserva el historial manual más reciente con fallback legado y las autorizaciones no permiten placas no verificadas.

Fases GSD: 04 navegación y catálogo; 05 ficha y acciones; 06 historial; 07 ambientes y horarios; 08 préstamos e informe; 09 retiro de Habilitaciones, compatibilidad y revisión. Cada fase deja pruebas focales. Al final: suites frontend/backend, lint, build, rutas viejas, roles y denegación directa, datos sintéticos con dos ambientes, préstamos abiertos/cerrados/externos, eventos vinculados y horarios sin mezcla. Evidencia local se separa de Railway, datos reales y UAT físico.
