import { describe, it, expect, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = relativePath => path.resolve(__dirname, relativePath);

const mockRequireAnyPermission = jest.fn(() => (req, res, next) => next());

await jest.unstable_mockModule(
  source('../../src/middleware/authMiddleware.js'),
  () => ({
    authenticate: jest.fn((req, res, next) => next()),
  })
);
await jest.unstable_mockModule(
  source('../../src/middleware/authorization.js'),
  () => ({
    requireAnyPermission: mockRequireAnyPermission,
  })
);
await jest.unstable_mockModule(
  source('../../src/config/permissions.js'),
  () => ({
    PERMISSIONS: {
      REPORTES: {
        VIEW: 'reportes:view',
        CREATE: 'reportes:create',
        UPDATE: 'reportes:update',
        DELETE: 'reportes:delete',
        EXPORT: 'reportes:export',
      },
    },
  })
);
await jest.unstable_mockModule(
  source('../../src/controller/reportesController.js'),
  () => ({
    crearReporte: jest.fn(),
    listarReportes: jest.fn(),
    obtenerReportePorId: jest.fn(),
    actualizarReporte: jest.fn(),
    eliminarReporte: jest.fn(),
    obtenerTiposReporte: jest.fn(),
    generarReportePDF: jest.fn(),
    generarReporteEquiposFotosPDF: jest.fn(),
  })
);
await jest.unstable_mockModule(
  source('../../src/middleware/rateLimiter.js'),
  () => ({
    writeLimiter: (req, res, next) => next(),
    strictLimiter: (req, res, next) => next(),
    readLimiter: (req, res, next) => next(),
  })
);
await jest.unstable_mockModule(
  source('../../src/validators/reportesValidator.js'),
  () => ({
    validate: jest.fn(() => (req, res, next) => next()),
    crearReporteSchema: {},
    actualizarReporteSchema: {},
  })
);

const { default: router } = await import(
  source('../../src/routes/reportesRoutes.js')
);

// IMPORTANTE: tests/setup.js registra un afterEach global con jest.clearAllMocks(),
// que borra mock.calls/mock.results entre cada `it`. Por eso todo lo que dependa de
// esos datos se calcula una sola vez aquí, inmediatamente después del import, y se
// guarda en constantes planas que los tests solo leen.
const wasCalledWithExport = mockRequireAnyPermission.mock.calls.some(
  call => JSON.stringify(call[0]) === JSON.stringify(['reportes:export'])
);

// Middlewares devueltos específicamente por llamadas a requireAnyPermission(['reportes:export'])
const exportMiddlewares = mockRequireAnyPermission.mock.calls
  .map((call, i) => ({
    call,
    fn: mockRequireAnyPermission.mock.results[i].value,
  }))
  .filter(
    ({ call }) =>
      JSON.stringify(call[0]) === JSON.stringify(['reportes:export'])
  )
  .map(({ fn }) => fn);

function routeIsProtectedByExport(routePath, method = 'get') {
  const layer = router.stack.find(
    l => l.route?.path === routePath && l.route.methods[method]
  );
  if (!layer) return false;
  const routeHandlers = layer.route.stack.map(s => s.handle);
  return exportMiddlewares.some(fn => routeHandlers.includes(fn));
}

const pdfProtected = routeIsProtectedByExport('/pdf');
const equiposPdfProtected = routeIsProtectedByExport('/equipos/pdf');

describe('reportesRoutes policy', () => {
  it('protege la exportación PDF con reportes:export', () => {
    expect(wasCalledWithExport).toBe(true);
  });

  it('protege específicamente /pdf con reportes:export', () => {
    expect(pdfProtected).toBe(true);
  });

  it('protege específicamente /equipos/pdf con reportes:export', () => {
    expect(equiposPdfProtected).toBe(true);
  });
});
