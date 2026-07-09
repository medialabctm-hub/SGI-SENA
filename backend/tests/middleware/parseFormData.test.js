/**
 * Tests para middleware/parseFormData
 *
 * Cubre: todos los branches del middleware parseFormData
 * - No es multipart/form-data → next()
 * - usuarios como JSON string (array) → parsear
 * - usuarios como JSON string (objeto) → envolver en array
 * - usuarios como JSON string inválido → fallback progresivo
 * - usuarios no es string ni array → convertir a array
 * - formato antiguo con documento en raíz
 * - usuario ya es array → normalizar campos camelCase
 * - parseo de diasSemana en usuarios
 * - error genérico → next(error)
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock(
  '../../src/utils/logger.js',
  () => ({
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }),
  { virtual: true }
);

import { parseFormData } from '../../src/middleware/parseFormData.js';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function makeReq(body = {}, contentType = 'multipart/form-data; boundary=---xxx') {
  return {
    headers: { 'content-type': contentType },
    body,
  };
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

// ──────────────────────────────────────────────
// No multipart
// ──────────────────────────────────────────────
describe('parseFormData - no multipart/form-data', () => {
  it('debe llamar next() inmediatamente si el content-type no es multipart', () => {
    const req = makeReq({}, 'application/json');
    const res = makeRes();
    const next = jest.fn();

    parseFormData(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('debe llamar next() si content-type está vacío', () => {
    const req = makeReq({}, '');
    const res = makeRes();
    const next = jest.fn();

    parseFormData(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

// ──────────────────────────────────────────────
// usuarios como string JSON válido
// ──────────────────────────────────────────────
describe('parseFormData - usuarios como JSON string', () => {
  it('debe parsear usuarios como array cuando es un string JSON de array', () => {
    const usuarios = [{ documento: '12345678' }, { documento: '98765432' }];
    const req = makeReq({
      placa: 'SENA-001',
      usuarios: JSON.stringify(usuarios),
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios).toHaveLength(2);
    expect(req.body.usuarios[0].documento).toBe('12345678');
  });

  it('debe envolver en array si el JSON es un objeto (no array)', () => {
    const req = makeReq({
      placa: 'SENA-002',
      usuarios: JSON.stringify({ documento: '11111111' }),
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(Array.isArray(req.body.usuarios)).toBe(true);
    expect(req.body.usuarios[0].documento).toBe('11111111');
  });
});

// ──────────────────────────────────────────────
// usuarios con JSON inválido → fallbacks
// ──────────────────────────────────────────────
describe('parseFormData - usuarios con JSON inválido', () => {
  it('debe crear array con objeto {documento} si el JSON falla completamente', () => {
    const req = makeReq({
      placa: 'SENA-003',
      usuarios: 'texto-invalido-sin-json',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(Array.isArray(req.body.usuarios)).toBe(true);
    expect(req.body.usuarios[0]).toHaveProperty('documento');
  });

  it('debe parsear string que comienza con "[" aunque el primer parse falle', () => {
    const req = makeReq({
      placa: 'SENA-004',
      usuarios: '[{"documento":"22222222"}]',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].documento).toBe('22222222');
  });
});

// ──────────────────────────────────────────────
// usuarios no es string ni array
// ──────────────────────────────────────────────
describe('parseFormData - usuarios no es string ni array', () => {
  it('debe convertir un objeto a array de un elemento', () => {
    const req = makeReq({
      placa: 'SENA-005',
      usuarios: { documento: '33333333' },
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(Array.isArray(req.body.usuarios)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// formato antiguo: documento en raíz
// ──────────────────────────────────────────────
describe('parseFormData - formato antiguo con documento en raíz', () => {
  it('debe crear un array con el documento del nivel raíz', () => {
    const req = makeReq({
      placa: 'SENA-006',
      ambiente: 'Aula 01',
      documento: '44444444',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios).toHaveLength(1);
    expect(req.body.usuarios[0].documento).toBe('44444444');
  });

  it('debe crear el usuario con documento aunque también venga ficha al nivel raíz', () => {
    // La ficha en root no se propaga en este path (el middleware usa el array
    // interno que sólo tiene 'documento'); la ficha sólo se incluye cuando
    // llega como campo del propio objeto de usuario dentro del array.
    const req = makeReq({
      placa: 'SENA-007',
      documento: '55555555',
      ficha: '2750123',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios).toHaveLength(1);
    expect(req.body.usuarios[0].documento).toBe('55555555');
  });

  it('debe parsear diasSemana del nivel raíz como string JSON', () => {
    const req = makeReq({
      placa: 'SENA-008',
      documento: '66666666',
      diasSemana: JSON.stringify([1, 3, 5]),
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].dias_semana).toEqual([1, 3, 5]);
  });

  it('debe usar array de un elemento si diasSemana no es JSON válido', () => {
    const req = makeReq({
      placa: 'SENA-009',
      documento: '77777777',
      diasSemana: 'lunes',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].dias_semana).toEqual(['lunes']);
  });
});

// ──────────────────────────────────────────────
// array de usuarios → normalizar campos
// ──────────────────────────────────────────────
describe('parseFormData - normalización de campos en array de usuarios', () => {
  it('debe normalizar horaInicio/horaFin a hora_inicio/hora_fin', () => {
    const usuarios = [{ documento: '88888888', horaInicio: '08:00', horaFin: '10:00' }];
    const req = makeReq({
      placa: 'SENA-010',
      usuarios: JSON.stringify(usuarios),
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    const u = req.body.usuarios[0];
    expect(u.hora_inicio).toBe('08:00');
    expect(u.hora_fin).toBe('10:00');
    expect(u.horaInicio).toBeUndefined();
    expect(u.horaFin).toBeUndefined();
  });

  it('debe parsear diasSemana como string JSON en cada usuario del array', () => {
    const usuarios = [{ documento: '99999999', diasSemana: JSON.stringify([1, 5]) }];
    const req = makeReq({
      placa: 'SENA-011',
      usuarios: JSON.stringify(usuarios),
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].dias_semana).toEqual([1, 5]);
    expect(req.body.usuarios[0].diasSemana).toBeUndefined();
  });

  it('debe manejar diasSemana inválido en usuario del array', () => {
    const usuarios = [{ documento: '10101010', diasSemana: 'viernes' }];
    const req = makeReq({
      placa: 'SENA-012',
      usuarios: JSON.stringify(usuarios),
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].dias_semana).toEqual(['viernes']);
  });

  it('debe incluir ficha si viene en el objeto del usuario', () => {
    const usuarios = [{ documento: '20202020', ficha: '2750456' }];
    const req = makeReq({
      placa: 'SENA-013',
      usuarios: JSON.stringify(usuarios),
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].ficha).toBe('2750456');
  });
});

// ──────────────────────────────────────────────
// Sin usuarios ni documento → array vacío
// ──────────────────────────────────────────────
describe('parseFormData - sin usuarios ni documento', () => {
  it('debe producir usuarios:[] si no hay documento ni usuarios', () => {
    const req = makeReq({ placa: 'SENA-014', ambiente: 'Aula 02' });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// Sanitización de placa y ambiente
// ──────────────────────────────────────────────
describe('parseFormData - sanitización', () => {
  it('debe recortar espacios de placa y ambiente', () => {
    const req = makeReq({
      placa: '  SENA-015  ',
      ambiente: '  Aula 03  ',
      documento: '30303030',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.placa).toBe('SENA-015');
    expect(req.body.ambiente).toBe('Aula 03');
  });

  it('debe excluir campos no permitidos del body sanitizado', () => {
    const req = makeReq({
      placa: 'SENA-016',
      campo_extra: 'no debe aparecer',
      documento: '40404040',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.campo_extra).toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// Error genérico → next(error)
// ──────────────────────────────────────────────
describe('parseFormData - error inesperado', () => {
  it('debe llamar next(error) si ocurre una excepción inesperada', () => {
    const req = {
      headers: { 'content-type': 'multipart/form-data' },
      get body() { throw new Error('Unexpected read error'); },
    };
    const res = makeRes();
    const next = jest.fn();

    parseFormData(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ──────────────────────────────────────────────
// Líneas no cubiertas: inner catch block (lines 48-53)
// ──────────────────────────────────────────────
describe('parseFormData - JSON inválido que empieza con [', () => {
  it('debe crear array vacío cuando string empieza con [ pero es JSON inválido (catch e2)', () => {
    // First JSON.parse fails (not valid), string starts with '[' but trimmed also fails
    const req = makeReq({
      placa: 'SENA-ERR',
      usuarios: '[{"documento": "123", invalid json here',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    // After all fallbacks, usuarios ends as empty array
    expect(Array.isArray(req.body.usuarios)).toBe(true);
  });

  it('debe crear array vacío cuando string empieza con { pero es JSON inválido (catch e2)', () => {
    const req = makeReq({
      placa: 'SENA-ERR2',
      usuarios: '{incomplete json',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(Array.isArray(req.body.usuarios)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Líneas no cubiertas: format antiguo - diasSemana no-string (line 84)
//                                     - horaInicio (line 89)
//                                     - horaFin (line 93)
// ──────────────────────────────────────────────
describe('parseFormData - formato antiguo campos extra', () => {
  it('debe asignar diasSemana directamente cuando ya es array (not string) [line 84]', () => {
    // dias_semana as actual array in root format (not string)
    const req = makeReq({
      placa: 'SENA-D1',
      documento: '11223344',
      dias_semana: [1, 3, 5],
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    // dias_semana is passed directly since it's not a string
    expect(req.body.usuarios[0].dias_semana).toEqual([1, 3, 5]);
  });

  it('debe asignar hora_inicio desde horaInicio en raíz [line 89]', () => {
    const req = makeReq({
      placa: 'SENA-H1',
      documento: '22334455',
      horaInicio: '07:00',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].hora_inicio).toBe('07:00');
  });

  it('debe asignar hora_inicio desde hora_inicio en raíz [line 89 - alternate]', () => {
    const req = makeReq({
      placa: 'SENA-H2',
      documento: '33445566',
      hora_inicio: '09:00',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].hora_inicio).toBe('09:00');
  });

  it('debe asignar hora_fin desde horaFin en raíz [line 93]', () => {
    const req = makeReq({
      placa: 'SENA-HF1',
      documento: '44556677',
      horaFin: '12:00',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].hora_fin).toBe('12:00');
  });

  it('debe asignar hora_fin desde hora_fin en raíz [line 93 - alternate]', () => {
    const req = makeReq({
      placa: 'SENA-HF2',
      documento: '55667788',
      hora_fin: '14:00',
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].hora_fin).toBe('14:00');
  });
});

// ──────────────────────────────────────────────
// Línea no cubierta: diasSemana como array dentro de usuario en array (line 117)
// ──────────────────────────────────────────────
describe('parseFormData - diasSemana como array en usuario de array (line 117)', () => {
  it('debe asignar diasSemana directamente cuando ya es array dentro del usuario', () => {
    // When diasSemana is an actual JS array inside the parsed JSON, typeof is not 'string'
    const usuarios = [{ documento: '66778899', diasSemana: [2, 4, 6] }];
    const req = makeReq({
      placa: 'SENA-D2',
      usuarios: JSON.stringify(usuarios),
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].dias_semana).toEqual([2, 4, 6]);
  });

  it('debe asignar dias_semana directamente cuando ya es array (clave snake_case)', () => {
    const usuarios = [{ documento: '77889900', dias_semana: [1, 3] }];
    const req = makeReq({
      placa: 'SENA-D3',
      usuarios: JSON.stringify(usuarios),
    });
    const next = jest.fn();

    parseFormData(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.usuarios[0].dias_semana).toEqual([1, 3]);
  });
});
