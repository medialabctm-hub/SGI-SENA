# Requirements: SGI-SENA — hardening wave

Defined: 2026-09-07
Source: Linear issues MDL-127, MDL-131 and MDL-134.

## v1 Requirements

### Authentication

- [ ] **MDL-127**: El navegador no debe guardar JWT de autenticación en `localStorage` ni `sessionStorage`; la sesión debe viajar mediante cookies `httpOnly` con atributos seguros y el frontend debe enviar credenciales de forma consistente.

### Invitation abuse and concurrency

- [ ] **MDL-131**: El endpoint público de validación de códigos de invitación debe tener rate limit y el consumo debe ser atómico/serializado para impedir sobreuso bajo concurrencia; la generación debe conservar entropía suficiente.

### Railway deployment contract

- [ ] **MDL-134**: El arranque debe respetar el `PORT` proporcionado por Railway, usar variables internas explícitas para Nginx/backend y documentar el contrato sin introducir una regresión en la finalización de clases.

## Out of Scope

- MDL-126, MDL-130, MDL-132 y MDL-133 no se incluyen en esta fase.
- UAT real de Railway, navegador, servicios nativos o credenciales productivas no se considera satisfecho por pruebas estáticas/locales.

## Traceability

| Requirement | Phase / Plan | Status | Evidence target |
|---|---|---|---|
| MDL-127 | Phase 1 / 01-01 | Pending | Focused auth tests, storage scan and cookie contract review |
| MDL-131 | Phase 1 / 01-02 | Pending | Route/service tests including rate-limit and concurrent-consume behavior |
| MDL-134 | Phase 1 / 01-03 | Pending | Shell/static checks, deployment docs and finalization regression evidence |

Coverage: 3/3 requirements mapped.

