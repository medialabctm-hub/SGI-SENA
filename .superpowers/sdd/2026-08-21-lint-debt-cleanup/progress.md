# Progreso: limpieza de deuda del gate de lint (PR #20)

Plan completo en la conversación de Claude Code del 2026-08-21. Objetivo: dejar `npm run
lint` en verde en `backend/` y `frontend/`, y eliminar código muerto real detectado.

Branch: `fix/sgi-preview-five-issues` (PR #20). Cada tarea completada se commitea y se
pushea a este branch.

## Estado por bloque

- [x] **Bloque 1 (P0)** — Config de ESLint (claves duplicadas, globals.jest, convención
      @jest/globals, ignoreRestSiblings). Bloqueante para 2, 3, 4. **Completado y verificado.**
- [ ] **Bloque 2 (P1)** — Bugs reales: hasOwnProperty, shadowing, promise-executor-return,
      self-assignment en ConsultarEquipo.jsx:600.
- [ ] **Bloque 3 (P2a)** — Código muerto en `backend/src/` (9+8 archivos).
- [ ] **Bloque 4 (P2b)** — Código muerto en `frontend/src/` (32 archivos, 3 agentes).
- [ ] **Bloque 5 (P3)** — Housekeeping (zod_test.mjs, eslint --fix, localDate.js).

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
