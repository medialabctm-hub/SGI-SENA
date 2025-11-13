import express from 'express'
import { authenticate } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/authorization.js'
import { PERMISSIONS } from '../config/permissions.js'
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controller/notificationsController.js'

const router = express.Router()

// ============================================
// RUTAS PROTEGIDAS DE NOTIFICACIONES
// ============================================

// Todas las rutas requieren autenticación
router.use(authenticate)

// Ver propias notificaciones (todos los roles)
router.get('/', 
  requirePermission(PERMISSIONS.NOTIFICACIONES.VIEW),
  listNotifications
)

// Crear notificación para otro usuario (solo Admin)
router.post('/', 
  requirePermission(PERMISSIONS.NOTIFICACIONES.CREATE),
  createNotification
)

// Marcar todas como leídas
router.patch('/read-all', 
  requirePermission(PERMISSIONS.NOTIFICACIONES.VIEW),
  markAllNotificationsRead
)

// Marcar una como leída
router.patch('/:id/read', 
  requirePermission(PERMISSIONS.NOTIFICACIONES.VIEW),
  markNotificationRead
)

export default router

