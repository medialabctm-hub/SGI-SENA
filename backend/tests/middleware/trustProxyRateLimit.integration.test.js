/**
 * MDL-199 / H-06 — trust proxy + rate-limit por IP real.
 *
 * Forma real que ve Node detrás de nginx in-container (post-$sgi_client_ip):
 *   X-Forwarded-For / X-Real-IP: <client>   (una sola IP)
 *   socket: 127.0.0.1 (supertest / nginx→Node)
 * con trust proxy = 1.
 *
 * Comprueba que:
 * 1) authLimiter / registerLimiter / autoservicioIpLimiter agrupan por esa IP
 * 2) un hop spoofeado a la izquierda de XFF no abre un bucket nuevo (hops=1)
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import {
  authLimiter,
  registerLimiter,
  autoservicioIpLimiter,
  autoservicioIdentifierLimiter,
} from '../../src/middleware/rateLimiter.js';
import { getTrustProxyHops } from '../../src/config/trustProxy.js';

/** Cabecera single-IP como la que nginx fija con $sgi_client_ip. */
const nginxClientIp = (clientIp) => clientIp;

const makeApp = (hops = 1) => {
  const app = express();
  app.set('trust proxy', hops);
  app.use(express.json());

  app.get('/debug-ip', (req, res) => {
    res.json({ ip: req.ip, ips: req.ips });
  });

  app.post('/login', authLimiter, (req, res) => {
    res.status(401).json({ success: false, error: 'credenciales' });
  });

  app.post('/register', registerLimiter, (req, res) => {
    res.status(201).json({ success: true });
  });

  app.post(
    '/autoservicio',
    autoservicioIpLimiter,
    autoservicioIdentifierLimiter,
    (req, res) => {
      res.status(200).json({ success: true });
    },
  );

  return app;
};

describe('trust proxy hops (nginx single-IP → Node)', () => {
  it('getTrustProxyHops default (incl. Railway) es 1', () => {
    expect(getTrustProxyHops({})).toBe(1);
    expect(getTrustProxyHops({ RAILWAY_ENVIRONMENT: 'production' })).toBe(1);
  });

  it('con trust=1 y XFF single-IP, req.ip es el cliente (no 127.0.0.1)', async () => {
    const app = makeApp(1);
    const res = await request(app)
      .get('/debug-ip')
      .set('X-Forwarded-For', nginxClientIp('203.0.113.50'))
      .set('X-Real-IP', '203.0.113.50');

    expect(res.body.ip).toBe('203.0.113.50');
    expect(res.body.ip).not.toMatch(/127\.0\.0\.1/);
  });

  it('con trust=2 y XFF spoof,client, req.ip toma el spoof (por eso no usamos 2)', async () => {
    const app = makeApp(2);
    const res = await request(app)
      .get('/debug-ip')
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.50');

    expect(res.body.ip).toBe('198.51.100.1');
  });
});

describe('authLimiter con trust proxy=1 (forma nginx real)', () => {
  it('10 intentos desde la misma IP cliente → 429 en el 11º', async () => {
    const app = makeApp(1);
    const client = '203.0.113.77';
    const responses = [];

    for (let i = 0; i < 11; i += 1) {
      responses.push(
        await request(app)
          .post('/login')
          .set('X-Forwarded-For', nginxClientIp(client))
          .set('X-Real-IP', client)
          .send({ email: 'a@b.c', password: 'x' }),
      );
    }

    expect(responses.slice(0, 10).every((r) => r.statusCode === 401)).toBe(true);
    expect(responses[10].statusCode).toBe(429);
    expect(responses[10].body).toEqual(
      expect.objectContaining({ success: false, retryAfter: 15 }),
    );
  });

  it('spoofed leftmost XFF no bypass cuando hops=1', async () => {
    const app = makeApp(1);
    const client = '203.0.113.88';

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/login')
        .set('X-Forwarded-For', nginxClientIp(client))
        .send({ email: 'a@b.c', password: 'x' });
      expect(res.statusCode).toBe(401);
    }

    // Extra hop a la izquierda: con trust=1 Express ignora el spoof y sigue
    // resolviendo req.ip al hop más cercano al socket (= client).
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post('/login')
        .set('X-Forwarded-For', `198.51.100.${i + 1}, ${client}`)
        .send({ email: 'a@b.c', password: 'x' });
      expect(res.statusCode).toBe(429);
    }
  });
});

describe('registerLimiter con trust proxy=1', () => {
  it('5 registros desde la misma IP cliente → 429 en el 6º', async () => {
    const app = makeApp(1);
    const client = '203.0.113.91';
    const responses = [];

    for (let i = 0; i < 6; i += 1) {
      responses.push(
        await request(app)
          .post('/register')
          .set('X-Forwarded-For', nginxClientIp(client))
          .send({ email: `u${i}@ex.com` }),
      );
    }

    expect(responses.slice(0, 5).every((r) => r.statusCode === 201)).toBe(true);
    expect(responses[5].statusCode).toBe(429);
  });
});

describe('autoservicioIpLimiter con trust proxy=1', () => {
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('20 intentos misma IP → 429; spoof izquierdo no bypass', async () => {
    const app = makeApp(1);
    const client = '203.0.113.120';

    for (let i = 0; i < 20; i += 1) {
      const res = await request(app)
        .post('/autoservicio')
        .set('X-Forwarded-For', nginxClientIp(client))
        .set('X-Real-IP', client)
        .send({ documento: `DOC-${i}`, placa: `EQ-${i}` });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await request(app)
      .post('/autoservicio')
      .set('X-Forwarded-For', nginxClientIp(client))
      .send({ documento: 'DOC-blocked', placa: 'EQ-blocked' });
    expect(blocked.statusCode).toBe(429);

    const spoofAttempt = await request(app)
      .post('/autoservicio')
      .set('X-Forwarded-For', `198.51.100.200, ${client}`)
      .send({ documento: 'DOC-spoof', placa: 'EQ-spoof' });
    expect(spoofAttempt.statusCode).toBe(429);
  });
});
