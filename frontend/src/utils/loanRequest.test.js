import assert from 'node:assert/strict';
import test from 'node:test';
import * as loanRequest from './loanRequest.js';

const { createRequestGuard, normalizeLoanResponse } = loanRequest;

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

test('normalizeLoanResponse acepta el sobre data y rechaza contratos incompletos', () => {
  const loan = normalizeLoanResponse({
    data: {
      equipo: { placa: 'P-1' },
      aprendiz: { nombre: 'Ana' },
      clase: { nombre_clase: 'Matemáticas' },
    },
  });

  assert.equal(loan.equipo.placa, 'P-1');

  assert.throws(
    () => normalizeLoanResponse({ data: { equipo: { placa: 'P-1' } } }),
    /respuesta del préstamo es inválida/i
  );
});
