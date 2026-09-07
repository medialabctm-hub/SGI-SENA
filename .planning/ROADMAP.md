# Roadmap: SGI-SENA — closure hardening

## Overview

Esta hoja de ruta organiza la segunda tanda de trabajo que se incorporará a la PR #29. La fase es deliberadamente pequeña y paralelizable: dos controles de seguridad independientes y un contrato de despliegue.

## Phases

- [x] **Phase 1: Security and Railway hardening wave** — cerrar MDL-127, MDL-131 y MDL-134 con evidencia local reproducible.

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

## Progress

| Phase | Plans | Status | Notes |
|---|---:|---|---|
| 1 | 3/3 | Complete | Tres commits integrados en el coordinador; Linear y PR #29 quedan en revisión |
