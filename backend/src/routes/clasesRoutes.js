import express from 'express';
import {
  crearClase,
  listarClases,
  obtenerClase,
  iniciarClase,
  finalizarClase,
  agregarParticipantes,
  obtenerResponsablesAmbiente,
  actualizarClase,
  cancelarClase
} from '../controller/clasesController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Crear clase (Instructor y Admin)
router.post(
  '/clases',
  requirePermission(PERMISSIONS.CLASES.CREATE),
  crearClase
);

// Listar clases (todos los usuarios autenticados pueden ver)
router.get(
  '/clases',
  requirePermission(PERMISSIONS.CLASES.VIEW),
  listarClases
);

// Obtener una clase específica
router.get(
  '/clases/:id',
  requirePermission(PERMISSIONS.CLASES.VIEW),
  obtenerClase
);

// Actualizar clase (solo programadas)
router.put(
  '/clases/:id',
  requirePermission(PERMISSIONS.CLASES.UPDATE),
  actualizarClase
);

// Iniciar clase (cambiar a "En Curso" y asignar responsabilidades)
router.post(
  '/clases/:id/iniciar',
  requirePermission(PERMISSIONS.CLASES.UPDATE),
  iniciarClase
);

// Finalizar clase (cambiar a "Finalizada" y cerrar responsabilidades)
router.post(
  '/clases/:id/finalizar',
  requirePermission(PERMISSIONS.CLASES.UPDATE),
  finalizarClase
);

// Cancelar clase
router.post(
  '/clases/:id/cancelar',
  requirePermission(PERMISSIONS.CLASES.UPDATE),
  cancelarClase
);

// Agregar participantes a una clase
router.post(
  '/clases/:id/participantes',
  requirePermission(PERMISSIONS.CLASES.UPDATE),
  agregarParticipantes
);

// Obtener responsables actuales de un ambiente
router.get(
  '/ambientes/:id_ambiente/responsables',
  requirePermission(PERMISSIONS.AMBIENTES.VIEW),
  obtenerResponsablesAmbiente
);

export default router;

