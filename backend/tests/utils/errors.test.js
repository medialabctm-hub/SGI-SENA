/**
 * Tests para utils/errors
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock(
  '../../src/utils/logger.js',
  () => ({
    logger: {
      error: jest.fn(),
    },
  }),
  { virtual: true }
);

// Jest ESM mocks must be registered before loading the module under test.
// eslint-disable-next-line import/first
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  errorHandler,
  translateDbError,
} from '../../src/utils/errors.js';

// ERR-02: los errores de la base de datos deben llegar al usuario como reglas de
// negocio comprensibles, no como fallos genéricos del servidor.
describe('translateDbError', () => {
  const fkError = (tabla) => ({
    code: 'ER_ROW_IS_REFERENCED_2',
    sqlMessage: `Cannot delete or update a parent row: a foreign key constraint fails (\`sgi\`.\`${tabla}\`, CONSTRAINT \`fk_1\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`Usuarios\` (\`id_usuario\`))`,
  });

  it('convierte una restriccion de clave foranea en 409 nombrando la entidad', () => {
    const traducido = translateDbError(fkError('Clases'));
    expect(traducido.statusCode).toBe(409);
    expect(traducido.message).toContain('clases');
    expect(traducido.message).not.toMatch(/foreign key|constraint/i);
  });

  // Al insertar, el dato que falta es el PADRE referenciado, no la tabla hija
  it('convierte una referencia inexistente en 400 nombrando la entidad que falta', () => {
    const traducido = translateDbError({
      code: 'ER_NO_REFERENCED_ROW_2',
      sqlMessage: 'Cannot add or update a child row: a foreign key constraint fails (`sgi`.`Elementos`, CONSTRAINT `fk_amb` FOREIGN KEY (`id_ambiente`) REFERENCES `Ambientes` (`id_ambiente`))',
    });
    expect(traducido.statusCode).toBe(400);
    expect(traducido.message).toContain('ambientes');
  });

  it('convierte un duplicado en 409', () => {
    expect(translateDbError({ code: 'ER_DUP_ENTRY', sqlMessage: 'Duplicate entry' }).statusCode).toBe(409);
  });

  it('nombra la columna en un valor demasiado largo', () => {
    const traducido = translateDbError({
      code: 'ER_DATA_TOO_LONG',
      sqlMessage: "Data too long for column 'nombre_usuario' at row 1",
    });
    expect(traducido.statusCode).toBe(400);
    expect(traducido.message).toContain('nombre_usuario');
  });

  it('nombra la columna en un campo obligatorio vacio', () => {
    const traducido = translateDbError({
      code: 'ER_BAD_NULL_ERROR',
      sqlMessage: "Column 'correo' cannot be null",
    });
    expect(traducido.statusCode).toBe(400);
    expect(traducido.message).toContain('correo');
  });

  it('convierte la indisponibilidad de la base de datos en 503', () => {
    expect(translateDbError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }).statusCode).toBe(503);
    expect(translateDbError({ code: 'ER_LOCK_WAIT_TIMEOUT', message: 'lock timeout' }).statusCode).toBe(503);
  });

  it('deja intacto un error desconocido para que siga siendo 500', () => {
    const original = new Error('fallo inesperado');
    expect(translateDbError(original)).toBe(original);
    const conCodigoDesconocido = { code: 'ER_ALGO_RARO', message: 'x' };
    expect(translateDbError(conCodigoDesconocido)).toBe(conCodigoDesconocido);
  });
});

describe('utils/errors', () => {
  it('debe crear AppError con statusCode y flags correctos', () => {
    const err = new AppError('mensaje', 418, false);
    expect(err.message).toBe('mensaje');
    expect(err.statusCode).toBe(418);
    expect(err.isOperational).toBe(false);
  });

  it('debe crear errores específicos con statusCode adecuado', () => {
    expect(new ValidationError('x').statusCode).toBe(400);
    expect(new AuthenticationError().statusCode).toBe(401);
    expect(new AuthorizationError().statusCode).toBe(403);
    expect(new NotFoundError('Recurso').statusCode).toBe(404);
    expect(new ConflictError().statusCode).toBe(409);
    expect(new DatabaseError().statusCode).toBe(500);
  });

  it('errorHandler debe mapear ZodError a ValidationError', () => {
    const zodError = {
      name: 'ZodError',
      message: 'zod',
      errors: [
        { path: ['campo'], message: 'invalido' },
      ],
    };

    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    errorHandler(zodError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Error de validación');
    expect(payload.details[0].path).toBe('campo');
  });

  it('errorHandler debe mapear JsonWebTokenError a AuthenticationError', () => {
    const jwtError = { name: 'JsonWebTokenError', message: 'bad token' };
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    errorHandler(jwtError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe('Token inválido');
  });

  it('errorHandler debe mapear ER_DUP_ENTRY a ConflictError', () => {
    const dbError = { code: 'ER_DUP_ENTRY', message: 'dup' };
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    errorHandler(dbError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe('Ya existe un registro con esos datos.');
    // Mensaje apto para mostrarse tal cual en la interfaz
    expect(payload.userMessage).toBe('Ya existe un registro con esos datos.');
  });

  it('errorHandler debe mapear TokenExpiredError a AuthenticationError', () => {
    const tokenErr = { name: 'TokenExpiredError', message: 'jwt expired' };
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    errorHandler(tokenErr, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe('Token expirado');
  });

  it('errorHandler debe incluir stack en entorno development', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = { message: 'test error', stack: 'stack trace here', name: 'Error' };
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.stack).toBe('stack trace here');
    process.env.NODE_ENV = original;
  });

  it('AppError debe usar statusCode=500 e isOperational=true por defecto', () => {
    const err = new AppError('default params');
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
  });

  it('NotFoundError debe usar "Recurso" por defecto', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Recurso no encontrado');
    expect(err.statusCode).toBe(404);
  });

  it('errorHandler debe manejar ZodError con err.errors undefined (rama false)', () => {
    const zodError = { name: 'ZodError', message: 'zod', errors: undefined };
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    errorHandler(zodError, req, res, jest.fn());
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe('Error de validación');
  });

  it('errorHandler debe manejar ZodError con path inválido (rama "unknown")', () => {
    const zodError = {
      name: 'ZodError',
      message: 'zod',
      errors: [{ path: null, message: undefined }],
    };
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    errorHandler(zodError, req, res, jest.fn());
    const payload = res.json.mock.calls[0][0];
    expect(payload.details[0].path).toBe('unknown');
    expect(payload.details[0].message).toBe('Error de validación');
  });

  it('errorHandler debe usar "Error en el servidor" cuando error.message está vacío [line 98]', () => {
    const err = new Error('');
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    errorHandler(err, req, res, jest.fn());
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe('Error en el servidor');
  });
});
