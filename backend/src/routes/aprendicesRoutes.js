import express from 'express'
import { listarAprendices } from '../controller/aprendicesController.js'
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

export default router
