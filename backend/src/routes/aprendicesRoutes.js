import express from 'express'
import { listarAprendices, actualizarAprendiz, eliminarAprendiz } from '../controller/aprendicesController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/authorization.js'
import { PERMISSIONS } from '../config/permissions.js'

const router = express.Router()

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.USERS.VIEW),
  listarAprendices
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
