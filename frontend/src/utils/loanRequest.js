const DEFAULT_TIMEOUT_MS = 15_000;

const defaultRequestIdentity = () => (
  globalThis.crypto?.randomUUID?.() || `prestamo-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

export function isRequestTimeout(error, request) {
  return Boolean(
    request?.timedOut ||
    request?.signal?.reason?.name === 'TimeoutError' ||
    error?.name === 'TimeoutError'
  );
}

export function createLoanRequestOptions(documento, placa, identity) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': identity,
    },
    body: JSON.stringify({ documento, placa }),
  };
}

export function createRequestGuard({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  createRequestIdentity = defaultRequestIdentity,
} = {}) {
  let sequence = 0;
  let controller = null;
  let timeout = null;

  const clearRequestTimeout = () => {
    if (timeout !== null) clearTimeoutFn(timeout);
    timeout = null;
  };

  return {
    start({ identity } = {}) {
      controller?.abort();
      clearRequestTimeout();
      controller = new AbortController();
      const id = ++sequence;
      const request = {
        id,
        identity: identity || createRequestIdentity(),
        signal: controller.signal,
        timedOut: false,
      };
      if (timeoutMs > 0) {
        timeout = setTimeoutFn(() => {
          if (id !== sequence) return;
          request.timedOut = true;
          controller.abort(new DOMException('La solicitud excedió el tiempo límite', 'TimeoutError'));
        }, timeoutMs);
      }
      return request;
    },

    isCurrent(id) {
      return id === sequence && controller && !controller.signal.aborted;
    },

    cancel() {
      controller?.abort();
      clearRequestTimeout();
      sequence += 1;
      controller = null;
    },

    finish(id) {
      if (id === sequence) {
        clearRequestTimeout();
        controller = null;
      }
    },
  };
}

export function normalizeLoanResponse(data) {
  const loan = data?.data || data;
  if (!loan?.equipo || !loan?.aprendiz || !loan?.clase) {
    throw new Error('La respuesta del préstamo es inválida');
  }
  return loan;
}
