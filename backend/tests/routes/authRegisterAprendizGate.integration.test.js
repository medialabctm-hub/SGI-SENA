/**
 * MDL-202 / H-03 — forma HTTP exacta del rechazo / éxito de registro Aprendiz.
 * Jest + Supertest sobre app mínima (validator + AuthService + errorHandler).
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { REGISTER_APRENDIZ_DENIED_MESSAGE } from '../../src/utils/authRegisterGate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mockValidateCode = jest.fn();
const mockUseCode = jest.fn();

jest.unstable_mockModule(
  path.resolve(__dirname, '../../src/factories/ServiceFactory.js'),
  () => ({
    ServiceFactory: {
      create: jest.fn((name) => {
        if (name === 'invitationCodeService') {
          return { validateCode: mockValidateCode, useCode: mockUseCode };
        }
        throw new Error(`Unexpected service: ${name}`);
      }),
    },
  })
);

const { AuthService } = await import('../../src/services/authService.js');
const { registerSchema, validate } = await import('../../src/validators/authValidator.js');
const { errorHandler, ValidationError } = await import('../../src/utils/errors.js');

const mockUserRepository = {
  findByCedulaOrEmail: jest.fn(),
  findInactiveByCedulaOrEmail: jest.fn(),
  create: jest.fn(),
  db: { execute: jest.fn() },
};
const mockRoleRepository = { findByName: jest.fn() };
const mockPasswordService = { hash: jest.fn().mockResolvedValue('hashed') };
const mockJwtService = { sign: jest.fn() };
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function buildApp(authService) {
  const app = express();
  app.use(express.json());
  app.post('/api/auth/register', validate(registerSchema), async (req, res, next) => {
    try {
      const result = await authService.registerUser(req.body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  });
  app.use(errorHandler);
  return app;
}

const payload = {
  nombre: 'Carlos Aprendiz',
  cedula: '1122334455',
  tipo_documento: 'CC',
  correo: 'carlos.h03@sena.edu.co',
  telefono: '3009988776',
  contrasena: 'secreto1',
  rol: 'Aprendiz',
};

describe('POST /api/auth/register — gate Aprendiz H-03', () => {
  let authService;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPasswordService.hash.mockResolvedValue('hashed');
    mockValidateCode.mockResolvedValue({});
    mockUseCode.mockResolvedValue({ consumed: true });
    mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
    mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
    mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
    mockUserRepository.create.mockResolvedValue({ insertId: 1 });
    mockUserRepository.db.execute.mockResolvedValue([[]]);

    authService = new AuthService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordService,
      mockJwtService,
      mockLogger
    );
    app = buildApp(authService);
  });

  it('sin invite ni roster → 400 body genérico (success:false, error, userMessage)', async () => {
    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: REGISTER_APRENDIZ_DENIED_MESSAGE,
      userMessage: REGISTER_APRENDIZ_DENIED_MESSAGE,
    });
  });

  it('invite inválida → mismo 400 genérico (no filtra causa de invitación)', async () => {
    mockValidateCode.mockRejectedValue(new ValidationError('Código de invitación inválido o no encontrado'));

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, codigo_invitacion: 'NOPE' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(REGISTER_APRENDIZ_DENIED_MESSAGE);
    expect(res.body.userMessage).toBe(REGISTER_APRENDIZ_DENIED_MESSAGE);
    expect(JSON.stringify(res.body)).not.toMatch(/invitación inválido|no encontrado|Usuarios|Aprendices/i);
  });

  it('roster match → 201', async () => {
    mockUserRepository.db.execute.mockResolvedValue([[
      { id_aprendiz: 1, nombre: 'Carlos', documento: '1122334455', ficha: 'F-1' },
    ]]);

    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Usuario registrado correctamente' });
  });

  it('invite válida → 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, codigo_invitacion: 'INV-OK' });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('registrado');
    expect(mockValidateCode).toHaveBeenCalledWith('INV-OK', 'Aprendiz');
    expect(mockUseCode).toHaveBeenCalledWith('INV-OK');
  });

  it('Instructor sin código → 400 con mensaje específico (roles sin cambio)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, rol: 'Instructor' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Error de validación');
    expect(JSON.stringify(res.body.details)).toMatch(/código de invitación/i);
  });
});
