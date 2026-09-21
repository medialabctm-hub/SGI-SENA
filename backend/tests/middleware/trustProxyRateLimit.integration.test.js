/**
 * MDL-199 / H-06 — trust proxy + rate-limit por IP real.
 *
 * Simula la cadena de producción que ve Node detrás de nginx in-container:
 *   X-Forwarded-For: <client>, <railway-edge>
 *   socket: 127.0.0.1 (supertest)
 * con trust proxy = 2 (Railway edge + nginx).
 *
 * Comprueba que:
 * 1) authLimiter y autoservicioIpLimiter agrupan por la IP de cliente real
 * 2) un hop spoofeado a la izquierda de la cadena no abre un bucket nuevo
 *    (no bypass del 429)
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

/** Cabecera XFF de dos hops como la que construye nginx con $proxy_add_x_forwarded_for. */
const prodXff = (clientIp, edgeIp = '10.0.0.2') => `${clientIp}, ${edgeIp}`;

const makeApp = (hops = 2) => {
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

describe('trust proxy hops (topología Railway + nginx)', () => {
  it('getTrustProxyHops en Railway es 2', () => {
    expect(getTrustProxyHops({ RAILWAY_ENVIRONMENT: 'production' })).toBe(2);
  });

  it('con trust=2, req.ip es el cliente y no el edge ni 127.0.0.1', async () => {
    const app = makeApp(2);
    const res = await request(app)
      .get('/debug-ip')
      .set('X-Forwarded-For', prodXff('203.0.113.50'));

    expect(res.body.ip).toBe('203.0.113.50');
    expect(res.body.ip).not.toBe('10.0.0.2');
    expect(res.body.ip).not.toMatch(/127\.0\.0\.1/);
  });

  it('con trust=1 (bug H-06), req.ip colapsa en el hop del edge', async () => {
    const app = makeApp(1);
    const res = await request(app)
      .get('/debug-ip')
      .set('X-Forwarded-For', prodXff('203.0.113.50'));

    expect(res.body.ip).toBe('10.0.0.2');
  });
});

describe('authLimiter con trust proxy=2', () => {
  it('10 intentos desde la misma IP cliente → 429 en el 11º', async () => {
    const app = makeApp(2);
    const xff = prodXff('203.0.113.77');
    const responses = [];

    for (let i = 0; i < 11; i += 1) {
      responses.push(
        await request(app)
          .post('/login')
          .set('X-Forwarded-For', xff)
          .send({ email: 'a@b.c', password: 'x' }),
      );
    }

    expect(responses.slice(0, 10).every((r) => r.statusCode === 401)).toBe(true);
    expect(responses[10].statusCode).toBe(429);
    expect(responses[10].body).toEqual(
      expect.objectContaining({ success: false, retryAfter: 15 }),
    );
  });

  it('spoof a la izquierda de la cadena no abre un bucket nuevo tras el 429', async () => {
    const app = makeApp(2);
    const edge = '10.0.0.2';
    const client = '203.0.113.88';

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/login')
        .set('X-Forwarded-For', prodXff(client, edge))
        .send({ email: 'a@b.c', password: 'x' });
      expect(res.statusCode).toBe(401);
    }

    // Intentos adicionales con IPs spoofeadas prependidas; el hop confiable
    // sigue resolviendo a `client`, así que deben seguir bloqueados.
    for (let i = 0; i < 3; i += 1) {
      const spoofed = `198.51.100.${i + 1}, ${client}, ${edge}`;
      const res = await request(app)
        .post('/login')
        .set('X-Forwarded-For', spoofed)
        .send({ email: 'a@b.c', password: 'x' });
      expect(res.statusCode).toBe(429);
    }
  });
});

describe('registerLimiter con trust proxy=2', () => {
  it('5 registros desde la misma IP cliente → 429 en el 6º', async () => {
    const app = makeApp(2);
    const xff = prodXff('203.0.113.91');
    const responses = [];

    for (let i = 0; i < 6; i += 1) {
      responses.push(
        await request(app)
          .post('/register')
          .set('X-Forwarded-For', xff)
          .send({ email: `u${i}@ex.com` }),
      );
    }

    expect(responses.slice(0, 5).every((r) => r.statusCode === 201)).toBe(true);
    expect(responses[5].statusCode).toBe(429);
  });
});

describe('autoservicioIpLimiter con trust proxy=2', () => {
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('20 intentos desde la misma IP cliente → 429; spoof izquierdo no bypass', async () => {
    const app = makeApp(2);
    const client = '203.0.113.120';
    const edge = '10.0.0.2';

    for (let i = 0; i < 20; i += 1) {
      const res = await request(app)
        .post('/autoservicio')
        .set('X-Forwarded-For', prodXff(client, edge))
        .send({ documento: `DOC-${i}`, placa: `EQ-${i}` });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await request(app)
      .post('/autoservicio')
      .set('X-Forwarded-For', prodXff(client, edge))
      .send({ documento: 'DOC-blocked', placa: 'EQ-blocked' });
    expect(blocked.statusCode).toBe(429);

    const spoofAttempt = await request(app)
      .post('/autoservicio')
      .set('X-Forwarded-For', `198.51.100.200, ${client}, ${edge}`)
      .send({ documento: 'DOC-spoof', placa: 'EQ-spoof' });
    expect(spoofAttempt.statusCode).toBe(429);
  });
});
