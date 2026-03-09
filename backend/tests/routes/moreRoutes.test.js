/**
 * Tests para las rutas restantes del sistema
 * Verifica que los routers se cargan correctamente
 */

import { describe, it, expect, jest } from '@jest/globals';

// ---- shared mocks ----
const noop = jest.fn((req, res, next) => (next ? next() : undefined));
const requirePermission = jest.fn(() => noop);
const requireAnyPermission = jest.fn(() => noop);
const requireRole = jest.fn(() => noop);

jest.mock('../../src/middleware/authMiddleware.js', () => ({
  authenticate: jest.fn((req, res, next) => next()),
}), { virtual: true });

jest.mock('../../src/middleware/authorization.js', () => ({
  requirePermission,
  requireAnyPermission,
  requireOwnership: jest.fn(() => noop),
  requireRole,
}), { virtual: true });

jest.mock('../../src/config/permissions.js', () => ({
  PERMISSIONS: {
    AMBIENTES: { VIEW: 'a.v', CREATE: 'a.c', UPDATE: 'a.u', DELETE: 'a.d' },
    EQUIPOS: { VIEW: 'e.v', CREATE: 'e.c', UPDATE: 'e.u', DELETE: 'e.d' },
    NOVEDADES: { VIEW: 'n.v', CREATE: 'n.c', UPDATE: 'n.u', DELETE: 'n.d' },
    MANTENIMIENTO: { VIEW: 'm.v', CREATE: 'm.c', UPDATE: 'm.u', DELETE: 'm.d' },
    APRENDICES: { VIEW: 'ap.v', UPDATE: 'ap.u', DELETE: 'ap.d' },
    CLASES: { VIEW: 'cl.v', CREATE: 'cl.c', UPDATE: 'cl.u', DELETE: 'cl.d' },
    HORARIOS: { VIEW: 'h.v', CREATE: 'h.c', UPDATE: 'h.u', DELETE: 'h.d' },
    IMPORT: { CREATE: 'i.c' },
    REPORTES: { VIEW: 'r.v', CREATE: 'r.c', UPDATE: 'r.u', DELETE: 'r.d' },
    USERS: { VIEW: 'u.v', UPDATE: 'u.u' },
    ROLES: { VIEW: 'ro.v', UPDATE: 'ro.u' },
    ESTADISTICAS: { VIEW: 'st.v' },
    IMAGENES: { VIEW: 'im.v', CREATE: 'im.c', DELETE: 'im.d' },
    PREFERENCES: { VIEW: 'pr.v', UPDATE: 'pr.u' },
  },
  ROLE_PERMISSIONS: {},
  getRolePermissions: jest.fn(() => []),
}), { virtual: true });

jest.mock('../../src/config/dbconfig.js', () => ({
  default: { execute: jest.fn() },
}), { virtual: true });

jest.mock('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}), { virtual: true });

jest.mock('../../src/middleware/rateLimiter.js', () => ({
  authLimiter: noop,
  registerLimiter: noop,
  writeLimiter: noop,
  readLimiter: noop,
  strictLimiter: noop,
  searchLimiter: noop,
  webhookLimiter: noop,
  passwordResetLimiter: noop,
}), { virtual: true });

// ---- validators ----
jest.mock('../../src/validators/equiposValidator.js', () => ({
  validate: jest.fn(() => noop),
  registrarEquipoSchema: {},
  actualizarEquipoSchema: {},
  asignarEquipoSchema: {},
  verificarInventarioSchema: {},
  crearCategoriaSchema: {},
  actualizarCategoriaSchema: {},
  registrarUsoEquipoSchema: {},
  actualizarUsoEquipoSchema: {},
  registrarUsoEquipoExternoSchema: {},
  actualizarAsignacionEquipoSchema: {},
}), { virtual: true });

jest.mock('../../src/validators/novedadesValidator.js', () => ({
  validate: jest.fn(() => noop),
  crearNovedadSchema: {},
  actualizarEstadoNovedadSchema: {},
}), { virtual: true });

jest.mock('../../src/validators/mantenimientoValidator.js', () => ({
  validate: jest.fn(() => noop),
  actualizarEstadoMantenimientoSchema: {},
  actualizarFechaProximoSchema: {},
  actualizarFechaMantenimientoSchema: {},
}), { virtual: true });

jest.mock('../../src/validators/clasesValidator.js', () => ({
  validate: jest.fn(() => noop),
  crearClaseSchema: {},
  actualizarClaseSchema: {},
  agregarParticipantesSchema: {},
}), { virtual: true });

jest.mock('../../src/validators/reportesValidator.js', () => ({
  validate: jest.fn(() => noop),
  crearReporteSchema: {},
  actualizarReporteSchema: {},
}), { virtual: true });

jest.mock('../../src/validators/authValidator.js', () => ({
  validate: jest.fn(() => noop),
  registerSchema: {},
  loginSchema: {},
}), { virtual: true });

// ---- upload middleware ----
jest.mock('../../src/middleware/uploadMiddleware.js', () => ({
  uploadEquipoImagePublico: noop,
  uploadEquipoImage: noop,
  handleUploadError: noop,
}), { virtual: true });

jest.mock('../../src/middleware/uploadAmbienteMiddleware.js', () => ({
  uploadAmbienteImage: noop,
  handleUploadError: noop,
}), { virtual: true });

jest.mock('../../src/middleware/corsPublicMiddleware.js', () => ({
  corsPublic: noop,
}), { virtual: true });

jest.mock('../../src/middleware/parseFormData.js', () => ({
  parseFormData: noop,
}), { virtual: true });

jest.mock('../../src/middleware/fileValidation.js', () => ({
  validateExcelFile: noop,
}), { virtual: true });

// ---- services ----
jest.mock('../../src/services/notificationService.js', () => ({
  createForUsers: jest.fn(),
  createForRole: jest.fn(),
  normalizeNotificationType: jest.fn(),
}), { virtual: true });

jest.mock('../../src/services/socketService.js', () => ({
  default: { emit: jest.fn() },
}), { virtual: true });

jest.mock('../../src/services/ambientesService.js', () => ({
  expandirAsignacionesPorFechas: jest.fn(),
  convertirNombresDiasANumeros: jest.fn(),
  validarRangoHoras: jest.fn(),
  validarRangoFechas: jest.fn(),
  calcularCantidadAsignaciones: jest.fn(),
  obtenerNombreDia: jest.fn(),
}), { virtual: true });

// ---- controllers ----
jest.mock('../../src/controller/equiposController.js', () => ({
  registrarEquipo: jest.fn(), obtenerEquipoPorCodigo: jest.fn(), listarEquipos: jest.fn(),
  actualizarEquipo: jest.fn(), eliminarEquipo: jest.fn(), asignarEquipo: jest.fn(),
  obtenerMisEquipos: jest.fn(), listarAsignaciones: jest.fn(), eliminarAsignacion: jest.fn(),
  actualizarAsignacionEquipo: jest.fn(), obtenerEquiposAmbientesInstructor: jest.fn(),
  registrarVerificacionInventario: jest.fn(), consultarHistorialVerificaciones: jest.fn(),
  obtenerHistorialEquipo: jest.fn(), actualizarCuentadantePrincipal: jest.fn(),
  obtenerCuentadantePrincipal: jest.fn(), buscarCuentadantePorDocumento: jest.fn(),
  listarCategorias: jest.fn(), crearCategoria: jest.fn(), actualizarCategoria: jest.fn(),
  eliminarCategoria: jest.fn(), registrarInicioUso: jest.fn(), registrarFinUso: jest.fn(),
  consultarHistorialUso: jest.fn(), obtenerHistorialEquipoUso: jest.fn(),
  obtenerSesionesActivas: jest.fn(), registrarUsoEquipoExterno: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/novedadesController.js', () => ({
  crearNovedad: jest.fn(), listarNovedades: jest.fn(), obtenerNovedadPorId: jest.fn(),
  actualizarEstadoNovedad: jest.fn(), obtenerTiposNovedad: jest.fn(), obtenerEstadosNovedad: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/mantenimientoController.js', () => ({
  crearMantenimiento: jest.fn(), listarMantenimientos: jest.fn(), obtenerMantenimientoPorId: jest.fn(),
  actualizarEstadoMantenimiento: jest.fn(), actualizarFechaProximo: jest.fn(),
  actualizarFechaMantenimiento: jest.fn(), eliminarMantenimiento: jest.fn(),
  obtenerTiposMantenimiento: jest.fn(), obtenerEstadosMantenimiento: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/aprendicesController.js', () => ({
  listarAprendices: jest.fn(), actualizarAprendiz: jest.fn(), eliminarAprendiz: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/clasesController.js', () => ({
  crearClase: jest.fn(), listarClases: jest.fn(), obtenerClasePorId: jest.fn(),
  actualizarClase: jest.fn(), eliminarClase: jest.fn(), agregarParticipantes: jest.fn(),
  listarParticipantes: jest.fn(), eliminarParticipante: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/horariosController.js', () => ({
  crearHorario: jest.fn(), listarHorarios: jest.fn(), obtenerHorarioPorId: jest.fn(),
  actualizarHorario: jest.fn(), eliminarHorario: jest.fn(),
  listarHorariosConflictos: jest.fn(), confirmarHorario: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/importController.js', () => ({
  importarAprendices: jest.fn(), importarEquipos: jest.fn(),
  importarHorarios: jest.fn(), importarAmbientes: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/reportesController.js', () => ({
  crearReporte: jest.fn(), listarReportes: jest.fn(), obtenerReportePorId: jest.fn(),
  actualizarReporte: jest.fn(), eliminarReporte: jest.fn(),
  obtenerTiposReporte: jest.fn(), generarReportePDF: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/preferencesController.js', () => ({
  getPreferences: jest.fn(), updatePreferences: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/rolesController.js', () => ({
  listarRoles: jest.fn(), obtenerRol: jest.fn(), crearRol: jest.fn(),
  actualizarRol: jest.fn(), eliminarRol: jest.fn(),
  asignarPermiso: jest.fn(), eliminarPermiso: jest.fn(),
  listarPermisosRol: jest.fn(), listarPermisosDisponibles: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/estadisticasController.js', () => ({
  obtenerEstadisticas: jest.fn(), obtenerResumenGeneral: jest.fn(),
  obtenerTopEquipos: jest.fn(), obtenerEstadisticasUsoEquipos: jest.fn(),
  obtenerEstadoEquiposActivos: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/imagenesAmbienteController.js', () => ({
  subirImagenAmbiente: jest.fn(), listarImagenesAmbiente: jest.fn(),
  eliminarImagenAmbiente: jest.fn(), establecerImagenPrincipal: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/imagenesEquipoController.js', () => ({
  subirImagenEquipo: jest.fn(), listarImagenesEquipo: jest.fn(),
  eliminarImagenEquipo: jest.fn(), establecerImagenPrincipal: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/invitationCodeController.js', () => ({
  generarCodigoInvitacion: jest.fn(), validarCodigoInvitacion: jest.fn(),
  listarCodigosInvitacion: jest.fn(), desactivarCodigo: jest.fn(),
}), { virtual: true });

jest.mock('../../src/controller/webhookController.js', () => ({
  recibirWebhookExterno: jest.fn(),
}), { virtual: true });

// ---- multer stub ----
jest.mock('multer', () => {
  const m = jest.fn(() => ({
    single: jest.fn(() => noop),
    array: jest.fn(() => noop),
    fields: jest.fn(() => noop),
  }));
  m.diskStorage = jest.fn(() => ({}));
  m.memoryStorage = jest.fn(() => ({}));
  return { default: m };
}, { virtual: true });

// ------------------------------------------------------------------
// Helper
// ------------------------------------------------------------------
async function loadRouter(path) {
  const mod = await import(path);
  return mod.default;
}

function isFunction(r) {
  return typeof r === 'function';
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe('equiposRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/equiposRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('novedadesRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/novedadesRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('mantenimientoRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/mantenimientoRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('aprendicesRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/aprendicesRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('clasesRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/clasesRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('horariosRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/horariosRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('importRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/importRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('reportesRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/reportesRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('preferencesRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/preferencesRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('permissionsRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/permissionsRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('estadisticasRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/estadisticasRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('imagenesAmbienteRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/imagenesAmbienteRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('imagenesEquipoRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/imagenesEquipoRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('invitationCodeRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/invitationCodeRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});

describe('webhookRoutes', () => {
  it('debe exportar un router', async () => {
    const r = await loadRouter('../../src/routes/webhookRoutes.js');
    expect(isFunction(r)).toBe(true);
  });
});
