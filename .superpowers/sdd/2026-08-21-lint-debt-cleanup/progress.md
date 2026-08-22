# Progreso: limpieza de deuda del gate de lint (PR #20)

Plan completo en la conversación de Claude Code del 2026-08-21. Objetivo: dejar `npm run
lint` en verde en `backend/` y `frontend/`, y eliminar código muerto real detectado.

Branch: `fix/sgi-preview-five-issues` (PR #20). Cada tarea completada se commitea y se
pushea a este branch.

## Estado por bloque

- [x] **Bloque 1 (P0)** — Config de ESLint (claves duplicadas, globals.jest, convención
      @jest/globals, ignoreRestSiblings). Bloqueante para 2, 3, 4. **Completado y verificado.**
- [x] **Bloque 2 (P1)** — Bugs reales: hasOwnProperty, shadowing, promise-executor-return,
      self-assignment en ConsultarEquipo.jsx:600. **Completado y verificado.**
- [x] **Bloque 3 (P2a)** — Código muerto en `backend/src/` (16 archivos). **Completado y
      verificado.**
- [x] **Bloque 4 (P2b)** — Código muerto en `frontend/src/` (25 archivos tras exclusiones,
      3 agentes: A, B, C). **Completado y verificado.**
- [x] **Bloque 5 (P3)** — Housekeeping. zod_test.mjs borrado, BOM/autofixes en 8 archivos
      backend aplicados. **Pendiente:** decisión sobre `frontend/src/utils/localDate.js`
      (usado por Horarios.jsx/AsignarAmbientes.jsx, que tienen cambios ajenos en curso —
      no lo agregué al commit para no mezclarlo con ese trabajo).

## Resultado final (verificado de forma independiente, no solo por los agentes)

| | Línea base | Final |
|---|---|---|
| Backend lint | 2575 (2364 err / 211 warn) | **431 (64 err / 367 warn)** |
| Frontend lint | 180 (136 err / 44 warn) | **103 (2 err / 101 warn)** |
| Backend tests | — | 85/85 suites, 1848/1848 tests ✅ |
| Frontend tests | — | 5/5 archivos, 18/18 tests ✅ |

Backend: -83% errores (2364→64). Frontend: -98.5% errores (136→2). Ningún test roto en
todo el proceso. Los errores/warnings restantes son deuda real fuera del alcance de este
plan (no-await-in-loop, dot-notation, prefer-destructuring, react-hooks/exhaustive-deps,
etc.) — ninguno relacionado con la config del lint ni con código muerto ya identificado.

## Commits de esta sesión (todos en `fix/sgi-preview-five-issues`, ya pusheados)

1. `fix(lint): corregir configuración de eslint duplicada y globals de jest`
2. `docs: record lint-debt Bloque 1 verification`
3. `fix(frontend): eliminar auto-asignación y código muerto en ConsultarEquipo`
4. `chore: eliminar script de scratch y aplicar autofixes de lint`
5. `fix(backend): corregir hasOwnProperty inseguro, shadowing y promise executors`
6. `chore(backend): eliminar código muerto en controllers, routes y services`
7. `chore(frontend): eliminar código muerto en Sidebar, Dashboard, Config, Mantenimientos y otros`
8. `chore(frontend): eliminar código muerto en Perfil, Register e historiales`
9. `chore(frontend): eliminar código muerto en 15 archivos de páginas y componentes`

## Pendiente para la siguiente sesión

1. **Decisión sobre `frontend/src/utils/localDate.js`** — archivo nuevo, ya usado por
   `Horarios.jsx` y `AsignarAmbientes.jsx`, solo falta `git add`. No incluido en ningún
   commit de esta sesión porque esos dos archivos tienen cambios ajenos en curso.
2. **Código muerto real sin limpiar** en los archivos excluidos (ver sección de ajuste al
   plan arriba): `sqlQueries.js`, `Header.jsx`, `Ambientes.jsx`, `Horarios.jsx`, `Login.jsx`,
   `AsignarAmbientes.jsx`, `ErrorBoundary.jsx`, `DetalleEquipo.jsx`. Requiere revisar primero
   qué pasó con el trabajo en curso en esos archivos (¿se terminó? ¿se commiteó?) antes de
   tocarlos.
3. **Deuda de lint restante fuera de alcance** (431 backend / 103 frontend, casi toda
   warning): `no-await-in-loop`, `dot-notation`, `prefer-destructuring`,
   `react-hooks/exhaustive-deps`, `no-plusplus`, etc. Ninguna es config rota ni código
   muerto — es estilo/deuda técnica genuina que requeriría su propia revisión caso a caso.
4. El PR #20 sigue en draft; esta limpieza no cambia el alcance funcional de las 5 issues
   que el PR resuelve, solo la salud del gate de lint.

## Commit adicional (post-checkpoint): cierre de restos del intento previo de lint

10. `chore: completar arreglos pendientes del intento previo de fix de lint` —
    `backend/jest.config.js` (resetModules + setupFiles, verificado tests/setUpEnv.js
    existe) y `frontend/package.json` (mismo fix de `--ext` ya aplicado en backend).
    Suite completa backend re-verificada: 85/85 suites, 1848/1848 tests. `frontend/package.json`
    sigue apareciendo como "modified" en `git status` tras el commit por una diferencia
    pura de fin de línea (CRLF/LF, `core.autocrlf=true` en esta máquina) — confirmado con
    `git diff --ignore-space-at-eol` (0 líneas) que no hay ninguna diferencia de contenido
    real. No requiere acción.

## Ajuste al plan original (descubierto durante la ejecución)

El plan original no cruzó las listas de "código muerto a limpiar" contra los archivos que
YA tenían cambios sin commitear de trabajo ajeno en curso (visible en `git status` al
iniciar la sesión). Se excluyeron adicionalmente de la limpieza automática, por la misma
razón que `DetalleEquipo.jsx`:
- Backend: `backend/src/utils/sqlQueries.js` (se retiró de la lista del Bloque 3).
- Frontend: `Header.jsx`, `Ambientes.jsx`, `Horarios.jsx`, `Login.jsx`,
  `AsignarAmbientes.jsx`, `ErrorBoundary.jsx` (se retiraron de las listas del Bloque 4 y
  los grupos se re-balancearon).

Estos archivos siguen teniendo código muerto real sin limpiar (quedó documentado en el
diagnóstico original de la conversación), pero limpiarlos automáticamente mientras tienen
cambios ajenos en curso era demasiado riesgoso. Pendiente para una pasada manual futura.

## Excluido deliberadamente de este trabajo

- `frontend/src/pages/DetalleEquipo.jsx` — tiene cambios sin commitear en curso
  (`useAuthenticatedEvidenceImages`, parte del propio PR #20 / MDL-80). No tocar.

## Línea base (antes de cualquier cambio)

- Backend: 2575 problemas (2364 errores, 211 warnings).
- Frontend: 180 problemas (136 errores, 44 warnings).
- Causa raíz: `no-dupe-keys` en ambos `eslint.config.js` (7 en backend, 4 en frontend)
  anula el intento previo de bajar reglas a `warn`. 1969/2364 errores del backend son
  `no-undef` por falta de `globals.jest`.

## Log

### Bloque 1 (P0) — completado

Cambios: consolidadas las 7 (backend) + 4 (frontend) claves duplicadas en `rules` de
ambos `eslint.config.js` (una sola definición por regla, en `'warn'`, conservando las
opciones del bloque Airbnb viejo). Añadido bloque de config para `tests/**` con
`globals.jest` en backend. Añadido `ignoreRestSiblings: true` a `no-unused-vars` backend
para el patrón de destructuring en tests de validadores.

Convención `@jest/globals`: se midió que 84 de 87 archivos de test del backend ya usan
import explícito (mayoría abrumadora, no minoría como se estimó al diagnosticar) → se
agregó `@jest/globals` a `devDependencies` de `backend/package.json` (en vez de retirar
los imports) y se sincronizó `package-lock.json`.

**Resultado verificado (por el agente y re-confirmado de forma independiente):**

| | Antes | Después |
|---|---|---|
| Backend lint | 2575 (2364 err / 211 warn) | 501 (86 err / 415 warn) |
| Frontend lint | 180 (136 err / 44 warn) | 176 (3 err / 173 warn) |

- `no-dupe-keys` = 0 en ambos config (verificado con `eslint eslint.config.js`, exit 0).
- Backend `no-undef`: ~1969 → 1 residual real (no relacionado con Jest).
- Backend `import/no-extraneous-dependencies` de `@jest/globals`: 84 → 0.
- Tests backend (Jest): 85/85 suites, 1848/1848 tests — coincide con la línea base
  documentada en el PR #20. Sin regresiones.
- Tests frontend (Vitest): 5/5 archivos, 18/18 tests — coincide con la línea base del PR.
  Sin regresiones.

Archivos tocados: `backend/eslint.config.js`, `frontend/eslint.config.js`,
`backend/package.json`, `backend/package-lock.json`.

Los 86 errores backend / 3 errores frontend restantes son código real (no config) —
corresponden a los Bloques 2-4.
