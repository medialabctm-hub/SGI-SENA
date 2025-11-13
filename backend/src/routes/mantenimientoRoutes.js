import express from 'express'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAnyPermission, requirePermission } from '../middleware/authorization.js'
import { PERMISSIONS } from '../config/permissions.js'
import { crearMantenimiento, listarMantenimientos, obtenerMantenimientoPorId, actualizarEstadoMantenimiento, actualizarFechaProximo, eliminarMantenimiento } from '../controller/mantenimientoController.js'

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(authenticate)

// Crear mantenimiento
router.post('/',
  requirePermission(PERMISSIONS.MANTENIMIENTO.CREATE),
  crearMantenimiento
)

// Listar mantenimientos
// Admin: ve todos
// Instructor y Aprendiz: solo de equipos asignados (filtrado en controlador)
router.get('/', 
  requireAnyPermission([
    PERMISSIONS.MANTENIMIENTO.VIEW,
    PERMISSIONS.MANTENIMIENTO.VIEW_OWN
  ]),
  listarMantenimientos
)

// Obtener detalle de mantenimiento
router.get('/:id', 
  requireAnyPermission([
    PERMISSIONS.MANTENIMIENTO.VIEW,
    PERMISSIONS.MANTENIMIENTO.VIEW_OWN
  ]),
  obtenerMantenimientoPorId
)

// Actualizar fecha_proximo de mantenimiento
router.put('/:id/fecha-proximo', 
  requireAnyPermission([
    PERMISSIONS.MANTENIMIENTO.UPDATE
  ]),
  actualizarFechaProximo
)

// Actualizar estado de mantenimiento
router.put('/:id/estado', 
  requireAnyPermission([
    PERMISSIONS.MANTENIMIENTO.UPDATE
  ]),
  actualizarEstadoMantenimiento
)

// Eliminar mantenimiento - Solo Administrador
router.delete('/:id', 
  requirePermission(PERMISSIONS.MANTENIMIENTO.DELETE),
  eliminarMantenimiento
)

export default router

