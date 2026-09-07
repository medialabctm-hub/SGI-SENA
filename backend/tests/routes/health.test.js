/**
 * Tests de integración para la ruta GET /health
 * Ejecutar con: npm test -- health.test.js
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { app, createApp } from '../../src/app.js';

describe('GET /health', () => {
  it('debe responder 200 con status ok cuando autoservicio está listo', async () => {
    const readyApp = createApp({
      readinessProvider: () => ({
        ready: true,
        migrationVersion: 'AUTOSERVICIO_CIERRE_V1',
        missing: [],
      }),
    });
    const res = await request(readyApp)
      .get('/health')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('env');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toMatchObject({ autoservicio: { ready: true, missing: [] } });
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('debe devolver 503 y not_ready cuando autoservicio no está listo', async () => {
    const notReadyApp = createApp({
      readinessProvider: () => ({
        ready: false,
        migrationVersion: 'AUTOSERVICIO_CIERRE_V1',
        missing: ['marcador de migración'],
      }),
    });
    const res = await request(notReadyApp)
      .get('/health')
      .expect(503);

    expect(res.body).toMatchObject({
      status: 'not_ready',
      autoservicio: {
        ready: false,
        missing: ['marcador de migración'],
      },
    });
  });

  it('la app exportada para tests conserva el gate real de readiness', async () => {
    const res = await request(app)
      .get('/health')
      .expect(503);

    expect(res.body).toHaveProperty('status', 'not_ready');
    expect(res.body.autoservicio).toHaveProperty('ready', false);
  });

  it('debe devolver Content-Type application/json', async () => {
    const res = await request(app)
      .get('/health');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
