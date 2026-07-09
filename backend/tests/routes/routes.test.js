/**
 * Tests para ambientesRoutes y notificationsRoutes
 * Verifica que los routers exponen las rutas correctas
 */

import { describe, it, expect, jest } from '@jest/globals';

// Mocks compartidos
const mockMiddleware = jest.fn((req, res, next) => next());
const mockRequirePermission = jest.fn(() => mockMiddleware);

jest.mock('../../src/middleware/authMiddleware.js', () => ({
  authenticate: jest.fn((req, res, next) => next()),
}), { virtual: true });

jest.mock('../../src/middleware/authorization.js', () => ({
  requirePermission: mockRequirePermission,
  requireOwnership: jest.fn(() => mockMiddleware),
}), { virtual: true });

jest.mock('../../src/config/permissions.js', () => ({
  PERMISSIONS: {
    AMBIENTES: { VIEW: 'amb.view', CREATE: 'amb.create', UPDATE: 'amb.update', DELETE: 'amb.delete' },
    EQUIPOS: { VIEW: 'eq.view', CREATE: 'eq.create', UPDATE: 'eq.update', DELETE: 'eq.delete' },
    NOVEDADES: { VIEW: 'nov.view', CREATE: 'nov.create', UPDATE: 'nov.update', DELETE: 'nov.delete' },
    USERS: { VIEW: 'users.view', UPDATE: 'users.update' },
    ROLES: { VIEW: 'roles.view', UPDATE: 'roles.update' },
    ESTADISTICAS: { VIEW: 'stats.view' },
  },
}), { virtual: true });

jest.mock('../../src/config/dbconfig.js', () => ({
  default: { execute: jest.fn() },
}), { virtual: true });

jest.mock('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}), { virtual: true });

jest.mock('../../src/services/ambientesService.js', () => ({
  expandirAsignacionesPorFechas: jest.fn(),
  convertirNombresDiasANumeros: jest.fn(),
  validarRangoHoras: jest.fn(),
  validarRangoFechas: jest.fn(),
  calcularCantidadAsignaciones: jest.fn(),
  obtenerNombreDia: jest.fn(),
}), { virtual: true });

jest.mock('../../src/validators/authValidator.js', () => ({
  validate: jest.fn(() => mockMiddleware),
  registerSchema: {},
  loginSchema: {},
}), { virtual: true });

jest.mock('../../src/middleware/rateLimiter.js', () => ({
  authLimiter: mockMiddleware,
  registerLimiter: mockMiddleware,
  passwordResetLimiter: mockMiddleware,
  writeLimiter: mockMiddleware,
  readLimiter: mockMiddleware,
  strictLimiter: mockMiddleware,
  searchLimiter: mockMiddleware,
  webhookLimiter: mockMiddleware,
}), { virtual: true });

// Mock de controladores de ambientes
jest.mock('../../src/controller/ambientesController.js', () => ({
  listarAmbientes: jest.fn(),
  obtenerAmbiente: jest.fn(),
  crearAmbiente: jest.fn(),
  actualizarAmbiente: jest.fn(),
  eliminarAmbiente: jest.fn(),
  listarAmbientesActivos: jest.fn(),
  asignarAmbienteInstructor: jest.fn(),
  desasignarAmbienteInstructor: jest.fn(),
  listarAsignacionesAmbientes: jest.fn(),
  obtenerInstructoresAmbiente: jest.fn(),
  cambiarInstructorACuentadanteSecundario: jest.fn(),
}), { virtual: true });

// Mock de controladores de notificaciones
jest.mock('../../src/controller/notificationsController.js', () => ({
  listNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  createNotification: jest.fn(),
}), { virtual: true });

jest.mock('../../src/services/notificationService.js', () => ({
  createForUsers: jest.fn(),
  createForRole: jest.fn(),
  normalizeNotificationType: jest.fn(),
}), { virtual: true });

jest.mock('../../src/services/socketService.js', () => ({
  default: { emit: jest.fn() },
}), { virtual: true });

// ------------------------------------------------------------------
// ambientesRoutes
// ------------------------------------------------------------------
describe('ambientesRoutes', () => {
  it('debe exportar un router de Express', async () => {
    const mod = await import('../../src/routes/ambientesRoutes.js');
    const router = mod.default;
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('debe registrar rutas GET /ambientes y /ambientes/activos', async () => {
    const mod = await import('../../src/routes/ambientesRoutes.js');
    const router = mod.default;
    const paths = router.stack
      .filter(l => l.route)
      .map(l => l.route.path);
    expect(paths).toContain('/ambientes');
    expect(paths).toContain('/ambientes/activos');
  });
});

// ------------------------------------------------------------------
// notificationsRoutes
// ------------------------------------------------------------------
describe('notificationsRoutes', () => {
  it('debe exportar un router de Express', async () => {
    const mod = await import('../../src/routes/notificationsRoutes.js');
    const router = mod.default;
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});
