import { describe, it, expect, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = (relativePath) => path.resolve(__dirname, relativePath);

const mockRequireAnyPermission = jest.fn(() => (req, res, next) => next());

await jest.unstable_mockModule(source('../../src/middleware/authMiddleware.js'), () => ({
  authenticate: jest.fn((req, res, next) => next()),
}));
await jest.unstable_mockModule(source('../../src/middleware/authorization.js'), () => ({
  requireAnyPermission: mockRequireAnyPermission,
}));
await jest.unstable_mockModule(source('../../src/config/permissions.js'), () => ({
  PERMISSIONS: {
    REPORTES: {
      VIEW: 'reportes:view',
      CREATE: 'reportes:create',
      UPDATE: 'reportes:update',
      DELETE: 'reportes:delete',
      EXPORT: 'reportes:export',
    },
  },
}));
await jest.unstable_mockModule(source('../../src/controller/reportesController.js'), () => ({
  crearReporte: jest.fn(),
  listarReportes: jest.fn(),
  obtenerReportePorId: jest.fn(),
  actualizarReporte: jest.fn(),
  eliminarReporte: jest.fn(),
  obtenerTiposReporte: jest.fn(),
  generarReportePDF: jest.fn(),
}));
await jest.unstable_mockModule(source('../../src/middleware/rateLimiter.js'), () => ({
  writeLimiter: (req, res, next) => next(),
  strictLimiter: (req, res, next) => next(),
}));
await jest.unstable_mockModule(source('../../src/validators/reportesValidator.js'), () => ({
  validate: jest.fn(() => (req, res, next) => next()),
  crearReporteSchema: {},
  actualizarReporteSchema: {},
}));

await import(source('../../src/routes/reportesRoutes.js'));

describe('reportesRoutes policy', () => {
  it('protege la exportación PDF con reportes:export', () => {
    expect(mockRequireAnyPermission).toHaveBeenCalledWith(['reportes:export']);
  });
});
