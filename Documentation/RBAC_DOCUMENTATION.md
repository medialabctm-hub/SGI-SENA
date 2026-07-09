# Sistema de Control de Acceso Basado en Roles (RBAC)

**Última actualización:** Enero 2026

## 📋 Tabla de Contenidos
1. [Descripción General](#descripción-general)
2. [Roles y Permisos](#roles-y-permisos)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Uso de Middlewares](#uso-de-middlewares)
5. [Ejemplos de Implementación](#ejemplos-de-implementación)
6. [Extensibilidad](#extensibilidad)
7. [Mejores Prácticas](#mejores-prácticas)

---

## Descripción General

Este sistema implementa un **Control de Acceso Basado en Roles (RBAC)** escalable y mantenible para la aplicación de Gestión de Equipos SENA. 

### Características Principales:
- ✅ **Permisos granulares**: Control fino sobre qué puede hacer cada rol
- ✅ **Middlewares reutilizables**: Fácil protección de rutas
- ✅ **Escalable**: Agregar nuevos roles/permisos es sencillo
- ✅ **Seguro**: Validación en cada capa (rutas, controladores)
- ✅ **Mantenible**: Código limpio y bien documentado

---

## Roles y Permisos

### Roles Existentes

#### 1. **Administrador**
**Permisos completos en todos los módulos**

| Módulo | Permisos |
|--------|----------|
| Usuarios | Ver, crear, editar, eliminar, gestionar roles |
| Equipos | Ver, crear, editar, eliminar, asignar |
| Novedades | Ver, crear, editar, eliminar, resolver |
| Mantenimiento | Ver, programar, editar, eliminar |
| Reportes | Ver, crear, exportar |
| Ambientes | Ver, crear, editar, eliminar |
| Clases | Ver, crear, actualizar, eliminar |
| Notificaciones | Ver, crear, broadcast |
| Sistema | Ver config, actualizar, auditoría |
| Roles | Gestionar roles y permisos (`roles:manage`) |

#### 2. **Instructor**
**Acceso de lectura amplio + creación limitada**

| Módulo | Permisos |
|--------|----------|
| Usuarios | Ver listado, ver detalle (NO puede crear, editar ni eliminar) |
| Equipos | Ver todos, ver detalle (NO puede crear, editar ni eliminar) |
| Novedades | Ver todas, crear, actualizar |
| Mantenimiento | Ver historial |
| Reportes | Ver, crear, exportar |
| Ambientes | Ver |
| Clases | Ver, crear, actualizar (sus clases) |
| Notificaciones | Ver propias |

**Casos de uso principales:**
- Consultar equipos y su estado (solo lectura)
- Ver listado de usuarios y aprendices asignados
- Registrar novedades y observaciones
- Generar reportes

**Restricciones importantes:**
- NO puede agregar nuevos equipos
- NO puede modificar o eliminar equipos existentes
- NO puede crear, editar ni eliminar usuarios
- NO puede ver estadísticas del dashboard (solo Admin)

#### 3. **Cuentadante**
**Gestión de su inventario y ambientes asignados; puede asignar equipos a aprendices**

| Módulo | Permisos |
|--------|----------|
| Usuarios | Ver listado, ver detalle (NO crear, editar ni eliminar) |
| Equipos | Ver todos, ver detalle, crear, editar, eliminar (su inventario), asignar a aprendices |
| Novedades | Ver todas, crear, eliminar propias |
| Mantenimiento | Ver, crear, editar, eliminar |
| Reportes | Ver, crear, actualizar, eliminar, exportar |
| Ambientes | Ver |
| Clases | Ver, crear, actualizar |
| Notificaciones | Ver propias |
| Sistema | Ver configuración |

**Casos de uso principales:**
- Gestionar equipos de sus ambientes asignados
- Asignar equipos a aprendices (como Instructor)
- Programar y gestionar mantenimientos
- Registrar y resolver novedades de su inventario
- Ver estadísticas del dashboard

#### 4. **Aprendiz**
**Acceso limitado solo a recursos propios**

| Módulo | Permisos |
|--------|----------|
| Usuarios | Ver solo su perfil (vía ruta de perfil) |
| Equipos | Ver solo equipos asignados (`equipos:view_own`) |
| Novedades | Ver y crear solo en equipos propios (`novedades:view_own`, `novedades:create_own`) |
| Mantenimiento | Ver solo de equipos propios |
| Reportes | Ver y crear |
| Notificaciones | Ver propias |

**Casos de uso principales:**
- Ver equipos que tiene asignados
- Reportar novedades de sus equipos
- Ver historial de mantenimiento
- Crear reportes de uso

---

## Arquitectura del Sistema

### Estructura de Archivos

```
backend/src/
├── config/
│   └── permissions.js          # Definición de permisos (PERMISSIONS, ROLE_PERMISSIONS, helpers)
├── middleware/
│   ├── authMiddleware.js       # Autenticación JWT; adjunta req.user (id, nombre, cedula, correo, id_rol, rol)
│   └── authorization.js       # requireRole, requirePermission, requireAnyPermission,
│                               # requireOwnership, requireAssignedEquipos, requirePermissionAndOwnership
├── routes/                     # Rutas protegidas con permisos (auth, equipos, ambientes, clases,
│                               # reportes, novedades, mantenimiento, notificaciones, aprendices,
│                               # estadisticas, horarios, import, invitationCode, permissions, etc.)
└── controller/
    └── ...                     # Validación adicional de negocio cuando aplica
```

La validación de permisos usa `hasPermissionFromDB` (consulta la tabla `Rol_Permisos` si existe, con fallback a `ROLE_PERMISSIONS` en `permissions.js`).

### Flujo de Autorización

```
Cliente → Ruta → authenticate → requirePermission/requireRole → Controlador → BD
                      ↓                    ↓
                 Valida JWT          Valida permisos
                 Adjunta user        según rol
```

---

## Uso de Middlewares

### 1. **authenticate**
Valida el token JWT y adjunta información completa del usuario al request.

```javascript
router.get('/endpoint', authenticate, controller)
```

**Adjunta a `req.user`:**
```javascript
{
  id: 123,              // id_usuario
  nombre: "Juan Pérez", // nombre_usuario
  cedula: "123456789",
  correo: "juan@example.com",
  id_rol: 1,
  rol: "Administrador"  // nombre_rol: 'Administrador' | 'Instructor' | 'Cuentadante' | 'Aprendiz'
}
```

### 2. **requireRole(roles)**
Requiere que el usuario tenga uno de los roles especificados.

```javascript
// Un solo rol
router.post('/admin-only', 
  authenticate,
  requireRole('Administrador'),
  controller
)

// Múltiples roles
router.get('/staff-area', 
  authenticate,
  requireRole(['Administrador', 'Instructor']),
  controller
)
```

### 3. **requirePermission(permission)**
Requiere que el usuario tenga un permiso específico. Internamente usa `hasPermissionFromDB` (consulta la tabla `Rol_Permisos` si existe, con fallback a `ROLE_PERMISSIONS` en `permissions.js`).

```javascript
import { PERMISSIONS } from '../config/permissions.js'

router.post('/equipos', 
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.CREATE),
  registrarEquipo
)
```

### 4. **requireAnyPermission(permissions[])**
Requiere que el usuario tenga al menos uno de los permisos. También usa `hasPermissionFromDB` por cada permiso.

```javascript
router.get('/equipos', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,      // Admin, Instructor
    PERMISSIONS.EQUIPOS.VIEW_OWN   // Aprendiz
  ]),
  listarEquipos
)
```

### 5. **requireOwnership(getOwnerId)**
Verifica que el recurso pertenezca al usuario (o sea admin).

```javascript
router.put('/user/:id', 
  authenticate,
  requireOwnership((req) => req.params.id),
  updateUser
)
```

### 6. **requireAssignedEquipos(getEquipos)**
Verifica que el usuario tenga equipos asignados (para aprendices). Admin, Instructor y Cuentadante pasan sin validar.

```javascript
router.get('/mis-equipos', 
  authenticate,
  requireAssignedEquipos(async (req) => await getEquiposByUserId(req.user.id)),
  controller
)
```

### 7. **requirePermissionAndOwnership(permission, getResourceOwnerId)**
Requiere un permiso Y que el recurso pertenezca al usuario (p. ej. editar perfil propio).

```javascript
router.put('/perfil/:id', 
  authenticate,
  requirePermissionAndOwnership(PERMISSIONS.USERS.UPDATE, (req) => req.params.id),
  actualizarPerfil
)
```

---

## Restricciones del Frontend

### Implementación de Control de Acceso en la UI

El frontend implementa restricciones visuales basadas en el rol del usuario autenticado, ocultando o deshabilitando funcionalidades según los permisos:

#### **Dashboard** (`frontend/src/pages/Dashboard.jsx`)

```javascript
// Se obtiene el rol del usuario desde localStorage (objeto user del login)
const userRole = user?.nombre_rol || ''
const isAdmin = userRole === 'Administrador'
const isInstructor = userRole === 'Instructor'
const isCuentadante = userRole === 'Cuentadante'

// Estadísticas: Admin, Instructor y Cuentadante
const shouldShowStats = isAdmin || isInstructor || isCuentadante

// Restricciones:
// 1. Card "Registrar Equipo" / Equipos - Visible para Administrador y Cuentadante (según permisos backend)
{isAdmin && <Card title="Registrar Equipo" to="/equipos" />}

// 2. Card "Usuarios" - Admin, Instructor y Cuentadante (todos tienen VIEW)
{(isAdmin || isInstructor || isCuentadante) && (
  <Card title="Usuarios" to="/usuarios" />
)}

// 3. Estadísticas - Admin, Instructor y Cuentadante
{shouldShowStats && (
  <div className="stats-card">
    <h3>Estadísticas Rápidas</h3>
    {/* ... */}
  </div>
)}
```

#### **Header/Navegación** (`frontend/src/components/Header.jsx`)

```javascript
<nav className="header-nav">
  <button onClick={() => go('/dashboard')}>Inicio</button>
  
  {/* Equipos: Administrador y Cuentadante (gestión de inventario) */}
  {(isAdmin || isCuentadante) && (
    <button onClick={() => go('/equipos')}>Equipos</button>
  )}
  
  {/* Usuarios: Admin, Instructor y Cuentadante (ver listado/detalle) */}
  {(isAdmin || isInstructor || isCuentadante) && (
    <button onClick={() => go('/usuarios')}>Usuarios</button>
  )}
  
  <button onClick={() => go('/config')}>Config</button>
</nav>
```

#### **Gestión de Usuarios** (`frontend/src/pages/Usuarios.jsx`)

```javascript
// Instructor y Cuentadante pueden VER usuarios pero NO editar ni eliminar (solo Admin tiene USERS.UPDATE/DELETE)
<td className="users-actions">
  <button onClick={() => openView(u)}>Ver</button>
  
  {/* Editar y Eliminar: Solo Administrador */}
  {isAdmin && (
    <>
      <button onClick={() => openEdit(u)}>Editar</button>
      <button onClick={() => setConfirm({ open: true, id: u.id })}>Eliminar</button>
    </>
  )}
</td>
```

### Resumen de Restricciones por Rol

| Funcionalidad | Admin | Instructor | Cuentadante | Aprendiz |
|---------------|-------|------------|-------------|----------|
| Ver Dashboard | ✅ | ✅ | ✅ | ✅ |
| Ver Estadísticas | ✅ | ✅ | ✅ | ❌ |
| Registrar/Editar Equipos | ✅ | ❌ | ✅ (su inventario) | ❌ |
| Consultar Equipos | ✅ | ✅ | ✅ | ✅ (solo asignados) |
| Ver Usuarios (nav) | ✅ | ✅ | ✅ | ❌ |
| Editar/Eliminar Usuarios | ✅ | ❌ | ❌ | ❌ |
| Gestionar Mantenimientos | ✅ | ❌ | ✅ | ❌ |
| Configuración | ✅ | ✅ | ✅ | ✅ |

> **Nota Importante:** Estas restricciones del frontend son **solo para mejorar la experiencia de usuario**. La seguridad real se implementa en el backend mediante middlewares de autorización. Nunca confíes solo en restricciones del frontend para seguridad.

---

## Ejemplos de Implementación

### Ejemplo 1: Proteger CRUD de Equipos

```javascript
import { PERMISSIONS } from '../config/permissions.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requirePermission, requireAnyPermission } from '../middleware/authorization.js'

// CREATE - Solo Administrador
router.post('/equipos', 
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.CREATE),
  registrarEquipo
)

// READ - Admin e Instructor ven todos, Aprendiz solo los suyos
router.get('/equipos', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  listarEquipos
)

// UPDATE - Solo Administrador
router.put('/equipos/:codigo', 
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  actualizarEquipo
)

// DELETE - Solo Administrador
router.delete('/equipos/:codigo', 
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.DELETE),
  eliminarEquipo
)
```

### Ejemplo 2: Filtrado en Controladores

Para rutas que permiten múltiples roles con diferentes alcances:

```javascript
export async function listarEquipos(req, res) {
  const { user } = req
  
  let query = `SELECT * FROM Elementos`
  
  // Aprendices solo ven sus equipos
  if (user.rol === 'Aprendiz') {
    query += ` 
      INNER JOIN Responsables_Equipo re 
        ON Elementos.codigo_equipo = re.codigo_equipo
      WHERE re.id_usuario = ? 
        AND re.estado_responsabilidad = 'Activo'
    `
    const [rows] = await db.execute(query, [user.id])
    return res.json(rows)
  }
  
  // Admin e Instructor ven todos
  const [rows] = await db.execute(query)
  return res.json(rows)
}
```

### Ejemplo 3: Crear Novedades Solo en Equipos Propios

```javascript
export async function crearNovedad(req, res) {
  const { user } = req
  const { codigo_equipo, descripcion } = req.body
  
  // Validar que el equipo existe
  const [[equipo]] = await db.execute(
    'SELECT codigo_equipo FROM Elementos WHERE codigo_equipo = ?',
    [codigo_equipo]
  )
  
  if (!equipo) {
    return res.status(404).json({ error: 'Equipo no encontrado' })
  }
  
  // Si es aprendiz, validar que el equipo le esté asignado
  if (user.rol === 'Aprendiz') {
    const [[asignacion]] = await db.execute(
      `SELECT id_responsable FROM Responsables_Equipo 
       WHERE codigo_equipo = ? 
         AND id_usuario = ? 
         AND estado_responsabilidad = 'Activo'`,
      [codigo_equipo, user.id]
    )
    
    if (!asignacion) {
      return res.status(403).json({ 
        error: 'No puede crear novedades en este equipo',
        message: 'El equipo no está asignado a usted'
      })
    }
  }
  
  // Crear novedad
  await db.execute(
    `INSERT INTO Novedades (codigo_equipo, descripcion, reportado_por) 
     VALUES (?, ?, ?)`,
    [codigo_equipo, descripcion, user.id]
  )
  
  return res.status(201).json({ ok: true })
}
```

---

## Extensibilidad

### Agregar un Nuevo Rol

1. **Crear el rol en la base de datos**

```sql
INSERT INTO Roles (nombre_rol, descripcion) 
VALUES ('Técnico', 'Responsable de mantenimiento técnico');
```

2. **Definir permisos en `permissions.js`**

```javascript
export const ROLE_PERMISSIONS = {
  // ... roles existentes
  
  Técnico: [
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_DETAIL,
    PERMISSIONS.MANTENIMIENTO.VIEW,
    PERMISSIONS.MANTENIMIENTO.CREATE,
    PERMISSIONS.MANTENIMIENTO.UPDATE,
    PERMISSIONS.NOVEDADES.VIEW,
    PERMISSIONS.NOVEDADES.RESOLVE,
  ],
}
```

3. **No se requiere modificar middlewares** ✅

### Agregar un Nuevo Permiso

1. **Definir el permiso en `permissions.js`**

```javascript
export const PERMISSIONS = {
  // ... módulos existentes
  
  INVENTARIO: {
    VIEW: 'inventario:view',
    EXPORT: 'inventario:export',
    AUDIT: 'inventario:audit',
  },
}
```

2. **Asignar a roles necesarios**

```javascript
Administrador: [
  // ... permisos existentes
  PERMISSIONS.INVENTARIO.VIEW,
  PERMISSIONS.INVENTARIO.EXPORT,
  PERMISSIONS.INVENTARIO.AUDIT,
],

Instructor: [
  // ... permisos existentes
  PERMISSIONS.INVENTARIO.VIEW,
],
```

3. **Proteger rutas**

```javascript
router.get('/inventario/audit', 
  authenticate,
  requirePermission(PERMISSIONS.INVENTARIO.AUDIT),
  controller
)
```

---

## Mejores Prácticas

### ✅ DO (Hacer)

1. **Usar permisos específicos en lugar de roles**
   ```javascript
   // ✅ Correcto
   requirePermission(PERMISSIONS.EQUIPOS.DELETE)
   
   // ❌ Evitar
   requireRole('Administrador')
   ```

2. **Validar en múltiples capas**
   - Middleware de ruta (primera línea de defensa)
   - Controlador (validaciones de negocio)
   - Base de datos (constraints y triggers)

3. **Usar middlewares combinados cuando sea necesario**
   ```javascript
   requireAnyPermission([
     PERMISSIONS.EQUIPOS.VIEW,
     PERMISSIONS.EQUIPOS.VIEW_OWN
   ])
   ```

4. **Documentar permisos especiales**
   ```javascript
   // Admin: puede ver todos
   // Aprendiz: solo equipos asignados (filtro en controlador)
   router.get('/equipos', authenticate, requireAnyPermission(...), controller)
   ```

### ❌ DON'T (Evitar)

1. **No confiar solo en el frontend**
   - Siempre validar permisos en el backend

2. **No hardcodear roles en controladores**
   ```javascript
   // ❌ Evitar
   if (user.rol === 'Administrador') { ... }
   
   // ✅ Mejor: usar helpers de permissions.js
   import { hasPermission } from '../config/permissions.js'
   if (hasPermission(user.rol, PERMISSIONS.USERS.DELETE)) { ... }
   ```

3. **No mezclar autenticación y autorización**
   - `authenticate`: valida identidad
   - `requirePermission`: valida permisos

4. **No devolver información sensible en errores de autorización**
   ```javascript
   // ❌ Evitar
   return res.status(403).json({ 
     error: 'Usuario ID 5 no puede eliminar equipo ID 123' 
   })
   
   // ✅ Correcto
   return res.status(403).json({ 
     error: 'Acceso denegado',
     message: 'No tiene permisos para esta acción'
   })
   ```

---

## Sugerencias de Mejora Futuras

### 1. **Tabla de Permisos en Base de Datos**
Para permitir gestión dinámica sin modificar código:

```sql
CREATE TABLE Permisos (
  id_permiso INT PRIMARY KEY AUTO_INCREMENT,
  codigo_permiso VARCHAR(50) UNIQUE NOT NULL,
  modulo VARCHAR(50) NOT NULL,
  accion VARCHAR(50) NOT NULL,
  descripcion TEXT
);

CREATE TABLE Rol_Permisos (
  id_rol INT,
  id_permiso INT,
  FOREIGN KEY (id_rol) REFERENCES Roles(id_rol),
  FOREIGN KEY (id_permiso) REFERENCES Permisos(id_permiso),
  PRIMARY KEY (id_rol, id_permiso)
);
```

### 2. **Permisos Contextuales**
Permisos que dependen del contexto (ej: hora del día, ubicación):

```javascript
export function requireContextualPermission(permission, contextValidator) {
  return async (req, res, next) => {
    if (!hasPermission(req.user.rol, permission)) {
      return res.status(403).json({ error: 'Permiso denegado' })
    }
    
    const contextValid = await contextValidator(req)
    if (!contextValid) {
      return res.status(403).json({ 
        error: 'Acción no permitida en este contexto' 
      })
    }
    
    next()
  }
}
```

### 3. **Auditoría de Accesos**
Registrar intentos de acceso denegados:

```javascript
export function auditAccess(req, res, next) {
  const originalSend = res.send
  res.send = function(data) {
    if (res.statusCode === 403) {
      logAccess({
        user: req.user,
        resource: req.path,
        action: req.method,
        denied: true,
        timestamp: new Date()
      })
    }
    originalSend.call(this, data)
  }
  next()
}
```

### 4. **Rate Limiting por Rol**
Límites diferentes según el rol:

```javascript
export function rateLimitByRole(limits) {
  return (req, res, next) => {
    const userRole = req.user.rol
    const limit = limits[userRole] || limits.default
    
    // Aplicar rate limit específico
    // ...
  }
}
```

---

## Conclusión

Este sistema RBAC proporciona:
- ✅ Seguridad robusta en múltiples capas
- ✅ Código mantenible y escalable
- ✅ Flexibilidad para crecer con el proyecto
- ✅ Separación clara de responsabilidades
- ✅ Facilidad de testing y debugging

Para cualquier duda o mejora, consulte este documento o revise los archivos de configuración en `backend/src/config/permissions.js`.

