/**
 * Negativas de seguridad — MDL-201 / auditoría H-05 (2026-09-21).
 *
 * Hallazgo: enumeración de identidades en GET /api/aprendices/verificar/:documento.
 * Regresión vs remediación MDL-125 (PII/DDL ya retirados).
 *
 * Criterios derivados del issue (QA aún no publicó casos en Linear al momento del PR):
 *  - Aceptación: respuesta pública sin PII; status uniforme (200) exista o no el documento;
 *    rate-limit dual IP+documento; sin DDL en el camino.
 *  - Negativas: 400 scrubbed en formato inválido; 500 scrubbed en error de BD;
 *    cuerpo sin nombres de tabla/columna/SQL; 404 ya no se usa como oráculo.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { errorHandler } from '../../src/utils/errors.js';
import {
  publicLookupLimiter,
  publicLookupDocumentoLimiter,
} from '../../src/middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockExecute = jest.fn();

const INTERNAL_IDENTIFIERS = [
  'Aprendices',
  'INFORMATION_SCHEMA',
  'Historial_Uso_Equipos',
  'Usuarios',
  'SELECT 1 FROM',
  'node_modules',
  '/workspace/',
];

function assertNoInternalLeak(payload) {
  const serialized = JSON.stringify(payload);
  for (const token of INTERNAL_IDENTIFIERS) {
    expect(serialized.includes(token)).toBe(false);
  }
  expect(serialized).not.toMatch(/FOREIGN KEY|CONSTRAINT `|ER_[A-Z_]+|Knex/i);
  expect(payload).not.toHaveProperty('stack');
  expect(payload).not.toHaveProperty('nombre');
  expect(payload).not.toHaveProperty('ficha');
  expect(payload).not.toHaveProperty('id_aprendiz');
}

describe('H-05 enumeración en GET /api/aprendices/verificar/:documento (MDL-201)', () => {
  let app;
  let previousEnv;
  let verificarAprendizPorDocumento;

  beforeAll(async () => {
    previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    jest.unstable_mockModule(resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
      default: { execute: mockExecute },
    }));
    jest.unstable_mockModule(resolve(__dirname, '../../src/utils/logger.js'), () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    ({ verificarAprendizPorDocumento } = await import(
      resolve(__dirname, '../../src/controller/aprendicesController.js')
    ));

    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    app.get(
      '/api/aprendices/verificar/:documento',
      publicLookupLimiter,
      publicLookupDocumentoLimiter,
      (req, res, next) => Promise.resolve(verificarAprendizPorDocumento(req, res)).catch(next)
    );

    app.use(errorHandler);
  });

  afterAll(() => {
    process.env.NODE_ENV = previousEnv;
  });

  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('aceptación: documento existente → 200 { existe: true } sin PII', async () => {
    mockExecute.mockResolvedValueOnce([[{ 1: 1 }]]);

    const res = await request(app)
      .get('/api/aprendices/verificar/1234567890')
      .set('X-Forwarded-For', '203.0.113.10');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ existe: true });
    assertNoInternalLeak(res.body);
  });

  it('aceptación: documento inexistente → 200 { existe: false } (no 404 oráculo)', async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/aprendices/verificar/9999999999')
      .set('X-Forwarded-For', '203.0.113.11');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ existe: false });
    expect(res.status).not.toBe(404);
    assertNoInternalLeak(res.body);
  });

  it('negativa: formato inválido → 400 scrubbed sin hit a BD', async () => {
    const res = await request(app)
      .get('/api/aprendices/verificar/ab')
      .set('X-Forwarded-For', '203.0.113.12');

    expect(res.status).toBe(400);
    expect(res.body.existe).toBe(false);
    expect(res.body.error).toBe('Documento inválido.');
    assertNoInternalLeak(res.body);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('negativa: error de BD → respuesta scrubbed sin filtrar schema/SQL', async () => {
    mockExecute.mockRejectedValueOnce(
      new Error("Table 'sgi.Aprendices' doesn't exist ER_NO_SUCH_TABLE SELECT 1 FROM Aprendices")
    );

    const res = await request(app)
      .get('/api/aprendices/verificar/1234567890')
      .set('X-Forwarded-For', '203.0.113.13');

    expect(res.status).toBeGreaterThanOrEqual(500);
    assertNoInternalLeak(res.body);
    expect(res.body.error || res.body.userMessage || '').not.toMatch(/Aprendices|ER_NO_SUCH/i);
  });

  it('negativa: el mismo documento desde IPs distintas agota el límite por documento (429)', async () => {
    mockExecute.mockResolvedValue([[]]);

    // max documento = 5; el 6º debe ser 429 aunque la IP cambie
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .get('/api/aprendices/verificar/5555555555')
        .set('X-Forwarded-For', `198.51.100.${i + 1}`);
      expect([200, 429]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toEqual({ existe: false });
      }
    }

    const blocked = await request(app)
      .get('/api/aprendices/verificar/5555555555')
      .set('X-Forwarded-For', '198.51.100.99');

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    assertNoInternalLeak(blocked.body);
  });
});
