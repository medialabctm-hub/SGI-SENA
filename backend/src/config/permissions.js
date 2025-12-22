/**
 * Sistema de permisos granulares para RBAC
 * 
 * Estructura escalable que permite:
 * - Definir permisos por módulo y acción
 * - Asignar permisos a roles
 * - Validar permisos de forma reutilizable
 * - Extender fácilmente con nuevos módulos/permisos
 */

// ============================================
// DEFINICIÓN DE PERMISOS POR MÓDULO
// ============================================

export const PERMISSIONS = {
  // Gestión de usuarios
  USERS: {
    VIEW: 'users:view',           // Ver listado de usuarios
    VIEW_DETAIL: 'users:view_detail', // Ver detalle de un usuario
    CREATE: 'users:create',       // Crear nuevos usuarios
    UPDATE: 'users:update',       // Editar usuarios
    DELETE: 'users:delete',       // Eliminar usuarios
    MANAGE_ROLES: 'users:manage_roles', // Cambiar roles de usuarios
  },

  // Gestión de equipos
  EQUIPOS: {
    VIEW: 'equipos:view',         // Ver listado de equipos
    VIEW_DETAIL: 'equipos:view_detail', // Ver detalle de equipo
    VIEW_OWN: 'equipos:view_own', // Ver solo equipos asignados
    CREATE: 'equipos:create',     // Registrar nuevos equipos
    UPDATE: 'equipos:update',     // Editar equipos
    DELETE: 'equipos:delete',     // Eliminar equipos
    ASSIGN: 'equipos:assign',     // Asignar equipos a cualquier usuario (Admin)
    ASSIGN_TO_APRENDIZ: 'equipos:assign_to_aprendiz', // Asignar solo a aprendices (Instructor)
    MANAGE_CATEGORIES: 'equipos:manage_categories', // Gestionar categorías de equipos (Admin)
  },

  // Gestión de novedades
  NOVEDADES: {
    VIEW: 'novedades:view',       // Ver todas las novedades
    VIEW_OWN: 'novedades:view_own', // Ver solo novedades de equipos propios
    CREATE: 'novedades:create',   // Registrar novedades
    CREATE_OWN: 'novedades:create_own', // Registrar solo en equipos propios
    UPDATE: 'novedades:update',   // Editar novedades
    DELETE: 'novedades:delete',   // Eliminar novedades
    RESOLVE: 'novedades:resolve', // Resolver novedades
  },

  // Gestión de mantenimiento
  MANTENIMIENTO: {
    VIEW: 'mantenimiento:view',   // Ver historial de mantenimiento
    VIEW_OWN: 'mantenimiento:view_own', // Ver mantenimiento de equipos propios
    CREATE: 'mantenimiento:create', // Programar mantenimiento
    UPDATE: 'mantenimiento:update', // Editar mantenimiento
    DELETE: 'mantenimiento:delete', // Eliminar registro de mantenimiento
  },

  // Gestión de reportes
  REPORTES: {
    VIEW: 'reportes:view',        // Ver reportes
    CREATE: 'reportes:create',    // Crear reportes
    UPDATE: 'reportes:update',    // Actualizar reportes
    DELETE: 'reportes:delete',    // Eliminar reportes
    EXPORT: 'reportes:export',    // Exportar reportes
  },

  // Gestión de ambientes
  AMBIENTES: {
    VIEW: 'ambientes:view',       // Ver ambientes
    CREATE: 'ambientes:create',   // Crear ambientes
    UPDATE: 'ambientes:update',   // Editar ambientes
    DELETE: 'ambientes:delete',   // Eliminar ambientes
  },

  // Gestión de clases y programaciones
  CLASES: {
    VIEW: 'clases:view',          // Ver clases
    CREATE: 'clases:create',      // Crear clases
    UPDATE: 'clases:update',      // Actualizar/iniciar/finalizar clases
    DELETE: 'clases:delete',      // Eliminar clases
  },

  // Notificaciones del sistema
  NOTIFICACIONES: {
    VIEW: 'notificaciones:view',  // Ver propias notificaciones
    CREATE: 'notificaciones:create', // Crear notificaciones para otros
    BROADCAST: 'notificaciones:broadcast', // Enviar notificaciones globales
  },

  // Configuración del sistema
  SYSTEM: {
    VIEW_CONFIG: 'system:view_config', // Ver configuración
    UPDATE_CONFIG: 'system:update_config', // Modificar configuración
    VIEW_AUDIT: 'system:view_audit', // Ver auditoría
  },

  // Gestión de roles y permisos
  ROLES: {
    MANAGE: 'roles:manage', // Gestionar roles y permisos
  },
}

// ============================================
// ASIGNACIÓN DE PERMISOS POR ROL
// ============================================

export const ROLE_PERMISSIONS = {
  Administrador: [
    // Usuarios - acceso completo
    PERMISSIONS.USERS.VIEW,
    PERMISSIONS.USERS.VIEW_DETAIL,
    PERMISSIONS.USERS.CREATE,
    PERMISSIONS.USERS.UPDATE,
    PERMISSIONS.USERS.DELETE,
    PERMISSIONS.USERS.MANAGE_ROLES,

    // Equipos - acceso completo (incluye todos los permisos posibles)
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_DETAIL,
    PERMISSIONS.EQUIPOS.VIEW_OWN,
    PERMISSIONS.EQUIPOS.CREATE,
    PERMISSIONS.EQUIPOS.UPDATE,
    PERMISSIONS.EQUIPOS.DELETE,
    PERMISSIONS.EQUIPOS.ASSIGN,
    PERMISSIONS.EQUIPOS.ASSIGN_TO_APRENDIZ,
    PERMISSIONS.EQUIPOS.MANAGE_CATEGORIES,

    // Novedades - acceso completo (incluye todos los permisos posibles)
    PERMISSIONS.NOVEDADES.VIEW,
    PERMISSIONS.NOVEDADES.VIEW_OWN,
    PERMISSIONS.NOVEDADES.CREATE,
    PERMISSIONS.NOVEDADES.CREATE_OWN,
    PERMISSIONS.NOVEDADES.UPDATE,
    PERMISSIONS.NOVEDADES.DELETE,
    PERMISSIONS.NOVEDADES.RESOLVE,

    // Mantenimiento - acceso completo (incluye todos los permisos posibles)
    PERMISSIONS.MANTENIMIENTO.VIEW,
    PERMISSIONS.MANTENIMIENTO.VIEW_OWN,
    PERMISSIONS.MANTENIMIENTO.CREATE,
    PERMISSIONS.MANTENIMIENTO.UPDATE,
    PERMISSIONS.MANTENIMIENTO.DELETE,

    // Reportes - acceso completo
    PERMISSIONS.REPORTES.VIEW,
    PERMISSIONS.REPORTES.CREATE,
    PERMISSIONS.REPORTES.UPDATE,
    PERMISSIONS.REPORTES.DELETE,
    PERMISSIONS.REPORTES.EXPORT,

    // Ambientes - acceso completo
    PERMISSIONS.AMBIENTES.VIEW,
    PERMISSIONS.AMBIENTES.CREATE,
    PERMISSIONS.AMBIENTES.UPDATE,
    PERMISSIONS.AMBIENTES.DELETE,

    // Clases - acceso completo
    PERMISSIONS.CLASES.VIEW,
    PERMISSIONS.CLASES.CREATE,
    PERMISSIONS.CLASES.UPDATE,
    PERMISSIONS.CLASES.DELETE,

    // Notificaciones - acceso completo
    PERMISSIONS.NOTIFICACIONES.VIEW,
    PERMISSIONS.NOTIFICACIONES.CREATE,
    PERMISSIONS.NOTIFICACIONES.BROADCAST,

    // Sistema - acceso completo
    PERMISSIONS.SYSTEM.VIEW_CONFIG,
    PERMISSIONS.SYSTEM.UPDATE_CONFIG,
    PERMISSIONS.SYSTEM.VIEW_AUDIT,

    // Roles - acceso completo
    PERMISSIONS.ROLES.MANAGE,
  ],

  Instructor: [
    // Usuarios - solo consulta de aprendices
    PERMISSIONS.USERS.VIEW,
    PERMISSIONS.USERS.VIEW_DETAIL,

    // Equipos - consulta completa, sin creación/edición/eliminación, puede asignar a aprendices
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_DETAIL,
    PERMISSIONS.EQUIPOS.ASSIGN_TO_APRENDIZ,

    // Novedades - ver todas, crear nuevas, no puede cambiar estado ni eliminar
    PERMISSIONS.NOVEDADES.VIEW,
    PERMISSIONS.NOVEDADES.CREATE,

    // Mantenimiento - consulta completa
    PERMISSIONS.MANTENIMIENTO.VIEW,

    // Reportes - crear, ver y exportar (sin editar/eliminar)
    PERMISSIONS.REPORTES.VIEW,
    PERMISSIONS.REPORTES.CREATE,
    PERMISSIONS.REPORTES.EXPORT,

    // Ambientes - solo consulta
    PERMISSIONS.AMBIENTES.VIEW,

    // Clases - puede crear, ver, iniciar y finalizar sus propias clases
    PERMISSIONS.CLASES.VIEW,
    PERMISSIONS.CLASES.CREATE,
    PERMISSIONS.CLASES.UPDATE,

    // Notificaciones - solo propias
    PERMISSIONS.NOTIFICACIONES.VIEW,
  ],

  Aprendiz: [
    // Usuarios - no tiene acceso

    // Equipos - solo equipos asignados
    PERMISSIONS.EQUIPOS.VIEW_OWN,

    // Novedades - solo de sus equipos
    PERMISSIONS.NOVEDADES.VIEW_OWN,
    PERMISSIONS.NOVEDADES.CREATE_OWN,

    // Mantenimiento - solo de sus equipos
    PERMISSIONS.MANTENIMIENTO.VIEW_OWN,

    // Reportes - crear y ver propios
    PERMISSIONS.REPORTES.VIEW,
    PERMISSIONS.REPORTES.CREATE,

    // Notificaciones - solo propias
    PERMISSIONS.NOTIFICACIONES.VIEW,
  ],

  Cuentadante: [
    // Usuarios - NO tiene acceso (no puede ver Usuarios ni gestionar usuarios)
    // PERMISSIONS.USERS.VIEW, // NO incluido
    // PERMISSIONS.USERS.VIEW_DETAIL, // NO incluido
    // PERMISSIONS.USERS.CREATE, // NO incluido
    // PERMISSIONS.USERS.UPDATE, // NO incluido
    // PERMISSIONS.USERS.DELETE, // NO incluido
    // PERMISSIONS.USERS.MANAGE_ROLES, // NO incluido

    // Equipos - solo su inventario (no todos los inventarios del sistema)
    PERMISSIONS.EQUIPOS.VIEW_OWN, // Solo ve su inventario
    PERMISSIONS.EQUIPOS.VIEW_DETAIL, // Puede ver detalles de sus equipos
    PERMISSIONS.EQUIPOS.CREATE, // Puede registrar equipos en su inventario
    PERMISSIONS.EQUIPOS.UPDATE, // Puede editar sus equipos
    PERMISSIONS.EQUIPOS.DELETE, // Puede eliminar sus equipos
    // PERMISSIONS.EQUIPOS.VIEW, // NO incluido - no puede ver todos los inventarios
    // PERMISSIONS.EQUIPOS.ASSIGN, // NO incluido
    // PERMISSIONS.EQUIPOS.ASSIGN_TO_APRENDIZ, // NO incluido

    // Novedades - de su inventario, no puede cambiar estado
    PERMISSIONS.NOVEDADES.VIEW_OWN,
    PERMISSIONS.NOVEDADES.CREATE_OWN,
    PERMISSIONS.NOVEDADES.DELETE,
    // PERMISSIONS.NOVEDADES.VIEW, // NO incluido - no puede ver todas las novedades

    // Mantenimiento - de su inventario
    PERMISSIONS.MANTENIMIENTO.VIEW_OWN,
    PERMISSIONS.MANTENIMIENTO.CREATE,
    PERMISSIONS.MANTENIMIENTO.UPDATE,
    PERMISSIONS.MANTENIMIENTO.DELETE,
    // PERMISSIONS.MANTENIMIENTO.VIEW, // NO incluido - no puede ver todos los mantenimientos

    // Reportes - puede crear y ver sus reportes
    PERMISSIONS.REPORTES.VIEW,
    PERMISSIONS.REPORTES.CREATE,
    PERMISSIONS.REPORTES.UPDATE,
    PERMISSIONS.REPORTES.DELETE,
    PERMISSIONS.REPORTES.EXPORT,

    // Ambientes - puede ver ambientes (necesario para asignar equipos)
    PERMISSIONS.AMBIENTES.VIEW,
    // PERMISSIONS.AMBIENTES.CREATE, // NO incluido
    // PERMISSIONS.AMBIENTES.UPDATE, // NO incluido
    // PERMISSIONS.AMBIENTES.DELETE, // NO incluido

    // Clases - no tiene acceso (no es instructor)
    // PERMISSIONS.CLASES.VIEW, // NO incluido
    // PERMISSIONS.CLASES.CREATE, // NO incluido
    // PERMISSIONS.CLASES.UPDATE, // NO incluido
    // PERMISSIONS.CLASES.DELETE, // NO incluido

    // Notificaciones - solo propias
    PERMISSIONS.NOTIFICACIONES.VIEW,
    // PERMISSIONS.NOTIFICACIONES.CREATE, // NO incluido
    // PERMISSIONS.NOTIFICACIONES.BROADCAST, // NO incluido

    // Sistema - puede ver su configuración
    PERMISSIONS.SYSTEM.VIEW_CONFIG,
    // PERMISSIONS.SYSTEM.UPDATE_CONFIG, // NO incluido
    // PERMISSIONS.SYSTEM.VIEW_AUDIT, // NO incluido

    // Roles - NO tiene acceso (no puede ver roles y áreas)
    // PERMISSIONS.ROLES.MANAGE, // NO incluido
  ],
}

// ============================================
// HELPERS PARA VALIDACIÓN DE PERMISOS
// ============================================

/**
 * Verifica si un rol tiene un permiso específico (versión síncrona - usa defaults)
 * @param {string} roleName - Nombre del rol
 * @param {string} permission - Permiso a verificar
 * @returns {boolean}
 */
export function hasPermission(roleName, permission) {
  // El Administrador tiene el 100% de los permisos del sistema
  if (isAdmin(roleName)) {
    return true
  }
  
  const rolePermissions = ROLE_PERMISSIONS[roleName]
  if (!rolePermissions) {
    return false
  }
  return rolePermissions.includes(permission)
}

/**
 * Verifica si un rol tiene un permiso específico consultando la base de datos
 * @param {Object} db - Instancia de la base de datos
 * @param {string} roleName - Nombre del rol
 * @param {string} permission - Permiso a verificar (código del permiso)
 * @returns {Promise<boolean>}
 */
export async function hasPermissionFromDB(db, roleName, permission) {
  // El Administrador tiene el 100% de los permisos del sistema
  if (isAdmin(roleName)) {
    return true
  }

  try {
    // Obtener el ID del rol
    const [roles] = await db.execute(
      'SELECT id_rol FROM Roles WHERE nombre_rol = ?',
      [roleName]
    )

    if (roles.length === 0) {
      // Si el rol no existe, usar defaults
      return hasPermission(roleName, permission)
    }

    const idRol = roles[0].id_rol

    // Verificar si el permiso está activo en la BD
    const [permisos] = await db.execute(
      `SELECT rp.activo 
       FROM Rol_Permisos rp
       INNER JOIN Permisos p ON rp.id_permiso = p.id_permiso
       WHERE rp.id_rol = ? AND p.codigo_permiso = ? AND rp.activo = 1`,
      [idRol, permission]
    )

    // Si está en la BD y está activo, retornar true
    if (permisos.length > 0) {
      return true
    }

    // Si no está en la BD, usar los defaults hardcodeados como fallback
    return hasPermission(roleName, permission)
  } catch (error) {
    console.error('Error al verificar permiso desde BD:', error)
    // En caso de error, usar defaults
    return hasPermission(roleName, permission)
  }
}

/**
 * Verifica si un rol tiene alguno de varios permisos
 * @param {string} roleName - Nombre del rol
 * @param {string[]} permissions - Lista de permisos
 * @returns {boolean}
 */
export function hasAnyPermission(roleName, permissions) {
  return permissions.some((permission) => hasPermission(roleName, permission))
}

/**
 * Verifica si un rol tiene todos los permisos especificados
 * @param {string} roleName - Nombre del rol
 * @param {string[]} permissions - Lista de permisos
 * @returns {boolean}
 */
export function hasAllPermissions(roleName, permissions) {
  return permissions.every((permission) => hasPermission(roleName, permission))
}

/**
 * Obtiene todos los permisos de un rol
 * @param {string} roleName - Nombre del rol
 * @returns {string[]}
 */
export function getRolePermissions(roleName) {
  return ROLE_PERMISSIONS[roleName] || []
}

/**
 * Verifica si un usuario es administrador
 * @param {string} roleName - Nombre del rol
 * @returns {boolean}
 */
export function isAdmin(roleName) {
  return roleName === 'Administrador'
}

/**
 * Verifica si un usuario es instructor
 * @param {string} roleName - Nombre del rol
 * @returns {boolean}
 */
export function isInstructor(roleName) {
  return roleName === 'Instructor'
}

/**
 * Verifica si un usuario es aprendiz
 * @param {string} roleName - Nombre del rol
 * @returns {boolean}
 */
export function isAprendiz(roleName) {
  return roleName === 'Aprendiz'
}

/**
 * Verifica si un usuario es cuentadante
 * @param {string} roleName - Nombre del rol
 * @returns {boolean}
 */
export function isCuentadante(roleName) {
  return roleName === 'Cuentadante'
}

export default {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasPermissionFromDB,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  isAdmin,
  isInstructor,
  isAprendiz,
  isCuentadante,
}

