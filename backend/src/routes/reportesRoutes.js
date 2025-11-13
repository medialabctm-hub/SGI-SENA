import express from 'express'
import { authenticate } from '../middleware/authMiddleware.js'
import { requireAnyPermission } from '../middleware/authorization.js'
import { PERMISSIONS } from '../config/permissions.js'
import { crearReporte, listarReportes, obtenerReportePorId, actualizarReporte, eliminarReporte } from '../controller/reportesController.js'

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(authenticate)

// Crear reporte - Todos los roles pueden crear
router.post('/', 
  requireAnyPermission([
    PERMISSIONS.REPORTES.CREATE
  ]),
  crearReporte
)

// Listar reportes
// Admin e Instructor: ven todos
// Aprendiz: solo sus propios reportes (filtrado en controlador)
router.get('/', 
  requireAnyPermission([
    PERMISSIONS.REPORTES.VIEW
  ]),
  listarReportes
)

// Obtener detalle de reporte
router.get('/:id', 
  requireAnyPermission([
    PERMISSIONS.REPORTES.VIEW
  ]),
  obtenerReportePorId
)

// Actualizar reporte - Solo Administrador
router.put('/:id', 
  requireAnyPermission([
    PERMISSIONS.REPORTES.UPDATE
  ]),
  actualizarReporte
)

// Eliminar reporte - Solo Administrador
router.delete('/:id', 
  requireAnyPermission([
    PERMISSIONS.REPORTES.DELETE
  ]),
  eliminarReporte
)

export default router

