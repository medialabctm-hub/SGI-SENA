# Documentación de Rutas de API

Este documento contiene todas las rutas de API disponibles en el sistema SGE-SENA.

## Base URL
- Desarrollo: `http://localhost:3000`
- Producción: Según configuración del servidor

---

## 🔐 Autenticación (`/api/auth`)

### Rutas Públicas (sin autenticación)

| Método | Ruta | Descripción | Rate Limiting |
|--------|------|-------------|---------------|
| POST | `/api/auth/register` | Registro de usuario | ✅ registerLimiter |
| POST | `/api/auth/login` | Login de usuario | ✅ authLimiter |
| POST | `/api/auth/recuperar-contrasena` | Solicitar recuperación de contraseña | ✅ passwordResetLimiter |
| GET | `/api/auth/validar-token/:token` | Validar token de recuperación | ✅ passwordResetLimiter |
| POST | `/api/auth/restablecer-contrasena` | Restablecer contraseña con token | ✅ passwordResetLimiter |

### Rutas Protegidas (requieren autenticación)

| Método | Ruta | Descripción | Permisos Requeridos |
|--------|------|-------------|---------------------|
| POST | `/api/auth/cambiar-contrasena` | Cambiar contraseña obligatorio | Autenticado |
| GET | `/api/auth/me` | Perfil del usuario autenticado | Autenticado |
| GET | `/api/auth/users` | Listar usuarios | `users:view` |
| GET | `/api/auth/user/cedula/:cedula` | Buscar usuario por cédula | `users:view` |
| GET | `/api/auth/user/:id` | Obtener detalle de usuario | Propio perfil o `users:view` |
| PUT | `/api/auth/user/:id` | Actualizar usuario | Propio perfil o `users:update` |
| DELETE | `/api/auth/user/:id` | Eliminar usuario | `users:delete` |

---

## 🖥️ Equipos (`/api/equipos`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos | Rate Limiting |
|--------|------|-------------|---------------------|---------------|
| POST | `/api/equipos` | Registrar nuevo equipo | `equipos:create` | ✅ writeLimiter |
| GET | `/api/equipos` | Listar equipos | `equipos:view` o `equipos:view_own` | |
| GET | `/api/equipos/mis-equipos/asignados` | Obtener equipos asignados al usuario | Autenticado | |
| GET | `/api/equipos/asignaciones` | Listar todas las asignaciones | `equipos:view` o `equipos:assign` | |
| GET | `/api/equipos/:codigo` | Consultar equipo por código | `equipos:view_detail` o `equipos:view_own` | |
| PUT | `/api/equipos/:codigo` | Actualizar equipo | `equipos:update` | ✅ writeLimiter |
| DELETE | `/api/equipos/:codigo` | Eliminar equipo | `equipos:delete` | ✅ strictLimiter |
| POST | `/api/equipos/asignar` | Asignar equipo a usuario | `equipos:assign` o `equipos:assign_to_aprendiz` | ✅ writeLimiter |
| DELETE | `/api/equipos/asignaciones/:id` | Eliminar/Desactivar asignación | `equipos:assign` o `equipos:assign_to_aprendiz` | |
| GET | `/api/equipos/verificacion/ambientes` | Obtener equipos de ambientes del instructor | Instructor | |
| POST | `/api/equipos/verificacion` | Registrar verificación física de inventario | Instructor | ✅ writeLimiter |
| GET | `/api/equipos/verificacion/historial` | Consultar historial de verificaciones | `equipos:view` o `equipos:view_own` | |
| GET | `/api/equipos/:codigo/historial-verificaciones` | Obtener historial de verificaciones de un equipo | `equipos:view` o `equipos:view_own` | |

---

## 🖼️ Imágenes de Equipos (`/api/equipos`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos | Rate Limiting |
|--------|------|-------------|---------------------|---------------|
| POST | `/api/equipos/:codigoEquipo/imagenes` | Subir imágenes para un equipo (máx. 10) | `equipos:update` | ✅ writeLimiter |
| GET | `/api/equipos/:codigoEquipo/imagenes` | Listar imágenes de un equipo | `equipos:view` o `equipos:view_own` | ✅ readLimiter |
| GET | `/api/equipos/imagenes/:idImagen` | Obtener una imagen específica | `equipos:view` o `equipos:view_own` | ✅ readLimiter |
| PUT | `/api/equipos/imagenes/:idImagen` | Actualizar información de una imagen | `equipos:update` | ✅ writeLimiter |
| PATCH | `/api/equipos/imagenes/:idImagen/principal` | Marcar imagen como principal | `equipos:update` | ✅ writeLimiter |
| DELETE | `/api/equipos/imagenes/:idImagen` | Eliminar una imagen | `equipos:update` | ✅ writeLimiter |

---

## 🏢 Ambientes (`/api/ambientes`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos |
|--------|------|-------------|---------------------|
| GET | `/api/ambientes` | Listar ambientes (con filtros y estadísticas) | `ambientes:view` |
| GET | `/api/ambientes/activos` | Listar ambientes activos (versión simplificada) | `ambientes:view` |
| GET | `/api/ambientes/:id` | Obtener un ambiente específico | `ambientes:view` |
| POST | `/api/ambientes` | Crear nuevo ambiente | `ambientes:create` |
| PUT | `/api/ambientes/:id` | Actualizar ambiente | `ambientes:update` |
| DELETE | `/api/ambientes/:id` | Eliminar ambiente | `ambientes:delete` |
| POST | `/api/ambientes/asignar` | Asignar ambiente a instructor (permanente) | `ambientes:update` |
| DELETE | `/api/ambientes/asignaciones/:id_responsabilidad` | Desasignar ambiente de instructor | `ambientes:update` |
| GET | `/api/ambientes/asignaciones` | Listar asignaciones permanentes de ambientes | `ambientes:view` |

---

## 📚 Clases (`/api/clases`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos | Rate Limiting |
|--------|------|-------------|---------------------|---------------|
| POST | `/api/clases` | Crear clase | `classes:create` | ✅ writeLimiter |
| GET | `/api/clases` | Listar clases | `classes:view` | |
| GET | `/api/clases/:id` | Obtener una clase específica | `classes:view` | |
| PUT | `/api/clases/:id` | Actualizar clase (solo programadas) | `classes:update` | ✅ writeLimiter |
| POST | `/api/clases/:id/iniciar` | Iniciar clase (cambiar a "En Curso") | `classes:update` | |
| POST | `/api/clases/:id/finalizar` | Finalizar clase (cambiar a "Finalizada") | `classes:update` | |
| POST | `/api/clases/:id/cancelar` | Cancelar clase | `classes:update` | |
| POST | `/api/clases/:id/participantes` | Agregar participantes a una clase | `classes:update` | ✅ writeLimiter |
| GET | `/api/ambientes/:id_ambiente/responsables` | Obtener responsables actuales de un ambiente | `ambientes:view` | |
| GET | `/api/ambientes/:id_ambiente/responsables-tiempo-real` | Consultar responsables en tiempo real | `ambientes:view` | |
| POST | `/api/clases/sincronizar-responsabilidades` | Sincronizar responsabilidades basándose en horarios | `classes:update` | |

---

## ⏰ Horarios (`/api/horarios`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos |
|--------|------|-------------|---------------------|
| POST | `/api/horarios/importar` | Importar horarios desde Excel | `classes:create` |
| GET | `/api/horarios/plantilla` | Descargar plantilla Excel | `classes:view` |

---

## 📢 Novedades (`/api/novedades`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos | Rate Limiting |
|--------|------|-------------|---------------------|---------------|
| POST | `/api/novedades` | Crear novedad | `novedades:create` | ✅ writeLimiter |
| GET | `/api/novedades` | Listar novedades | `novedades:view` o `novedades:view_own` | |
| GET | `/api/novedades/:id` | Obtener detalle de novedad | `novedades:view` o `novedades:view_own` | |
| PUT | `/api/novedades/:id/estado` | Actualizar estado de novedad | `novedades:update` o `novedades:resolve` | ✅ writeLimiter |

---

## 🔧 Mantenimiento (`/api/mantenimiento`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos |
|--------|------|-------------|---------------------|
| POST | `/api/mantenimiento` | Crear mantenimiento | `mantenimiento:create` |
| GET | `/api/mantenimiento` | Listar mantenimientos | `mantenimiento:view` o `mantenimiento:view_own` |
| GET | `/api/mantenimiento/:id` | Obtener detalle de mantenimiento | `mantenimiento:view` o `mantenimiento:view_own` |
| PUT | `/api/mantenimiento/:id/fecha-proximo` | Actualizar fecha_proximo de mantenimiento | `mantenimiento:update` |
| PUT | `/api/mantenimiento/:id/estado` | Actualizar estado de mantenimiento | `mantenimiento:update` |
| DELETE | `/api/mantenimiento/:id` | Eliminar mantenimiento | `mantenimiento:delete` |

---

## 📊 Reportes (`/api/reportes`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos | Rate Limiting |
|--------|------|-------------|---------------------|---------------|
| POST | `/api/reportes` | Crear reporte | `reportes:create` | ✅ writeLimiter |
| GET | `/api/reportes` | Listar reportes | `reportes:view` | |
| GET | `/api/reportes/:id` | Obtener detalle de reporte | `reportes:view` | |
| PUT | `/api/reportes/:id` | Actualizar reporte | `reportes:update` | ✅ writeLimiter |
| DELETE | `/api/reportes/:id` | Eliminar reporte | `reportes:delete` | ✅ strictLimiter |

---

## 📈 Estadísticas (`/api/estadisticas`)

Todas las rutas requieren autenticación y rol de Administrador.

| Método | Ruta | Descripción | Permisos Requeridos | Rate Limiting |
|--------|------|-------------|---------------------|---------------|
| GET | `/api/estadisticas` | Obtener estadísticas del sistema | Rol: Administrador | ✅ readLimiter |

---

## 🔔 Notificaciones (`/api/notifications`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos |
|--------|------|-------------|---------------------|
| GET | `/api/notifications` | Ver propias notificaciones | `notificaciones:view` |
| POST | `/api/notifications` | Crear notificación para otro usuario | `notificaciones:create` |
| PATCH | `/api/notifications/read-all` | Marcar todas como leídas | `notificaciones:view` |
| PATCH | `/api/notifications/:id/read` | Marcar una como leída | `notificaciones:view` |

---

## 🔑 Permisos (`/api/permissions`)

Todas las rutas requieren autenticación y permiso `system:view_config`.

| Método | Ruta | Descripción | Permisos Requeridos |
|--------|------|-------------|---------------------|
| GET | `/api/permissions` | Obtener todos los permisos disponibles | `system:view_config` |
| GET | `/api/permissions/roles` | Obtener todos los roles y sus permisos | `system:view_config` |
| GET | `/api/permissions/roles/:roleName` | Obtener permisos de un rol específico | `system:view_config` |
| GET | `/api/permissions/me` | Obtener permisos del usuario autenticado | `system:view_config` |
| POST | `/api/permissions/check` | Verificar si el usuario tiene un permiso | `system:view_config` |

---

## 🎫 Códigos de Invitación (`/api/invitation-codes`)

### Ruta Pública

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/invitation-codes/validate` | Validar código de invitación (usado en registro) |

### Rutas Protegidas (Solo Administradores)

| Método | Ruta | Descripción | Permisos Requeridos |
|--------|------|-------------|---------------------|
| POST | `/api/invitation-codes` | Crear código de invitación | Rol: Administrador |
| GET | `/api/invitation-codes` | Obtener todos los códigos | Rol: Administrador |
| GET | `/api/invitation-codes/:id` | Obtener código por ID | Rol: Administrador |
| DELETE | `/api/invitation-codes/:id` | Eliminar código | Rol: Administrador |
| PATCH | `/api/invitation-codes/:id/deactivate` | Desactivar código | Rol: Administrador |

---

## ⚙️ Preferencias (`/api/preferences`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/preferences` | Obtener preferencias del usuario autenticado |
| PUT | `/api/preferences` | Actualizar preferencias del usuario autenticado |

---

## 📥 Importación (`/api/import`)

Todas las rutas requieren autenticación.

| Método | Ruta | Descripción | Permisos Requeridos |
|--------|------|-------------|---------------------|
| POST | `/api/import/equipos` | Importar equipos desde Excel | `equipos:create` |
| POST | `/api/import/usuarios` | Importar usuarios desde Excel | `users:create` |

---

## 🔗 Webhooks (`/webhook`)

### Ruta Pública (requiere x-api-key header)

| Método | Ruta | Descripción | Rate Limiting |
|--------|------|-------------|---------------|
| POST | `/webhook/externo` | Recibir datos de sistemas externos | ✅ webhookLimiter |

---

## 🏥 Health Check

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Verificar estado del servidor |

---

## 📁 Archivos Estáticos

| Ruta | Descripción |
|------|-------------|
| `/uploads` | Servir archivos estáticos (imágenes de equipos) |

---

## Notas Importantes

### Autenticación
- La mayoría de las rutas requieren autenticación mediante token JWT en el header `Authorization: Bearer <token>`
- Algunas rutas públicas están protegidas con rate limiting

### Rate Limiting
- **registerLimiter**: Para registro de usuarios
- **authLimiter**: Para login
- **passwordResetLimiter**: Para recuperación de contraseña
- **writeLimiter**: Para operaciones de escritura
- **readLimiter**: Para operaciones de lectura
- **strictLimiter**: Para operaciones críticas (eliminaciones)
- **webhookLimiter**: Para webhooks externos

### Permisos
- El sistema utiliza un sistema de permisos basado en roles (RBAC)
- Los permisos se verifican mediante middleware antes de ejecutar los controladores
- Algunas rutas permiten acceso basado en propiedad (own) o permisos completos

### Validación
- Muchas rutas incluyen validación de esquemas usando validators
- Los errores de validación se devuelven con detalles específicos

### CORS
- El servidor está configurado para aceptar requests desde el origen configurado
- En desarrollo: `http://localhost:5173`
- En producción: según configuración

---

## Ejemplos de Uso

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "cedula": "1234567890",
  "contrasena": "password123"
}
```

### Obtener Equipos (con autenticación)
```bash
GET /api/equipos
Authorization: Bearer <token>
```

### Crear Clase
```bash
POST /api/clases
Authorization: Bearer <token>
Content-Type: application/json

{
  "id_ambiente": 1,
  "fecha": "2024-01-15",
  "hora_inicio": "08:00:00",
  "hora_fin": "10:00:00",
  "id_instructor": 2
}
```

---

*Última actualización: Generado automáticamente desde el código fuente*

