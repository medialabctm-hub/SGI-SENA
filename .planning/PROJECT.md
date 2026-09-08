# SGI-SENA — Cierre y hardening

## What This Is

SGI-SENA es el sistema de gestión de inventario y préstamo de equipos para los ambientes de MediaLab. Esta fase de cierre endurece autenticación, flujos públicos sensibles y el contrato de despliegue en Railway sobre la base que ya está integrada en la PR #29.

## Core Value

Los flujos de inventario y préstamo deben permanecer seguros, trazables y reproducibles tanto en desarrollo como en el despliegue objetivo.

## Current Scope

- **MDL-127** — migrar el JWT expuesto en `localStorage` a cookies `httpOnly`, con sesión corta/renovable y guardas coherentes.
- **MDL-131** — limitar abuso y eliminar la condición de carrera en códigos de invitación públicos.
- **MDL-134** — preservar el `PORT` de Railway, declarar puertos internos explícitos y dejar documentado el contrato de arranque.

## Out of Scope

- MDL-126, MDL-130, MDL-132 y MDL-133 quedan fuera de esta tanda por solapamiento con el cierre anterior o por requerir una intervención arquitectónica mayor.
- No se declara UAT real contra producción, rotación de credenciales ni ejecución de servicios externos si no existe evidencia local reproducible.
- El `package-lock.json` no forma parte de esta fase y no debe ser agregado.

## Constraints and Decisions

- La PR #29 permanece abierta; los tres worktrees parten de su HEAD actual para facilitar la integración posterior.
- Cada issue tiene un plan GSD independiente y un commit atómico en su worktree.
- Los cambios deben preservar los contratos públicos existentes salvo donde el criterio de aceptación exige explícitamente endurecerlos.
- Los workers deben reportar `BLOCKED` si una aceptación requiere una decisión de arquitectura o infraestructura que no pueda resolverse de forma segura con la evidencia disponible.
- La jerarquía prevista para la revisión final es MDL-15 para los hallazgos de seguridad (MDL-127 y MDL-131) y MDL-9 para despliegue/release (MDL-134). La revisión final confirmará esa convención frente a las issues existentes.

## Planning Baseline

Los mapas existentes en `.planning/codebase/` son la base técnica del repositorio. Este paquete añade una fase GSD acotada para la segunda tanda de trabajo sobre PR #29; no reemplaza ni reescribe el historial de esos mapas.

