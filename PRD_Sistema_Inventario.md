# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Sistema de Trazabilidad de Inventario de Equipos

**Versión:** 1.0  
**Fecha:** Noviembre 2025  
**Proyecto:** MVP - Sistema de Control de Inventario  
**Cliente:** Centro Tecnológico Mobiliario  
**Preparado para:** Implementación con Claude Code

---

## TABLA DE CONTENIDOS

1. [Executive Summary](#1-executive-summary)
2. [Contexto y Problema](#2-contexto-y-problema)
3. [Solución Propuesta](#3-solución-propuesta)
4. [Usuarios y Roles](#4-usuarios-y-roles)
5. [Requerimientos Funcionales](#5-requerimientos-funcionales)
6. [Modelo de Datos](#6-modelo-de-datos)
7. [Flujos de Usuario Detallados](#7-flujos-de-usuario-detallados)
8. [Especificaciones de Pantallas](#8-especificaciones-de-pantallas)
9. [Reglas de Negocio](#9-reglas-de-negocio)
10. [Stack Tecnológico](#10-stack-tecnológico)
11. [Plan de Implementación](#11-plan-de-implementación)
12. [Criterios de Aceptación](#12-criterios-de-aceptación)
13. [Plan de Piloto](#13-plan-de-piloto)
14. [Métricas de Éxito](#14-métricas-de-éxito)
15. [Anexos](#15-anexos)

---

## 1. EXECUTIVE SUMMARY

### Problema

Los custodios de equipos en instituciones educativas enfrentan un problema crítico de trazabilidad y responsabilidad. Actualmente, Alex Zapata tiene asignados 391 equipos por valor de $584,418,247 COP, pero:

- **No sabe dónde están físicamente** muchos de ellos
- **No sabe quién los está usando** en tiempo real
- **No puede identificar responsables** cuando hay daños
- **Los trámites de seguros toman semanas** por falta de evidencia
- **Entrega de inventario es imposible** sin saber ubicaciones

Un instructor puede estar asignado a un aula solo en la mañana, pero 6 profesores diferentes pueden usar los equipos en la tarde. Cuando algo se daña, no hay forma de saber quién lo usó y cuándo.

### Solución

Sistema web }que permite:

- **Check-in/out rápido** con escaneo de códigos de barras
- **Trazabilidad completa** de uso de equipos
- **Descubrimiento automático** de ubicaciones
- **Reportes de daños** con evidencia fotográfica
- **Notificaciones** a custodios sobre eventos anormales
- **Dashboard en tiempo real** para supervisión

### Beneficios Esperados

- Reducir tiempo de trámites de seguros de 2 semanas a 2 días
- Localizar 100% de equipos en 3 meses
- Identificar responsables en 100% de incidentes
- Reducir pérdidas por robo/extravío
- Facilitar entrega de inventario entre custodios

### Alcance MVP

Piloto de 2-3 semanas con:
- 20-30 equipos en Media Lab
- 2 usuarios (Alex Zapata + instructor usuario)
- Funcionalidades core: check-in/out, reportar daños, consultar ubicaciones

---

## 2. CONTEXTO Y PROBLEMA

### 2.1 Situación Actual

**Inventario de Alex Zapata:**
- 391 bienes asignados
- Valor total: $584,418,247 COP
- Tipos: computadores, cámaras, kits Arduino, access points, gafas VR, equipos de sonido, etc.
- Ubicaciones: múltiples aulas del Centro de Formación

**Modelo de uso actual:**
- Alex es custodio (responsable legal) pero NO usuario principal
- Equipos se usan en aulas por diferentes profesores en diferentes horarios
- Estudiantes usan equipos bajo supervisión de profesores (NO registrados individualmente en MVP)
- Algunos equipos son fijos (computadores de aula)
- Otros son portátiles (gafas VR, equipos de sonido)

**Problemas específicos:**

1. **Falta de trazabilidad:**
   - Equipo se daña → no se sabe quién lo usó último
   - Equipo desaparece → no se sabe dónde estaba
   - Múltiples usuarios en el día → imposible identificar responsable

2. **Responsabilidad legal mal asignada:**
   - Custodio es responsable ante seguros
   - Pero no tiene control sobre el uso
   - Genera papeleo extenso para demostrar no-responsabilidad

3. **Pérdida de tiempo:**
   - Trámites de seguros: 2+ semanas
   - Buscar equipos para auditorías: días enteros
   - Transferir inventario a otro custodio: proceso manual caótico

4. **Falta de información:**
   - Excel de inventario NO tiene ubicaciones reales
   - No hay historial de mantenimientos
   - No se sabe qué equipos están subutilizados

### 2.2 Usuarios Afectados

**Custodios (como Alex):**
- Responsables legales del inventario
- Necesitan protección ante reclamos
- Requieren visibilidad de dónde/quién usa equipos
- Deben generar reportes para seguros

**Profesores usuarios:**
- Usan equipos en sus clases
- Responsables del aula durante su horario
- Necesitan reportar daños fácilmente
- Requieren proceso rápido (no interrumpir clases)

**Administración:**
- Necesita datos para auditorías
- Gestiona múltiples custodios
- Toma decisiones de compra basadas en uso

---

## 3. SOLUCIÓN PROPUESTA

### 3.1 Descripción General

Sistema de tres componentes:

**App Móvil (Flutter):**
- Escaneo de códigos de barras
- Check-in/out rápido de equipos/clases
- Reportar daños con fotos
- Solicitar permisos de salida
- Notificaciones

**Dashboard Web (React):**
- Consultar estado de inventario en tiempo real
- Ver historial de uso por equipo
- Aprobar permisos de salida
- Ver reportes de daños
- Generar reportes para seguros
- Panel administrativo

**Backend (Node.js + Express):**
- Base de datos MySQL
- Autenticación de usuarios con JWT
- Almacenamiento de imágenes con Multer/S3
- API REST
- Middleware de autorización

### 3.2 Funcionalidades Core del MVP

**Gestión de Uso:**
- ✅ Check-in grupal de clase (aula completa)
- ✅ Check-in individual de equipo específico
- ✅ Check-out manual
- ✅ Check-out automático después de 2 horas + notificación
- ✅ Registro de ubicación por uso

**Reportes de Daños:**
- ✅ Escanear equipo dañado
- ✅ Tomar foto obligatoria
- ✅ Descripción del daño
- ✅ Severidad (leve/moderado/severo)
- ✅ Bloqueo automático del equipo si es severo
- ✅ Notificación inmediata al custodio

**Permisos de Salida:**
- ✅ Solicitar permiso para sacar equipo del Centro
- ✅ Foto de permiso firmado
- ✅ Destino y fecha de retorno
- ✅ Aprobación/rechazo por custodio
- ✅ Check-in fuera del Centro solo por quien lo sacó

**Consultas y Reportes:**
- ✅ Dashboard: equipos en uso ahora
- ✅ Ubicación actual de cada equipo
- ✅ Historial completo de uso
- ✅ Lista de equipos sin ubicar
- ✅ "Mapa de inventario" con distribución por aula
- ✅ Reporte de ubicaciones para entrega de inventario

**Administración:**
- ✅ Importar equipos desde Excel
- ✅ Crear usuarios (custodios, profesores, admins)
- ✅ Asignar equipos a custodios
- ✅ Crear/editar lista de aulas
- ✅ Cambiar estados de equipos manualmente

### 3.3 Funcionalidades Excluidas del MVP (Fase 2)

- ❌ Registro individual de estudiantes
- ❌ Notificaciones push (solo email)
- ❌ Estadísticas avanzadas / analytics
- ❌ Integración con sistema académico
- ❌ Geolocalización GPS automática
- ❌ Modo offline robusto
- ❌ Exportación de reportes PDF para seguros
- ❌ Firma digital
- ❌ Uso simultáneo de equipos por múltiples usuarios
- ❌ Códigos QR (se usan códigos de barras existentes)

---

## 4. USUARIOS Y ROLES

### 4.1 Roles del Sistema

#### ROL: Profesor

**Descripción:**
Usuario que usa equipos en sus clases. Es responsable de los equipos durante su horario de clase.

**Permisos:**
- ✅ Login en app móvil
- ✅ Escanear códigos de barras
- ✅ Hacer check-in de equipos/clases
- ✅ Hacer check-out de sus equipos en uso
- ✅ Reportar daños con fotos
- ✅ Solicitar permisos de salida del Centro
- ✅ Ver sus check-ins activos
- ✅ Ver historial de equipos que él ha usado
- ✅ Ver equipos del aula donde está

**Restricciones:**
- ❌ No puede ver equipos de otras aulas (a menos que los use)
- ❌ No puede ver historial completo de otros usuarios
- ❌ No puede resolver reportes de daños
- ❌ No puede aprobar permisos de salida
- ❌ No puede crear/editar usuarios
- ❌ No puede modificar datos de equipos

#### ROL: Custodio

**Descripción:**
Responsable legal de un conjunto de equipos. Debe supervisar su uso y responder ante seguros/auditorías.

**Permisos:**
- ✅ TODO lo que puede hacer un Profesor
- ✅ Acceso a dashboard web
- ✅ Ver TODOS sus equipos asignados (391 en el caso de Alex)
- ✅ Ver quién está usando cada equipo en tiempo real
- ✅ Ver historial completo de uso de sus equipos
- ✅ Ver todos los reportes de daños de sus equipos
- ✅ Resolver (marcar como resuelto) reportes de daños
- ✅ Aprobar/rechazar permisos de salida
- ✅ Recibir notificaciones email de eventos anormales
- ✅ Ver "Mapa de inventario" (ubicaciones de equipos)
- ✅ Ver equipos sin ubicar
- ✅ Generar reporte de ubicaciones

**Restricciones:**
- ❌ No puede ver equipos de otros custodios
- ❌ No puede crear usuarios
- ❌ No puede asignar equipos a otros custodios
- ❌ No puede importar equipos masivamente
- ❌ No puede eliminar registros de historial

#### ROL: Admin

**Descripción:**
Administrador del sistema con acceso completo.

**Permisos:**
- ✅ TODO lo anterior
- ✅ Ver TODO el inventario de la universidad (todos los custodios)
- ✅ Crear/editar/eliminar usuarios
- ✅ Asignar equipos a custodios
- ✅ Importar equipos desde Excel
- ✅ Crear/editar lista de aulas
- ✅ Cambiar estados de equipos manualmente
- ✅ Resolver reportes de daños de cualquier equipo
- ✅ Aprobar/rechazar cualquier permiso de salida
- ✅ Ver estadísticas globales del sistema
- ✅ Exportar reportes completos
- ✅ Eliminar registros de uso (con precaución)

**Restricciones:**
- Ninguna (acceso total)

### 4.2 Matriz de Permisos

| Funcionalidad | Profesor | Custodio | Admin |
|--------------|----------|----------|-------|
| **App Móvil** |
| Login | ✅ | ✅ | ✅ |
| Escanear códigos | ✅ | ✅ | ✅ |
| Check-in equipos | ✅ | ✅ | ✅ |
| Check-out equipos | ✅ Solo propios | ✅ Solo propios | ✅ Cualquiera |
| Reportar daños | ✅ | ✅ | ✅ |
| Solicitar permiso salida | ✅ | ✅ | ✅ |
| **Dashboard Web** |
| Acceso | ❌ | ✅ | ✅ |
| Ver mis equipos | ❌ | ✅ Solo asignados | ✅ Todos |
| Ver equipos en uso ahora | ❌ | ✅ Solo propios | ✅ Todos |
| Ver historial completo | ❌ | ✅ Solo propios | ✅ Todos |
| Ver reportes daños | ❌ Solo propios | ✅ Solo propios | ✅ Todos |
| Resolver reportes | ❌ | ✅ Solo propios | ✅ Todos |
| Aprobar permisos salida | ❌ | ✅ Solo propios | ✅ Todos |
| Mapa de inventario | ❌ | ✅ Solo propios | ✅ Todos |
| **Administración** |
| Crear usuarios | ❌ | ❌ | ✅ |
| Importar equipos | ❌ | ❌ | ✅ |
| Asignar a custodios | ❌ | ❌ | ✅ |
| Editar aulas | ❌ | ❌ | ✅ |
| Eliminar registros | ❌ | ❌ | ✅ |

---

## 5. REQUERIMIENTOS FUNCIONALES

### 5.1 Autenticación y Usuarios

**RF-001: Login con Email/Password**
- Usuario ingresa email y contraseña
- Sistema valida credenciales
- Si correctas → redirige según rol (app o web)
- Si incorrectas → muestra error específico
- Sesión persiste hasta logout manual

**RF-002: Roles Diferenciados**
- Sistema identifica rol del usuario al login
- Profesor → solo acceso a app móvil
- Custodio → acceso a app móvil + dashboard web
- Admin → acceso completo

**RF-003: Logout**
- Botón de cerrar sesión visible en todas las pantallas
- Al hacer logout → limpia sesión local
- Requiere confirmación antes de salir

### 5.2 Check-in de Equipos

**RF-004: Check-in Grupal de Clase**

**Flujo:**
1. Profesor abre app móvil
2. Presiona "Iniciar Clase"
3. Sistema solicita: "¿En qué aula estás?"
4. Profesor selecciona de lista desplegable (ej: Media Lab) o ingresa manualmente
5. Sistema pregunta: "¿Qué equipos vas a usar?"
   - Opción A: Escanear código de barras de cada equipo individualmente
   - Opción B: Seleccionar "Todos los equipos de esta aula" (si ya están configurados)
6. Profesor escanea códigos de barras uno por uno (o confirma lista)
7. Sistema muestra resumen: "20 equipos - Media Lab - 2:00 PM"
8. Profesor confirma
9. Sistema crea:
   - 1 registro de clase (class_session)
   - 20 registros de uso (usage_logs) vinculados a esa clase
   - Estado de equipos cambia a "en_uso"

**Validaciones:**
- No permitir check-in de equipo ya en uso (mostrar quién lo tiene)
- No permitir check-in de equipo en estado "dañado"
- No permitir check-in de equipo "fuera del Centro" por otro usuario
- Si equipo no tiene ubicación actual → registrar esta como primera ubicación

**RF-005: Check-in Individual de Equipo**

**Flujo:**
1. Profesor abre app
2. Presiona "Escanear Equipo"
3. Escanea código de barras
4. Sistema muestra:
   - Nombre del equipo
   - Código
   - Estado actual
   - Ubicación habitual (si existe)
5. Opciones:
   - "Iniciar Uso" → check-in individual
   - "Reportar Daño" → ir a flujo de reporte
   - "Solicitar Salida" → ir a flujo de permiso
6. Si selecciona "Iniciar Uso":
   - Sistema solicita ubicación (aula)
   - Crea registro de uso individual
   - Cambia estado a "en_uso"

**Validaciones:**
- Mismas que check-in grupal

### 5.3 Check-out de Equipos

**RF-006: Check-out Manual**

**Flujo:**
1. Profesor abre app
2. Ve sección "Mis Clases Activas" o "Mis Equipos en Uso"
3. Lista muestra:
   - Clase: Media Lab - Iniciada 2:00 PM (20 equipos)
   - Equipo individual: Gafas VR - Iniciadas 3:15 PM
4. Presiona "Finalizar" en clase o equipo
5. Sistema pregunta confirmación
6. Al confirmar:
   - Actualiza check_out_time
   - Cambia estado a "disponible"
   - Calcula duración de uso
   - Actualiza estadísticas de ubicación

**RF-007: Check-out Automático con Notificación**

**Regla:**
- Si un check-in NO tiene check-out después de 2 horas
- Sistema envía notificación email al usuario
- Si después de 4 horas totales sigue sin check-out:
  - Sistema hace check-out automático
  - Envía email informativo explicando qué pasó
  - Registra que fue automático (para auditoría)

### 5.4 Reportes de Daños

**RF-008: Crear Reporte de Daño**

**Flujo:**
1. Profesor detecta equipo dañado
2. Abre app → "Reportar Daño"
3. Escanea código de barras del equipo
4. Sistema muestra datos del equipo
5. Profesor completa formulario:
   - **Foto (obligatoria):** Toma con cámara o selecciona de galería
   - **Descripción (obligatoria):** Texto libre, min 10 caracteres
   - **Severidad (obligatoria):** Leve / Moderado / Severo
   - **Notas adicionales (opcional):** Ej: "Estudiante Juan lo reportó"
6. Presiona "Enviar Reporte"
7. Sistema:
   - Sube foto al servidor (almacenamiento local o S3)
   - Crea registro en damage_reports
   - Si severidad = "Severo" → cambia estado equipo a "dañado" (bloqueado)
   - Envía email inmediato al custodio del equipo
   - Muestra confirmación

**Validaciones:**
- Foto es obligatoria
- Descripción mínimo 10 caracteres
- Severidad debe estar seleccionada

**RF-009: Ver Reportes de Daños**

**Dashboard web - Vista de custodio:**
- Sección "Reportes de Daños"
- Tabla con columnas:
  - Equipo (nombre + código)
  - Reportado por (usuario)
  - Fecha/hora
  - Severidad (con color)
  - Estado (Pendiente / Resuelto)
  - Acciones (Ver detalles / Resolver)
- Filtros por severidad, estado, fecha, equipo

**RF-010: Resolver Reporte de Daño**

**Flujo:**
1. Custodio abre detalle del reporte
2. Coordina reparación (fuera del sistema)
3. Una vez reparado, presiona "Marcar como Resuelto"
4. Sistema solicita confirmación
5. Al confirmar:
   - Actualiza resolved = TRUE
   - Cambia estado equipo de "dañado" a "disponible"
   - Registra fecha de resolución
   - Registra quién lo resolvió

### 5.5 Permisos de Salida del Centro

**RF-011: Solicitar Permiso de Salida**

**Flujo:**
1. Profesor necesita sacar equipo del Centro
2. Abre app → Escanea equipo
3. Selecciona "Solicitar Salida del Centro"
4. Sistema muestra advertencia sobre requisitos
5. Profesor completa formulario:
   - **Foto de permiso firmado (obligatoria)**
   - **Destino:** Texto libre
   - **Fecha de retorno esperado:** Selector de fecha
   - **Motivo:** Texto libre opcional
6. Presiona "Enviar Solicitud"
7. Sistema:
   - Crea registro en exit_permits con status = "pending"
   - Envía notificación inmediata al custodio
   - Muestra: "Solicitud enviada. Esperando aprobación"

**RF-012: Aprobar/Rechazar Permiso**

**Flujo (dashboard web del custodio):**
1. Custodio recibe notificación
2. Abre dashboard → sección "Permisos Pendientes"
3. Ve solicitudes con todos los datos
4. Hace click en una solicitud
5. Ve detalle completo con foto del permiso
6. Opciones:
   - **APROBAR:**
     - Sistema actualiza status = "approved"
     - Notifica al profesor
     - Equipo puede hacer check-in "fuera del Centro"
   - **RECHAZAR:**
     - Solicita motivo del rechazo (opcional)
     - Actualiza status = "rejected"
     - Notifica al profesor con motivo

**RF-013: Check-in Fuera del Centro**

**Regla especial:**
- Si equipo tiene permiso de salida aprobado
- Solo el profesor que solicitó el permiso puede hacer check-in
- Sistema detecta permiso activo automáticamente
- Registra is_outside_facility = TRUE

**Validación:**
- Si otro profesor intenta check-in → sistema bloquea con mensaje

**RF-014: Retorno de Equipo**

**Flujo:**
1. Profesor regresa equipo al Centro
2. Hace check-out normal
3. Sistema actualiza:
   - Status del permiso a "returned"
   - is_outside_facility = FALSE
   - current_location a ubicación del check-out

### 5.6 Consultas y Dashboard

**RF-015: Dashboard de Custodio - Vista Principal**

**Secciones:**
1. Cards superiores con métricas clave
2. Tabla "Equipos en Uso AHORA"
3. Alertas urgentes
4. Reportes pendientes
5. Permisos pendientes

**RF-016: Mapa de Inventario**

**Vista de ubicaciones:**
- Equipos ubicados por aula
- Equipos sin ubicación conocida (nunca registrados, sin uso 30+ días)
- Equipos fuera del Centro
- Botón para generar reporte Excel

**RF-017: Detalle de Equipo**

**Información mostrada:**
- Datos generales (marca, modelo, serial, valor, custodio)
- Ubicación habitual y confianza
- Estado actual
- Estadísticas de uso (total usos, horas, distribución ubicaciones)
- Historial de uso (últimos 10 + ver completo)
- Botones de acción (editar, generar reporte, ver código)

**RF-018: Historial Completo de Equipo**

**Tabla con:**
- Fecha
- Usuario
- Ubicación
- Check-in / Check-out
- Duración
- Notas
- Filtros por fecha, usuario, ubicación
- Exportable a Excel

### 5.7 Administración

**RF-019: Importar Equipos desde Excel**

**Flujo (solo Admin):**
1. Admin va a "Administración" → "Importar Equipos"
2. Descarga template Excel
3. Completa con datos requeridos
4. Sube archivo
5. Sistema valida formato y datos
6. Si hay errores → muestra lista por fila
7. Si correcto → preview y confirmación
8. Importa todos los registros
9. Campos faltantes → valores por defecto

**RF-020: Crear Usuario**

**Flujo:**
1. Admin va a "Usuarios" → "Crear Nuevo"
2. Completa formulario (email, nombre, contraseña, rol)
3. Si custodio → opción de enviar email bienvenida
4. Sistema crea usuario con password hasheado en BD

**RF-021: Asignar Equipos a Custodio**

**Flujo:**
1. Admin filtra equipos sin custodio (o para reasignar)
2. Selecciona múltiples equipos
3. Elige custodio de dropdown
4. Confirma (con advertencia si es reasignación)
5. Sistema actualiza custodian_id

**RF-022: Gestión de Aulas**

**Flujo:**
1. Admin va a "Aulas"
2. Ve lista actual
3. Puede:
   - Agregar nueva aula (nombre + edificio)
   - Editar aula existente
   - Eliminar (solo si no tiene equipos)

---

## 6. MODELO DE DATOS

### 6.1 Diagrama de Entidades y Relaciones (ER)

```
profiles (users)
├─ id (PK, UUID)
├─ email (UNIQUE)
├─ full_name
├─ role (profesor/custodio/admin)
└─ created_at

classrooms
├─ id (PK, UUID)
├─ name (UNIQUE)
├─ building
└─ created_at

equipment
├─ id (PK, UUID)
├─ inventory_code (UNIQUE) ← Del código de barras
├─ name
├─ brand
├─ model
├─ serial_number
├─ acquisition_date
├─ value
├─ custodian_id (FK → profiles)
├─ classroom_id (FK → classrooms, nullable)
├─ current_location (nullable)
├─ primary_location (calculada)
├─ location_confidence (0-100%)
├─ can_exit_facility (boolean)
├─ status (disponible/en_uso/dañado/mantenimiento)
├─ last_seen_at
├─ total_uses
└─ created_at

class_sessions
├─ id (PK, UUID)
├─ classroom_id (FK → classrooms)
├─ professor_id (FK → profiles)
├─ check_in_time
├─ check_out_time (nullable)
├─ equipment_ids (UUID[])
└─ created_at

usage_logs
├─ id (PK, UUID)
├─ class_session_id (FK → class_sessions, nullable)
├─ equipment_id (FK → equipment)
├─ user_id (FK → profiles)
├─ check_in_time
├─ check_out_time (nullable)
├─ location
├─ is_auto_checkout (boolean)
├─ is_outside_facility (boolean)
└─ created_at

damage_reports
├─ id (PK, UUID)
├─ equipment_id (FK → equipment)
├─ reported_by (FK → profiles)
├─ description
├─ photo_url
├─ severity (leve/moderado/severo)
├─ notes (nullable)
├─ reported_at
├─ resolved (boolean)
├─ resolved_by (FK → profiles, nullable)
└─ resolved_at (nullable)

exit_permits
├─ id (PK, UUID)
├─ equipment_id (FK → equipment)
├─ requested_by (FK → profiles)
├─ permit_photo_url
├─ destination
├─ expected_return_date
├─ reason (nullable)
├─ status (pending/approved/rejected/returned)
├─ approved_by (FK → profiles, nullable)
├─ approved_at (nullable)
├─ rejection_reason (nullable)
├─ returned_at (nullable)
└─ created_at

location_history
├─ id (PK, UUID)
├─ equipment_id (FK → equipment)
├─ location
├─ use_count
├─ percentage
└─ updated_at
```

### 6.2 Descripción Detallada de Tablas

#### TABLA: profiles

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, FK a auth.users | ID del usuario |
| email | TEXT | UNIQUE, NOT NULL | Email |
| full_name | TEXT | NOT NULL | Nombre completo |
| role | TEXT | NOT NULL, CHECK | profesor/custodio/admin |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha creación |

**Índices:**
- PRIMARY KEY (id)
- UNIQUE (email)
- INDEX (role)

---

#### TABLA: classrooms

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK | ID único del aula |
| name | TEXT | UNIQUE, NOT NULL | Nombre (ej: Media Lab) |
| building | TEXT | NULL | Edificio/piso |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha creación |

---

#### TABLA: equipment

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK | ID único |
| inventory_code | TEXT | UNIQUE, NOT NULL | Código de inventario |
| name | TEXT | NOT NULL | Nombre del equipo |
| brand | TEXT | DEFAULT 'Sin especificar' | Marca |
| model | TEXT | DEFAULT 'Sin especificar' | Modelo |
| serial_number | TEXT | DEFAULT 'Sin especificar' | Número de serie |
| acquisition_date | DATE | NULL | Fecha de adquisición |
| value | NUMERIC(15,2) | DEFAULT 0 | Valor en COP |
| custodian_id | UUID | FK profiles(id), NULL | Custodio asignado |
| classroom_id | UUID | FK classrooms(id), NULL | Aula habitual |
| current_location | TEXT | NULL | Ubicación actual |
| primary_location | TEXT | NULL | Ubicación más frecuente |
| location_confidence | NUMERIC(5,2) | DEFAULT 0 | % confianza (0-100) |
| can_exit_facility | BOOLEAN | DEFAULT FALSE | ¿Puede salir del Centro? |
| status | TEXT | DEFAULT 'disponible', CHECK | Estado del equipo |
| last_seen_at | TIMESTAMP | NULL | Última vez registrado |
| total_uses | INTEGER | DEFAULT 0 | Total de veces usado |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha creación |

**Valores de status:** disponible, en_uso, dañado, mantenimiento

**Índices:**
- PRIMARY KEY (id)
- UNIQUE (inventory_code)
- INDEX (custodian_id)
- INDEX (classroom_id)
- INDEX (status)
- INDEX (current_location)

---

#### TABLA: class_sessions

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK | ID sesión |
| classroom_id | UUID | FK classrooms, NOT NULL | Aula |
| professor_id | UUID | FK profiles, NOT NULL | Profesor responsable |
| check_in_time | TIMESTAMP | DEFAULT NOW() | Hora inicio |
| check_out_time | TIMESTAMP | NULL | Hora fin (NULL si activa) |
| equipment_ids | UUID[] | NOT NULL | Array de equipos |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha creación |

---

#### TABLA: usage_logs

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK | ID registro |
| class_session_id | UUID | FK class_sessions, NULL | Sesión de clase |
| equipment_id | UUID | FK equipment, NOT NULL | Equipo usado |
| user_id | UUID | FK profiles, NOT NULL | Usuario |
| check_in_time | TIMESTAMP | DEFAULT NOW() | Hora inicio |
| check_out_time | TIMESTAMP | NULL | Hora fin (NULL si activo) |
| location | TEXT | NOT NULL | Ubicación de uso |
| is_auto_checkout | BOOLEAN | DEFAULT FALSE | Check-out automático |
| is_outside_facility | BOOLEAN | DEFAULT FALSE | Fuera del Centro |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha creación |

**Índices:**
- INDEX (equipment_id)
- INDEX (user_id)
- INDEX (check_in_time)
- INDEX (check_out_time) WHERE NULL (usos activos)

---

#### TABLA: damage_reports

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK | ID reporte |
| equipment_id | UUID | FK equipment, NOT NULL | Equipo dañado |
| reported_by | UUID | FK profiles, NOT NULL | Quién reportó |
| description | TEXT | NOT NULL, CHECK length >= 10 | Descripción |
| photo_url | TEXT | NOT NULL | URL foto en Storage |
| severity | TEXT | NOT NULL, CHECK | leve/moderado/severo |
| notes | TEXT | NULL | Notas adicionales |
| reported_at | TIMESTAMP | DEFAULT NOW() | Cuándo se reportó |
| resolved | BOOLEAN | DEFAULT FALSE | ¿Resuelto? |
| resolved_by | UUID | FK profiles, NULL | Quién lo resolvió |
| resolved_at | TIMESTAMP | NULL | Cuándo se resolvió |

**Trigger:**
- Si severity='severo' → equipment.status = 'dañado'
- Si resolved=TRUE → equipment.status = 'disponible'

---

#### TABLA: exit_permits

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK | ID permiso |
| equipment_id | UUID | FK equipment, NOT NULL | Equipo |
| requested_by | UUID | FK profiles, NOT NULL | Solicitante |
| permit_photo_url | TEXT | NOT NULL | Foto permiso firmado |
| destination | TEXT | NOT NULL | Destino |
| expected_return_date | DATE | NOT NULL | Fecha retorno esperado |
| reason | TEXT | NULL | Motivo |
| status | TEXT | DEFAULT 'pending', CHECK | Estado |
| approved_by | UUID | FK profiles, NULL | Quién aprobó |
| approved_at | TIMESTAMP | NULL | Cuándo aprobó |
| rejection_reason | TEXT | NULL | Motivo rechazo |
| returned_at | TIMESTAMP | NULL | Cuándo regresó |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha solicitud |

**Valores de status:** pending, approved, rejected, returned

---

#### TABLA: location_history

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK | ID |
| equipment_id | UUID | FK equipment, NOT NULL | Equipo |
| location | TEXT | NOT NULL | Ubicación |
| use_count | INTEGER | DEFAULT 0 | Veces usado aquí |
| percentage | NUMERIC(5,2) | DEFAULT 0 | % del total |
| updated_at | TIMESTAMP | DEFAULT NOW() | Última actualización |

**Índices:**
- UNIQUE (equipment_id, location)

---

## 7. FLUJOS DE USUARIO DETALLADOS

### 7.1 Flujo: Clase Típica en Media Lab

**Contexto:**
- Victor Cardona da clase de 2:00 PM a 6:00 PM
- Media Lab tiene 20 computadores
- Clase normal sin incidentes

**Check-in (1:58 PM):**
1. Victor abre app "Inventario"
2. Presiona "Iniciar Clase"
3. Selecciona aula: "Media Lab"
4. Selecciona "Usar configuración guardada: Media Lab - 20 equipos"
5. Confirma lista de equipos
6. Presiona "Iniciar Clase"
7. Sistema registra sesión + 20 usage_logs
8. Confirmación: "Clase iniciada - 20 equipos en uso"
9. **Tiempo total: ~1 minuto**

**Durante clase:**
- A las 4:00 PM (2 horas) → notificación push: "Recuerda hacer check-out"

**Check-out (6:00 PM):**
1. Victor abre app
2. Ve "Mis Clases Activas: Media Lab - 2:00 PM (20 equipos)"
3. Presiona "Finalizar Clase"
4. Confirma
5. Sistema actualiza check_out_time, cambia estados, actualiza estadísticas
6. Confirmación: "Clase finalizada"
7. **Tiempo total: ~15 segundos**

---

### 7.2 Flujo: Reportar Daño Durante Clase

**Contexto:**
- Estudiante nota que Computador 05 no enciende a las 3:30 PM

**Reporte:**
1. Victor abre app → "Reportar Daño"
2. Escanea código de barras del Computador 05
3. Sistema muestra info del equipo
4. Victor toma foto del computador apagado
5. Escribe descripción: "Computador no enciende. Botón de power no responde..."
6. Selecciona severidad: "Severo"
7. Notas: "Reportado por estudiante Juan Pablo Torres"
8. Presiona "Enviar Reporte"
9. Sistema:
   - Sube foto a Storage
   - Crea damage_report
   - Cambia status a "dañado" (bloqueado)
   - Envía email a Alex
10. Confirmación: "Reporte enviado. Custodio notificado"
11. **Tiempo total: ~2 minutos**

**Alex recibe email (3:31 PM):**
- Asunto: "🔴 DAÑO SEVERO REPORTADO - Computador HP 05"
- Contenido: todos los datos + link a dashboard
- Alex revisa foto y coordina reparación

**Alex marca resuelto (2 días después):**
1. Dashboard → Reporte
2. "Marcar como Resuelto"
3. Sistema cambia resolved=TRUE, status="disponible"

---

### 7.3 Flujo: Solicitar Permiso para Sacar Equipo

**Contexto:**
- María González necesita Gafas VR para feria el 05/Nov
- Obtiene permiso firmado del coordinador

**Solicitud (04/Nov, 8:00 AM):**
1. María abre app
2. Escanea Gafas Oculus VR
3. Selecciona "Solicitar Salida del Centro"
4. Sistema muestra advertencia de requisitos
5. María sube foto del permiso firmado
6. Destino: "Feria Tecnológica - CC Santa Fe"
7. Fecha retorno: 05/Nov/2025
8. Motivo: "Demostración para estudiantes"
9. Envía solicitud
10. Sistema crea exit_permit, notifica a Alex
11. **Tiempo total: ~3 minutos**

**Alex aprueba (8:30 AM):**
1. Ve email con solicitud
2. Abre dashboard → "Permisos Pendientes"
3. Revisa foto del permiso
4. Presiona "APROBAR"
5. Sistema notifica a María

**María saca equipo (1:00 PM):**
1. Va a Media Lab, toma gafas
2. Escanea en app
3. Sistema detecta permiso aprobado
4. "Iniciar Uso" → selecciona "Fuera del Centro"
5. Check-in registrado con is_outside_facility=TRUE

**María regresa (05/Nov, 6:00 PM):**
1. Regresa con gafas
2. Hace check-out desde app
3. Sistema actualiza permit status="returned"
4. Alex ve notificación: "Gafas retornadas"

---

## 8. ESPECIFICACIONES DE PANTALLAS

### 8.1 App Móvil (Flutter)

#### Pantalla: Login

```
┌─────────────────────────────┐
│         [Logo/Icono]        │
│    Sistema de Inventario    │
│                             │
│  ┌───────────────────────┐  │
│  │ Email                 │  │
│  │ [________________]    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Contraseña            │  │
│  │ [________________]    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │      INGRESAR         │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

**Estados:**
- Loading: spinner en botón
- Error: mensaje rojo debajo
- Success: transición a Home

---

#### Pantalla: Home (Principal)

```
┌─────────────────────────────┐
│  ☰  Inventario    [Profile] │
├─────────────────────────────┤
│  👋 Hola, Victor            │
│                             │
│  ┌───────────────────────┐  │
│  │   📱 INICIAR CLASE    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  📷 ESCANEAR EQUIPO   │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  ⚠️ REPORTAR DAÑO     │  │
│  └───────────────────────┘  │
│                             │
│  MIS CLASES ACTIVAS (1)     │
│  ┌───────────────────────┐  │
│  │ 📚 Media Lab          │  │
│  │ Iniciada: 2:00 PM     │  │
│  │ 20 equipos            │  │
│  │ [Finalizar Clase]     │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

**Interacciones:**
- Tap "Iniciar Clase" → Check-in Grupal
- Tap "Escanear Equipo" → Escáner
- Tap "Reportar Daño" → Escáner modo daño
- Pull-to-refresh actualiza listas

---

#### Pantalla: Escáner de Códigos

```
┌─────────────────────────────┐
│  ← Escanear Equipo          │
├─────────────────────────────┤
│█████████████████████████████│
│█████░░░░░░░░░░░░░░░░░░█████│ 
│█████░  ┌───────────┐  ░█████│
│█████░  │   MARCO   │  ░█████│
│█████░  │   GUÍA    │  ░█████│
│█████░  └───────────┘  ░█████│
│█████░░░░░░░░░░░░░░░░░░█████│
│█████████████████████████████│
├─────────────────────────────┤
│  Coloca el código dentro    │
│  del marco                   │
│  [🔦 Flash] [⟲ Cambiar]   │
└─────────────────────────────┘
```

**Comportamiento:**
- Escaneo automático
- Vibración + sonido al detectar
- Código no reconocido → mensaje error
- Código reconocido → Detalle de Equipo

---

#### Pantalla: Detalle de Equipo

```
┌─────────────────────────────┐
│  ← Gafas Oculus VR          │
├─────────────────────────────┤
│  Código: 920510117200       │
│  Ubicación: Media Lab       │
│  Estado: ✅ Disponible      │
│                             │
│  ¿QUÉ DESEAS HACER?         │
│                             │
│  ┌───────────────────────┐  │
│  │   ▶️ INICIAR USO      │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │   ⚠️ REPORTAR DAÑO    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │   📤 SOLICITAR SALIDA │  │
│  └───────────────────────┘  │
│                             │
│  INFORMACIÓN                │
│  • Marca: Meta              │
│  • Custodio: Alex Zapata    │
└─────────────────────────────┘
```

---

#### Pantalla: Reportar Daño

```
┌─────────────────────────────┐
│  ← Reportar Daño            │
├─────────────────────────────┤
│  EQUIPO                     │
│  Computador HP 05           │
│  920510154782               │
│                             │
│  FOTO DEL DAÑO *            │
│  ┌───────────────────────┐  │
│  │   [📷 Tomar Foto]     │  │
│  └───────────────────────┘  │
│                             │
│  DESCRIPCIÓN *              │
│  ┌───────────────────────┐  │
│  │ ¿Qué pasó?            │  │
│  │ (mín 10 caracteres)   │  │
│  └───────────────────────┘  │
│                             │
│  SEVERIDAD *                │
│  ○ Leve                     │
│  ○ Moderado                 │
│  ○ Severo                   │
│                             │
│  NOTAS (opcional)           │
│  ┌───────────────────────┐  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │   ENVIAR REPORTE      │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

### 8.2 Dashboard Web (React)

#### Pantalla: Dashboard Principal (Custodio)

```
┌─────────────────────────────────────────────────────────┐
│ [Logo] Inventario    🔔(3)  👤 Alex Zapata ▼  🚪 Salir │
├─────────────────────────────────────────────────────────┤
│ ┌──────┬──────┬──────┬──────┬──────┬──────┐            │
│ │Total │En Uso│Report│Ubicad│Sin   │Fuera │            │
│ │391   │45    │3     │285   │106   │2     │            │
│ └──────┴──────┴──────┴──────┴──────┴──────┘            │
│                                                         │
│ 🚨 ALERTAS URGENTES (2)                                │
│ • Gafas VR - Daño severo hace 3 horas [Ver]           │
│ • Compu 05 - Sin check-out 6 horas [Contactar]        │
│                                                         │
│ EQUIPOS EN USO AHORA (45)        [🔍] [⚙️Filtros]     │
│ ┌────────────────────────────────────────────────┐    │
│ │Código  │Nombre    │Usuario │Ubicación│Desde   │    │
│ │920510..│Compu 05  │Victor  │MediaLab │2:00    │    │
│ │920510..│Gafas VR  │María   │Fuera⚠️  │1:00    │    │
│ │...     │...       │...     │...      │...     │    │
│ └────────────────────────────────────────────────┘    │
│                                                         │
│ REPORTES PENDIENTES     PERMISOS PENDIENTES            │
│ • Compu 05 [Ver]        • Gafas VR [Aprobar/Rechazar] │
│ • Kit Arduino [Ver]                                    │
└─────────────────────────────────────────────────────────┘
```

---

#### Pantalla: Mapa de Inventario

```
┌─────────────────────────────────────────────────┐
│ MAPA DE INVENTARIO                              │
├─────────────────────────────────────────────────┤
│ [📥 Generar Reporte Excel]                     │
│                                                 │
│ RESUMEN                                         │
│ ████████████████░░░░ 285 Ubicados (73%)       │
│ ░░░░░░░░████████████ 106 Sin ubicar (27%)     │
│                                                 │
│ EQUIPOS UBICADOS                                │
│ ┌─────────────────────────────────────────┐    │
│ │ 📍 Laboratorio IoT  180 eq    [Ver]    │    │
│ │ 📍 Media Lab         45 eq    [Ver]    │    │
│ │ 📍 Aula 205          32 eq    [Ver]    │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ EQUIPOS SIN UBICACIÓN                           │
│ ┌─────────────────────────────────────────┐    │
│ │ 🔍 Nunca registrados  89 eq  [Lista]   │    │
│ │ 🔍 Sin uso 30+ días   17 eq  [Lista]   │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ FUERA DEL CENTRO (2)                            │
│ • Gafas VR - María - Retorno: 05/Nov          │
│ • Proyector - Carlos - ⚠️ Vencido 2 días     │
└─────────────────────────────────────────────────┘
```

---

## 9. REGLAS DE NEGOCIO

### 9.1 Check-in/Check-out

**RN-001:** Un equipo solo puede tener 1 check-in activo (sin check-out)

**RN-002:** Si profesor intenta check-in de equipo en uso:
- Bloquear
- Mostrar quién lo tiene y desde cuándo
- Ofrecer "Notificar al usuario" o "Cancelar"

**RN-003:** Recordatorio de check-out:
- Enviar email después de 2 horas sin check-out
- Email explica importancia del check-out

**RN-004:** Check-out automático:
- Después de 4 horas totales sin check-out
- Marca `is_auto_checkout = TRUE`
- Envía email informativo

**RN-005:** Al check-in, si equipo sin `current_location`:
- Registrar ubicación como primera ubicación

**RN-006:** Al check-out:
- Actualizar `last_seen_at`, `total_uses`
- Recalcular `location_history`
- Actualizar `primary_location` y `location_confidence`

### 9.2 Reportes de Daños

**RN-007:** Foto obligatoria en reportes

**RN-008:** Descripción mínima 10 caracteres

**RN-009:** Si severidad "Severo":
- Cambiar status a "dañado"
- Bloquear check-ins futuros
- Email inmediato a custodio

**RN-010:** Si "Leve" o "Moderado":
- No bloquear
- Permitir check-ins con advertencia
- Email a custodio

**RN-011:** Solo custodio (o admin) puede resolver reporte

**RN-012:** Al resolver:
- Si status "dañado" → cambiar a "disponible"
- Registrar quién y cuándo

### 9.3 Permisos de Salida

**RN-013:** Solo equipos con `can_exit_facility=TRUE` muestran opción

**RN-014:** Foto de permiso firmado obligatoria

**RN-015:** Fecha retorno debe ser futura

**RN-016:** Solo custodio (o admin) puede aprobar/rechazar

**RN-017:** Al aprobar:
- `status = "approved"`
- Registrar aprobador y fecha
- Notificar solicitante

**RN-018:** Al rechazar:
- `status = "rejected"`
- Permitir motivo opcional
- Notificar con motivo

**RN-019:** Check-in fuera del Centro:
- Solo si permiso aprobado activo
- Solo usuario que solicitó
- `is_outside_facility = TRUE`

**RN-020:** Otro usuario intenta check-in con permiso activo:
- Bloquear
- Mostrar mensaje informativo

**RN-021:** Check-out fuera del Centro:
- `permit.status = "returned"`
- `permit.returned_at = NOW()`
- `is_outside_facility = FALSE`

**RN-022:** Equipo no regresa en fecha esperada:
- Generar alerta en dashboard
- Email a custodio

### 9.4 Ubicaciones

**RN-023:** Cálculo de ubicación habitual:
- Se actualiza en cada check-out
- Ubicación con mayor % de usos
- Mínimo 3 usos para considerar

**RN-024:** Cálculo de confianza:
- % de usos en ubicación más frecuente
- Si <50% → "sin ubicación fija"

**RN-025:** Equipos "sin ubicar":
- `total_uses = 0` (nunca registrados)
- O `last_seen_at > 30 días`
- O `location_confidence < 30%`

**RN-026:** Actualización `location_history`:
- Trigger en check-out
- Recalcula use_count y percentage

### 9.5 Roles y Permisos

**RN-027:** Profesor ve:
- Sus check-ins activos
- Equipos que ha usado
- Reportes que creó
- Solicitudes que creó

**RN-028:** Custodio ve:
- Todos sus equipos (`custodian_id`)
- Todos sus check-ins, reportes, solicitudes
- NO ve equipos de otros custodios

**RN-029:** Admin ve TODO

**RN-030:** Implementar middleware de autorización en Node.js para reforzar permisos

### 9.6 Notificaciones Email

**RN-031:** Enviar a custodio cuando:
- Reporte de daño en sus equipos (inmediato)
- Solicitud de permiso salida (inmediato)
- Equipo no regresa en fecha (diario 8 AM)

**RN-032:** Enviar a usuario cuando:
- Solicitud aprobada (inmediato)
- Solicitud rechazada (inmediato)
- Recordatorio check-out (2 horas)
- Check-out automático (4 horas)

**RN-033:** NO enviar por:
- Check-ins normales
- Check-outs normales
- Consultas

### 9.7 Valores por Defecto

**RN-034:** Al importar, si falta:
- `brand/model/serial` → "Sin especificar"
- `acquisition_date` → NULL
- `value` → 0
- `classroom_id` → NULL
- `can_exit_facility` → FALSE

**RN-035:** `inventory_code`:
- Único en sistema
- No vacío
- Validar en import y creación

---

## 10. STACK TECNOLÓGICO

### 10.1 Backend: Node.js + Express

**Framework:** Express.js 4.x

**Base de datos:**
- MySQL 8.0
- Sequelize ORM o mysql2 (queries directas)

**Componentes principales:**
- Express.js (servidor web)
- JWT (jsonwebtoken) para autenticación
- Bcrypt para hash de contraseñas
- Multer para upload de imágenes
- AWS S3 o almacenamiento local para fotos
- Nodemailer para envío de emails
- Express-validator para validaciones
- Cors para manejo de CORS
- Dotenv para variables de entorno

**Middleware:**
- Autenticación JWT
- Autorización por roles
- Rate limiting
- Error handling
- Request logging (Morgan)

**Estructura de carpetas:**
```
backend/
├── src/
│   ├── config/         # Configuración DB, S3, etc
│   ├── controllers/    # Controladores
│   ├── models/         # Modelos de datos
│   ├── routes/         # Rutas API
│   ├── middlewares/    # Middlewares personalizados
│   ├── services/       # Lógica de negocio
│   ├── utils/          # Utilidades
│   └── validators/     # Esquemas de validación
├── uploads/            # Archivos temporales
├── tests/              # Tests unitarios e integración
├── server.js           # Punto de entrada
└── package.json

### 10.2 Frontend Web: React

**Framework:** React 18+ con Create React App o Vite

**Bibliotecas principales:**
- React Router DOM v6 (navegación)
- Axios (peticiones HTTP)
- React Query o SWR (cache y sincronización)
- Tailwind CSS (estilos)
- Headless UI o Material-UI (componentes)
- React Hook Form (formularios)
- Yup o Zod (validación)
- Recharts o Chart.js (gráficos)
- date-fns (manejo de fechas)
- React-toastify (notificaciones)

**Estado global:**
- Context API + useReducer
- O Zustand (más simple)
- O Redux Toolkit (si se necesita algo más robusto)

**Estructura de carpetas:**
```
frontend/
├── public/
├── src/
│   ├── components/     # Componentes reutilizables
│   ├── pages/          # Páginas/vistas
│   ├── hooks/          # Custom hooks
│   ├── services/       # Servicios API
│   ├── context/        # Context providers
│   ├── utils/          # Utilidades
│   ├── assets/         # Imágenes, iconos
│   └── styles/         # Estilos globales
├── App.js
└── index.js
```

**Hosting:** 
- Frontend: Netlify, Vercel o GitHub Pages
- Backend: Railway, Render, Heroku o VPS

### 10.3 App Móvil: Flutter

**Versión:** Flutter 3.10+

**Paquetes:**
- `dio` (cliente HTTP)
- `mobile_scanner` (códigos de barras)
- `image_picker`
- `cached_network_image`
- `shared_preferences` (almacenamiento local)
- `intl`
- `provider` o `riverpod`
- `go_router`
- `flutter_secure_storage`

**Integración con backend:**
- Consumo de API REST
- Manejo de tokens JWT
- Upload de imágenes

**Soporte:**
- Android: minSdkVersion 21 (Android 5.0+)
- iOS: iOS 12+

**Distribución piloto:**
- Android: APK directo
- iOS: TestFlight (opcional)

### 10.4 Herramientas

**Base de datos:**
- MySQL Workbench (diseño y administración)
- phpMyAdmin (alternativa web)
- Migraciones con Sequelize o scripts SQL

**API Testing:**
- Postman o Insomnia
- Thunder Client (VS Code)

**Testing:**
- Backend: Jest + Supertest
- Frontend: Jest + React Testing Library
- App: Flutter test framework

**Monitoreo (post-MVP):**
- Sentry (error tracking)
- PM2 (gestión de procesos Node.js)
- MySQL monitoring

---

## 11. PLAN DE IMPLEMENTACIÓN

### 11.1 Cronograma de 4 Semanas

**SEMANA 1: Setup y Fundamentos**
- Días 1-2: Configurar backend Node.js (BD MySQL, Auth JWT, Storage)
- Días 3-4: Implementar login web + móvil
- Día 5: Importar datos piloto, crear usuarios

**SEMANA 2: App Móvil Core**
- Día 1: Escáner de códigos
- Días 2-3: Check-in/out individual
- Día 4: Check-in/out grupal (clase)
- Día 5: Refinamiento y testing

**SEMANA 3: Reportes y Automatización**
- Días 1-2: Reportar daños con fotos
- Día 3: Permisos de salida
- Días 4-5: Notificaciones automáticas, check-out automático

**SEMANA 4: Dashboard Web**
- Día 1: Dashboard principal custodio
- Día 2: Listados y detalle equipos
- Día 3: Mapa de inventario
- Día 4: Reportes y permisos
- Día 5: Panel admin

**SEMANA 5 (Opcional): Testing y Polish**

### 11.2 Recursos

**Humanos:**
- 1 desarrollador full-stack
- 120-160 horas
- 4-5 semanas tiempo completo

**Infraestructura:**
- Backend hosting (Railway/Render): $0-7/mes (plan free o básico)
- Frontend hosting (Netlify/Vercel): $0
- Base de datos MySQL: $0-10/mes (plan free o básico)
- Dominio: $1-2/mes (opcional)
- **Total: $0-20/mes**

---

## 12. CRITERIOS DE ACEPTACIÓN

### 12.1 Funcionales

- **CA-001:** Login con email/password ✓
- **CA-002:** Escanear código de barras ✓
- **CA-003:** Check-in individual en <30 seg ✓
- **CA-004:** Check-in grupal 20 equipos en <2 min ✓
- **CA-005:** Check-out manual ✓
- **CA-006:** Notificación después de 2 horas ✓
- **CA-007:** Check-out automático después de 4 horas ✓
- **CA-008:** Reportar daño con foto en <2 min ✓
- **CA-009:** Custodio recibe email inmediato ✓
- **CA-010:** Equipo se bloquea automáticamente ✓
- **CA-011:** Solicitar permiso salida ✓
- **CA-012:** Custodio recibe notificación ✓
- **CA-013:** Custodio aprobar/rechazar ✓
- **CA-014:** Solo autorizado puede check-in fuera ✓
- **CA-015:** Dashboard tiempo real ✓
- **CA-016:** Ver ubicaciones ✓
- **CA-017:** Ver historial completo ✓
- **CA-018:** Lista equipos sin ubicar ✓
- **CA-019:** Marcar reporte resuelto ✓
- **CA-020:** Importar equipos Excel ✓
- **CA-021:** Crear usuarios ✓

### 12.2 No Funcionales

- **CA-022:** Android 10+ sin crashes ✓
- **CA-023:** iOS 14+ sin crashes ✓
- **CA-024:** Chrome/Safari/Edge ✓
- **CA-025:** Dashboard carga <3 seg ✓
- **CA-026:** Escaneo <2 seg ✓
- **CA-027:** Upload foto <10 seg ✓
- **CA-028:** 50 usuarios concurrentes ✓
- **CA-029:** Queries <500ms (95%) ✓
- **CA-030:** Uptime >99% ✓

### 12.3 Seguridad

- **CA-031:** Passwords hasheados ✓
- **CA-032:** Autorización por roles en backend ✓
- **CA-033:** Solo custodio/admin resuelve ✓
- **CA-034:** Solo custodio/admin aprueba ✓
- **CA-035:** Fotos solo autenticados ✓

### 12.4 Usabilidad

- **CA-036:** Intuitivo sin capacitación ✓
- **CA-037:** Mensajes error claros ✓
- **CA-038:** Responsive (tablet) ✓
- **CA-039:** Navegación consistente ✓

---

## 13. PLAN DE PILOTO

### 13.1 Objetivo

Validar que el MVP:
- Funciona sin bugs críticos
- Es adoptado por profesores
- Resuelve problema de trazabilidad
- Es escalable

### 13.2 Alcance

**Duración:** 2-3 semanas

**Equipos:** 20-30 del inventario de Alex (Media Lab)

**Usuarios:**
- Alex Zapata (custodio)
- 1-2 instructores

**Ubicación:** Media Lab

### 13.3 Preparación

**2 semanas antes:**
- Sistema MVP funcional
- Testing completo
- Criterios de aceptación cumplidos

**1 semana antes:**
- Importar 20-30 equipos
- Crear cuentas usuarios
- Instalar app en celulares
- Material capacitación (1 página)

**Día 1:**
- Capacitación 15 min
- Demo en vivo
- Entrega credenciales
- Q&A

### 13.4 Métricas

**Adopción:**
- % clases con check-in (meta: >80%)
- % profesores usando app (meta: 100%)
- Tiempo promedio check-in (meta: <30 seg)
- % check-outs olvidados (meta: <20%)

**Trazabilidad:**
- % equipos con ubicación (meta: 100%)
- Usos por equipo (meta: >3)
- % confianza ubicación >70% (meta: >80%)

**Calidad:**
- Bugs críticos (meta: <5)
- Reportes creados (cualquier # = éxito)
- Tiempo resolver reporte (meta: <2 días)

**Satisfacción:**
- Facilidad uso (meta: >8/10)
- Utilidad (meta: >8/10)
- Recomendar (meta: >7/10)

### 13.5 Checklist Diario

**Cada día:**
- Revisar logs errores
- Verificar emails enviados
- Check equipos sin check-out excesivo
- Contacto usuarios
- Documentar bugs

**Cada semana:**
- Reunión 15 min usuarios
- Recopilar feedback
- Priorizar bugs/mejoras
- Actualizar métricas

### 13.6 Criterios de Éxito

✅ **Técnicamente estable:** 0 bugs críticos, <5 menores, uptime >98%

✅ **Adoptado:** >80% clases registradas, feedback >7/10

✅ **Resuelve problema:** 100% equipos ubicados, tiempo real funcional

✅ **Escalable:** Usuarios piden expandir, Alex ahorra tiempo

### 13.7 Plan Post-Piloto

**Si exitoso:**
- Semanas 1-2: Corregir bugs, mejoras UX
- Mes 2: Escalar a 100 equipos, 5 profesores, 2-3 aulas
- Mes 3: Todos 391 equipos, todos profesores, todas aulas
- Mes 4+: Otros custodios, funcionalidades Fase 2

**Si falla:**
- Analizar causas
- Rediseñar
- Segundo piloto

---

## 14. MÉTRICAS DE ÉXITO

### 14.1 Métricas Primarias (3 meses)

**M-001: Trazabilidad Completa**
- Meta: 100% equipos con ubicación
- Baseline: 0%
- Target 3 meses: 95%

**M-002: Reducción Tiempo Trámites**
- Meta: 2 semanas → 2 días
- Baseline: 14 días
- Target: 2 días

**M-003: Identificación Responsables**
- Meta: 100% daños con responsable
- Baseline: ~30%
- Target: 100%

### 14.2 Métricas Secundarias

**M-004: Adopción** - >90% profesores usan app

**M-005: Pérdidas** - 0 equipos extraviados sin ubicación

**M-006: Eficiencia** - Auditoría <1 día (era 3-5 días)

---

## 15. ANEXOS

### 15.1 Glosario

- **Check-in:** Registrar inicio de uso
- **Check-out:** Registrar fin de uso
- **Custodio:** Responsable legal de equipos
- **Ubicación habitual:** Donde se usa más frecuentemente
- **Confianza:** % de seguridad de ubicación
- **Permiso de salida:** Autorización para sacar equipo
- **Sin ubicar:** Nunca registrado o sin uso 30+ días
- **Clase:** Check-in grupal de múltiples equipos
- **JWT:** JSON Web Token para autenticación
- **Middleware:** Capa intermedia que procesa peticiones

### 15.2 Excel Template

**Columnas requeridas:**

| inventory_code | name | brand | model | serial_number | acquisition_date | value | custodian_email | classroom | can_exit_facility |
|---|---|---|---|---|---|---|---|---|---|
| 920510117200 | Gafas Oculus VR | Meta | Quest 2 | ABC123 | 15/01/2023 | 1500000 | alex@centro.edu.co | Media Lab | SI |

### 15.3 Variables de Entorno

**Backend Node.js:**
```
# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_NAME=inventario_db
DB_USER=root
DB_PASSWORD=tu_password

# JWT
JWT_SECRET=tu_secret_key_aqui
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_password_aplicacion

# Storage (si usas S3)
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_BUCKET_NAME=inventario-imagenes
AWS_REGION=us-east-1

# Frontend URL (para CORS)
FRONTEND_URL=http://localhost:3000
```

**Frontend React:**
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENVIRONMENT=development
```

**Flutter:**
```dart
const apiUrl = 'http://localhost:5000/api';
// Para producción: 'https://tu-dominio.com/api'
```

### 15.4 Checklist Pre-Deploy

**Base de Datos:**
- [ ] Todas tablas creadas en MySQL
- [ ] Índices aplicados
- [ ] Foreign keys configuradas
- [ ] Triggers funcionando (si aplica)
- [ ] Stored procedures creadas (si aplica)
- [ ] Usuario de BD con permisos correctos

**Backend Node.js:**
- [ ] Variables de entorno configuradas
- [ ] JWT secret generado
- [ ] Middleware de autenticación funcionando
- [ ] Middleware de autorización por roles
- [ ] Validaciones de entrada implementadas
- [ ] Manejo de errores global
- [ ] CORS configurado correctamente
- [ ] Rate limiting configurado
- [ ] Logs configurados

**Storage:**
- [ ] Carpeta uploads creada (si es local)
- [ ] Permisos de escritura configurados
- [ ] S3 bucket configurado (si aplica)
- [ ] Límites de tamaño implementados (5MB)

**Frontend React:**
- [ ] Build de producción generado
- [ ] Variables de entorno configuradas
- [ ] Desplegado en Netlify/Vercel
- [ ] Dominio conectado (opcional)
- [ ] SSL activo
- [ ] Rutas protegidas funcionando
- [ ] Interceptores de axios configurados

**App Móvil:**
- [ ] Build Android funcional
- [ ] Build iOS funcional (opcional)
- [ ] Permisos cámara correctos
- [ ] APK firmado

**Notificaciones:**
- [ ] Emails de prueba funcionando
- [ ] Templates revisados
- [ ] SMTP configurado

**Monitoreo:**
- [ ] Error logging (opcional)
- [ ] Backups automáticos
- [ ] Plan respuesta incidentes

### 15.5 Próximos Pasos (Fase 2)

1. Notificaciones push
2. Modo offline
3. Estadísticas avanzadas
4. Integración sistema académico
5. Geolocalización GPS
6. Exportación PDF seguros
7. Firma digital
8. Uso simultáneo equipos
9. App para técnicos
10. Panel métricas ejecutivas

---

## FIN DEL PRD

**Versión:** 1.0  
**Última actualización:** Noviembre 2025  
**Este documento contiene toda la especificación necesaria para implementar el MVP del Sistema de Trazabilidad de Inventario.**

**Próximo paso:** Usar este PRD con Claude Code para iniciar desarrollo.
