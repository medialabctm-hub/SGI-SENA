# UI-SPEC — Equipos y seguimiento

## Fuente visual

Continuar el sistema actual de `frontend/src/styles`: verdes de éxito/SENA, neutrales, radios y tipografía existentes. No crear un segundo diseño. La maqueta conversada expresa jerarquía y destinos, no colores ni medidas exactas. El catálogo debe ser reconocible respecto de producción.

## Jerarquía

1. Encabezado «Equipos» y acciones globales Registrar/Importar, visibles solo con permiso.
2. Vistas de alcance («Todos los equipos», «Equipos a mi cargo», «Mis ambientes») separadas de filtros; nunca llamarlas «Mis equipos» si significan habilitación.
3. Filtro Ambiente y búsqueda combinables, total y paginador correspondientes al servidor.
4. Fila: una primaria «Ver ficha»; secundarias en «Más acciones» agrupadas por intención, no por color. Editar/eliminar se restringen al Administrador existente.
5. Seguimiento global en sidebar: Equipos prestados, Autorizaciones, Novedades y reportes, Mantenimientos. Ambiente y agenda aparte.

## Estados y respuesta

- Carga en tabla/informe, vacío específico para filtros, error con recuperación sin ocultar el alcance.
- Al salir del menú secundario: Escape devuelve foco a «Más acciones»; clic externo cierra; objetivos mínimo 44 px y foco visible.
- En ≤768 px, filas del catálogo apiladas con etiquetas visibles; editar sigue disponible donde esté permitido. El informe admite desplazamiento horizontal indicado por encabezados, sin ensanchar el documento completo.
- Las rutas `/equipos/asignar` y `/asignaciones` muestran aviso de retiro desde el catálogo; la lectura histórica y controles backend se preservan hasta una migración verificada.

## Validación visual pendiente

Inspeccionar 320/375/768/1280 px, zoom 200%, teclado y lector de pantalla con datos de dos ambientes y estados diferentes. El build no sustituye esa UAT. Comparar contra `develop` y entorno productivo sin afirmar que Railway ejecuta esta rama.
