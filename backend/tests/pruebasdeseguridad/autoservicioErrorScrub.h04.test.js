/**
 * Negativas de seguridad — MDL-204 / auditoría H-04 (2026-09-21).
 *
 * Fuerza un 503 controlado en POST /api/equipos/autoservicio/iniciar-uso
 * (schema no listo) y verifica que el cuerpo al cliente no filtre
 * identificadores internos (tablas, SP, scripts, stacks).
 *
 * El scrubber compartido (utils/errorScrubber.js) es el mismo que podrá
 * reutilizar MDL-193 (H-05 / H-08).
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { AppError } from '../../src/utils/errors.js';
import { handleControllerError } from '../../src/utils/controllerHelpers.js';
import { errorHandler } from '../../src/utils/errors.js';
import {
  autoservicioIpLimiter,
  autoservicioIdentifierLimiter,
} from '../../src/middleware/rateLimiter.js';

const INTERNAL_IDENTIFIERS = [
  'Historial_Uso_Equipos',
  'sp_finalizar_clase',
  'AUTOSERVICIO_CIERRE_V2',
  'migrate-autoservicio-cierre-clase',
  'INFORMATION_SCHEMA',
  'Clases',
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
}

describe('H-04 scrub 503 en autoservicio/iniciar-uso', () => {
  let app;
  let previousEnv;

  beforeAll(() => {
    previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    // Replica el montaje público (limiters + handler) sin BD: el handler
    // lanza el mismo AppError operacional que assertAutoservicioReady.
    app.post(
      '/api/equipos/autoservicio/iniciar-uso',
      autoservicioIpLimiter,
      autoservicioIdentifierLimiter,
      (req, res) => {
        const detail =
          'Autoservicio no está listo: faltan Historial_Uso_Equipos.id_usuario nullable, ' +
          'columna Historial_Uso_Equipos.documento_externo, sp_finalizar_clase con marcador AUTOSERVICIO_CIERRE_V2, ' +
          'índice sobre Clases. Ejecute node scripts/migrate-autoservicio-cierre-clase.js con credenciales MySQL de administrador.';
        const err = new AppError(detail, 503);
        err.clientMessage =
          'El autoservicio no está disponible temporalmente. Inténtalo de nuevo más tarde.';
        return handleControllerError(
          err,
          res,
          'iniciarUsoAutoservicio',
          'No se pudo registrar el préstamo del equipo'
        );
      }
    );

    // Ruta auxiliar: error no operacional pasado por errorHandler global
    app.get('/api/_probe/raw-db-error', (req, res, next) => {
      const err = new Error(
        "KnexTimeoutError: select * from `Historial_Uso_Equipos` - pool timeout at /workspace/SGI-SENA/backend/src/x.js:10:1"
      );
      err.code = 'ER_LOCK_WAIT_TIMEOUT';
      next(err);
    });
    app.use(errorHandler);
  });

  afterAll(() => {
    process.env.NODE_ENV = previousEnv;
  });

  it('POST iniciar-uso fuerza 503 genérico sin identificadores internos', async () => {
    const res = await request(app)
      .post('/api/equipos/autoservicio/iniciar-uso')
      .send({ documento: '123', placa: 'ABC-1' })
      .expect(503);

    expect(res.body.error).toMatch(/no está disponible temporalmente/i);
    expect(res.body.userMessage).toMatch(/no está disponible temporalmente/i);
    assertNoInternalLeak(res.body);
  });

  it('errorHandler global no filtra SQL/Knex/paths en 5xx', async () => {
    const res = await request(app)
      .get('/api/_probe/raw-db-error')
      .expect(503);

    // translateDbError mapea ER_LOCK_WAIT_TIMEOUT a AppError operacional seguro
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/Historial_Uso_Equipos|Knex|\/workspace\/|ER_LOCK/i);
    expect(res.body).not.toHaveProperty('stack');
  });
});
