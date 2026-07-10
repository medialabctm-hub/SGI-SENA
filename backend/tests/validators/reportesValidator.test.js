/**
 * Tests para validators/reportesValidator
 *
 * Cubre: crearReporteSchema, actualizarReporteSchema, validate middleware
 */

import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';
import {
  crearReporteSchema,
  actualizarReporteSchema,
  validate,
} from '../../src/validators/reportesValidator.js';

// ──────────────────────────────────────────────
// Base mínima válida
// ──────────────────────────────────────────────
const baseCrear = {
  tipo_reporte: 'General',
  titulo: 'Reporte de prueba',
  descripcion: 'Descripción de al menos 10 caracteres para el reporte',
};

// ──────────────────────────────────────────────
// crearReporteSchema
// ──────────────────────────────────────────────
describe('crearReporteSchema', () => {
  it('debe pasar con los campos mínimos requeridos', () => {
    expect(() => crearReporteSchema.parse(baseCrear)).not.toThrow();
  });

  it('debe asignar prioridad "Media" por defecto', () => {
    const result = crearReporteSchema.parse(baseCrear);
    expect(result.prioridad).toBe('Media');
  });

  it('debe aceptar todos los tipos de reporte válidos', () => {
    // Lista alineada con el ENUM de la tabla Reportes (SGI_SENA.sql)
    const tipos = ['General', 'Equipos', 'Mantenimiento', 'Novedades', 'Uso', 'Otro'];
    for (const tipo of tipos) {
      expect(() => crearReporteSchema.parse({ ...baseCrear, tipo_reporte: tipo })).not.toThrow();
    }
  });

  it('debe fallar si tipo_reporte es inválido', () => {
    expect(() =>
      crearReporteSchema.parse({ ...baseCrear, tipo_reporte: 'Inventario' })
    ).toThrow();
  });

  it('debe fallar si titulo tiene menos de 5 caracteres', () => {
    expect(() =>
      crearReporteSchema.parse({ ...baseCrear, titulo: 'Oops' })
    ).toThrow();
  });

  it('debe fallar si titulo supera 200 caracteres', () => {
    expect(() =>
      crearReporteSchema.parse({ ...baseCrear, titulo: 'A'.repeat(201) })
    ).toThrow();
  });

  it('debe fallar si descripcion tiene menos de 10 caracteres', () => {
    expect(() =>
      crearReporteSchema.parse({ ...baseCrear, descripcion: 'Corto' })
    ).toThrow();
  });

  it('debe fallar si descripcion supera 5000 caracteres', () => {
    expect(() =>
      crearReporteSchema.parse({ ...baseCrear, descripcion: 'A'.repeat(5001) })
    ).toThrow();
  });

  it('debe aceptar todas las prioridades válidas', () => {
    const prioridades = ['Baja', 'Media', 'Alta', 'Urgente'];
    for (const prioridad of prioridades) {
      expect(() =>
        crearReporteSchema.parse({ ...baseCrear, prioridad })
      ).not.toThrow();
    }
  });

  it('debe fallar si prioridad es inválida', () => {
    expect(() =>
      crearReporteSchema.parse({ ...baseCrear, prioridad: 'Crítica' })
    ).toThrow();
  });

  it('debe aceptar codigo_equipo como número', () => {
    const result = crearReporteSchema.parse({ ...baseCrear, codigo_equipo: 42 });
    expect(result.codigo_equipo).toBe(42);
  });

  it('debe aceptar codigo_equipo como string', () => {
    const result = crearReporteSchema.parse({ ...baseCrear, codigo_equipo: 'EQUIPO-001' });
    expect(result.codigo_equipo).toBe('EQUIPO-001');
  });

  it('debe aceptar codigo_equipo como null (se normaliza a undefined)', () => {
    const result = crearReporteSchema.parse({ ...baseCrear, codigo_equipo: null });
    expect(result.codigo_equipo).toBeUndefined();
  });

  it('debe aceptar codigo_equipo como undefined (campo omitido)', () => {
    expect(() => crearReporteSchema.parse(baseCrear)).not.toThrow();
  });

  it('debe fallar si falta titulo', () => {
    const { titulo, ...sin } = baseCrear;
    expect(() => crearReporteSchema.parse(sin)).toThrow();
  });

  it('debe fallar si falta descripcion', () => {
    const { descripcion, ...sin } = baseCrear;
    expect(() => crearReporteSchema.parse(sin)).toThrow();
  });

  it('debe fallar si falta tipo_reporte', () => {
    const { tipo_reporte, ...sin } = baseCrear;
    expect(() => crearReporteSchema.parse(sin)).toThrow();
  });
});

// ──────────────────────────────────────────────
// actualizarReporteSchema
// ──────────────────────────────────────────────
describe('actualizarReporteSchema', () => {
  it('debe pasar con objeto vacío (todos opcionales)', () => {
    expect(() => actualizarReporteSchema.parse({})).not.toThrow();
  });

  it('debe aceptar actualización parcial del titulo', () => {
    const result = actualizarReporteSchema.parse({ titulo: 'Nuevo titulo largo' });
    expect(result.titulo).toBe('Nuevo titulo largo');
  });

  it('debe aceptar todos los estados válidos', () => {
    const estados = ['Pendiente', 'En Proceso', 'Resuelto', 'Cerrado'];
    for (const estado of estados) {
      expect(() => actualizarReporteSchema.parse({ estado })).not.toThrow();
    }
  });

  it('debe fallar si estado es inválido', () => {
    expect(() => actualizarReporteSchema.parse({ estado: 'Archivado' })).toThrow();
  });

  it('debe aceptar observaciones opcionales con hasta 2000 caracteres', () => {
    const result = actualizarReporteSchema.parse({
      observaciones: 'Observaciones de la actualización',
    });
    expect(result.observaciones).toBeTruthy();
  });

  it('debe aceptar tipo_reporte válido en actualización', () => {
    const result = actualizarReporteSchema.parse({ tipo_reporte: 'Equipos' });
    expect(result.tipo_reporte).toBe('Equipos');
  });
});

// ──────────────────────────────────────────────
// validate() middleware
// ──────────────────────────────────────────────
describe('validate() de reportes', () => {
  it('debe llamar next() con datos válidos', () => {
    const req = { body: { ...baseCrear } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearReporteSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe retornar 400 con datos inválidos', () => {
    const req = { body: { tipo_reporte: 'Invalido', titulo: 'x', descripcion: 'corto' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearReporteSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('la respuesta 400 debe incluir detalles de error', () => {
    const req = { body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearReporteSchema)(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details[0]).toHaveProperty('path');
    expect(payload.details[0]).toHaveProperty('message');
  });

  it('debe pasar con actualizacion vacía', () => {
    const req = { body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(actualizarReporteSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('debe llamar next(error) cuando el error no es ZodError [lines 71-72]', () => {
    const req = {
      get body() { throw new Error('Unexpected parse error'); },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearReporteSchema)(req, res, next);

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

    validate(crearReporteSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.details[0].path).toBe('unknown');
    expect(payload.details[0].message).toBe('Error de validación');
    expect(payload.details[0].code).toBe('invalid_type');
  });

  it('ZodError con issues vacías debe retornar detalle fallback', () => {
    const req = {
      get body() { throw new z.ZodError([]); },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearReporteSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.details[0].path).toBe('unknown');
    expect(payload.details[0].message).toBe('Error de validación desconocido');
  });
});
