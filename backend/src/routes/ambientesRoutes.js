import express from 'express';
import {
  listarAmbientes,
  obtenerAmbiente,
  crearAmbiente,
  actualizarAmbiente,
  eliminarAmbiente,
  listarAmbientesActivos
} from '../controller/ambientesController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Listar ambientes (con filtros opcionales y estadísticas)
router.get(
  '/ambientes',
  requirePermission(PERMISSIONS.AMBIENTES.VIEW),
  listarAmbientes
);

// Listar ambientes activos (versión simplificada para formularios)
router.get(
  '/ambientes/activos',
  requirePermission(PERMISSIONS.AMBIENTES.VIEW),
  listarAmbientesActivos
);

// Obtener un ambiente específico con detalles completos
router.get(
  '/ambientes/:id',
  requirePermission(PERMISSIONS.AMBIENTES.VIEW),
  obtenerAmbiente
);

// Crear nuevo ambiente
router.post(
  '/ambientes',
  requirePermission(PERMISSIONS.AMBIENTES.CREATE),
  crearAmbiente
);

// Actualizar ambiente
router.put(
  '/ambientes/:id',
  requirePermission(PERMISSIONS.AMBIENTES.UPDATE),
  actualizarAmbiente
);

// Eliminar ambiente
router.delete(
  '/ambientes/:id',
  requirePermission(PERMISSIONS.AMBIENTES.DELETE),
  eliminarAmbiente
);

export default router;
