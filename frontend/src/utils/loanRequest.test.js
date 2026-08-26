import assert from 'node:assert/strict';
import test from 'node:test';
import * as loanRequest from './loanRequest.js';

const { createRequestGuard, normalizeLoanResponse, formatLoanStartTime } = loanRequest;

test('createRequestGuard aborta la solicitud anterior y distingue la vigente', () => {
  const guard = createRequestGuard();
  const first = guard.start();
  const second = guard.start();

  assert.equal(first.signal.aborted, true);
  assert.equal(guard.isCurrent(first.id), false);
  assert.equal(guard.isCurrent(second.id), true);

  guard.cancel();
  assert.equal(second.signal.aborted, true);
  assert.equal(guard.isCurrent(second.id), false);
});

test('createRequestGuard vence la solicitud y conserva su identidad para reintentarla', () => {
  assert.equal(typeof loanRequest.isRequestTimeout, 'function');

  let expireRequest;
  const guard = createRequestGuard({
    timeoutMs: 2500,
    setTimeoutFn: (callback) => {
      expireRequest = callback;
      return 'timeout-1';
    },
    clearTimeoutFn: () => {},
    createRequestIdentity: () => 'prestamo-123',
  });

  const request = guard.start();
  expireRequest();

  assert.equal(request.identity, 'prestamo-123');
  assert.equal(request.signal.aborted, true);
  assert.equal(loanRequest.isRequestTimeout(new DOMException('The operation was aborted', 'AbortError'), request), true);

  const retry = guard.start({ identity: request.identity });
  assert.equal(retry.identity, 'prestamo-123');
  assert.equal(loanRequest.isRequestTimeout(new DOMException('The operation was aborted', 'AbortError'), retry), false);
});

test('createLoanRequestOptions repite documento, placa e identidad en la recuperación', () => {
  assert.equal(typeof loanRequest.createLoanRequestOptions, 'function');

  const firstAttempt = loanRequest.createLoanRequestOptions('123', 'P-1', 'prestamo-123');
  const recoveredAttempt = loanRequest.createLoanRequestOptions('123', 'P-1', 'prestamo-123');

  assert.deepEqual(recoveredAttempt, firstAttempt);
  assert.equal(recoveredAttempt.headers['Idempotency-Key'], 'prestamo-123');
  assert.equal(recoveredAttempt.body, JSON.stringify({ documento: '123', placa: 'P-1' }));
});

test('normalizeLoanResponse acepta el envelope completo que usa la confirmación', () => {
  const loan = normalizeLoanResponse({
    data: {
      equipo: { placa: 'P-1', tipo: 'Portátil', modelo: 'Latitude' },
      aprendiz: { nombre: 'Ana' },
      clase: { nombre_clase: 'Matemáticas' },
    },
  });

  assert.equal(loan.equipo.placa, 'P-1');
});

test('normalizeLoanResponse rechaza envelopes ausentes, colecciones y campos de confirmación incompletos', () => {
  const completeLoan = {
    equipo: { placa: 'P-1', tipo: 'Portátil', modelo: 'Latitude' },
    aprendiz: { nombre: 'Ana' },
    clase: { nombre_clase: 'Matemáticas' },
  };

  for (const response of [
    completeLoan,
    { data: { ...completeLoan, equipo: [] } },
    { data: { ...completeLoan, equipo: { placa: 'P-1', tipo: 'Portátil' } } },
    { data: { ...completeLoan, aprendiz: { nombre: '   ' } } },
    { data: { ...completeLoan, clase: { nombre_clase: '' } } },
  ]) {
    assert.throws(
      () => normalizeLoanResponse(response),
      /respuesta del préstamo es inválida/i
    );
  }
});

test('formatLoanStartTime formatea una fecha-hora ISO válida a HH:MM', () => {
  const formatted = formatLoanStartTime('2026-08-26T14:05:00-05:00');
  assert.match(formatted, /^\d{1,2}:\d{2}\s?(a\.?\s?m\.?|p\.?\s?m\.?)$/i);
});

test('formatLoanStartTime devuelve null cuando no hay fecha_hora_inicio (regresión: confirmación sin horas)', () => {
  assert.equal(formatLoanStartTime(undefined), null);
  assert.equal(formatLoanStartTime(null), null);
  assert.equal(formatLoanStartTime(''), null);
});

test('formatLoanStartTime devuelve null ante un valor de fecha inválido', () => {
  assert.equal(formatLoanStartTime('no-es-una-fecha'), null);
});

test('submitLoanRequest no confirma un préstamo cuando el envelope de éxito es inválido', async () => {
  const guard = createRequestGuard({ timeoutMs: 0 });
  const result = await loanRequest.submitLoanRequest({
    guard,
    documento: '123',
    placa: 'P-1',
    onLoading: () => {},
    fetchImpl: () => Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        equipo: { placa: 'P-1', tipo: 'Portátil' },
        aprendiz: { nombre: 'Ana' },
        clase: { nombre_clase: 'Matemáticas' },
      },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } })),
  });

  assert.equal(result.kind, 'error');
  assert.match(result.error.message, /respuesta del préstamo es inválida/i);
});
