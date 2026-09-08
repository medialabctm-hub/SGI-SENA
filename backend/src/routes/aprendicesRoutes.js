import express from 'express'
import { listarAprendices, crearAprendiz, actualizarAprendiz, eliminarAprendiz, verificarAprendizPorDocumento } from '../controller/aprendicesController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/authorization.js'
import { PERMISSIONS } from '../config/permissions.js'
import { publicLookupLimiter } from '../middleware/rateLimiter.js'

const router = express.Router()

// ============================================
// RUTAS PÚBLICAS (sin autenticación) - Autoservicio
// ============================================

// Verificar documento de aprendiz (público) - usado antes de solicitar un equipo por autoservicio
router.get(
  '/verificar/:documento',
  publicLookupLimiter,
  verificarAprendizPorDocumento
)

// ============================================
// RUTAS PROTEGIDAS
// ============================================

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.USERS.VIEW),
  listarAprendices
)

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.USERS.CREATE),
  crearAprendiz
)

router.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.USERS.UPDATE),
  actualizarAprendiz
)

router.delete(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.USERS.DELETE),
  eliminarAprendiz
)

export default router
