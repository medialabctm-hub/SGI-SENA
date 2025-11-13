/**
 * Rutas para gestión dinámica de permisos (Futuro/Opcional)
 * 
 * Permite a los administradores:
 * - Ver todos los permisos disponibles
 * - Ver permisos asignados a cada rol
 * - Modificar permisos de roles (si se implementa persistencia en BD)
 */

import express from 'express'
import { authenticate } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/authorization.js'
import { PERMISSIONS, ROLE_PERMISSIONS, getRolePermissions } from '../config/permissions.js'

const router = express.Router()

// Todas las rutas requieren ser Administrador
router.use(authenticate)
router.use(requirePermission(PERMISSIONS.SYSTEM.VIEW_CONFIG))

/**
 * GET /api/permissions
 * Obtiene todos los permisos disponibles en el sistema
 */
router.get('/', (req, res) => {
  try {
    // Aplanar la estructura de permisos para devolver una lista
    const allPermissions = []
    
    for (const [module, actions] of Object.entries(PERMISSIONS)) {
      for (const [action, permission] of Object.entries(actions)) {
        allPermissions.push({
          module,
          action,
          permission,
          description: `${module}: ${action}`,
        })
      }
    }

    return res.json({
      total: allPermissions.length,
      permissions: allPermissions,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Error al obtener permisos',
      details: error.message,
    })
  }
})

/**
 * GET /api/permissions/roles
 * Obtiene todos los roles y sus permisos asignados
 */
router.get('/roles', (req, res) => {
  try {
    const rolesWithPermissions = []

    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      rolesWithPermissions.push({
        rol: roleName,
        totalPermisos: permissions.length,
        permisos: permissions,
      })
    }

    return res.json({
      total: rolesWithPermissions.length,
      roles: rolesWithPermissions,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Error al obtener roles y permisos',
      details: error.message,
    })
  }
})

/**
 * GET /api/permissions/roles/:roleName
 * Obtiene los permisos de un rol específico
 */
router.get('/roles/:roleName', (req, res) => {
  try {
    const { roleName } = req.params
    const permissions = getRolePermissions(roleName)

    if (permissions.length === 0) {
      return res.status(404).json({
        error: 'Rol no encontrado',
        message: `El rol "${roleName}" no existe en el sistema`,
      })
    }

    return res.json({
      rol: roleName,
      totalPermisos: permissions.length,
      permisos: permissions,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Error al obtener permisos del rol',
      details: error.message,
    })
  }
})

/**
 * GET /api/permissions/me
 * Obtiene los permisos del usuario autenticado
 */
router.get('/me', (req, res) => {
  try {
    const { user } = req
    const permissions = getRolePermissions(user.rol)

    return res.json({
      usuario: {
        id: user.id,
        nombre: user.nombre,
        rol: user.rol,
      },
      totalPermisos: permissions.length,
      permisos: permissions,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Error al obtener permisos del usuario',
      details: error.message,
    })
  }
})

/**
 * POST /api/permissions/check
 * Verifica si el usuario tiene un permiso específico
 * Body: { permission: 'users:delete' }
 */
router.post('/check', (req, res) => {
  try {
    const { user } = req
    const { permission } = req.body

    if (!permission) {
      return res.status(400).json({
        error: 'Permiso requerido',
        message: 'Debe proporcionar un permiso a verificar',
      })
    }

    const userPermissions = getRolePermissions(user.rol)
    const hasPermission = userPermissions.includes(permission)

    return res.json({
      usuario: user.rol,
      permiso: permission,
      tiene: hasPermission,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Error al verificar permiso',
      details: error.message,
    })
  }
})

// ============================================
// RUTAS FUTURAS (requieren implementación adicional)
// ============================================

/**
 * PUT /api/permissions/roles/:roleName
 * Actualiza los permisos de un rol (requiere tabla de permisos en BD)
 * 
 * Body: { permisos: ['users:view', 'equipos:view'] }
 * 
 * Implementación futura:
 * 1. Validar que todos los permisos existan
 * 2. Actualizar en tabla Rol_Permisos
 * 3. Invalidar caché de permisos
 * 4. Auditar el cambio
 */

/**
 * POST /api/permissions
 * Crea un nuevo permiso en el sistema (requiere tabla de permisos en BD)
 * 
 * Body: { 
 *   codigo_permiso: 'inventario:audit',
 *   modulo: 'INVENTARIO',
 *   accion: 'AUDIT',
 *   descripcion: 'Ver auditoría de inventario'
 * }
 */

export default router

