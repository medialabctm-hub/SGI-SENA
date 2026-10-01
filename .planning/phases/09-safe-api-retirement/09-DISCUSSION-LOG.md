# Phase 9: Safe API retirement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 09-safe-api-retirement
**Areas discussed:** Aprobador vs ejecutor del movimiento; Alcance exacto del Instructor (aula/horario); Historiales y datos personales visibles; Acciones permitidas y campos (allowlist); Contratos desktop; Permisos efectivos en BD; Estrategia de despliegue; Modelo de datos de mantenimiento

---

## Aprobador vs ejecutor del movimiento

| Pregunta | Opciones | Elegida |
|---|---|---|
| ¿Quién aprueba? | Cuentadante titular / Solo Admin / Titular y Admin si el titular es el solicitante | Cuentadante titular (Admin respaldo) |
| ¿Quién ejecuta el traslado? | Sistema al aprobar (atómico) / Solicitante con operación limitada / Solo Admin | Sistema al aprobar (atómico) |
| Solicitante = cuentadante titular | Mueve directo con registro / Solicita igual y aprueba Admin | Mueve directo con registro |
| Equipo no verificado | Solicitud para ambos estados / Mantener cambio directo | Solicitud para ambos estados |

---

## Alcance exacto del Instructor (aula/horario)

| Pregunta | Opciones | Elegida |
|---|---|---|
| Qué es «horario autorizado» | Franja exacta / Jornada / Clase En Curso | Franja exacta |
| Tolerancia | Sin margen / 15 min fijo / Configurable | 15 min fijo antes y después |
| Clases simultáneas | Cualquiera con franja vigente / Solo clase En Curso más reciente | Cualquiera con franja vigente |
| Scheduler vs contrato manual | Desactivar inicio/cierre automático / Mantener scheduler y corregir doc / Solo cierre de seguridad | Desactivar inicio/cierre automático |

---

## Historiales y datos personales visibles

| Pregunta | Opciones | Elegida |
|---|---|---|
| Quién lee historial | Admin+titular+instructor del aula / Solo Admin+titular / Vista amplia recortando PII | Admin + titular + instructor del aula |
| Tras terminar el vínculo | Solo su período / Pierde acceso / Toda la historia | Pierde acceso |
| PII de terceros | Solo nombre y rol / Nombre + correo / Cédula enmascarada | Solo nombre y rol; cédula/correo solo Admin |
| Sin vínculo | 404 genérico / 403 explícito | 404 genérico |

---

## Acciones permitidas y campos (allowlist)

| Pregunta | Opciones | Elegida |
|---|---|---|
| Mantenimiento del Instructor | Solo solicitar / Nada (novedad) / Registrar y programar | Solo solicitar |
| Campos editables por Cuentadante | Ninguno (solo Admin) / Descripción, atributos, imágenes | Ninguno |
| DELETE equipo | Solo Admin / Titular sin historial | Solo Admin |
| Importación | Permiso EQUIPOS.IMPORT / Mantener CREATE + validar en handler | EQUIPOS.IMPORT |

---

## Áreas adicionales

| Pregunta | Opciones | Elegida |
|---|---|---|
| Modelar «solicitado» | Estado en ENUM (migración) / Reutilizar Novedades / Tabla nueva | Estado `Solicitado` en ENUM |
| Rol_Permisos | Política en código + migración solo EQUIPOS.IMPORT / Alinear Rol_Permisos / Ambas | Política en código + sembrar EQUIPOS.IMPORT |
| Despliegue | Activa desde el inicio, PRs pequeños / Modo observación | Activa desde el inicio, PRs pequeños |
| Contratos desktop | Solo cerrar A6 y diferir retirada / Deprecar con aviso / No tocar | Solo cerrar A6, retirada diferida a D11 |

---

## Claude's Discretion

Diseño de la política compartida, mensajes de error, orden interno de PRs, estructura del log de uso de contratos desktop.

## Deferred Ideas

Retirada de contratos desktop (D11), `--forceExit`/DDL en request (D16), cronología/ambientes/informe (D08–D10), snapshot de titularidad al prestar.
