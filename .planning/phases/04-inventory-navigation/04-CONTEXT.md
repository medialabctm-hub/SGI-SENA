# Fase 04 — Navegación y catálogo de Equipos

Fecha: 2026-09-26. Base: `develop@b50d06a`. Issue: MDL-236. Especificación: `docs/armonizacion-inventario.md`.

## Alcance acordado

- Sidebar de consulta/seguimiento; Equipos es entrada principal. Habilitaciones no se ofrece como acción.
- Vistas del catálogo según rol: todos los equipos autorizados, equipos a cargo del cuentadante (`Elementos.id_cuentadante`) y mis ambientes.
- Búsqueda y filtro Ambiente se combinan dentro de cada vista, en servidor y antes del total/paginación. Exportación usa idénticos filtros.
- Acciones Registrar e Importar desde Equipos; ruta de alta existente sigue sirviendo al flujo.
- Responsive y accesibilidad conforme a tokens actuales. Menú de acciones por fila se desarrollará en fase 05.

## Invariantes

- `Responsables_Equipo` no es el conjunto «Equipos a mi cargo» del cuentadante.
- `Historial_Uso_Equipos` representa préstamo/uso; ninguna asignación se cuenta como sesión.
- Alumno/Instructor/Cuentadante no obtiene filas globales por cambiar una pestaña o modificar parámetros.
- Filtro Ambiente explícito se intersecta con alcance permitido, incluidos los casos sin intersección.
- Verificación y autorización existentes mantienen la regla de estado manual más reciente y la explicación de placas no verificadas.

## Evidencia y límites

El worktree de Claude se inspeccionó solo como diagnóstico; no se incorporarán sus commits. La instancia local aún no prueba Railway ni datos reales. El historial integral, ambientes/horarios e informe de préstamos continúan en fases 06–08.
