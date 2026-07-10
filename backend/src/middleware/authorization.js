/**
 * Middlewares de autorización basados en roles y permisos
 * 
 * Proporciona funciones reutilizables para proteger rutas según:
 * - Roles específicos
 * - Permisos granulares
 * - Propiedad de recursos (el usuario solo puede acceder a sus propios recursos)
 */

import { hasPermission, hasAnyPermission, isAdmin, hasPermissionFromDB } from '../config/permissions.js'
import defaultDb from '../config/dbconfig.js'

/**
 * Middleware para requerir uno o varios roles específicos
 * @param {string|string[]} allowedRoles - Rol(es) permitido(s)
 * @returns {Function} Middleware de Express
 * 
 * @example
 * router.get('/admin', requireRole('Administrador'), controller)
 * router.get('/staff', requireRole(['Administrador', 'Instructor']), controller)
 */
export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  return (req, res, next) => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user || !req.user.rol) {
        return res.status(401).json({
          error: 'No autorizado',
          message: 'Debe iniciar sesión para acceder a este recurso',
        })
      }

      const userRole = req.user.rol

      // Los Administradores tienen acceso completo a todo
      if (isAdmin(userRole)) {
        return next()
      }

      // Verificar si el rol del usuario está en la lista de roles permitidos
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: `Esta acción requiere uno de los siguientes roles: ${roles.join(', ')}`,
          userRole,
          requiredRoles: roles,
        })
      }

      // Rol válido, continuar
      next()
    } catch (error) {
      return res.status(500).json({
        error: 'Error al validar autorización',
        details: error.message,
      })
    }
  }
}

/**
 * Middleware para requerir un permiso específico
 * @param {string} permission - Permiso requerido
 * @returns {Function} Middleware de Express
 * 
 * @example
 * router.post('/equipos', requirePermission(PERMISSIONS.EQUIPOS.CREATE), controller)
 */
export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user || !req.user.rol) {
        return res.status(401).json({
          error: 'No autorizado',
          message: 'Debe iniciar sesión para acceder a este recurso',
        })
      }

      const userRole = req.user.rol

      // Los Administradores tienen acceso completo a todo
      if (isAdmin(userRole)) {
        return next()
      }

      // Verificar si el rol tiene el permiso requerido (consulta BD)
      const hasAccess = await hasPermissionFromDB(defaultDb, userRole, permission)
      
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tiene permisos suficientes para realizar esta acción',
          userRole,
          requiredPermission: permission,
        })
      }

      // Permiso válido, continuar
      next()
    } catch (error) {
      return res.status(500).json({
        error: 'Error al validar permisos',
        details: error.message,
      })
    }
  }
}

/**
 * Middleware para requerir al menos uno de varios permisos
 * @param {string[]} permissions - Lista de permisos (el usuario necesita al menos uno)
 * @returns {Function} Middleware de Express
 * 
 * @example
 * router.get('/equipos', requireAnyPermission([
 *   PERMISSIONS.EQUIPOS.VIEW,
 *   PERMISSIONS.EQUIPOS.VIEW_OWN
 * ]), controller)
 */
export function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.rol) {
        return res.status(401).json({
          error: 'No autorizado',
          message: 'Debe iniciar sesión para acceder a este recurso',
        })
      }

      const userRole = req.user.rol

      // Los Administradores tienen acceso completo a todo
      if (isAdmin(userRole)) {
        return next()
      }

      // Verificar si el rol tiene al menos uno de los permisos (consulta BD)
      let hasAccess = false
      for (const permission of permissions) {
        if (await hasPermissionFromDB(defaultDb, userRole, permission)) {
          hasAccess = true
          break
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tiene permisos suficientes para realizar esta acción',
          userRole,
          requiredPermissions: permissions,
        })
      }

      next()
    } catch (error) {
      return res.status(500).json({
        error: 'Error al validar permisos',
        details: error.message,
      })
    }
  }
}

/**
 * Igual que requireAnyPermission pero solo aplica si el usuario está autenticado.
 * Si no hay req.user, continúa sin exigir permiso (para rutas públicas con auth opcional).
 */
export function requireAnyPermissionIfAuthenticated(permissions) {
  return async (req, res, next) => {
    if (!req.user || !req.user.rol) return next()
    try {
      const userRole = req.user.rol
      if (isAdmin(userRole)) return next()
      let hasAccess = false
      for (const permission of permissions) {
        if (await hasPermissionFromDB(defaultDb, userRole, permission)) {
          hasAccess = true
          break
        }
      }
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tiene permisos suficientes para realizar esta acción',
          userRole: userRole,
          requiredPermissions: permissions,
        })
      }
      next()
    } catch (error) {
      return res.status(500).json({
        error: 'Error al validar permisos',
        details: error.message,
      })
    }
  }
}

/**
 * Middleware para verificar propiedad de recurso
 * Permite acceso si:
 * - El usuario es administrador (acceso total), O
 * - El recurso pertenece al usuario autenticado
 * 
 * @param {Function} getResourceOwnerId - Función que obtiene el ID del propietario del recurso
 * @returns {Function} Middleware de Express
 * 
 * @example
 * // El parámetro es el ID del usuario propietario del recurso
 * router.get('/usuarios/:id', requireOwnership(
 *   (req) => req.params.id
 * ), controller)
 * 
 * @example
 * // Consultar BD para obtener propietario
 * router.put('/novedades/:id', requireOwnership(
 *   async (req) => {
 *     const novedad = await getNovedad(req.params.id)
 *     return novedad.reportado_por
 *   }
 * ), controller)
 */
export function requireOwnership(getResourceOwnerId) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: 'No autorizado',
          message: 'Debe iniciar sesión para acceder a este recurso',
        })
      }

      // Los administradores tienen acceso total
      if (isAdmin(req.user.rol)) {
        return next()
      }

      // Obtener el ID del propietario del recurso
      const ownerId = await getResourceOwnerId(req)

      // Verificar que el usuario sea el propietario
      if (Number(ownerId) !== Number(req.user.id)) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo puede acceder a sus propios recursos',
        })
      }

      next()
    } catch (error) {
      return res.status(500).json({
        error: 'Error al validar propiedad del recurso',
        details: error.message,
      })
    }
  }
}

/**
 * Middleware para verificar que el usuario tiene equipos asignados
 * Útil para rutas que requieren que el usuario tenga al menos un equipo
 * 
 * @param {Function} getUserEquipos - Función que obtiene los equipos del usuario
 * @returns {Function} Middleware de Express
 * 
 * @example
 * router.get('/mis-equipos', requireAssignedEquipos(
 *   async (req) => await getEquiposByUserId(req.user.id)
 * ), controller)
 */
export function requireAssignedEquipos(getUserEquipos) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: 'No autorizado',
        })
      }

      // Administradores, instructores y cuentadantes no necesitan equipos asignados para esta validación
      if (isAdmin(req.user.rol) || req.user.rol === 'Instructor' || req.user.rol === 'Cuentadante') {
        return next()
      }

      // Obtener equipos del usuario
      const equipos = await getUserEquipos(req)

      if (!equipos || equipos.length === 0) {
        return res.status(403).json({
          error: 'No tiene equipos asignados',
          message: 'Debe tener al menos un equipo asignado para acceder a este recurso',
        })
      }

      // Adjuntar equipos al request para uso en el controlador
      req.userEquipos = equipos

      next()
    } catch (error) {
      return res.status(500).json({
        error: 'Error al verificar equipos asignados',
        details: error.message,
      })
    }
  }
}

/**
 * Middleware combinado: requiere permiso Y propiedad del recurso
 * @param {string} permission - Permiso requerido
 * @param {Function} getResourceOwnerId - Función para obtener propietario
 * @returns {Function} Middleware de Express
 * 
 * @example
 * router.put('/perfil/:id', requirePermissionAndOwnership(
 *   PERMISSIONS.USERS.UPDATE,
 *   (req) => req.params.id
 * ), controller)
 */
export function requirePermissionAndOwnership(permission, getResourceOwnerId) {
  return async (req, res, next) => {
    // Primero verificar permiso
    requirePermission(permission)(req, res, (err) => {
      if (err) return next(err)

      // Luego verificar propiedad
      requireOwnership(getResourceOwnerId)(req, res, next)
    })
  }
}

export default {
  requireRole,
  requirePermission,
  requireAnyPermission,
  requireAnyPermissionIfAuthenticated,
  requireOwnership,
  requireAssignedEquipos,
  requirePermissionAndOwnership,
}

