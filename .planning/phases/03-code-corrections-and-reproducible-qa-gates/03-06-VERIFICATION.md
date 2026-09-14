---
phase: 03-code-corrections-and-reproducible-qa-gates
plan: 06
status: verified-local
---

# 03-06 — Verificación (MDL-13)

## Resultado global: PASS local

La base del worktree fue verificada antes de editar:

- Rama de trabajo: `PR3S1G4zZ/mdl-154-phase3-06-read-scope-parent`.
- Rama padre: `presigadurangoesteban/mdl-154-sgi-auditar-coherencia-entre-estados-y-evidencias-de-cierre`.
- `HEAD` inicial: `c1162db86b66cd43d9e7bd3d70143c86e5ef5b5c` (`c1162db`),
  apuntando a la rama padre.
- Worktree inicial limpio.

## Comandos y resultados

### 1. Dependencias

```text
cd backend && npm ci
```

**PASS** — 699 paquetes instalados. `npm` reportó advertencias de
deprecación y 27 vulnerabilidades del árbol de dependencias; no se ejecutó
`npm audit fix` ni se modificaron manifiestos.

### 2. Ciclo TDD

```text
cd backend && npm test -- --runInBand --forceExit --no-cache tests/controllers/equiposController.test.js
```

La ejecución RED falló inicialmente porque faltaba `backend/node_modules`;
tras `npm ci`, las pruebas nuevas fallaron por la brecha de autorización
(detalle con responsables ajenos, equipo ajeno sin 404 e historiales sin
validación). Después de la implementación, la misma suite quedó **PASS**:

```text
Test Suites: 1 passed, 1 total
Tests:       149 passed, 149 total
```

### 3. Suites focales solicitadas

```text
npm test --prefix backend -- --runInBand --forceExit --no-cache \
  tests/controllers/equiposController.test.js \
  tests/controllers/aprendicesController.test.js \
  tests/controllers/importController.test.js
```

**PASS**:

```text
Test Suites: 3 passed, 3 total
Tests:       228 passed, 228 total
Snapshots:   0 total
```

### 4. Lint focal con cwd correcto

```text
cd backend && npx eslint src/controller/equiposController.js tests/controllers/equiposController.test.js
```

**PASS** — `0 errors, 61 warnings`. Las advertencias son preexistentes en
el controlador y la suite; no se introdujeron errores de lint.

### 5. Espacios/conflictos del diff

```text
git diff --check
```

**PASS** — sin salida.

## Matriz de requisitos

| Requisito | Evidencia | Resultado |
|---|---|---|
| Aprendiz propio puede leer detalle, verificaciones y movimientos | Casos `allows an Aprendiz...` en los tres bloques | PASS |
| Equipo ajeno no se enumera | Casos `fails closed... another Aprendiz equipo` y ausencia de consultas de historial | PASS |
| Identidad ausente/inválida falla cerrado | Casos parametrizados para `0`, `-1`, cadena inválida y `undefined` | PASS |
| Responsables ajenos no se exponen | `hides other responsables` | PASS |
| Admin/Instructor/Cuentadante conservan visibilidad | Casos parametrizados `preserves broad...` en cada endpoint | PASS |
| Filtros/contratos existentes | Pruebas previas de detalle, historial de uso y suite completa focal | PASS |

## Límites

No se ejecutaron MySQL real, Railway, staging, CI remoto, navegador,
credenciales productivas ni UAT físico. No se hicieron commits previos,
push, Linear updates, despliegues ni cambios en aulas/evidencias físicas.
