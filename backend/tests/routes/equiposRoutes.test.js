/**
 * Tests de montaje y comportamiento en vivo de los rate limiters públicos
 * aplicados en equiposRoutes.js (MDL-126/MDL-15).
 *
 * Monta el router REAL (sin mocks: en este proyecto jest.mock()/
 * unstable_mockModule() con rutas relativas no interceptan imports ESM
 * dinámicos de forma fiable bajo --experimental-vm-modules, así que se
 * evita esa dependencia). Definir el router no ejecuta handlers ni abre
 * conexión a BD; sólo se conecta si un request realmente invoca al
 * controlador, y eso ocurre exclusivamente cuando el rate limiter deja
 * pasar la petición. La aserción no depende de que la BD esté disponible:
 * sólo exige que las peticiones permitidas NO devuelvan 429 y que, al
 * superar el límite, la respuesta 429 sea estable y no enumerable.
 * Volúmenes de petición pequeños (6 y 21): no simula una denegación de
 * servicio real.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import equiposRouter from '../../src/routes/equiposRoutes.js';
import { iniciarUsoAutoservicio } from '../../src/controller/equiposController.js';
import {
  autoservicioIpLimiter,
  autoservicioIdentifierLimiter,
  webhookLimiter,
} from '../../src/middleware/rateLimiter.js';

const findRoute = (path, method) => {
  const layer = equiposRouter.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  return layer?.route;
};

const makeApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/equipos', equiposRouter);
  return app;
};

describe('equiposRoutes — montaje de rate limiters públicos', () => {
  it('POST /autoservicio/iniciar-uso monta autoservicioIpLimiter y autoservicioIdentifierLimiter antes del validador/controlador', () => {
    const route = findRoute('/autoservicio/iniciar-uso', 'post');
    expect(route).toBeDefined();

    const handles = route.stack.map((layer) => layer.handle);
    const ipIndex = handles.indexOf(autoservicioIpLimiter);
    const identifierIndex = handles.indexOf(autoservicioIdentifierLimiter);
    const controllerIndex = handles.indexOf(iniciarUsoAutoservicio);

    expect(ipIndex).toBeGreaterThanOrEqual(0);
    expect(identifierIndex).toBeGreaterThan(ipIndex);
    expect(controllerIndex).toBeGreaterThan(identifierIndex);
  });

  it('POST /uso/registro-externo NO usa los limiters de autoservicio (queda BLOCKED/PARCIAL, ver 03-03-SUMMARY.md)', () => {
    const route = findRoute('/uso/registro-externo', 'post');
    expect(route).toBeDefined();

    const handles = route.stack.map((layer) => layer.handle);
    expect(handles).toContain(webhookLimiter);
    expect(handles).not.toContain(autoservicioIpLimiter);
    expect(handles).not.toContain(autoservicioIdentifierLimiter);
  });
});

describe('equiposRoutes — comportamiento en vivo de /autoservicio/iniciar-uso', () => {
  // Las peticiones no bloqueadas llegan al controlador real, que intenta
  // conectar a una BD inexistente en este entorno de test (ECONNREFUSED
  // esperado y ya cubierto por handleControllerError). Silenciamos ese
  // console.error para no ensuciar la salida; el rate limiter no depende
  // de la BD.
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('limita por identificador documento+placa aunque la IP rote, con 429 no enumerable', async () => {
    const app = makeApp();
    const responses = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await request(app)
        .post('/api/equipos/autoservicio/iniciar-uso')
        .set('X-Forwarded-For', `198.51.100.${attempt + 10}`)
        .send({ documento: 'IDENTIFIER-REUSE-9001', placa: 'EQ-REUSE-1' }));
    }

    // Las primeras 5 peticiones llegan al controlador (pueden fallar por BD
    // no disponible en el entorno de test, pero eso es responsabilidad del
    // controlador, no del rate limiter): lo que importa es que NINGUNA de
    // ellas sea bloqueada por el limitador de identificador.
    expect(responses.slice(0, 5).every((r) => r.statusCode !== 429)).toBe(true);
    expect(responses[5].statusCode).toBe(429);
    expect(responses[5].body).toEqual(expect.objectContaining({ success: false, retryAfter: 15 }));
    expect(JSON.stringify(responses[5].body)).not.toMatch(/IDENTIFIER-REUSE-9001|EQ-REUSE-1/);
  });

  it('limita por IP aunque cambien documento y placa en cada intento', async () => {
    const app = makeApp();
    const responses = [];

    for (let attempt = 0; attempt < 21; attempt += 1) {
      responses.push(await request(app)
        .post('/api/equipos/autoservicio/iniciar-uso')
        .set('X-Forwarded-For', '203.0.113.77')
        .send({ documento: `IP-ROTATING-${attempt}`, placa: `EQ-IP-${attempt}` }));
    }

    expect(responses.slice(0, 20).every((r) => r.statusCode !== 429)).toBe(true);
    expect(responses[20].statusCode).toBe(429);
    expect(responses[20].body).toEqual(expect.objectContaining({ success: false, retryAfter: 15 }));
  });
});
