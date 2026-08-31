import { jest } from '@jest/globals';
import { getBaseUrl, runSmoke } from '../../scripts/smoke-test.js';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const htmlResponse = () => new Response('<html><body><div id="root"></div></body></html>', {
  status: 200,
  headers: { 'Content-Type': 'text/html' },
});

const baseEnvironment = {
  BASE_URL: 'https://railway.example/',
};

describe('smoke test de Railway', () => {
  it('normaliza BASE_URL y usa el frontend local como fallback', () => {
    expect(getBaseUrl({ BASE_URL: ' https://railway.example/ ' })).toBe('https://railway.example');
    expect(getBaseUrl({})).toBe('http://localhost:5173');
  });

  it('valida health, frontend y proxy API sin mutar la base de datos por defecto', async () => {
    const calls = [];
    const fetchImpl = jest.fn(async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith('/health')) return jsonResponse({ status: 'ok' });
      if (url.endsWith('/')) return htmlResponse();
      return jsonResponse({ success: false }, 400);
    });
    const log = { log: jest.fn() };

    const result = await runSmoke({ env: baseEnvironment, fetchImpl, log });

    expect(result).toEqual({ baseUrl: 'https://railway.example', loan: 'skipped' });
    expect(calls.map(({ url }) => url)).toEqual([
      'https://railway.example/health',
      'https://railway.example/',
      'https://railway.example/api/equipos/autoservicio/iniciar-uso',
    ]);
    expect(calls[2].options.method).toBe('POST');
    expect(JSON.parse(calls[2].options.body)).toEqual({});
    expect(log.log).toHaveBeenCalledWith(expect.stringMatching(/mutación/i));
  });

  it('ejecuta el préstamo controlado con la identidad idempotente configurada', async () => {
    const calls = [];
    const fetchImpl = jest.fn(async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith('/health')) return jsonResponse({ status: 'ok' });
      if (url.endsWith('/')) return htmlResponse();
      if (url.endsWith('/autoservicio/iniciar-uso') && Object.keys(JSON.parse(options.body || '{}')).length === 0) {
        return jsonResponse({ success: false }, 400);
      }
      if (url.endsWith('/api/aprendices/verificar/D1')) {
        return jsonResponse({ ok: true, documento: 'D1' });
      }
      return jsonResponse({
        success: true,
        data: {
          equipo: { placa: 'P-3', tipo: 'Portátil', modelo: 'M' },
          aprendiz: { nombre: 'Ana', documento: 'D1' },
          clase: { nombre_clase: 'Clase de prueba' },
          fecha_hora_inicio: '2026-08-31T14:00:00.000Z',
        },
      }, 201);
    });
    const log = { log: jest.fn() };

    const result = await runSmoke({
      env: {
        ...baseEnvironment,
        SMOKE_LOAN: '1',
        SMOKE_DOCUMENTO: 'D1',
        SMOKE_PLACA: 'P-3',
        SMOKE_IDEMPOTENCY_KEY: 'smoke-mdl-73',
      },
      fetchImpl,
      log,
    });

    expect(result).toEqual({ baseUrl: 'https://railway.example', loan: 'passed' });
    const loanCall = calls.find(({ options }) => options.body && options.headers?.['Idempotency-Key']);
    expect(loanCall.url).toBe('https://railway.example/api/equipos/autoservicio/iniciar-uso');
    expect(loanCall.options.headers['Idempotency-Key']).toBe('smoke-mdl-73');
    expect(JSON.parse(loanCall.options.body)).toEqual({ documento: 'D1', placa: 'P-3' });
    expect(log.log).toHaveBeenCalledWith(expect.stringMatching(/préstamo controlado/i));
  });
});
