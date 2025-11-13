import express from 'express'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAnyPermission } from '../middleware/authorization.js'
import { PERMISSIONS } from '../config/permissions.js'
import { crearNovedad, listarNovedades, obtenerNovedadPorId, actualizarEstadoNovedad } from '../controller/novedadesController.js'

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(authenticate)

// Crear novedad - Todos los roles pueden crear (con restricciones en el controlador)
router.post('/', 
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

// Obtener detalle de novedad
router.get('/:id', 
  requireAnyPermission([
    PERMISSIONS.NOVEDADES.VIEW,
    PERMISSIONS.NOVEDADES.VIEW_OWN
  ]),
  obtenerNovedadPorId
)

// Actualizar estado de novedad
router.put('/:id/estado', 
  requireAnyPermission([
    PERMISSIONS.NOVEDADES.UPDATE,
    PERMISSIONS.NOVEDADES.RESOLVE
  ]),
  actualizarEstadoNovedad
)

export default router

