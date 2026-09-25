/**
 * Rutas de /api/navegacion: exigen autenticación y devuelven el estado
 * calculado con el usuario de la sesión (no con parámetros del cliente).
 */
import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import request from 'supertest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = (relativePath) => path.resolve(__dirname, relativePath);

const mockObtenerEstadoNavegacion = jest.fn();

await jest.unstable_mockModule(source('../../src/middleware/authMiddleware.js'), () => ({
  authenticate: (req, res, next) => {
    const rol = req.headers['x-test-rol'];
    if (!rol) return res.status(401).json({ error: 'No autenticado' });
    req.user = { id: Number(req.headers['x-test-id'] || 1), rol };
    return next();
  },
}));
await jest.unstable_mockModule(source('../../src/middleware/rateLimiter.js'), () => ({
  readLimiter: (req, res, next) => next(),
}));
await jest.unstable_mockModule(source('../../src/factories/ServiceFactory.js'), () => ({
  ServiceFactory: { create: jest.fn(() => ({ listarEquipos: jest.fn() })) },
}));
await jest.unstable_mockModule(source('../../src/services/estadoNavegacionService.js'), () => ({
  obtenerEstadoNavegacion: mockObtenerEstadoNavegacion,
}));

const { default: router } = await import(source('../../src/routes/navegacionRoutes.js'));

let app;
beforeAll(() => {
  app = express();
  app.use('/api/navegacion', router);
});

describe('GET /api/navegacion/estado', () => {
  it('rechaza sin sesión', async () => {
    const res = await request(app).get('/api/navegacion/estado');
    expect(res.status).toBe(401);
    expect(mockObtenerEstadoNavegacion).not.toHaveBeenCalled();
  });

  it('calcula con el usuario de la sesión e ignora parámetros del cliente', async () => {
    mockObtenerEstadoNavegacion.mockResolvedValueOnce({ inventario: { total: 2 } });

    const res = await request(app)
      .get('/api/navegacion/estado?rol=Administrador&id=1')
      .set('x-test-rol', 'Aprendiz')
      .set('x-test-id', '44');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inventario: { total: 2 } });
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(mockObtenerEstadoNavegacion.mock.calls[0][1]).toEqual({ id: 44, rol: 'Aprendiz' });
  });

  it('responde error controlado si el servicio falla', async () => {
    mockObtenerEstadoNavegacion.mockRejectedValueOnce(new Error('boom'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/api/navegacion/estado').set('x-test-rol', 'Instructor');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('boom');
    consoleSpy.mockRestore();
  });
});
