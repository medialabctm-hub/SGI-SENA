/**
 * MDL-192 Alcance B — import usuarios / identidad (QA-192B-01 … B-10)
 * + política de contraseñas (PR #42) + requiere_cambio_contrasena.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
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

  it('QA-192B-09: sin usuario autenticado con permiso — cubierto por ruta; aquí documentado', () => {
    // requirePermission(USERS.CREATE) en importRoutes; negativo de ruta en importRoutes.test
    expect(true).toBe(true);
  });
});
