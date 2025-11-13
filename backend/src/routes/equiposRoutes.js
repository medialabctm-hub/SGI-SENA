import express from 'express';
import { registrarEquipo, obtenerEquipoPorCodigo, listarEquipos, actualizarEquipo, eliminarEquipo, asignarEquipo, obtenerMisEquipos, listarAsignaciones, eliminarAsignacion } from '../controller/equiposController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = express.Router();

// ============================================
// RUTAS PROTEGIDAS DE EQUIPOS
// ============================================

// Registrar nuevo equipo - Solo Admin
router.post('/', 
  authenticate,
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

// Consultar equipo por código
// Admin e Instructor: pueden ver cualquier equipo
// Aprendiz: solo equipos asignados (controlador valida)
// IMPORTANTE: Esta ruta debe ir DESPUÉS de las rutas específicas como /asignaciones
router.get('/:codigo', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW_DETAIL,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  obtenerEquipoPorCodigo
);

// Actualizar equipo - Solo Admin
router.put('/:codigo', 
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  actualizarEquipo
);

// Eliminar equipo - Solo Admin
router.delete('/:codigo', 
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.DELETE),
  eliminarEquipo
);

// Asignar equipo a usuario
// Admin: puede asignar a cualquier usuario
// Instructor: solo puede asignar a Aprendices
router.post('/asignar', 
  authenticate,
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

export default router;
