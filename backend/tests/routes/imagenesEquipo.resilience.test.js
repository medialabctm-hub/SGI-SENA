/**
 * MDL-190 / H-02: payloads malformados en imágenes / registro no tumban el proceso.
 * Tras cada caso negativo, /health debe seguir respondiendo.
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { createApp } from '../../src/app.js';
import { errorHandler } from '../../src/utils/errors.js';
import { validateParams } from '../../src/middleware/validate.js';
import { asyncHandler } from '../../src/middleware/asyncHandler.js';
import {
  evidenceFilenameParamSchema,
} from '../../src/validators/imagenesEquipoValidator.js';
import {
  resolveEvidenceImagePath,
  sendEvidenceImage,
} from '../../src/services/imagenEquipoService.js';
import { validate } from '../../src/middleware/validate.js';
import { registerSchema } from '../../src/validators/authValidator.js';

const readyProvider = () => ({
  ready: true,
  migrationVersion: 'AUTOSERVICIO_CIERRE_V2',
  missing: [],
});

describe('MDL-190 H-02 — resiliencia ante payloads malformados', () => {
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('GET /api/equipos/imagenes/archivo con traversal sin auth → 401 y /health sigue vivo', async () => {
    const app = createApp({ readinessProvider: readyProvider });

    const bad = await request(app).get('/api/equipos/imagenes/archivo/../secret.jpg');
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).toBeLessThan(500);

    const health = await request(app).get('/health');
    expect(health.status).toBeLessThan(500); // proceso vivo (200 listo / 503 not_ready)
    expect(health.body).toHaveProperty('status');
  });

  it('ruta de descarga con validateParams rechaza traversal/non-image con 400 sin tumbar', async () => {
    const app = express();
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.get(
      '/api/equipos/imagenes/archivo/:filename',
      validateParams(evidenceFilenameParamSchema),
      asyncHandler(async (req, res, next) => {
        try {
          const absolutePath = resolveEvidenceImagePath(req.params.filename);
          return sendEvidenceImage(res, absolutePath);
        } catch (err) {
          return next(err);
        }
      })
    );
    app.use(errorHandler);

    const traversal = await request(app).get('/api/equipos/imagenes/archivo/../etc/passwd');
    // Express puede normalizar el path antes de llegar al router; aceptamos 400 o 404 de ruta.
    expect([400, 404]).toContain(traversal.status);

    const nonImage = await request(app).get('/api/equipos/imagenes/archivo/payload.exe');
    expect(nonImage.status).toBe(400);
    expect(nonImage.body).toEqual(expect.objectContaining({ success: false }));

    const missing = await request(app).get('/api/equipos/imagenes/archivo/no-existe-mdl190.png');
    expect(missing.status).toBe(404);

    const health = await request(app).get('/health').expect(200);
    expect(health.body.status).toBe('ok');
  });

  it('POST /api/auth/register con payload inválido → 400 controlado y /health vivo', async () => {
    const app = createApp({ readinessProvider: readyProvider });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ correo: 'no-es-email', contrasena: '1' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ success: false }));

    const health = await request(app).get('/health');
    expect(health.status).toBeLessThan(500);
    expect(health.body).toHaveProperty('status');
  });

  it('validate(registerSchema) en aislamiento responde 400 sin excepciones no capturadas', async () => {
    const app = express();
    app.use(express.json());
    app.post('/register', validate(registerSchema), (_req, res) => res.status(201).json({ ok: true }));
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.use(errorHandler);

    const res = await request(app).post('/register').send({ nombre: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validaci/i);

    await request(app).get('/health').expect(200);
  });
});
