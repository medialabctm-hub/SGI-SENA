import { jest, describe, it, expect } from '@jest/globals';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockCreate = jest.fn();

jest.unstable_mockModule(resolve(__dirname, '../../src/factories/ServiceFactory.js'), () => ({
  ServiceFactory: { create: mockCreate },
}));

jest.unstable_mockModule(resolve(__dirname, '../../src/utils/logger.js'), () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const { authenticate } = await import(resolve(__dirname, '../../src/middleware/authMiddleware.js'));
const { AuthenticationError } = await import(resolve(__dirname, '../../src/utils/errors.js'));

function makeContext(h = null) {
  return {
    req: { headers: h ? { authorization: h } : {} },
    res: { status: jest.fn().mockReturnThis(), json: jest.fn() },
    next: jest.fn(),
  };
}

const mockUser = {
  id_usuario: 42,
  nombre_usuario: 'Juan Perez',
  cedula: '1234567890',
  correo: 'juan@sena.edu.co',
  id_rol: 2,
  nombre_rol: 'Instructor',
};

describe('authenticate()', () => {
  it('debe pasar next(AuthenticationError) si no se provee token', async () => {
    const { req, res, next } = makeContext();
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    expect(next.mock.calls[0][0].message).toMatch('Token no proporcionado');
  });

  it('debe pasar next(AuthenticationError) si el header no empieza con Bearer', async () => {
    const { req, res, next } = makeContext('Basic token123');
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  it('debe adjuntar req.user y llamar next() con token valido', async () => {
    const mockJwt = { verify: jest.fn().mockReturnValue({ id: 42 }) };
    const mockRepo = { findById: jest.fn().mockResolvedValue(mockUser) };
    mockCreate.mockImplementation((n) => n === 'jwtService' ? mockJwt : mockRepo);
    const { req, res, next } = makeContext('Bearer valid.token.here');
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({
      id: 42,
      nombre: 'Juan Perez',
      cedula: '1234567890',
      correo: 'juan@sena.edu.co',
      id_rol: 2,
      rol: 'Instructor',
    });
  });

  it('debe pasar next(AuthenticationError) si el usuario no existe en BD', async () => {
    const mockJwt = { verify: jest.fn().mockReturnValue({ id: 999 }) };
    const mockRepo = { findById: jest.fn().mockResolvedValue(null) };
    mockCreate.mockImplementation((n) => n === 'jwtService' ? mockJwt : mockRepo);
    const { req, res, next } = makeContext('Bearer valid.token');
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    expect(next.mock.calls[0][0].message).toMatch('Usuario no encontrado');
  });

  it('debe pasar next(AuthenticationError) si el token esta expirado', async () => {
    const mockJwt = { verify: jest.fn().mockImplementation(() => { throw new Error('Token expirado'); }) };
    mockCreate.mockReturnValue(mockJwt);
    const { req, res, next } = makeContext('Bearer expired.token');
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    expect(next.mock.calls[0][0].message).toMatch('Token expirado');
  });

  it('debe pasar next(AuthenticationError) si el token es invalido', async () => {
    const mockJwt = { verify: jest.fn().mockImplementation(() => { throw new Error('Token inv\u00e1lido'); }) };
    mockCreate.mockReturnValue(mockJwt);
    const { req, res, next } = makeContext('Bearer bad.token');
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  it('debe propagar errores inesperados al next()', async () => {
    const mockJwt = { verify: jest.fn().mockImplementation(() => { throw new Error('Error inesperado de red'); }) };
    mockCreate.mockReturnValue(mockJwt);
    const { req, res, next } = makeContext('Bearer some.token');
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('debe llamar next(err) si req.headers lanza una excepci\u00f3n (outer catch)', async () => {
    // Simular que acceder a req.headers.authorization lanza
    const req = {
      headers: {
        get authorization() { throw new Error('Headers error'); }
      }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});