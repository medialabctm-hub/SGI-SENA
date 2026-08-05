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
import { PERMISSIONS, getRolePermissions } from '../config/permissions.js'
import * as rolesController from '../controller/rolesController.js'

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
 * Obtiene todos los roles y sus permisos asignados desde la BD.
 * rolesController.listarRoles ya maneja sus propios errores de BD
 * (responde 500 con mensaje traducido), así que no hace falta un
 * fallback aquí: nunca llegaría a activarse.
 */
router.get('/roles', (req, res) => rolesController.listarRoles(req, res))

/**
 * GET /api/permissions/roles/:roleName
 * Obtiene los permisos de un rol específico desde la BD.
 */
router.get('/roles/:roleName', (req, res) => rolesController.obtenerRol(req, res))

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
// RUTAS DE GESTIÓN DE ROLES Y PERMISOS
// ============================================

/**
 * GET /api/permissions/permisos
 * Obtiene todos los permisos disponibles
 */
router.get('/permisos', rolesController.listarPermisos)

/**
 * POST /api/permissions/roles
 * Crea un nuevo rol
 * Body: { nombre_rol: 'NuevoRol', descripcion: '...', permisos: ['users:view', ...] }
 */
router.post('/roles', requirePermission(PERMISSIONS.ROLES.MANAGE), rolesController.crearRol)

/**
 * PUT /api/permissions/roles/:roleName
 * Actualiza un rol (nombre, descripción, estado)
 * Body: { nombre_rol: '...', descripcion: '...', estado: 'Activo'|'Inactivo' }
 */
router.put('/roles/:roleName', requirePermission(PERMISSIONS.ROLES.MANAGE), rolesController.actualizarRol)

/**
 * DELETE /api/permissions/roles/:roleName
 * Elimina un rol (solo si no tiene usuarios asignados)
 */
router.delete('/roles/:roleName', requirePermission(PERMISSIONS.ROLES.MANAGE), rolesController.eliminarRol)

/**
 * PUT /api/permissions/roles/:roleName/permisos
 * Actualiza todos los permisos de un rol
 * Body: { permisos: ['users:view', 'equipos:view', ...] }
 */
router.put('/roles/:roleName/permisos', requirePermission(PERMISSIONS.ROLES.MANAGE), rolesController.actualizarPermisosRol)

/**
 * PATCH /api/permissions/roles/:roleName/permisos/:permissionCode
 * Activa o desactiva un permiso específico de un rol
 * Body: { activo: true|false }
 */
router.patch('/roles/:roleName/permisos/:permissionCode', requirePermission(PERMISSIONS.ROLES.MANAGE), rolesController.togglePermisoRol)

export default router

