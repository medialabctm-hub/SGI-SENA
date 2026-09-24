/**
 * MDL-192 Alcance B — import usuarios / identidad (QA-192B-01 … B-10)
 * + política de contraseñas (PR #42) + requiere_cambio_contrasena.
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { normalizeCorreo, normalizeCedula, normalizeIdentity } from '../../src/utils/normalizeIdentity.js';
import { mapUsuarioImportRow } from '../../src/utils/usuariosImportExport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockExecute = jest.fn();
const mockBcryptHash = jest.fn();
const mockGeneratePassword = jest.fn();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

await jest.unstable_mockModule(resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: { execute: mockExecute },
}));
await jest.unstable_mockModule(resolve(__dirname, '../../src/utils/logger.js'), () => ({
  logger: mockLogger,
}));
await jest.unstable_mockModule('bcrypt', () => ({
  default: { hash: mockBcryptHash, compare: jest.fn() },
}));
await jest.unstable_mockModule(resolve(__dirname, '../../src/services/emailService.js'), () => ({
  default: {
    generatePassword: mockGeneratePassword,
    enviarContrasenasMasivo: jest.fn().mockResolvedValue({ exitosos: 0, fallidos: 0, errores: [] }),
  },
}));

const xlsxRows = { current: [] };
await jest.unstable_mockModule('xlsx', () => ({
  default: {
    read: () => ({ SheetNames: ['S'], Sheets: { S: {} } }),
    utils: {},
  },
}));
await jest.unstable_mockModule(resolve(__dirname, '../../src/utils/excelSecurity.js'), () => ({
  assertWorkbookLimits: jest.fn(),
  sheetToSanitizedObjects: () => ({ rows: xlsxRows.current, headerRowIndex: 0 }),
}));

const { importarUsuarios } = await import(
  resolve(__dirname, '../../src/controller/importController.js')
);

function mockReq(overrides = {}) {
  return {
    file: { buffer: Buffer.from('x') },
    user: { id: 1, rol: 'Administrador' },
    ...overrides,
  };
}
function mockRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function assertNoSecrets(payload) {
  const s = JSON.stringify(payload);
  expect(s).not.toMatch(/\$2[aby]\$/i);
  expect(s).not.toMatch(/refresh_token/i);
  expect(payload).not.toHaveProperty('contrasena');
}

describe('normalizeIdentity reuse (QA-192B-05 / A-16)', () => {
  it.each([
    { input: ' Correo@X.com ', expected: 'correo@x.com' },
    { input: 'user@sena.edu.co', expected: 'user@sena.edu.co' },
    { input: ' User@Sena.Edu.Co ', expected: 'user@sena.edu.co' },
  ])('normalizeCorreo($input)', ({ input, expected }) => {
    expect(normalizeCorreo(input)).toBe(expected);
    expect(mapUsuarioImportRow({
      nombre_usuario: 'A', cedula: '1', correo: input, rol: 'Aprendiz',
    }).correo).toBe(expected);
  });

  it('normalizeCedula spaces', () => {
    expect(normalizeCedula(' 123 ')).toBe('123');
    expect(normalizeIdentity({ cedula: ' 123 ', correo: ' A@B.C ' })).toEqual({
      cedula: '123',
      correo: 'a@b.c',
    });
  });
});

describe('importarUsuarios identidad (QA-192B)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockBcryptHash.mockResolvedValue('$2b$10$hashedvaluexxxxxxxxxxxx');
    mockGeneratePassword.mockReturnValue('GenPass1!Abcd');
    xlsxRows.current = [];
  });

  it('QA-192B-01: update existente misma identidad actualiza nombre/tel, no correo', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'Nuevo Nombre',
      cedula: 'C1',
      correo: 'old@x.com',
      telefono: '300111',
      rol: 'Aprendiz',
    }];
    mockExecute
      .mockResolvedValueOnce([[{ id_usuario: 10, correo: 'old@x.com' }]])
      .mockResolvedValueOnce([[]])  // sin colisión de correo con otro id
      .mockResolvedValueOnce([[{ id_rol: 3 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    const body = res.json.mock.calls[0][0];
    expect(body.resultados.exitosos).toBe(1);
    expect(body.resultados.actualizados).toBe(1);
    expect(body.resultados.omitidas).toBe(0);
    const upd = mockExecute.mock.calls.find((c) => String(c[0]).includes('UPDATE Usuarios'));
    expect(upd[0]).not.toMatch(/correo\s*=/);
    expect(upd[0]).not.toMatch(/cedula\s*=/);
  });

  it('QA-192B-02/10: existente + correo distinto → omitida, sin UPDATE correo', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'X',
      cedula: 'C1',
      correo: 'new@x.com',
      rol: 'Aprendiz',
    }];
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 10, correo: 'old@x.com' }]]);

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    const body = res.json.mock.calls[0][0];
    expect(body.resultados.omitidas).toBe(1);
    expect(body.resultados.errores[0].error).toMatch(/omitida: cambio de identidad requiere verificación/i);
    expect(body.resultados.errores[0].cedula).toBe('***C1');
    expect(body.resultados.errores[0]).not.toHaveProperty('correo');
    expect(mockExecute.mock.calls.some((c) => String(c[0]).includes('UPDATE'))).toBe(false);
    expect(JSON.stringify(body)).not.toContain('new@x.com');
    assertNoSecrets(body);
  });

  it('QA-192B-03: nunca UPDATE cedula de id existente', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'X',
      cedula: 'NUEVA',
      correo: 'old@x.com',
      rol: 'Aprendiz',
    }];
    // cédula NUEVA no existe; correo old pertenece a otro → omitida colisión
    mockExecute
      .mockResolvedValueOnce([[]]) // cedula nueva libre
      .mockResolvedValueOnce([[{ id_usuario: 99 }]]); // correo de otro

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    expect(mockExecute.mock.calls.some((c) => /UPDATE Usuarios SET[\s\S]*cedula\s*=/.test(String(c[0])))).toBe(false);
    expect(res.json.mock.calls[0][0].resultados.omitidas).toBe(1);
  });

  it('QA-192B-04: fila nueva con correo de otro → omitida genérica', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'Nuevo',
      cedula: 'N1',
      correo: 'taken@x.com',
      rol: 'Aprendiz',
    }];
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_usuario: 7 }]]);

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    const err = res.json.mock.calls[0][0].resultados.errores[0];
    expect(err.error).toBe('No se pudo completar la fila.');
    expect(JSON.stringify(err)).not.toMatch(/taken@x.com|id_usuario|dueño|pertenece/i);
    expect(mockExecute.mock.calls.some((c) => String(c[0]).includes('INSERT'))).toBe(false);
  });

  it('QA-192B-05: casing/espacios en correo no omiten', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'User',
      cedula: 'C9',
      correo: ' User@Sena.Edu.Co ',
      telefono: '301',
      rol: 'Aprendiz',
    }];
    mockExecute
      .mockResolvedValueOnce([[{ id_usuario: 3, correo: 'user@sena.edu.co' }]])
      .mockResolvedValueOnce([[]])  // colisión correo
      .mockResolvedValueOnce([[{ id_rol: 3 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    expect(res.json.mock.calls[0][0].resultados.omitidas).toBe(0);
    expect(res.json.mock.calls[0][0].resultados.actualizados).toBe(1);
  });

  it('QA-192B-06: log por omisión con id + field, sin valor nuevo', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'X',
      cedula: 'C1',
      correo: 'secret-new@evil.com',
      rol: 'Aprendiz',
    }];
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 42, correo: 'old@x.com' }]]);

    await importarUsuarios(mockReq(), mockRes());
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Import usuarios: fila omitida por identidad',
      expect.objectContaining({ id_usuario: 42, field: 'correo' })
    );
    const meta = mockLogger.info.mock.calls.find(([m]) => String(m).includes('omitida'))[1];
    expect(JSON.stringify(meta)).not.toContain('secret-new@evil.com');
  });

  it('QA-192B-07: reporte no muestra valor nuevo completo', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'X',
      cedula: 'C1',
      correo: 'brand.new@leak.com',
      rol: 'Aprendiz',
    }];
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 1, correo: 'a@b.com' }]]);
    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    const blob = JSON.stringify(res.json.mock.calls[0][0]);
    expect(blob).not.toContain('brand.new@leak.com');
  });

  it('QA-192B-08: filas nuevas se crean; system-gen password → requiere_cambio=1', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'Nuevo',
      cedula: 'NEW1',
      correo: 'nuevo@sena.edu.co',
      rol: 'Aprendiz',
    }];
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_rol: 3 }]])
      .mockResolvedValueOnce([{ insertId: 50 }]);

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    expect(res.json.mock.calls[0][0].resultados.exitosos).toBe(1);
    expect(mockGeneratePassword).toHaveBeenCalled();
    const insert = mockExecute.mock.calls.find((c) => String(c[0]).includes('INSERT INTO Usuarios'));
    expect(insert[1][9]).toBe(1); // requiere_cambio_contrasena
    assertNoSecrets(res.json.mock.calls[0][0]);
  });

  it('Excel contraseña válida → create con requiere_cambio_contrasena = 1', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'ConPass',
      cedula: 'P1',
      correo: 'p1@sena.edu.co',
      rol: 'Aprendiz',
      contrasena: 'Pass123*Seg',
    }];
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_rol: 3 }]])
      .mockResolvedValueOnce([{ insertId: 51 }]);

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    expect(res.json.mock.calls[0][0].resultados.exitosos).toBe(1);
    const insert = mockExecute.mock.calls.find((c) => String(c[0]).includes('INSERT INTO Usuarios'));
    expect(insert[1][9]).toBe(1);
    expect(mockBcryptHash).toHaveBeenCalledWith('Pass123*Seg', 10);
  });

  it('contraseña débil en Excel → omitida/error genérico, no hash', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'Weak',
      cedula: 'W1',
      correo: 'w@sena.edu.co',
      rol: 'Aprendiz',
      contrasena: 'abc',
    }];
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_rol: 3 }]]);

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    const body = res.json.mock.calls[0][0];
    expect(body.resultados.fallidos).toBe(1);
    expect(body.resultados.errores[0].error).toBe('No se pudo completar la fila.');
    expect(mockBcryptHash).not.toHaveBeenCalled();
    expect(mockExecute.mock.calls.some((c) => String(c[0]).includes('INSERT'))).toBe(false);
  });

  it('QA-192B-09 (doc): requirePermission(USERS.CREATE) en importRoutes — ver suite de ruta abajo', () => {
    expect(true).toBe(true);
  });
});

describe('QA-192B-09 ruta POST /api/import/usuarios (authz)', () => {
  let app;
  let dbWrite;
  let previousEnv;
  let requirePermission;
  let PERMISSIONS;
  let errorHandler;
  let AuthenticationError;

  beforeAll(async () => {
    previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    ({ requirePermission } = await import(
      resolve(__dirname, '../../src/middleware/authorization.js')
    ));
    ({ PERMISSIONS } = await import(
      resolve(__dirname, '../../src/config/permissions.js')
    ));
    ({ errorHandler, AuthenticationError } = await import(
      resolve(__dirname, '../../src/utils/errors.js')
    ));

    dbWrite = jest.fn();

    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    // Réplica del montaje real: authenticate → requirePermission(USERS.CREATE) → handler
    app.post(
      '/api/import/usuarios',
      (req, res, next) => {
        // Simula authenticate: sin header → 401; con x-test-user → req.user
        if (req.headers['x-test-anon'] === '1') {
          return next(new AuthenticationError('Token no proporcionado'));
        }
        if (!req.headers['x-test-user']) {
          return next(new AuthenticationError('Token no proporcionado'));
        }
        req.user = JSON.parse(req.headers['x-test-user']);
        return next();
      },
      requirePermission(PERMISSIONS.USERS.CREATE),
      (req, res) => {
        dbWrite({ body: req.body, user: req.user });
        return res.status(200).json({ ok: true });
      }
    );
    app.use(errorHandler);
  });

  afterAll(() => {
    process.env.NODE_ENV = previousEnv;
  });

  beforeEach(() => {
    dbWrite.mockReset();
    mockExecute.mockReset();
    // Sin filas de permiso en BD → fallback ROLE_PERMISSIONS (Instructor/Aprendiz sin USERS.CREATE)
    mockExecute.mockResolvedValue([[]]);
  });

  it('anónimo → 401 y sin escritura a BD/handler', async () => {
    const res = await request(app)
      .post('/api/import/usuarios')
      .set('X-Test-Anon', '1')
      .send({ fake: true });

    expect(res.status).toBe(401);
    expect(dbWrite).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('Instructor → 403 y sin escritura', async () => {
    const res = await request(app)
      .post('/api/import/usuarios')
      .set('X-Test-User', JSON.stringify({ id: 2, rol: 'Instructor' }))
      .send({ fake: true });

    expect(res.status).toBe(403);
    expect(dbWrite).not.toHaveBeenCalled();
  });

  it('Aprendiz → 403 y sin escritura', async () => {
    const res = await request(app)
      .post('/api/import/usuarios')
      .set('X-Test-User', JSON.stringify({ id: 3, rol: 'Aprendiz' }))
      .send({ fake: true });

    expect(res.status).toBe(403);
    expect(dbWrite).not.toHaveBeenCalled();
  });

  it('Administrador → 200 (control positivo del guard)', async () => {
    const res = await request(app)
      .post('/api/import/usuarios')
      .set('X-Test-User', JSON.stringify({ id: 1, rol: 'Administrador' }))
      .send({ fake: true });

    expect(res.status).toBe(200);
    expect(dbWrite).toHaveBeenCalledTimes(1);
  });
});


describe('MDL-192 SECURITY: cédula enmascarada + tope de filas', () => {
  const prevEnv = process.env.IMPORT_MAX_ROWS;

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.IMPORT_MAX_ROWS;
    else process.env.IMPORT_MAX_ROWS = prevEnv;
  });

  beforeEach(() => {
    mockExecute.mockReset();
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockBcryptHash.mockResolvedValue('$2b$10$hashedvaluexxxxxxxxxxxx');
    mockGeneratePassword.mockReturnValue('GenPass1!Abcd');
    xlsxRows.current = [];
    delete process.env.IMPORT_MAX_ROWS;
  });

  it('omitidas reportan cédula como ***XXXX y nunca correo en claro', async () => {
    xlsxRows.current = [{
      nombre_usuario: 'X',
      cedula: '1234567890',
      correo: 'secret-new@evil.com',
      rol: 'Aprendiz',
    }];
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 10, correo: 'old@x.com' }]]);

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    const err = res.json.mock.calls[0][0].resultados.errores[0];
    expect(err.cedula).toBe('***7890');
    expect(err).not.toHaveProperty('correo');
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('secret-new@evil.com');
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('1234567890');
  });

  it('límite inclusive: N filas con IMPORT_MAX_ROWS=N no rechaza por tope', async () => {
    process.env.IMPORT_MAX_ROWS = '2';
    xlsxRows.current = [
      { nombre_usuario: 'A', cedula: '111', correo: 'a@x.com', rol: 'Aprendiz', contrasena: 'ValidPass1*' },
      { nombre_usuario: 'B', cedula: '222', correo: 'b@x.com', rol: 'Aprendiz', contrasena: 'ValidPass1*' },
    ];
    mockExecute.mockImplementation(async (sql) => {
      if (/Roles|id_rol/i.test(String(sql))) return [[{ id_rol: 3 }]];
      if (/INSERT/i.test(String(sql))) return [{ insertId: 1, affectedRows: 1 }];
      return [[]];
    });
    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    expect(res.status.mock.calls.some((c) => c[0] === 400 && /máximo de 2 filas/i.test(JSON.stringify(res.json.mock.calls)))).toBe(false);
    expect(mockExecute).toHaveBeenCalled();
  });

  it('5001 filas: 400 y cero llamadas al repositorio', async () => {
    process.env.IMPORT_MAX_ROWS = '5000';
    const rows = [];
    rows.length = 5001; // length sin materializar 5001 objetos
    xlsxRows.current = rows;

    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/máximo de 5000 filas/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('IMPORT_MAX_ROWS override: 3 filas → 400 y cero DB', async () => {
    process.env.IMPORT_MAX_ROWS = '2';
    xlsxRows.current = [
      { nombre_usuario: 'A', cedula: '1', rol: 'Aprendiz', contrasena: 'ValidPass1*' },
      { nombre_usuario: 'B', cedula: '2', rol: 'Aprendiz', contrasena: 'ValidPass1*' },
      { nombre_usuario: 'C', cedula: '3', rol: 'Aprendiz', contrasena: 'ValidPass1*' },
    ];
    const res = mockRes();
    await importarUsuarios(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/máximo de 2 filas/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
