import express from 'express';
import { registrarEquipo, obtenerEquipoPorCodigo, listarEquipos, actualizarEquipo, eliminarEquipo, asignarEquipo, obtenerMisEquipos, listarAsignaciones, eliminarAsignacion, obtenerEquiposAmbientesInstructor, registrarVerificacionInventario, consultarHistorialVerificaciones, obtenerHistorialEquipo } from '../controller/equiposController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { writeLimiter, readLimiter, strictLimiter } from '../middleware/rateLimiter.js';
import { validate, registrarEquipoSchema, actualizarEquipoSchema, asignarEquipoSchema, verificarInventarioSchema } from '../validators/equiposValidator.js';

const router = express.Router();

// ============================================
// RUTAS PROTEGIDAS DE EQUIPOS
// ============================================

// Registrar nuevo equipo - Solo Admin - Protegido con rate limiting y validación
router.post('/', 
  authenticate,
  writeLimiter,
  validate(registrarEquipoSchema),
  requirePermission(PERMISSIONS.EQUIPOS.CREATE),
  registrarEquipo
);

// Listar equipos
// Admin e Instructor: ven todos los equipos
// Aprendiz: solo ve sus equipos asignados (controlador filtra)
router.get('/', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  listarEquipos
);

// Obtener equipos asignados al usuario actual
// Todos los roles pueden ver sus propios equipos asignados
router.get('/mis-equipos/asignados', 
  authenticate,
  obtenerMisEquipos
);

// Listar todas las asignaciones
// Admin: ve todas las asignaciones
// Instructor: ve solo asignaciones de aprendices
router.get('/asignaciones', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.ASSIGN
  ]),
  listarAsignaciones
);

// Obtener historial de verificaciones de un equipo específico
// IMPORTANTE: Esta ruta debe ir ANTES de /:codigo para evitar conflictos
router.get('/:codigo/historial-verificaciones', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  obtenerHistorialEquipo
);

// Consultar equipo por código
// Admin e Instructor: pueden ver cualquier equipo
// Aprendiz: solo equipos asignados (controlador valida)
// IMPORTANTE: Esta ruta debe ir DESPUÉS de las rutas específicas como /asignaciones y /:codigo/historial-verificaciones
router.get('/:codigo', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW_DETAIL,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  obtenerEquipoPorCodigo
);

// Actualizar equipo - Solo Admin - Protegido con rate limiting y validación
router.put('/:codigo', 
  authenticate,
  writeLimiter,
  validate(actualizarEquipoSchema),
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  actualizarEquipo
);

// Eliminar equipo - Solo Admin - Protegido con rate limiting
router.delete('/:codigo', 
  authenticate,
  strictLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.DELETE),
  eliminarEquipo
);

// Asignar equipo a usuario - Protegido con validación
// Admin: puede asignar a cualquier usuario
// Instructor: solo puede asignar a Aprendices
router.post('/asignar', 
  authenticate,
  writeLimiter,
  validate(asignarEquipoSchema),
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.ASSIGN,
    PERMISSIONS.EQUIPOS.ASSIGN_TO_APRENDIZ
  ]),
  asignarEquipo
);

// Eliminar/Desactivar una asignación
// Solo Admin e Instructor pueden eliminar asignaciones
router.delete('/asignaciones/:id', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.ASSIGN,
    PERMISSIONS.EQUIPOS.ASSIGN_TO_APRENDIZ
  ]),
  eliminarAsignacion
);

// Obtener equipos de ambientes asignados al instructor (para verificación)
// Solo instructores
router.get('/verificacion/ambientes', 
  authenticate,
  obtenerEquiposAmbientesInstructor
);

// Registrar verificación física de inventario - Protegido con validación
// Solo instructores
router.post('/verificacion', 
  authenticate,
  writeLimiter,
  validate(verificarInventarioSchema),
  registrarVerificacionInventario
);

// Consultar historial de verificaciones
// Admin: ve todas las verificaciones
// Instructor: solo sus propias verificaciones
router.get('/verificacion/historial', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  consultarHistorialVerificaciones
);

export default router;
