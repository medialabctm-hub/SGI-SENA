# Roadmap: SGI-SENA — closure hardening

## Overview

Esta hoja de ruta organiza la segunda tanda de trabajo que se incorporará a la PR #29. La fase es deliberadamente pequeña y paralelizable: dos controles de seguridad independientes y un contrato de despliegue.

## Phases

- [x] **Phase 1: Security and Railway hardening wave** — cerrar MDL-127, MDL-131 y MDL-134 con evidencia local reproducible.
- [x] **Phase 2: Follow-up security wave** — implementar MDL-132 y MDL-133 con brechas externas explícitas.
- [x] **Phase 3: Code corrections and reproducible QA gates** — corregir fallos reproducibles de código y ampliar los gates locales sin afirmar UAT físico o de despliegue; verificada localmente con brechas externas.

## Phase Details

### Phase 1: Security and Railway hardening wave

**Goal:** reducir exposición de credenciales y abuso en endpoints públicos, y hacer reproducible el contrato de puertos de Railway sin romper el flujo de cierre.

**Depends on:** HEAD de la PR #29 (`feature/autoservicio-atomico-migracion-y-railway-reproducible`).

**Requirements:** MDL-127, MDL-131, MDL-134.

**Success criteria:** cada issue tiene un commit revisable, pruebas focalizadas o un bloqueo explícito con evidencia; los tres cambios se integran sin contaminar archivos ajenos; Linear queda con proyecto, etiquetas, estado y padre coherentes.

**Plans:** 3 plans in 1 wave.

Plans:

- [x] 01-01 — MDL-127: migración de JWT a cookies `httpOnly`.
- [x] 01-02 — MDL-131: rate limit y consumo atómico de códigos de invitación.
- [x] 01-03 — MDL-134: contrato de `PORT` en Railway y revisión de idempotencia.

### Phase 2: Follow-up security wave

**Goal:** restringir uploads privados y alinear el contrato JWT/login-placa, conservando las URLs y respuestas existentes cuando no contradigan la política de seguridad.

**Depends on:** Phase 1.

**Requirements:** MDL-132, MDL-133.

**Success criteria:** las pruebas focalizadas pasan; los handlers autenticados, validaciones y contratos JWT quedan documentados; MySQL, Docker, Railway, CI, navegador, staging y UAT permanecen separados como gates externos no ejecutados.

**Plans:** 1 plan in 1 wave.

Plans:

- [x] 02-01 — MDL-133/MDL-132: uploads privados y contrato JWT/login-placa.

## Progress

| Phase | Plans | Status | Notes |
|---|---:|---|---|
| 1 | 3/3 | Complete | Tres commits integrados; las seis issues asociadas a PR #29 tienen metadata normalizada, comentarios de evidencia y estado `In Review` |
| 2 | 1/1 | Complete with external gaps | MDL-132/MDL-133 tienen implementación y verificación local; faltan despliegue, navegador, staging/UAT y symlink real |
| 3 | 4/4 | Verified locally with external gaps | Correcciones integradas desde cuatro worktrees Orca hijos; backend/frontend/E2E/MySQL local PASS; Railway, staging, CI, UAT autenticado y aulas 303/304 siguen HUMAN/BLOCKED |

### Phase 3: Code corrections and reproducible QA gates

**Goal:** corregir fallos reproducibles de código y dejar evidencia local
repetible para MDL-11, MDL-14, MDL-15, MDL-73, MDL-126, MDL-129, MDL-130,
MDL-135 y MDL-138, sin declarar satisfechos los gates de despliegue o de
presencia física.

**Depends on:** Phase 2.

**Plans:** 4 plans in 1 wave.

Plans:

- [x] 03-01 — MDL-138/MDL-73: runner MySQL con readiness real y SQL correcto en Compose.
- [x] 03-02 — MDL-130/MDL-129: readiness fail-closed y DDL fuera del request path.
- [x] 03-03 — MDL-126/MDL-15: límites independientes de autoservicio sin identidad inventada.
- [x] 03-04 — MDL-11/MDL-14/MDL-135: Excel seguro, smoke y contratos E2E públicos.
