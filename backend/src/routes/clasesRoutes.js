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
  cancelarClase,
  consultarResponsablesTiempoReal,
  sincronizarResponsabilidadesHorarios,
  obtenerNombresClases,
  crearNombreClase,
  aceptarConsentimiento,
  rechazarConsentimiento
} from '../controller/clasesController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { writeLimiter } from '../middleware/rateLimiter.js';
import { validate, crearClaseSchema, actualizarClaseSchema, agregarParticipantesSchema } from '../validators/clasesValidator.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Crear clase (Instructor y Admin) - Protegido con rate limiting y validación
router.post(
  '/clases',
  writeLimiter,
  validate(crearClaseSchema),
  requirePermission(PERMISSIONS.CLASES.CREATE),
  crearClase
);

// Listar clases (todos los usuarios autenticados pueden ver)
router.get(
  '/clases',
  requirePermission(PERMISSIONS.CLASES.VIEW),
  listarClases
);

// Autocompletado: Obtener nombres únicos de clases de formación
// IMPORTANTE: Esta ruta debe ir ANTES de /clases/:id para evitar conflictos
router.get(
  '/clases/nombres',
  requirePermission(PERMISSIONS.CLASES.VIEW),
  obtenerNombresClases
);

// Obtener una clase específica
router.get(
  '/clases/:id',
  requirePermission(PERMISSIONS.CLASES.VIEW),
  obtenerClase
);

// Actualizar clase (solo programadas) - Protegido con validación
router.put(
  '/clases/:id',
  writeLimiter,
  validate(actualizarClaseSchema),
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

// Consentimiento para iniciar clase
router.post(
  '/clases/:id/consentimiento/aceptar',
  requirePermission(PERMISSIONS.CLASES.UPDATE),
  aceptarConsentimiento
);

router.post(
  '/clases/:id/consentimiento/rechazar',
  requirePermission(PERMISSIONS.CLASES.UPDATE),
  rechazarConsentimiento
);

// Agregar participantes a una clase - Protegido con validación
router.post(
  '/clases/:id/participantes',
  writeLimiter,
  validate(agregarParticipantesSchema),
  requirePermission(PERMISSIONS.CLASES.UPDATE),
  agregarParticipantes
);

// Obtener responsables actuales de un ambiente
router.get(
  '/ambientes/:id_ambiente/responsables',
  requirePermission(PERMISSIONS.AMBIENTES.VIEW),
  obtenerResponsablesAmbiente
);

// Consultar responsables en tiempo real (fecha y hora específicas)
router.get(
  '/ambientes/:id_ambiente/responsables-tiempo-real',
  requirePermission(PERMISSIONS.AMBIENTES.VIEW),
  consultarResponsablesTiempoReal
);

// Sincronizar responsabilidades basándose en horarios (puede ejecutarse automáticamente)
router.post(
  '/clases/sincronizar-responsabilidades',
  requirePermission(PERMISSIONS.CLASES.UPDATE),
  sincronizarResponsabilidadesHorarios
);

// Autocompletado: Crear/validar nuevo nombre de clase
router.post(
  '/clases/nombres',
  writeLimiter,
  requirePermission(PERMISSIONS.CLASES.CREATE),
  crearNombreClase
);

export default router;

