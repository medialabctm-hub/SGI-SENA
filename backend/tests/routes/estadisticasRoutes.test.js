import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../src/middleware/authMiddleware.js', () => ({
  authenticate: jest.fn((req, res, next) => next()),
}), { virtual: true });

jest.mock('../../src/middleware/rateLimiter.js', () => ({
  readLimiter: jest.fn((req, res, next) => next()),
}), { virtual: true });

jest.mock('../../src/controller/estadisticasController.js', () => ({
  obtenerEstadisticas: jest.fn(),
  obtenerEstadisticasInstructor: jest.fn(),
  obtenerEstadisticasCuentadante: jest.fn(),
}), { virtual: true });

describe('estadisticasRoutes', () => {
  it('GET / debe devolver 403 para rol sin permiso', async () => {
    const { default: router } = await import('../../src/routes/estadisticasRoutes.js');

    const rootRoute = router.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.get);
    const handler = rootRoute.route.stack[1].handle;

    const req = {
      user: { rol: 'Aprendiz' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No tienes permiso para ver estadísticas',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
