import assert from 'node:assert/strict';
import test from 'node:test';
import * as api from './api.js';

const { ApiError, buildErrorMessage, parseApiResponse } = api;

const response = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('parseApiResponse prioriza userMessage sobre message, detalles y error', async () => {
  await assert.rejects(
    parseApiResponse(
      response(409, {
        userMessage: 'El aprendiz importado ya tiene este equipo habilitado.',
        message: 'Conflicto técnico interno',
        error: 'duplicate key',
        details: [{ message: 'Detalle de validación' }],
      })
    ),
    error => {
      assert.equal(error.message, 'El aprendiz importado ya tiene este equipo habilitado.');
      assert.equal(error.userMessage, 'El aprendiz importado ya tiene este equipo habilitado.');
      return true;
    }
  );
});

test('parseApiResponse usa message antes del primer detalle estructurado y error', async () => {
  await assert.rejects(
    parseApiResponse(
      response(400, {
        message: 'El registro externo requiere una clase en curso.',
        error: 'ValidationError',
        details: [{ message: 'Documento inválido' }, { message: 'No mostrar este segundo detalle' }],
      })
    ),
    error => {
      assert.equal(error.message, 'El registro externo requiere una clase en curso.');
      return true;
    }
  );
});

test('buildErrorMessage muestra el primer detalle estructurado sin trazas técnicas', () => {
  const error = new ApiError('ValidationError', 400, {
    error: 'ValidationError',
    details: [
      { message: 'El autoservicio solo está disponible durante una clase en curso.' },
      { message: 'SQLSTATE[23000] detalle técnico' },
    ],
  });

  assert.equal(
    buildErrorMessage(error),
    'El autoservicio solo está disponible durante una clase en curso.'
  );
});

test('buildErrorMessage trata 422 como 400 y conserva el primer detalle estructurado', () => {
  const error = new ApiError('NO_USERS_PROCESSED', 422, {
    code: 'NO_USERS_PROCESSED',
    error: 'ValidationError',
    details: [
      { message: 'Ningún aprendiz pudo registrarse porque la clase no está disponible.' },
      { message: 'SQLSTATE[23000] detalle técnico' },
    ],
  });

  assert.equal(
    buildErrorMessage(error),
    'Ningún aprendiz pudo registrarse porque la clase no está disponible.'
  );
});

test('parseApiResponse acepta una respuesta 409 marcada explícitamente como idempotente', async () => {
  const data = await parseApiResponse(
    response(409, {
      success: true,
      idempotent: true,
      data: { aprendiz: { id_aprendiz: 22, documento: '123456' } },
    })
  );

  assert.equal(data.data.aprendiz.id_aprendiz, 22);
});

test('buildErrorMessage explica el rate limit y permite reintentar', () => {
  const error = new ApiError('Too many requests', 429, {
    code: 'RATE_LIMITED',
    message: 'Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.',
  });

  assert.equal(
    buildErrorMessage(error),
    'Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.'
  );
});

test('buildErrorMessage conserva mensajes accionables de envelopes 404, 409, 429 y 500', () => {
  const cases = [
    [404, 'No encontramos un aprendiz con ese documento.'],
    [409, 'Este equipo ya está siendo usado por otra persona en este momento.'],
    [429, 'Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.'],
    [500, 'El préstamo fue registrado; actualiza la página para confirmar el estado.'],
  ];

  for (const [status, userMessage] of cases) {
    const error = new ApiError('Error técnico', status, { userMessage });
    assert.equal(buildErrorMessage(error), userMessage);
  }
});

test('buildEquipoAssignmentPayload conserva la forma de usuario con cuenta', () => {
  assert.deepEqual(
    api.buildEquipoAssignmentPayload({
      codigo_equipo: 'EQ-1',
      id_usuario: 8,
      id_aprendiz: 22,
      documento_externo: '123',
      tipo_responsabilidad: 'Principal',
    }),
    {
      codigo_equipo: 'EQ-1',
      id_usuario: 8,
      tipo_responsabilidad: 'Principal',
    }
  );
});

test('handleSessionExpiration dispara auth:changed y limpia token/user antes de redirigir', () => {
  const events = [];
  const store = { token: 'abc', user: '{"id_usuario":1}' };
  globalThis.window = {
    location: { pathname: '/dashboard' },
    dispatchEvent: (event) => events.push(event.type),
  };
  globalThis.localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    removeItem: (key) => { delete store[key]; },
  };
  // setTimeout ya existe en el proceso de Node (a diferencia de window/localStorage):
  // se guarda y se restaura, nunca se borra, para no dejar el timer roto para el
  // resto de los tests de este archivo.
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = () => {}; // no ejercitamos el redirect diferido en este test

  try {
    api.handleSessionExpiration();

    assert.deepEqual(events, ['auth:changed']);
    assert.equal('token' in store, false);
    assert.equal('user' in store, false);
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
    globalThis.setTimeout = realSetTimeout;
  }
});

test('buildEquipoAssignmentPayload conserva id_aprendiz y documento_externo sin id_usuario', () => {
  assert.deepEqual(
    api.buildEquipoAssignmentPayload({
      codigo_equipo: 'EQ-2',
      id_usuario: '',
      id_aprendiz: 22,
      documento_externo: '123456',
      tipo_responsabilidad: 'Principal',
      observaciones: 'Importado',
    }),
    {
      codigo_equipo: 'EQ-2',
      id_aprendiz: 22,
      documento_externo: '123456',
      tipo_responsabilidad: 'Principal',
      observaciones: 'Importado',
    }
  );
});
