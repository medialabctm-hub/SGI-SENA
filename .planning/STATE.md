---
gsd_state_version: '1.0'
milestone: 'Inventory harmony wave (MDL-236)'
milestone_status: in_progress
current_phase: 4
current_phase_name: Inventory navigation and catalog
current_plan: 04-02
status: in_progress
stopped_at: null
last_updated: '2026-09-28'
progress:
  phases_completed: 2
  phases_total: 9
  plans_completed: 10
  plans_total: 16
  requirements_completed: 3
  requirements_total: 3
  percent: 22
---

# State

## Current focus — MDL-236

Tanda de diseño MDL-238/239/240 implementada en `codex/sgi-diseno-uat` sobre `35ebfba` (PR3S1G4zZ/Encuentro). Evidencia local: 123 Vitest, 22 utilidades y 22 comprobaciones de navegador PASS; build PASS, lint focal 0 errores/15 advertencias. Ver `phases/04-inventory-navigation/04-02-SUMMARY.md`. Pendiente decisión de publicación y UAT remoto/manual; MDL-237/241 no implementados. No se modificó producción.

2026-09-28: publicación autorizada por el usuario y completada en PR #55, https://github.com/medialabctm-hub/SGI-SENA/pull/55, borrador hacia `PR3S1G4zZ/Encuentro`. Código `d95edb6`: Vitest 123/123, utilidades 22/22 y build repetidos antes del push. La consulta GSD de verificación de fase devuelve `missing`; no se declara ship formal, merge, CI aprobado ni despliegue Railway. Pendientes UAT y aceptación. El párrafo anterior describe la evidencia y decisión previa a publicar.

Fases 04/05/08 en trabajo desde `develop` en worktree aislado; no se ha desplegado. La retirada de UI de Habilitaciones no equivale a desactivar los endpoints históricos: `Responsables_Equipo` aún es dependencia de permisos. Antes de cerrar, completar cronología, ambientes/horarios, validación SQL real, navegación por rol y responsive. La sección histórica siguiente corresponde al ciclo anterior.

## Current Focus

Phase 3 verificada localmente sobre el HEAD actual de la PR #29. Los seis
planes se integraron desde worktrees Orca hijos; las evidencias físicas de aulas
303/304 y los gates de Railway/staging/UAT permanecen fuera del trabajo del
coordinador.

## Decisions

- La fase se mantiene como un paquete GSD acotado porque el repositorio ya tenía mapas `.planning/codebase/`, pero no un `PROJECT/ROADMAP/STATE` operativo para esta tanda.
- Los planes son independientes y se ejecutan en una sola wave; la integración y la verificación final permanecen bajo coordinación del worktree de la PR.
- La revisión de metadata de Linear se ejecutará después de completar la tanda, incluyendo los issues de la primera tanda que ya están adjuntos a la misma PR.
- Las seis issues de las dos tandas usan el proyecto `SGI – Evidencias y Cierre`, un padre de cierre coherente y etiquetas de dominio más `Improvement`; todas pasan a `In Review` con un comentario de cierre y un attachment a la PR #29.
- En la fase 3 cada worker Orca fue de profundidad 1 y recibió la prohibición explícita de delegar subagentes, crear otra Run o escribir en Linear.
- El estado `verified_local_external_gates_pending` no autoriza promover MDL-154 ni sus issues dependientes a Done/In Review sin evidencia externa.

## Verification

- Phase 3: backend completo 97/98 suites PASS con 1 skipped y 2.011 tests PASS; frontend completo 33/33; Playwright público 3/3; MySQL 8 real 7/7; lint backend/frontend con 0 errores; build y Compose config PASS.
- MDL-13: `obtenerHistorialEquipoUso`, detalle, verificaciones y movimientos restringen al Aprendiz por identidad y vínculo activo; detalle oculta responsables ajenos y roles amplios conservan acceso; 36 pruebas nuevas de MDL-13 y 228/228 pruebas focales PASS.
- MDL-127: cookies/auth backend 69/69, frontend focalizado 17/17, build PASS y escaneo sin residuos funcionales de JWT en storage/header.
- MDL-131 y MDL-134: 10 suites backend, 170 tests PASS; shell/config y diff checks PASS.
- Linear: MDL-125/128/127/131 cuelgan de MDL-15; MDL-129/134 cuelgan de MDL-9; las seis tienen etiquetas, comentario de evidencia y una referencia a la PR #29.
- Gaps: Railway, staging, CI remoto, E2E autenticado, UAT visual/físico y la política pendiente de `registro-externo`; no se ejecutaron las evidencias físicas 303/304.

## Blockers

No hay bloqueadores de código para integrar. Permanecen como validación humana
pendiente: despliegue Railway/staging, CI remoto, credenciales autorizadas,
E2E autenticado, decisión de identidad/capability/cuota para `registro-externo`
y evidencias físicas de aulas 303/304.

## Session Continuity

- PR abierta: #29.
- Base de los worktrees: `feature/autoservicio-atomico-migracion-y-railway-reproducible`.
- No agregar `package-lock.json` ni alterar mapas GSD existentes fuera de esta fase.
- PR #29 continúa abierta para la revisión y decisión humana de merge.
- Orca Run: `run_f09fcad6d980`; los commits de fase integrados en este padre terminan en `ec2e995` (03-06 child `7f4a45b`, dispatch `ctx_77ef876d7673`).

## Accumulated Context

### Roadmap Evolution

- Phase 3 added: Code corrections and reproducible QA gates
