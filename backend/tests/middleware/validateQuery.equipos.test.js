/**
 * MDL-189 / H-01 — validateQuery rechaza limit excesivo en listado de equipos
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import { validateQuery } from '../../src/middleware/validate.js';
import { listarEquiposQuerySchema } from '../../src/validators/equiposValidator.js';

function buildApp() {
  const app = express();
  app.get('/api/equipos', validateQuery(listarEquiposQuerySchema), (req, res) => {
    res.json({ ok: true, query: req.query });
  });
  return app;
}

describe('GET /api/equipos query validation (MDL-189 / H-01)', () => {
  const app = buildApp();

  it('responde 400 cuando limit=5000 (Aprendiz no puede dump masivo)', async () => {
    const res = await request(app).get('/api/equipos').query({ limit: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/validación/i);
  });

  it('acepta limit=100 y coerción de page', async () => {
    const res = await request(app).get('/api/equipos').query({ limit: '100', page: '2' });
    expect(res.status).toBe(200);
    expect(res.body.query.limit).toBe(100);
    expect(res.body.query.page).toBe(2);
  });
});
