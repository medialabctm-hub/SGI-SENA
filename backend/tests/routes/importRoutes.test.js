import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const noop = jest.fn((req, res, next) => next && next());
const requirePermissionMock = jest.fn(() => noop);
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

const { default: router } = await import(path.resolve(__dirname, '../../src/routes/importRoutes.js'));

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