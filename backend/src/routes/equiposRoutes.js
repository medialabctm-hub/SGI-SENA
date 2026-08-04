import express from 'express';
import { registrarEquipo, obtenerEquipoPorCodigo, listarEquipos, actualizarEquipo, eliminarEquipo, asignarEquipo, obtenerMisEquipos, listarAsignaciones, eliminarAsignacion, actualizarAsignacionEquipo, obtenerEquiposAmbientesInstructor, registrarVerificacionInventario, consultarHistorialVerificaciones, obtenerHistorialEquipo, obtenerHistorialMovimientos, actualizarCuentadantePrincipal, obtenerCuentadantePrincipal, buscarCuentadantePorDocumento, listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria, registrarInicioUso, registrarFinUso, consultarHistorialUso, obtenerHistorialEquipoUso, obtenerSesionesActivas, registrarUsoEquipoExterno, iniciarUsoAutoservicio } from '../controller/equiposController.js';
import { crearSolicitud, listarPendientesParaAutorizador, contarPendientesParaAutorizador, listarHistorialAutorizador, listarMisSolicitudes, aprobarSolicitud, rechazarSolicitud, listarDisponiblesParaMovimiento, obtenerAutorizadorParaEquipo } from '../controller/autorizacionMovimientoController.js';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission, requireAnyPermissionIfAuthenticated } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { writeLimiter, readLimiter, strictLimiter, webhookLimiter, searchLimiter } from '../middleware/rateLimiter.js';
import { validate, registrarEquipoSchema, actualizarEquipoSchema, asignarEquipoSchema, verificarInventarioSchema, solicitudAutorizacionMovimientoSchema, crearCategoriaSchema, actualizarCategoriaSchema, registrarUsoEquipoSchema, actualizarUsoEquipoSchema, registrarUsoEquipoExternoSchema, actualizarAsignacionEquipoSchema, autoservicioIniciarUsoSchema } from '../validators/equiposValidator.js';
import { uploadEquipoImagePublico, handleUploadError } from '../middleware/uploadMiddleware.js';
import { parseFormData } from '../middleware/parseFormData.js';
import { corsPublic } from '../middleware/corsPublicMiddleware.js';

const router = express.Router();

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

// Registrar uso de equipo desde página externa (público)
// Endpoint para recibir datos de páginas externas: documento, placa, imagenes (opcional)
// El nombre se obtiene automáticamente buscando el usuario por documento en la BD
// Las imágenes se guardan en Imagenes_Equipo asociadas al equipo identificado por la placa
// Registro externo: público sin token; con token exige permiso ASSIGN o ASSIGN_TO_APRENDIZ (web/app).
router.post('/uso/registro-externo', 
  corsPublic,
  webhookLimiter,
  uploadEquipoImagePublico.array('imagenes', 10),
  handleUploadError,
  parseFormData,
  optionalAuthenticate,
  requireAnyPermissionIfAuthenticated([PERMISSIONS.EQUIPOS.ASSIGN, PERMISSIONS.EQUIPOS.ASSIGN_TO_APRENDIZ]),
  validate(registrarUsoEquipoExternoSchema),
  registrarUsoEquipoExterno
);

// Autoservicio: aprendiz sin cuenta ingresa documento + placa para tomar un equipo en préstamo (público)
// Requiere clase En Curso en el ambiente del equipo; se libera automáticamente al finalizar la clase.
router.post('/autoservicio/iniciar-uso',
  webhookLimiter,
  validate(autoservicioIniciarUsoSchema),
  iniciarUsoAutoservicio
);

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

// Listar categorías de equipos disponibles
// Todos los usuarios autenticados pueden ver las categorías
router.get('/categorias', 
  authenticate,
  readLimiter,
  listarCategorias
);

// Crear nueva categoría - Solo Admin
router.post('/categorias',
  authenticate,
  writeLimiter,
  validate(crearCategoriaSchema),
  requirePermission(PERMISSIONS.EQUIPOS.MANAGE_CATEGORIES),
  crearCategoria
);

// Actualizar categoría - Solo Admin
router.put('/categorias/:id_categoria',
  authenticate,
  writeLimiter,
  validate(actualizarCategoriaSchema),
  requirePermission(PERMISSIONS.EQUIPOS.MANAGE_CATEGORIES),
  actualizarCategoria
);

// Eliminar categoría - Solo Admin
router.delete('/categorias/:id_categoria',
  authenticate,
  strictLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.MANAGE_CATEGORIES),
  eliminarCategoria
);

// Listar equipos con filtros avanzados
// Admin e Instructor: ven todos los equipos
// Aprendiz: solo ve sus equipos asignados (controlador filtra)
router.get('/', 
  authenticate,
  searchLimiter, // Rate limiting específico para búsquedas
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
// Instructor y Cuentadante: ven asignaciones de aprendices (pueden asignar equipos)
router.get('/asignaciones', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.ASSIGN,
    PERMISSIONS.EQUIPOS.ASSIGN_TO_APRENDIZ
  ]),
  listarAsignaciones
);

// Obtener cuentadante principal - Solo Admin
// IMPORTANTE: Debe ir ANTES de /:codigo para evitar conflictos
router.get('/cuentadante-principal', 
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.VIEW),
  obtenerCuentadantePrincipal
);

// Actualizar cuentadante principal - Solo Admin
// IMPORTANTE: Debe ir ANTES de /:codigo para evitar conflictos
router.put('/cuentadante-principal', 
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  actualizarCuentadantePrincipal
);

// Buscar cuentadante por documento y ver su inventario - Solo Admin
// IMPORTANTE: Debe ir ANTES de /:codigo para evitar conflictos
router.get('/cuentadantes/buscar/:documento', 
  authenticate,
  readLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.VIEW),
  buscarCuentadantePorDocumento
);

// ============================================
// SOLICITUDES DE AUTORIZACIÓN PARA MOVER EQUIPO VERIFICADO
// ============================================
router.post('/autorizacion-movimiento',
  authenticate,
  writeLimiter,
  validate(solicitudAutorizacionMovimientoSchema),
  requireAnyPermission([PERMISSIONS.EQUIPOS.VIEW, PERMISSIONS.EQUIPOS.UPDATE]),
  crearSolicitud
);
// Consultar a quién se enviará la autorización de un equipo (destinatario derivado del equipo)
router.get('/autorizacion-movimiento/autorizador',
  authenticate,
  readLimiter,
  requireAnyPermission([PERMISSIONS.EQUIPOS.VIEW, PERMISSIONS.EQUIPOS.UPDATE]),
  obtenerAutorizadorParaEquipo
);
router.get('/autorizacion-movimiento/pendientes/count',
  authenticate,
  readLimiter,
  contarPendientesParaAutorizador
);
router.get('/autorizacion-movimiento/pendientes',
  authenticate,
  readLimiter,
  listarPendientesParaAutorizador
);
router.get('/autorizacion-movimiento/historial',
  authenticate,
  readLimiter,
  listarHistorialAutorizador
);
router.get('/autorizacion-movimiento/mis-solicitudes',
  authenticate,
  readLimiter,
  listarMisSolicitudes
);
router.get('/autorizacion-movimiento/disponibles',
  authenticate,
  readLimiter,
  requireAnyPermission([PERMISSIONS.EQUIPOS.VIEW, PERMISSIONS.EQUIPOS.UPDATE]),
  listarDisponiblesParaMovimiento
);
router.put('/autorizacion-movimiento/:id/aprobar',
  authenticate,
  writeLimiter,
  aprobarSolicitud
);
router.put('/autorizacion-movimiento/:id/rechazar',
  authenticate,
  writeLimiter,
  rechazarSolicitud
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

// Obtener historial de movimientos de ambiente de un equipo
router.get('/:codigo/historial-movimientos',
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  obtenerHistorialMovimientos
);

// Consultar equipo por código
// Admin e Instructor: pueden ver cualquier equipo
// Aprendiz: solo equipos asignados (controlador valida)
// IMPORTANTE: Esta ruta debe ir DESPUÉS de las rutas específicas como /asignaciones, /cuentadante-principal y /:codigo/historial-verificaciones
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

// Actualizar una asignación de equipo
// Solo Admin e Instructor pueden actualizar asignaciones
router.put('/asignaciones/:id', 
  authenticate,
  writeLimiter,
  validate(actualizarAsignacionEquipoSchema),
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.ASSIGN,
    PERMISSIONS.EQUIPOS.ASSIGN_TO_APRENDIZ
  ]),
  actualizarAsignacionEquipo
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

// Consultar historial de verificaciones - DESACTIVADO
// Admin: ve todas las verificaciones
// Instructor: solo sus propias verificaciones
/* router.get('/verificacion/historial', 
  authenticate,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  consultarHistorialVerificaciones
); */

// ============================================
// RUTAS DE HISTORIAL DE USO DE EQUIPOS
// ============================================

// Registrar uso de equipo por un aprendiz (web y app móvil; Instructor/Admin/Cuentadante)
// Registrar inicio de sesión en un equipo (desde app Flutter)
// Todos los usuarios autenticados pueden registrar su propio inicio de sesión
router.post('/uso/inicio', 
  authenticate,
  writeLimiter,
  validate(registrarUsoEquipoSchema),
  registrarInicioUso
);

// Registrar cierre de sesión en un equipo (desde app Flutter)
// Todos los usuarios autenticados pueden registrar su propio cierre de sesión
router.post('/uso/fin', 
  authenticate,
  writeLimiter,
  validate(actualizarUsoEquipoSchema),
  registrarFinUso
);

// Consultar historial de uso de equipos
// Admin e Instructor: ven todo el historial
// Aprendiz: solo su propio historial
// RUTA DESACTIVADA
// router.get('/uso/historial', 
//   authenticate,
//   readLimiter,
//   requireAnyPermission([
//     PERMISSIONS.EQUIPOS.VIEW,
//     PERMISSIONS.EQUIPOS.VIEW_OWN
//   ]),
//   consultarHistorialUso
// );

// Obtener historial de uso de un equipo específico
// IMPORTANTE: Esta ruta debe ir ANTES de /:codigo para evitar conflictos
router.get('/:codigo/uso/historial', 
  authenticate,
  readLimiter,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  obtenerHistorialEquipoUso
);

// Obtener sesiones activas (en uso) de equipos
// Admin e Instructor: ven todas las sesiones activas
// Aprendiz: solo sus propias sesiones activas
router.get('/uso/activas', 
  authenticate,
  readLimiter,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN
  ]),
  obtenerSesionesActivas
);

export default router;
