/**
 * Tests para validators/authValidator
 *
 * Cubre: loginSchema, registerSchema, updateUserSchema y el middleware validate()
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  loginSchema,
  registerSchema,
  updateUserSchema,
  validate,
} from '../../src/validators/authValidator.js';

// ──────────────────────────────────────────────
// Helper para simular req/res/next
// ──────────────────────────────────────────────
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
// loginSchema
// ──────────────────────────────────────────────
describe('loginSchema', () => {
  it('debe pasar con cédula y contraseña válidas', () => {
    const data = { cedula: '1234567890', contrasena: 'secreto' };
    expect(() => loginSchema.parse(data)).not.toThrow();
  });

  it('debe fallar si falta la cédula', () => {
    expect(() => loginSchema.parse({ contrasena: 'secreto' })).toThrow();
  });

  it('debe fallar si la cédula está vacía', () => {
    expect(() => loginSchema.parse({ cedula: '', contrasena: 'secreto' })).toThrow();
  });

  it('debe fallar si falta la contraseña', () => {
    expect(() => loginSchema.parse({ cedula: '1234567890' })).toThrow();
  });

  it('debe fallar si la contraseña está vacía', () => {
    expect(() =>
      loginSchema.parse({ cedula: '1234567890', contrasena: '' })
    ).toThrow();
  });
});

// ──────────────────────────────────────────────
// registerSchema
// ──────────────────────────────────────────────
describe('registerSchema', () => {
  const baseData = {
    nombre: 'Juan Carlos',
    cedula: '1234567890',
    correo: 'juan@sena.edu.co',
    telefono: '3001234567',
    contrasena: 'secreto123',
    rol: 'Aprendiz',
  };

  it('debe pasar con un Aprendiz con datos mínimos válidos', () => {
    expect(() => registerSchema.parse(baseData)).not.toThrow();
  });

  it('debe normalizar el correo a minúsculas', () => {
    const result = registerSchema.parse({ ...baseData, correo: 'JUAN@SENA.EDU.CO' });
    expect(result.correo).toBe('juan@sena.edu.co');
  });

  it('debe asignar "CC" por defecto a tipo_documento', () => {
    const result = registerSchema.parse(baseData);
    expect(result.tipo_documento).toBe('CC');
  });

  it('debe fallar si el nombre tiene menos de 2 caracteres', () => {
    expect(() =>
      registerSchema.parse({ ...baseData, nombre: 'A' })
    ).toThrow();
  });

  it('debe fallar si la cédula tiene menos de 5 caracteres', () => {
    expect(() =>
      registerSchema.parse({ ...baseData, cedula: '1234' })
    ).toThrow();
  });

  it('debe fallar si el correo no tiene formato válido', () => {
    expect(() =>
      registerSchema.parse({ ...baseData, correo: 'no-es-correo' })
    ).toThrow();
  });

  it('debe fallar si el teléfono tiene menos de 7 caracteres', () => {
    expect(() =>
      registerSchema.parse({ ...baseData, telefono: '123456' })
    ).toThrow();
  });

  it('debe fallar si la contraseña tiene menos de 6 caracteres', () => {
    expect(() =>
      registerSchema.parse({ ...baseData, contrasena: 'abc1' })
    ).toThrow();
  });

  it('debe fallar si el rol es inválido', () => {
    expect(() =>
      registerSchema.parse({ ...baseData, rol: 'Superhéroe' })
    ).toThrow();
  });

  it.each(['Instructor', 'Administrador', 'Cuentadante'])(
    'debe requerir código_invitacion para el rol %s',
    (rol) => {
      expect(() =>
        registerSchema.parse({ ...baseData, rol, codigo_invitacion: undefined })
      ).toThrow('código de invitación');
    }
  );

  it('debe pasar para Instructor con código de invitación', () => {
    expect(() =>
      registerSchema.parse({
        ...baseData,
        rol: 'Instructor',
        codigo_invitacion: 'INV-2024',
      })
    ).not.toThrow();
  });

  it('debe requerir tipo_documento_otro cuando tipo_documento es "Otro"', () => {
    expect(() =>
      registerSchema.parse({ ...baseData, tipo_documento: 'Otro' })
    ).toThrow('tipo de documento');
  });

  it('debe pasar cuando tipo_documento es "Otro" y tipo_documento_otro está dado', () => {
    expect(() =>
      registerSchema.parse({
        ...baseData,
        tipo_documento: 'Otro',
        tipo_documento_otro: 'Pasaporte',
      })
    ).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// updateUserSchema
// ──────────────────────────────────────────────
describe('updateUserSchema', () => {
  it('debe pasar con un objeto vacío (todos los campos son opcionales)', () => {
    expect(() => updateUserSchema.parse({})).not.toThrow();
  });

  it('debe aceptar actualizaciones parciales', () => {
    const result = updateUserSchema.parse({ nombre: 'María' });
    expect(result.nombre).toBe('María');
  });

  it('debe normalizar el correo a minúsculas', () => {
    const result = updateUserSchema.parse({ correo: 'TEST@SENA.EDU.CO' });
    expect(result.correo).toBe('test@sena.edu.co');
  });

  it('debe fallar si el correo tiene formato inválido', () => {
    expect(() => updateUserSchema.parse({ correo: 'no-valido' })).toThrow();
  });

  it('debe requerir tipo_documento_otro cuando tipo_documento es "Otro"', () => {
    expect(() =>
      updateUserSchema.parse({ tipo_documento: 'Otro' })
    ).toThrow();
  });

  it('debe aceptar tipo_documento válido', () => {
    expect(() =>
      updateUserSchema.parse({ tipo_documento: 'TI' })
    ).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// Middleware validate()
// ──────────────────────────────────────────────
describe('Middleware validate()', () => {
  describe('con loginSchema', () => {
    it('debe llamar next() y mutar req.body con datos válidos', () => {
      const { req, res, next } = makeReqRes({
        cedula: '1234567890',
        contrasena: 'miContrasena',
      });

      validate(loginSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith(); // sin argumentos = sin error
      expect(res.status).not.toHaveBeenCalled();
    });

    it('debe retornar 400 si la cédula falta', () => {
      const { req, res, next } = makeReqRes({ contrasena: 'miContrasena' });

      validate(loginSchema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Error de validación' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('la respuesta 400 debe incluir array de detalles con path y message', () => {
      const { req, res, next } = makeReqRes({});

      validate(loginSchema)(req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(Array.isArray(payload.details)).toBe(true);
      expect(payload.details.length).toBeGreaterThan(0);
      expect(payload.details[0]).toHaveProperty('path');
      expect(payload.details[0]).toHaveProperty('message');
    });
  });

  describe('con registerSchema', () => {
    it('debe llamar next() con datos de Aprendiz válidos', () => {
      const { req, res, next } = makeReqRes({
        nombre: 'Carlos',
        cedula: '9876543210',
        correo: 'carlos@sena.edu.co',
        telefono: '3109876543',
        contrasena: 'pass123',
        rol: 'Aprendiz',
      });

      validate(registerSchema)(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('debe retornar 400 si el rol es inválido', () => {
      const { req, res, next } = makeReqRes({
        nombre: 'Carlos',
        cedula: '9876543210',
        correo: 'carlos@sena.edu.co',
        telefono: '3109876543',
        contrasena: 'pass123',
        rol: 'Invalido',
      });

      validate(registerSchema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  it('debe llamar next(error) cuando el error no es ZodError', () => {
    const { req, res, next } = makeReqRes({});
    const schemaRaro = { parse: () => { throw new RangeError('Error inesperado'); } };

    validate(schemaRaro)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(RangeError));
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// errorMap de tipo_documento
// ──────────────────────────────────────────────
describe('registerSchema – errorMap de tipo_documento', () => {
  const baseData = {
    nombre: 'Ana',
    cedula: '12345678',
    correo: 'ana@sena.edu.co',
    telefono: '3001111111',
    contrasena: 'pass1234',
    rol: 'Aprendiz',
  };

  it('debe fallar cuando tipo_documento tiene un valor no permitido', () => {
    expect(() =>
      registerSchema.parse({ ...baseData, tipo_documento: 'INVALIDO' })
    ).toThrow();
  });

  it('debe fallar cuando rol tiene un valor no permitido', () => {
    expect(() =>
      registerSchema.parse({ ...baseData, rol: 'SuperAdmin' })
    ).toThrow();
  });
});
