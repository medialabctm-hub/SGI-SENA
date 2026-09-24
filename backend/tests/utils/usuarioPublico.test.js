/**
 * MDL-230 — unit tests for toPublicUser sanitizer
 */
import { describe, it, expect } from '@jest/globals';
import {
  toPublicUser,
  toPublicUserList,
  payloadContainsUserSecrets,
  CAMPOS_SECRETOS_USUARIO,
} from '../../src/utils/usuarioPublico.js';

const BCRYPT = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

describe('usuarioPublico (MDL-230)', () => {
  it('toPublicUser strips contrasena and token fields without mutating input', () => {
    const row = {
      id_usuario: 1,
      nombre_usuario: 'Ana',
      cedula: '123',
      contrasena: BCRYPT,
      password: 'x',
      refresh_token: 'rt',
      reset_token: 'rst',
      token_version: 3,
      nombre_rol: 'Instructor',
    };
    const pub = toPublicUser(row);
    expect(pub).not.toHaveProperty('contrasena');
    expect(pub).not.toHaveProperty('password');
    expect(pub).not.toHaveProperty('refresh_token');
    expect(pub).not.toHaveProperty('reset_token');
    expect(pub).not.toHaveProperty('token_version');
    expect(pub).toMatchObject({
      id_usuario: 1,
      nombre_usuario: 'Ana',
      cedula: '123',
      nombre_rol: 'Instructor',
    });
    expect(row.contrasena).toBe(BCRYPT);
  });

  it('toPublicUserList maps arrays', () => {
    const list = toPublicUserList([
      { id_usuario: 1, contrasena: BCRYPT },
      { id_usuario: 2, refresh_token: 'x' },
    ]);
    expect(list).toHaveLength(2);
    list.forEach((u) => {
      expect(u).not.toHaveProperty('contrasena');
      expect(u).not.toHaveProperty('refresh_token');
    });
  });

  it('toPublicUser is null-safe', () => {
    expect(toPublicUser(null)).toBeNull();
    expect(toPublicUser(undefined)).toBeUndefined();
  });

  it('payloadContainsUserSecrets detects field names and bcrypt strings', () => {
    expect(payloadContainsUserSecrets({ user: { contrasena: BCRYPT } })).toBe(true);
    expect(payloadContainsUserSecrets({ note: BCRYPT })).toBe(true);
    expect(payloadContainsUserSecrets({ id_usuario: 1, nombre_rol: 'Admin' })).toBe(false);
    for (const campo of CAMPOS_SECRETOS_USUARIO) {
      expect(payloadContainsUserSecrets({ [campo]: 'x' })).toBe(true);
    }
  });
});
