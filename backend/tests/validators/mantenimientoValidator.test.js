/**
 * Tests para validators/mantenimientoValidator
 *
 * Cubre: crearMantenimientoSchema, actualizarEstadoMantenimientoSchema,
 *        actualizarFechaProximoSchema, actualizarFechaMantenimientoSchema, validate()
 */

import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';
import {
  crearMantenimientoSchema,
  actualizarEstadoMantenimientoSchema,
  actualizarFechaProximoSchema,
  actualizarFechaMantenimientoSchema,
  validate,
} from '../../src/validators/mantenimientoValidator.js';

function makeReqRes(body) {
  const req = { body };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ──────────────────────────────────────────────
// crearMantenimientoSchema
// ──────────────────────────────────────────────
describe('crearMantenimientoSchema', () => {
  const base = {
    codigo_equipo: 'EQ-001',
    tipo_mantenimiento: 'Preventivo',
    descripcion: 'Revisión completa del equipo de cómputo.',
    fecha_mantenimiento: '2026-03-10',
  };

  it('debe pasar con datos mínimos válidos', () => {
    expect(() => crearMantenimientoSchema.parse(base)).not.toThrow();
  });

  it('debe aceptar codigo_equipo como número', () => {
    expect(() =>
      crearMantenimientoSchema.parse({ ...base, codigo_equipo: 5 })
    ).not.toThrow();
  });

  it('debe aceptar fecha_proximo opcional', () => {
    expect(() =>
      crearMantenimientoSchema.parse({ ...base, fecha_proximo: '2026-06-10' })
    ).not.toThrow();
  });

  it('debe asignar "Programado" como estado por defecto', () => {
    const result = crearMantenimientoSchema.parse(base);
    expect(result.estado_mantenimiento).toBe('Programado');
  });

  it('debe fallar si falta codigo_equipo', () => {
    const { codigo_equipo, ...sin } = base;
    expect(() => crearMantenimientoSchema.parse(sin)).toThrow();
  });

  it('debe fallar si tipo_mantenimiento es inválido', () => {
    expect(() =>
      crearMantenimientoSchema.parse({ ...base, tipo_mantenimiento: 'Urgente' })
    ).toThrow('Tipo de mantenimiento inválido');
  });

  it.each(['Preventivo', 'Correctivo', 'Predictivo'])(
    'debe aceptar el tipo "%s"',
    (tipo) => {
      expect(() =>
        crearMantenimientoSchema.parse({ ...base, tipo_mantenimiento: tipo })
      ).not.toThrow();
    }
  );

  it('debe fallar si la descripción tiene menos de 10 caracteres', () => {
    expect(() =>
      crearMantenimientoSchema.parse({ ...base, descripcion: 'Corto' })
    ).toThrow('al menos 10 caracteres');
  });

  it('debe fallar si la descripción supera 2000 caracteres', () => {
    expect(() =>
      crearMantenimientoSchema.parse({ ...base, descripcion: 'A'.repeat(2001) })
    ).toThrow();
  });

  it('debe fallar si la fecha tiene formato inválido (DD-MM-YYYY)', () => {
    expect(() =>
      crearMantenimientoSchema.parse({ ...base, fecha_mantenimiento: '10-03-2026' })
    ).toThrow('Formato de fecha inválido');
  });

  it('debe fallar si la fecha_proximo tiene formato inválido', () => {
    expect(() =>
      crearMantenimientoSchema.parse({ ...base, fecha_proximo: '10/06/2026' })
    ).toThrow('Formato de fecha inválido');
  });

  it.each(['Programado', 'En Proceso', 'Completado', 'Cancelado'])(
    'debe aceptar el estado "%s"',
    (estado) => {
      expect(() =>
        crearMantenimientoSchema.parse({ ...base, estado_mantenimiento: estado })
      ).not.toThrow();
    }
  );
});

// ──────────────────────────────────────────────
// actualizarEstadoMantenimientoSchema
// ──────────────────────────────────────────────
describe('actualizarEstadoMantenimientoSchema', () => {
  it.each(['Programado', 'En Proceso', 'Completado', 'Cancelado'])(
    'debe aceptar el estado "%s"',
    (estado) => {
      expect(() =>
        actualizarEstadoMantenimientoSchema.parse({ estado_mantenimiento: estado })
      ).not.toThrow();
    }
  );

  it('debe fallar si el estado es inválido', () => {
    expect(() =>
      actualizarEstadoMantenimientoSchema.parse({ estado_mantenimiento: 'Finalizado' })
    ).toThrow('Estado de mantenimiento inválido');
  });

  it('debe fallar si falta el campo estado_mantenimiento', () => {
    expect(() => actualizarEstadoMantenimientoSchema.parse({})).toThrow();
  });
});

// ──────────────────────────────────────────────
// actualizarFechaProximoSchema
// ──────────────────────────────────────────────
describe('actualizarFechaProximoSchema', () => {
  it('debe pasar con fecha en formato YYYY-MM-DD', () => {
    expect(() =>
      actualizarFechaProximoSchema.parse({ fecha_proximo: '2026-12-31' })
    ).not.toThrow();
  });

  it('debe fallar con formato inválido', () => {
    expect(() =>
      actualizarFechaProximoSchema.parse({ fecha_proximo: '31/12/2026' })
    ).toThrow('Formato de fecha inválido');
  });

  it('debe fallar si falta el campo', () => {
    expect(() => actualizarFechaProximoSchema.parse({})).toThrow();
  });
});

// ──────────────────────────────────────────────
// actualizarFechaMantenimientoSchema
// ──────────────────────────────────────────────
describe('actualizarFechaMantenimientoSchema', () => {
  it('debe pasar con formato YYYY-MM-DD', () => {
    expect(() =>
      actualizarFechaMantenimientoSchema.parse({ fecha_mantenimiento: '2026-03-10' })
    ).not.toThrow();
  });

  it('debe pasar con formato YYYY-MM-DDTHH:mm', () => {
    expect(() =>
      actualizarFechaMantenimientoSchema.parse({
        fecha_mantenimiento: '2026-03-10T14:30',
      })
    ).not.toThrow();
  });

  it('debe fallar con formato inválido', () => {
    expect(() =>
      actualizarFechaMantenimientoSchema.parse({ fecha_mantenimiento: '10-03-2026' })
    ).toThrow('Formato de fecha inválido');
  });
});

// ──────────────────────────────────────────────
// Middleware validate()
// ──────────────────────────────────────────────
describe('Middleware validate() de mantenimiento', () => {
  it('debe llamar next() con datos válidos', () => {
    const { req, res, next } = makeReqRes({
      codigo_equipo: 'EQ-001',
      tipo_mantenimiento: 'Correctivo',
      descripcion: 'Reparación del teclado dañado por líquido.',
      fecha_mantenimiento: '2026-03-10',
    });

    validate(crearMantenimientoSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe retornar 400 si la descripción es muy corta', () => {
    const { req, res, next } = makeReqRes({
      codigo_equipo: 'EQ-001',
      tipo_mantenimiento: 'Correctivo',
      descripcion: 'Corta',
      fecha_mantenimiento: '2026-03-10',
    });

    validate(crearMantenimientoSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('la respuesta 400 debe incluir detalles del error', () => {
    const { req, res, next } = makeReqRes({
      tipo_mantenimiento: 'Invalido',
      descripcion: 'Muy corta',
      fecha_mantenimiento: 'no-es-fecha',
    });

    validate(crearMantenimientoSchema)(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details.length).toBeGreaterThan(0);
  });

  it('debe llamar next(error) cuando el error no es ZodError [line 60]', () => {
    const req = {
      get body() { throw new Error('Unexpected parse error'); },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearMantenimientoSchema)(req, res, next);

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

    validate(crearMantenimientoSchema)(req, res, next);

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

    validate(crearMantenimientoSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.details[0].path).toBe('unknown');
    expect(payload.details[0].message).toBe('Error de validación desconocido');
  });
});
