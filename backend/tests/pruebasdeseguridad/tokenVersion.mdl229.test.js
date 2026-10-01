/**
 * MDL-229 — revocación de sesiones JWT con token_version (TV-01 … TV-07).
 *
 * JwtService, AuthService y el middleware authenticate son los reales; solo la
 * persistencia es un almacén en memoria que imita el comportamiento SQL
 * relevante (UPDATE ... token_version = token_version + 1). La migración y el
 * comportamiento sobre MySQL real se validan aparte (MDL-138 / MDL-233).
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockCreate = jest.fn();

jest.unstable_mockModule(resolve(__dirname, '../../src/factories/ServiceFactory.js'), () => ({
  ServiceFactory: { create: mockCreate },
}));

const { authenticate } = await import(resolve(__dirname, '../../src/middleware/authMiddleware.js'));
const { AuthService } = await import(resolve(__dirname, '../../src/services/authService.js'));
const { JwtService } = await import(resolve(__dirname, '../../src/services/JwtService.js'));
const { UserRepository } = await import(resolve(__dirname, '../../src/repositories/UserRepository.js'));
const { AuthenticationError } = await import(resolve(__dirname, '../../src/utils/errors.js'));
const { sessionMatchesUser } = await import(resolve(__dirname, '../../src/utils/sessionVersion.js'));

const SECRET = 'test-secret-mdl229';

function makeStore() {
  const rows = new Map();
  rows.set(7, {
    id_usuario: 7,
    nombre_usuario: 'Ana Instructora',
    cedula: '1010101010',
    correo: 'ana@sena.edu.co',
    telefono: '3000000000',
    contrasena: 'hash',
    id_rol: 2,
    nombre_rol: 'Instructor',
    estado: 'Activo',
    requiere_cambio_contrasena: 0,
    foto_perfil: null,
    token_version: 0,
  });

  const execute = jest.fn(async (sql, params = []) => {
    if (/UPDATE Usuarios[\s\S]*token_version = token_version \+ 1/.test(sql)) {
      const id = params[params.length - 1];
      const row = rows.get(id);
      if (!row) return [{ affectedRows: 0 }];
      row.token_version += 1;
      if (/contrasena = \?/.test(sql)) row.contrasena = params[0];
      return [{ affectedRows: 1 }];
    }
    throw new Error(`SQL no esperado en el almacén de prueba: ${sql}`);
  });

  const repo = {
    db: { execute },
    findById: jest.fn(async (id) => {
      const row = rows.get(id);
      return row && row.estado === 'Activo' ? { ...row } : null;
    }),
    findByCedula: jest.fn(async (cedula) => {
      const row = [...rows.values()].find((r) => r.cedula === cedula && r.estado === 'Activo');
      return row ? { ...row } : null;
    }),
    findOne: jest.fn(async (sql, params) => {
      const row = rows.get(params[0]);
      return row ? { ...row } : null;
    }),
    bumpTokenVersion: UserRepository.prototype.bumpTokenVersion,
    update: UserRepository.prototype.update,
  };
  // Los métodos prestados del repositorio real usan this.db.
  repo.bumpTokenVersion = repo.bumpTokenVersion.bind(repo);
  repo.update = repo.update.bind(repo);

  return { rows, repo, execute };
}

function makeReq(token) {
  return { headers: { authorization: `Bearer ${token}` }, cookies: {} };
}

async function runAuthenticate(token) {
  const req = makeReq(token);
  const next = jest.fn();
  await authenticate(req, {}, next);
  return { req, error: next.mock.calls[0]?.[0] };
}

describe('MDL-229 — token_version (TV-01..07)', () => {
  let store;
  let jwtService;
  let authService;
  let passwordService;
  let logger;

  beforeEach(() => {
    store = makeStore();
    jwtService = new JwtService(SECRET, '1d');
    passwordService = {
      compare: jest.fn().mockResolvedValue(true),
      hash: jest.fn().mockResolvedValue('nuevo-hash'),
    };
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    authService = new AuthService(store.repo, { findByName: jest.fn() }, passwordService, jwtService, logger);
    mockCreate.mockImplementation((name) => (name === 'jwtService' ? jwtService : store.repo));
  });

  const login = async () => (await authService.loginUser('1010101010', 'cualquiera')).token;

  it('TV-06: el login emite el claim con la versión vigente y la sesión funciona', async () => {
    store.rows.get(7).token_version = 4;
    const token = await login();
    expect(jwtService.decode(token).token_version).toBe(4);

    const { req, error } = await runAuthenticate(token);
    expect(error).toBeUndefined();
    expect(req.user.id).toBe(7);
  });

  it('TV-01: tras logout el JWT anterior recibe 401', async () => {
    const token = await login();
    expect((await runAuthenticate(token)).error).toBeUndefined();

    expect(await authService.revokeSession(token)).toEqual({ revoked: true });

    const { error } = await runAuthenticate(token);
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Sesión revocada');
  });

  it('TV-01/TV-06: tras logout, un login nuevo funciona con la versión nueva', async () => {
    const viejo = await login();
    await authService.revokeSession(viejo);

    const nuevo = await login();
    expect(jwtService.decode(nuevo).token_version).toBe(1);
    expect((await runAuthenticate(nuevo)).error).toBeUndefined();
    expect((await runAuthenticate(viejo)).error).toBeInstanceOf(AuthenticationError);
  });

  it('logout es idempotente: token ausente, inválido o ya revocado no falla ni vuelve a incrementar', async () => {
    expect(await authService.revokeSession(null)).toEqual({ revoked: false });
    expect(await authService.revokeSession('no.es.jwt')).toEqual({ revoked: false });

    const token = await login();
    await authService.revokeSession(token);
    expect(await authService.revokeSession(token)).toEqual({ revoked: false });
    expect(store.rows.get(7).token_version).toBe(1);
  });

  it('TV-02: el cambio de contraseña en A revoca la sesión B; A conserva la suya al reemitir', async () => {
    const sesionA = await login();
    const sesionB = await login();

    const result = await authService.cambiarContrasenaObligatorio(7, 'actual', 'Nueva123*Seg');
    expect(result.sessionRotated).toBe(true);
    expect(result).not.toHaveProperty('token');

    expect((await runAuthenticate(sesionA)).error).toBeInstanceOf(AuthenticationError);
    expect((await runAuthenticate(sesionB)).error).toBeInstanceOf(AuthenticationError);

    const reemitida = await authService.issueSessionToken(7);
    expect((await runAuthenticate(reemitida)).error).toBeUndefined();
  });

  it('TV-03: el reset exitoso incrementa token_version en la misma transacción y revoca el JWT previo', async () => {
    const previo = await login();

    const sqls = [];
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
      execute: jest.fn(async (sql, params) => {
        sqls.push(sql);
        if (/SET usado = 1[\s\S]*WHERE token = \?/.test(sql)) return [{ affectedRows: 1 }];
        if (/SELECT id_usuario FROM Tokens_Recuperacion_Contrasena/.test(sql)) return [[{ id_usuario: 7 }]];
        if (/UPDATE Usuarios/.test(sql)) return store.execute(sql, params);
        return [{ affectedRows: 0 }];
      }),
    };
    store.repo.db.pool = { getConnection: jest.fn().mockResolvedValue(connection) };

    await authService.restablecerContrasena('a'.repeat(64), 'Nueva123*Seg');

    expect(sqls.some((s) => /UPDATE Usuarios[\s\S]*token_version = token_version \+ 1/.test(s))).toBe(true);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect((await runAuthenticate(previo)).error).toBeInstanceOf(AuthenticationError);
  });

  it('TV-03: si el reset falla (token inválido) no se incrementa la versión', async () => {
    const previo = await login();
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
      execute: jest.fn().mockResolvedValue([{ affectedRows: 0 }]),
    };
    store.repo.db.pool = { getConnection: jest.fn().mockResolvedValue(connection) };

    await expect(authService.restablecerContrasena('b'.repeat(64), 'Nueva123*Seg')).rejects.toThrow();

    expect(store.rows.get(7).token_version).toBe(0);
    expect((await runAuthenticate(previo)).error).toBeUndefined();
  });

  it('TV-04: el cambio de rol (UserRepository.update con idRol) revoca el JWT previo', async () => {
    const previo = await login();

    await store.repo.update(7, { idRol: 1 });

    expect(store.execute.mock.calls.at(-1)[0]).toMatch(/token_version = token_version \+ 1/);
    expect((await runAuthenticate(previo)).error).toBeInstanceOf(AuthenticationError);
  });

  it.each([
    ['cédula', { cedula: '2020202020' }],
    ['correo', { correo: 'otro@sena.edu.co' }],
  ])('cambio de %s revoca el JWT previo', async (_label, cambio) => {
    const previo = await login();
    await store.repo.update(7, cambio);
    expect((await runAuthenticate(previo)).error).toBeInstanceOf(AuthenticationError);
  });

  it('un cambio sin identidad ni rol (nombre/teléfono) NO revoca sesiones', async () => {
    store.execute.mockImplementationOnce(async () => [{ affectedRows: 1 }]);
    await store.repo.update(7, { nombre: 'Ana María', telefono: '3111111111' });
    expect(store.execute.mock.calls[0][0]).not.toMatch(/token_version/);
  });

  it('TV-05: un usuario desactivado recibe 401 aunque su token siga vigente', async () => {
    const previo = await login();
    store.rows.get(7).estado = 'Inactivo';

    const { error } = await runAuthenticate(previo);
    expect(error).toBeInstanceOf(AuthenticationError);
  });

  it('fail-closed: un JWT firmado sin el claim token_version (emitido antes de MDL-229) recibe 401', async () => {
    const legado = jwtService.sign({ id: 7, rol: 2 });
    expect((await runAuthenticate(legado)).error).toBeInstanceOf(AuthenticationError);
  });

  it('fail-closed: un JWT con token_version adelantado o no entero no coincide', async () => {
    const adelantado = jwtService.sign({ id: 7, rol: 2, token_version: 99 });
    const texto = jwtService.sign({ id: 7, rol: 2, token_version: '0' });
    expect((await runAuthenticate(adelantado)).error).toBeInstanceOf(AuthenticationError);
    expect((await runAuthenticate(texto)).error).toBeInstanceOf(AuthenticationError);
  });

  it('sessionMatchesUser: fila de usuario sin la columna nunca coincide', () => {
    expect(sessionMatchesUser({ token_version: 0 }, { id_usuario: 7 })).toBe(false);
    expect(sessionMatchesUser({ token_version: 0 }, null)).toBe(false);
    expect(sessionMatchesUser({ token_version: 3 }, { token_version: 3 })).toBe(true);
    expect(sessionMatchesUser({ token_version: 3 }, { token_version: '3' })).toBe(true);
  });

  it('el JWT firmado por el servicio nunca se devuelve en el resultado de logout', async () => {
    const token = await login();
    const result = await authService.revokeSession(token);
    expect(JSON.stringify(result)).not.toContain(token);
  });
});
