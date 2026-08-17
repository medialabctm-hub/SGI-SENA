import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Esta suite necesita una instancia aislada de multer y de los middlewares
// para no reutilizar mocks registrados por otras suites de rutas.
jest.resetModules();

const noop = jest.fn((req, res, next) => next && next());
const requirePermissionMock = jest.fn(() => noop);
const requireRoleMock = jest.fn(() => noop);
const validateExcelFileMock = jest.fn();
const singleMock = jest.fn(() => noop);
const multerState = { options: null };

const multerMock = jest.fn((options) => {
  multerState.options = options;
  return {
    single: singleMock,
  };
});
multerMock.memoryStorage = jest.fn(() => ({ type: 'memory' }));

jest.unstable_mockModule('multer', () => ({
  default: multerMock,
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/controller/importController.js'), () => ({
  importarEquipos: jest.fn(),
  obtenerEstadoImportacionEquipos: jest.fn(), // seguimiento en tiempo real de import jobs
  importarUsuarios: jest.fn(),
  importarAprendices: jest.fn(),
  obtenerDuplicadosPendientes: jest.fn(),
  procesarDuplicado: jest.fn(),
  procesarDuplicadosMasivo: jest.fn(),
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/middleware/authMiddleware.js'), () => ({
  authenticate: noop,
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/middleware/authorization.js'), () => ({
  requirePermission: requirePermissionMock,
  requireRole: requireRoleMock,
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/permissions.js'), () => ({
  PERMISSIONS: {
    EQUIPOS: { CREATE: 'equipos:create' },
    USERS: { CREATE: 'users:create' },
  },
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/middleware/fileValidation.js'), () => ({
  validateExcelFile: validateExcelFileMock,
}));

// El query string fuerza una instancia ESM nueva cuando otra suite ya cargó
// importRoutes con un mock distinto de multer.
const { default: router } = await import(`${path.resolve(__dirname, '../../src/routes/importRoutes.js')}?config-test`);

// Nota: tests/setup.js corre `jest.clearAllMocks()` en un afterEach global,
// así que el historial de llamadas de requireRoleMock/requirePermissionMock
// (invocadas una sola vez, al construir las rutas al importar el módulo) solo
// sobrevive para el primer test que se ejecute. Por eso, para verificar que
// una ruta quedó protegida, se inspecciona la longitud de su cadena de
// middlewares en router.stack en vez de aserciones sobre `.mock.calls`.
const getRouteMiddlewareCount = (path, method) => {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  return layer.route.stack.length;
};

describe('importRoutes', () => {
  beforeEach(() => {
    validateExcelFileMock.mockReset();
    validateExcelFileMock.mockReturnValue({ valid: true });
  });

  it('debe registrar las rutas de importación y duplicados', () => {
    const routeKeys = router.stack
      .filter((layer) => layer.route)
      .map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);

    expect(routeKeys).toEqual(expect.arrayContaining([
      'post /equipos',
      'post /usuarios',
      'post /aprendices',
      'get /duplicados',
      'post /duplicados/procesar',
      'post /duplicados/procesar-masivo',
    ]));
  });

  it('debe proteger los 3 endpoints de duplicados con un middleware de rol además de authenticate', () => {
    // authenticate + requireRole(...) + handler = 3 capas (antes del fix eran solo 2: authenticate + handler)
    expect(getRouteMiddlewareCount('/duplicados', 'get')).toBe(3);
    expect(getRouteMiddlewareCount('/duplicados/procesar', 'post')).toBe(3);
    expect(getRouteMiddlewareCount('/duplicados/procesar-masivo', 'post')).toBe(3);
  });

  it('debe configurar multer con memoryStorage y límite de 50MB', () => {
    expect(multerState.options).toEqual(expect.objectContaining({
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: expect.any(Function),
    }));
    expect(multerState.options.storage).toEqual({ type: 'memory' });
  });

  it('fileFilter debe aceptar archivos válidos de Excel', () => {
    const cb = jest.fn();

    validateExcelFileMock.mockReturnValueOnce({ valid: true });
    multerState.options.fileFilter({}, { originalname: 'datos.xlsx' }, cb);

    expect(validateExcelFileMock).toHaveBeenCalledWith({ originalname: 'datos.xlsx' });
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('fileFilter debe rechazar archivos inválidos de Excel', () => {
    const cb = jest.fn();

    validateExcelFileMock.mockReturnValueOnce({ valid: false, error: 'archivo inválido' });
    multerState.options.fileFilter({}, { originalname: 'datos.csv' }, cb);

    expect(cb.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(cb.mock.calls[0][0].message).toBe('archivo inválido');
    expect(cb.mock.calls[0][1]).toBe(false);
  });
});
