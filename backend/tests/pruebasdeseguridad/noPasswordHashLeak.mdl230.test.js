/**
 * Negativas de seguridad — MDL-230
 * Ninguna respuesta de endpoints de usuario debe incluir hash ni tokens.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  toPublicUser,
  payloadContainsUserSecrets,
} from '../../src/utils/usuarioPublico.js';
import { AuthService } from '../../src/services/authService.js';

const BCRYPT = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUV';

function buildAuthService() {
  const baseUser = {
    id_usuario: 7,
    nombre_usuario: 'LeakTest',
    cedula: '1099000111',
    tipo_documento: 'CC',
    tipo_documento_otro: null,
    telefono: '300',
    correo: 'leak@test.local',
    contrasena: BCRYPT,
    id_rol: 2,
    estado: 'Activo',
    requiere_cambio_contrasena: 0,
    foto_perfil: null,
    fecha_registro: '2026-01-01',
    ultimo_acceso: null,
    creado_por: null,
    nombre_rol: 'Instructor',
    refresh_token: 'should-never-leak',
    reset_token: 'should-never-leak',
    token_version: 9,
  };

  const mockConnection = {
    execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
  };

  const userRepository = {
    findByCedula: jest.fn().mockResolvedValue({ ...baseUser }),
    findById: jest.fn().mockResolvedValue({ ...baseUser }),
    findAll: jest.fn().mockResolvedValue([{ ...baseUser }]),
    getAssignedEquipos: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    db: {
      execute: jest.fn().mockResolvedValue([[]]),
      pool: { getConnection: jest.fn().mockResolvedValue(mockConnection) },
    },
  };
  const roleRepository = { findByName: jest.fn() };
  const passwordService = {
    compare: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue(BCRYPT),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('jwt.token.here') };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

  const authService = new AuthService(
    userRepository,
    roleRepository,
    passwordService,
    jwtService,
    logger
  );
  return { authService, userRepository, baseUser };
}

function assertNoSecretLeak(payload, label) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(/\$2[aby]\$\d{2}\$/);
  expect(payloadContainsUserSecrets(payload)).toBe(false);
  expect(serialized).not.toMatch(/"contrasena"\s*:/);
  expect(serialized).not.toMatch(/"password(_hash)?"\s*:/i);
  expect(serialized).not.toMatch(
    /"(refresh_token|reset_token|token_version|access_token|session_token)"\s*:/
  );
  expect(label).toBeTruthy();
}

describe('MDL-230 no password/hash/token leak in user responses', () => {
  let authService;
  let userRepository;

  beforeEach(() => {
    ({ authService, userRepository } = buildAuthService());
  });

  it('getUserByCedula never returns contrasena/hash/tokens', async () => {
    const result = await authService.getUserByCedula('1099000111');
    assertNoSecretLeak(result, 'getUserByCedula');
    expect(result.id_usuario).toBe(7);
    expect(result).not.toHaveProperty('contrasena');
  });

  it('listUsers strips secrets even if repository returned them', async () => {
    const users = await authService.listUsers();
    assertNoSecretLeak(users, 'listUsers');
    expect(users[0]).not.toHaveProperty('contrasena');
  });

  it('getCurrentUser has no secrets', async () => {
    const me = await authService.getCurrentUser(7);
    assertNoSecretLeak(me, 'getCurrentUser');
  });

  it('getUserDetails.user has no secrets', async () => {
    const details = await authService.getUserDetails(7);
    assertNoSecretLeak(details, 'getUserDetails');
  });

  it('loginUser.user has no secrets', async () => {
    // Avoid aprendiz roster gate: nombre_rol Instructor
    const result = await authService.loginUser('1099000111', 'plain');
    assertNoSecretLeak(result.user, 'loginUser.user');
    expect(result.user).not.toHaveProperty('contrasena');
  });

  it('updateUserProfilePhoto.user has no secrets', async () => {
    userRepository.findById.mockResolvedValue({
      id_usuario: 7,
      nombre_usuario: 'LeakTest',
      foto_perfil: null,
      contrasena: BCRYPT,
      refresh_token: 'x',
    });
    const result = await authService.updateUserProfilePhoto(7, '/uploads/perfiles/x.jpg');
    assertNoSecretLeak(result, 'updateUserProfilePhoto');
  });

  it('shared toPublicUser guard strips secrets', () => {
    assertNoSecretLeak(
      toPublicUser({ id_usuario: 1, contrasena: BCRYPT, reset_token: 't' }),
      'toPublicUser'
    );
  });
});
