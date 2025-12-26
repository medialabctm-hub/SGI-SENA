import express from 'express'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAnyPermission, requirePermission } from '../middleware/authorization.js'
import { PERMISSIONS } from '../config/permissions.js'
import { crearNovedad, listarNovedades, obtenerNovedadPorId, actualizarEstadoNovedad, obtenerTiposNovedad, obtenerEstadosNovedad } from '../controller/novedadesController.js'
import { writeLimiter, readLimiter } from '../middleware/rateLimiter.js'
import { validate, crearNovedadSchema, actualizarEstadoNovedadSchema } from '../validators/novedadesValidator.js'

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(authenticate)

// Crear novedad - Todos los roles pueden crear (con restricciones en el controlador) - Protegido con rate limiting y validación
router.post('/', 
  writeLimiter,
  validate(crearNovedadSchema),
  requireAnyPermission([
    PERMISSIONS.NOVEDADES.CREATE
  ]),
  crearNovedad
)

// Listar novedades
// Admin e Instructor: ven todas
// Aprendiz: solo de equipos asignados (filtrado en controlador)
router.get('/', 
  requireAnyPermission([
    PERMISSIONS.NOVEDADES.VIEW,
    PERMISSIONS.NOVEDADES.VIEW_OWN
  ]),
  listarNovedades
)

// Obtener tipos de novedad disponibles (DEBE ir antes de /:id)
router.get('/tipos', obtenerTiposNovedad)

// Obtener estados de novedad disponibles (DEBE ir antes de /:id)
router.get('/estados', obtenerEstadosNovedad)

// Obtener detalle de novedad
router.get('/:id', 
  requireAnyPermission([
    PERMISSIONS.NOVEDADES.VIEW,
    PERMISSIONS.NOVEDADES.VIEW_OWN
  ]),
  obtenerNovedadPorId
)

// Actualizar estado de novedad - Solo Administrador - Protegido con validación
router.put('/:id/estado', 
  writeLimiter,
  validate(actualizarEstadoNovedadSchema),
  requirePermission(PERMISSIONS.NOVEDADES.RESOLVE), // Solo Administrador tiene este permiso
  actualizarEstadoNovedad
)

export default router

