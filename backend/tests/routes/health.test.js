/**
 * Tests de integración para la ruta GET /health
 * Ejecutar con: npm test -- health.test.js
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('GET /health', () => {
  it('debe responder 200 con status ok y timestamp', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('env');
    expect(res.body).toHaveProperty('timestamp');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('debe devolver Content-Type application/json', async () => {
    const res = await request(app)
      .get('/health');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
