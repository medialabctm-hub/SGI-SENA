import express from 'express';
import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import {
  invitationCodeLimiter,
  invitationIpLimiter,
} from '../../src/middleware/rateLimiter.js';

const makeApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/validate', invitationIpLimiter, invitationCodeLimiter, (req, res) => {
    res.status(200).json({ success: true });
  });
  return app;
};

describe('limitadores públicos de invitaciones', () => {
  it('bloquea el sondeo desde una misma IP aunque cambie el código', async () => {
    const app = makeApp();
    const responses = [];

    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(await request(app)
        .post('/validate')
        .set('X-Forwarded-For', '203.0.113.131')
        .send({ codigo: `IP-ROTATING-${attempt}`, rol: 'Instructor' }));
    }

    expect(responses.slice(0, 10).every(response => response.statusCode === 200)).toBe(true);
    expect(responses[10].statusCode).toBe(429);
    expect(responses[10].body).toEqual(expect.objectContaining({ success: false, retryAfter: 15 }));
  });

  it('bloquea repetir el mismo identificador aunque cambie la IP', async () => {
    const app = makeApp();
    const responses = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await request(app)
        .post('/validate')
        .set('X-Forwarded-For', `198.51.100.${attempt + 1}`)
        .send({ codigo: 'IDENTIFIER-REUSE-131', rol: 'Instructor' }));
    }

    expect(responses.slice(0, 5).every(response => response.statusCode === 200)).toBe(true);
    expect(responses[5].statusCode).toBe(429);
    expect(responses[5].body).toEqual(expect.objectContaining({ success: false, retryAfter: 15 }));
  });
});
