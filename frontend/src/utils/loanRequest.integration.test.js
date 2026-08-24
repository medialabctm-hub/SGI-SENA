import assert from 'node:assert/strict';
import test from 'node:test';
import * as loanRequest from './loanRequest.js';

const loanResponse = (status = 200) => new Response(JSON.stringify({
  success: true,
  data: {
    id_historial: 11,
    equipo: { placa: 'P3', tipo: 'Laptop', modelo: 'M' },
    aprendiz: { nombre: 'Ana', documento: 'D1' },
    clase: { id_clase: 4, nombre_clase: 'Clase' },
  },
}), { status, headers: { 'Content-Type': 'application/json' } });

test('integra timeout, reintento con misma identidad, respuesta recuperada, conflicto y loading', async () => {
  assert.equal(typeof loanRequest.submitLoanRequest, 'function');

  let expire;
  const loading = [];
  const guard = loanRequest.createRequestGuard({
    timeoutMs: 1,
    setTimeoutFn: (callback) => {
      expire = callback;
      return 1;
    },
    clearTimeoutFn: () => {},
    createRequestIdentity: () => 'prestamo-123',
  });
  const timedOut = loanRequest.submitLoanRequest({
    guard,
    documento: 'D1',
    placa: 'P3',
    onLoading: (value) => loading.push(value),
    fetchImpl: (_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }),
  });
  expire();

  const timeoutResult = await timedOut;
  assert.equal(timeoutResult.kind, 'timeout');
  assert.equal(timeoutResult.request.identity, 'prestamo-123');

  let retriedIdentity;
  const recovered = await loanRequest.submitLoanRequest({
    guard,
    identity: timeoutResult.request.identity,
    documento: 'D1',
    placa: 'P3',
    onLoading: (value) => loading.push(value),
    fetchImpl: (_url, options) => {
      retriedIdentity = options.headers['Idempotency-Key'];
      return Promise.resolve(loanResponse(200));
    },
  });
  assert.equal(recovered.kind, 'success');
  assert.equal(recovered.status, 200);
  assert.equal(retriedIdentity, 'prestamo-123');

  const conflict = await loanRequest.submitLoanRequest({
    guard,
    identity: 'prestamo-conflict',
    documento: 'D1',
    placa: 'P4',
    onLoading: (value) => loading.push(value),
    fetchImpl: () => Promise.resolve(new Response(JSON.stringify({ error: 'Equipo en uso' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })),
  });
  assert.equal(conflict.kind, 'error');
  assert.equal(conflict.status, 409);
  assert.deepEqual(loading, [true, false, true, false, true, false]);
});
