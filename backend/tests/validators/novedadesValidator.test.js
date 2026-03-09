/**
 * Tests para validators/novedadesValidator
 *
 * Cubre: crearNovedadSchema, actualizarEstadoNovedadSchema, validate()
 */

import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';
import {
  crearNovedadSchema,
  actualizarEstadoNovedadSchema,
  validate,
} from '../../src/validators/novedadesValidator.js';

function makeReqRes(body) {
  const req = { body };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

const tiposValidos = [
  'Daño',
  'Pérdida',
  'Robo',
  'Mal Funcionamiento',
  'Daño Físico',
  'Falta de Componente',
  'Otro',
];

// ──────────────────────────────────────────────
// crearNovedadSchema
// ──────────────────────────────────────────────
describe('crearNovedadSchema', () => {
  const base = {
    codigo_equipo: 'EQ-001',
    tipo_novedad: 'Daño',
    descripcion: 'La pantalla del portátil presenta rayaduras visibles.',
  };

  it('debe pasar con datos válidos', () => {
    expect(() => crearNovedadSchema.parse(base)).not.toThrow();
  });

  it('debe aceptar codigo_equipo como número', () => {
    expect(() =>
      crearNovedadSchema.parse({ ...base, codigo_equipo: 10 })
    ).not.toThrow();
  });

  it.each(tiposValidos)('debe aceptar el tipo de novedad "%s"', (tipo) => {
    expect(() =>
      crearNovedadSchema.parse({ ...base, tipo_novedad: tipo })
    ).not.toThrow();
  });

  it('debe fallar si falta codigo_equipo', () => {
    const { codigo_equipo, ...sin } = base;
    expect(() => crearNovedadSchema.parse(sin)).toThrow();
  });

  it('debe fallar si codigo_equipo es una cadena vacía', () => {
    expect(() =>
      crearNovedadSchema.parse({ ...base, codigo_equipo: '' })
    ).toThrow('código del equipo es requerido');
  });

  it('debe fallar si tipo_novedad es inválido', () => {
    expect(() =>
      crearNovedadSchema.parse({ ...base, tipo_novedad: 'Destrucción' })
    ).toThrow('Tipo de novedad inválido');
  });

  it('debe fallar si la descripción tiene menos de 10 caracteres', () => {
    expect(() =>
      crearNovedadSchema.parse({ ...base, descripcion: 'Corta.' })
    ).toThrow('al menos 10 caracteres');
  });

  it('debe fallar si la descripción supera 2000 caracteres', () => {
    expect(() =>
      crearNovedadSchema.parse({ ...base, descripcion: 'X'.repeat(2001) })
    ).toThrow();
  });

  it('debe fallar si falta tipo_novedad', () => {
    const { tipo_novedad, ...sin } = base;
    expect(() => crearNovedadSchema.parse(sin)).toThrow();
  });

  it('debe fallar si falta la descripción', () => {
    const { descripcion, ...sin } = base;
    expect(() => crearNovedadSchema.parse(sin)).toThrow();
  });
});

// ──────────────────────────────────────────────
// actualizarEstadoNovedadSchema
// ──────────────────────────────────────────────
describe('actualizarEstadoNovedadSchema', () => {
  it.each(['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto'])(
    'debe aceptar el estado "%s"',
    (estado) => {
      expect(() =>
        actualizarEstadoNovedadSchema.parse({ estado_resolucion: estado })
      ).not.toThrow();
    }
  );

  it('debe aceptar observaciones opcionales', () => {
    expect(() =>
      actualizarEstadoNovedadSchema.parse({
        estado_resolucion: 'Resuelto',
        observaciones_resolucion: 'Se reemplazó la pantalla.',
      })
    ).not.toThrow();
  });

  it('debe funcionar sin observaciones', () => {
    expect(() =>
      actualizarEstadoNovedadSchema.parse({ estado_resolucion: 'Pendiente' })
    ).not.toThrow();
  });

  it('debe fallar si el estado es inválido', () => {
    expect(() =>
      actualizarEstadoNovedadSchema.parse({ estado_resolucion: 'Completado' })
    ).toThrow('Estado de resolución inválido');
  });

  it('debe fallar si falta el campo estado_resolucion', () => {
    expect(() => actualizarEstadoNovedadSchema.parse({})).toThrow();
  });

  it('debe fallar si observaciones supera 1000 caracteres', () => {
    expect(() =>
      actualizarEstadoNovedadSchema.parse({
        estado_resolucion: 'Resuelto',
        observaciones_resolucion: 'O'.repeat(1001),
      })
    ).toThrow();
  });
});

// ──────────────────────────────────────────────
// Middleware validate()
// ──────────────────────────────────────────────
describe('Middleware validate() de novedades', () => {
  it('debe llamar next() con datos de novedad válidos', () => {
    const { req, res, next } = makeReqRes({
      codigo_equipo: 'EQ-042',
      tipo_novedad: 'Robo',
      descripcion: 'El mouse del equipo fue sustraído del salón.',
    });

    validate(crearNovedadSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe retornar 400 con tipo de novedad inválido', () => {
    const { req, res, next } = makeReqRes({
      codigo_equipo: 'EQ-042',
      tipo_novedad: 'Vandalismo',
      descripcion: 'Descripción suficientemente larga.',
    });

    validate(crearNovedadSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Error de validación');
  });

  it('debe retornar 400 con descripción muy corta', () => {
    const { req, res, next } = makeReqRes({
      codigo_equipo: 'EQ-001',
      tipo_novedad: 'Daño',
      descripcion: 'Corta',
    });

    validate(crearNovedadSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('debe incluir detalles del error en la respuesta 400', () => {
    const { req, res, next } = makeReqRes({});

    validate(crearNovedadSchema)(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details.length).toBeGreaterThan(0);
    expect(payload.details[0]).toHaveProperty('path');
    expect(payload.details[0]).toHaveProperty('message');
  });

  it('debe llamar next() con datos de actualización de estado válidos', () => {
    const { req, res, next } = makeReqRes({ estado_resolucion: 'En Proceso' });

    validate(actualizarEstadoNovedadSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('debe llamar next(error) cuando el error no es ZodError [line 59]', () => {
    const req = {
      get body() { throw new Error('Unexpected parse error'); },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearNovedadSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('ZodError con path null debe usar "unknown" como path', () => {
    const req = {
      get body() {
        throw new z.ZodError([{ code: null, path: null, message: null, input: {} }]);
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearNovedadSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.details[0].path).toBe('unknown');
    expect(payload.details[0].message).toBe('Error de validación desconocido');
    expect(payload.details[0].code).toBe('invalid_type');
  });

  it('ZodError con issues vacías debe retornar detalle fallback', () => {
    const req = {
      get body() { throw new z.ZodError([]); },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearNovedadSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.details[0].path).toBe('unknown');
    expect(payload.details[0].message).toBe('Error de validación desconocido');
  });
});
