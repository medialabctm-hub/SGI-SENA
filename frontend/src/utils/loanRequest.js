import { parseApiResponse } from './api.js';

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

export async function submitLoanRequest({
  guard,
  identity,
  documento,
  placa,
  onLoading,
  fetchImpl = fetch,
  endpoint = '/api/equipos/autoservicio/iniciar-uso',
}) {
  const request = guard.start({ identity });
  onLoading(true);
  try {
    const response = await fetchImpl(endpoint, {
      ...createLoanRequestOptions(documento, placa, request.identity),
      signal: request.signal,
    });
    const data = await parseApiResponse(response, 'No se pudo registrar el préstamo del equipo');
    const loan = normalizeLoanResponse(data);
    if (!guard.isCurrent(request.id)) return { kind: 'cancelled', request };
    return { kind: 'success', status: response.status, request, loan };
  } catch (error) {
    if (isRequestTimeout(error, request)) return { kind: 'timeout', request, error };
    if (error?.name === 'AbortError' || !guard.isCurrent(request.id)) {
      return { kind: 'cancelled', request, error };
    }
    return { kind: 'error', status: error?.status, request, error };
  } finally {
    if (guard.isCurrent(request.id) || isRequestTimeout(null, request)) onLoading(false);
    guard.finish(request.id);
  }
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
  const loan = data?.data;
  const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);
  const hasText = value => typeof value === 'string' && value.trim().length > 0;

  if (
    !isRecord(data) ||
    !isRecord(loan) ||
    !isRecord(loan.equipo) ||
    !hasText(loan.equipo.placa) ||
    !hasText(loan.equipo.tipo) ||
    !hasText(loan.equipo.modelo) ||
    !isRecord(loan.aprendiz) ||
    !hasText(loan.aprendiz.nombre) ||
    !isRecord(loan.clase) ||
    !hasText(loan.clase.nombre_clase)
  ) {
    throw new Error('La respuesta del préstamo es inválida');
  }
  return loan;
}

export function formatLoanStartTime(fechaHoraInicio) {
  if (!fechaHoraInicio) return null;
  const parsed = new Date(fechaHoraInicio);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}
