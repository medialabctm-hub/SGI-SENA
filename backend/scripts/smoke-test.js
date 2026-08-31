/**
 * Smoke test del despliegue completo (nginx + frontend + API).
 *
 * Uso seguro por defecto:
 *   BASE_URL=https://<dominio> npm run test:smoke
 *
 * El préstamo real solo se ejecuta con SMOKE_LOAN=1 y fixtures explícitos:
 *   SMOKE_LOAN=1 SMOKE_DOCUMENTO=<documento> SMOKE_PLACA=<placa>
 */

import process from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'http://localhost:5173';
const LOAN_ENDPOINT = '/api/equipos/autoservicio/iniciar-uso';

const trimTrailingSlashes = value => value.replace(/\/+$/, '');

export function getBaseUrl(env = process.env) {
  const configured = String(env.BASE_URL || DEFAULT_BASE_URL).trim();
  let parsed;

  try {
    parsed = new URL(configured);
  } catch {
    throw new Error('BASE_URL debe ser una URL http(s) válida');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('BASE_URL debe usar http:// o https://');
  }

  return trimTrailingSlashes(parsed.toString());
}

function buildUrl(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`).toString();
}

async function readResponse(response) {
  const body = await response.text();
  let json = null;

  if (body) {
    try {
      json = JSON.parse(body);
    } catch {
      json = null;
    }
  }

  return {
    status: response.status,
    contentType: response.headers?.get('content-type') || '',
    body,
    json,
  };
}

async function request(fetchImpl, baseUrl, pathname, options) {
  try {
    const response = await fetchImpl(buildUrl(baseUrl, pathname), options);
    return readResponse(response);
  } catch (error) {
    throw new Error(`No se pudo consultar ${pathname}: ${error.message}`);
  }
}

function responseSummary(result) {
  const body = result.body.replace(/\s+/g, ' ').trim();
  return `status ${result.status}${body ? ` (${body.slice(0, 180)})` : ''}`;
}

function getControlledLoan(env) {
  if (String(env.SMOKE_LOAN || '').trim() !== '1') return null;

  const documento = String(env.SMOKE_DOCUMENTO || '').trim();
  const placa = String(env.SMOKE_PLACA || '').trim();
  if (!documento || !placa) {
    throw new Error('SMOKE_LOAN=1 requiere SMOKE_DOCUMENTO y SMOKE_PLACA');
  }

  const idempotencyKey = String(
    env.SMOKE_IDEMPOTENCY_KEY || `smoke-mdl-73-${documento}-${placa}`
  ).trim();
  if (!idempotencyKey || idempotencyKey.length > 128 || /[\r\n]/.test(idempotencyKey)) {
    throw new Error('SMOKE_IDEMPOTENCY_KEY debe tener entre 1 y 128 caracteres');
  }

  return { documento, placa, idempotencyKey };
}

async function checkHealth(fetchImpl, baseUrl, log) {
  const result = await request(fetchImpl, baseUrl, '/health');
  if (result.status !== 200 || result.json?.status !== 'ok') {
    throw new Error(`Health check falló: ${responseSummary(result)}`);
  }
  log.log('Health check passed');
}

async function checkFrontend(fetchImpl, baseUrl, log) {
  const result = await request(fetchImpl, baseUrl, '/');
  if (
    result.status !== 200 ||
    !result.contentType.toLowerCase().includes('text/html') ||
    !/<div\s+id=["']root["']\s*>/i.test(result.body)
  ) {
    throw new Error(`Frontend check falló: ${responseSummary(result)}`);
  }
  log.log('Frontend check passed');
}

async function checkApiProxy(fetchImpl, baseUrl, log) {
  const result = await request(fetchImpl, baseUrl, LOAN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (result.status !== 400) {
    throw new Error(`Proxy /api check falló: ${responseSummary(result)}`);
  }
  log.log('Proxy /api check passed (validación de préstamo sin mutación)');
}

async function checkControlledLoan(fetchImpl, baseUrl, loan, log) {
  const verifyPath = `/api/aprendices/verificar/${encodeURIComponent(loan.documento)}`;
  const verified = await request(fetchImpl, baseUrl, verifyPath);
  if (verified.status !== 200 || verified.json?.ok !== true) {
    throw new Error(`Verificación del fixture de préstamo falló: ${responseSummary(verified)}`);
  }

  const result = await request(fetchImpl, baseUrl, LOAN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': loan.idempotencyKey,
    },
    body: JSON.stringify({ documento: loan.documento, placa: loan.placa }),
  });
  const data = result.json?.data;
  const validEnvelope = data?.equipo?.placa &&
    data?.aprendiz?.documento &&
    data?.clase?.nombre_clase &&
    data?.fecha_hora_inicio;

  if (
    ![200, 201].includes(result.status) ||
    result.json?.success !== true ||
    !validEnvelope ||
    String(data.equipo.placa).trim() !== loan.placa ||
    String(data.aprendiz.documento).trim() !== loan.documento
  ) {
    throw new Error(`Préstamo controlado falló: ${responseSummary(result)}`);
  }

  log.log(`Préstamo controlado passed (${result.status}, identidad idempotente)`);
}

export async function runSmoke({
  env = process.env,
  fetchImpl = globalThis.fetch,
  log = console,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('No hay una implementación fetch disponible para el smoke test');
  }

  const baseUrl = getBaseUrl(env);
  const controlledLoan = getControlledLoan(env);

  await checkHealth(fetchImpl, baseUrl, log);
  await checkFrontend(fetchImpl, baseUrl, log);
  await checkApiProxy(fetchImpl, baseUrl, log);

  if (controlledLoan) {
    await checkControlledLoan(fetchImpl, baseUrl, controlledLoan, log);
    log.log('Smoke test passed');
    return { baseUrl, loan: 'passed' };
  }

  log.log('Préstamo controlado omitido; la validación 400 no mutó la base de datos');
  log.log('Smoke test passed');
  return { baseUrl, loan: 'skipped' };
}

export async function run() {
  return runSmoke();
}

const currentFile = resolve(fileURLToPath(import.meta.url));
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  run().catch(error => {
    console.error(`Smoke test failed: ${error.message}`);
    process.exitCode = 1;
  });
}
