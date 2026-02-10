/**
 * Tests de integración para rutas de auth (validación y existencia de endpoints)
 * Ejecutar con: npm test -- authRoutes.test.js
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('POST /api/auth/login', () => {
  it('debe responder 400 cuando falta cedula', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ contrasena: 'alguna' })
      .expect(400);

    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
  });

  it('debe responder 400 cuando falta contrasena', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ cedula: '1234567890' })
      .expect(400);

    expect(res.body).toHaveProperty('success', false);
  });

  it('debe responder 400 cuando el body está vacío', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400);

    expect(res.body).toHaveProperty('success', false);
  });
});

describe('Rutas de auth existentes', () => {
  it('GET /api/auth/roles no debe devolver 404 (ruta pública existe)', async () => {
    const res = await request(app).get('/api/auth/roles');
    expect(res.status).not.toBe(404);
  });
});
