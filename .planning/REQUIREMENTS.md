# Requirements: SGI-SENA — hardening wave

## Requisitos activos — MDL-236 (2026-09-26)

- [ ] CAT-01: Catálogo Equipos único con responsabilidad patrimonial por `id_cuentadante`, filtro ambiente y paginación/exportación bajo el mismo alcance.
- [ ] UX-01: Navegación de seguimiento separada de acciones contextuales; rutas antiguas útiles y semántica móvil/teclado.
- [ ] TRACE-01: Cronología integral de equipo, deduplicada, fechada y autorizada en servidor.
- [ ] ENV-01: Ficha de ambiente con equipos, responsables y agenda, sin automatismos de clase.
- [ ] LOAN-01: Sesiones abiertas/cerradas con informe PDF y filtros por fecha, ambiente, equipo, estado y cuentadante autorizado.
- [ ] RET-01: Retirar Habilitaciones sin invalidar `Responsables_Equipo`, historial ni permisos de aprendices.
- [ ] QA-01: Tests de frontend/backend, lint/build, MySQL local, responsive, roles y rutas legadas; separar gates de Railway/UAT.

El cierre del hardening listado abajo es histórico; sus casillas no acreditan estos requisitos nuevos.

Defined: 2026-09-07
Source: Linear issues MDL-127, MDL-131 and MDL-134.

## v1 Requirements

### Authentication

- [x] **MDL-127**: El navegador no debe guardar JWT de autenticación en `localStorage` ni `sessionStorage`; la sesión debe viajar mediante cookies `httpOnly` con atributos seguros y el frontend debe enviar credenciales de forma consistente.

### Invitation abuse and concurrency

- [x] **MDL-131**: El endpoint público de validación de códigos de invitación debe tener rate limit y el consumo debe ser atómico/serializado para impedir sobreuso bajo concurrencia; la generación debe conservar entropía suficiente.

### Railway deployment contract

- [x] **MDL-134**: El arranque debe respetar el `PORT` proporcionado por Railway, usar variables internas explícitas para Nginx/backend y documentar el contrato sin introducir una regresión en la finalización de clases.

## Out of Scope

- MDL-126, MDL-130, MDL-132 y MDL-133 no se incluyen en esta fase.
- UAT real de Railway, navegador, servicios nativos o credenciales productivas no se considera satisfecho por pruebas estáticas/locales.

## Traceability

| Requirement | Phase / Plan | Status | Evidence target |
|---|---|---|---|
| MDL-127 | Phase 1 / 01-01 | Complete | Cookie/auth contract, storage scan, build and 17 focused frontend tests; full Vitest suite remains a gap |
| MDL-131 | Phase 1 / 01-02 | Complete | 10 focused suites, 170 tests, rate-limit and serialized-consume evidence |
| MDL-134 | Phase 1 / 01-03 | Complete | Shell/config checks, deployment docs, 14 focused finalization tests; real MySQL/Railway UAT remains a gap |

Coverage: 3/3 requirements mapped.
