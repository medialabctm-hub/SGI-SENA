import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockExecute = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: { execute: mockExecute },
  pool: { execute: mockExecute }
}));

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/logger.js'), () => ({
  logger: mockLogger
}));

// Mock XLSX
const mockSheetToJson = jest.fn();
const mockRead = jest.fn();
jest.unstable_mockModule('xlsx', () => ({
  default: {
    read: mockRead,
    utils: { sheet_to_json: mockSheetToJson }
  },
  read: mockRead,
  utils: { sheet_to_json: mockSheetToJson }
}));

// Mock bcrypt
const mockBcryptHash = jest.fn().mockResolvedValue('$2b$10$hashedpassword');
jest.unstable_mockModule('bcrypt', () => ({
  default: { hash: mockBcryptHash, compare: jest.fn() },
  hash: mockBcryptHash,
  compare: jest.fn()
}));

// Mock emailService
const mockGeneratePassword = jest.fn().mockReturnValue('TempPass123!');
const mockEnviarContrasenasMasivo = jest.fn().mockResolvedValue({ exitosos: 1, fallidos: 0, errores: [] });
jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/emailService.js'), () => ({
  default: {
    generatePassword: mockGeneratePassword,
    enviarContrasenasMasivo: mockEnviarContrasenasMasivo
  }
}));

// Mock aprendicesController
const mockEnsureAprendicesTable = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule(path.resolve(__dirname, '../../src/controller/aprendicesController.js'), () => ({
  ensureAprendicesTable: mockEnsureAprendicesTable,
  listarAprendices: jest.fn(),
  crearAprendiz: jest.fn(),
  actualizarAprendiz: jest.fn(),
  eliminarAprendiz: jest.fn()
}));

// ── Dynamic import ─────────────────────────────────────────────────────────
const {
  importarEquipos,
  obtenerDuplicadosPendientes,
  procesarDuplicado,
  procesarDuplicadosMasivo,
  importarUsuarios,
  importarAprendices
} = await import(path.resolve(__dirname, '../../src/controller/importController.js'));

// ── Helpers ────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1, rol: 'Administrador' },
    file: null,
    ...overrides
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// Helper: create a fake xlsx workbook mock
function fakeWorkbook(data = []) {
  const worksheet = { fakeSheet: true };
  mockRead.mockReturnValueOnce({
    SheetNames: ['Sheet1'],
    Sheets: { Sheet1: worksheet }
  });
  mockSheetToJson.mockReturnValueOnce(data);
}

// ── importarEquipos ────────────────────────────────────────────────────────

describe('importarEquipos', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    mockBcryptHash.mockResolvedValue('$2b$10$hash');
    mockGeneratePassword.mockReturnValue('TempPass123!');
  });

  it('returns 400 when no file provided', async () => {
    const req = mockReq({ file: null });
    const res = mockRes();
    await importarEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 400 when file buffer is empty', async () => {
    const req = mockReq({ file: { buffer: Buffer.alloc(0) } });
    const res = mockRes();
    await importarEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Archivo inválido' }));
  });

  it('returns 400 when XLSX.read throws (invalid format)', async () => {
    mockRead.mockImplementationOnce(() => { throw new Error('Invalid file'); });
    const req = mockReq({ file: { buffer: Buffer.from('not excel') } });
    const res = mockRes();
    await importarEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Formato de archivo inválido' }));
  });

  it('returns 400 when workbook has no sheets', async () => {
    mockRead.mockReturnValueOnce({ SheetNames: [], Sheets: {} });
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Archivo Excel sin hojas' }));
  });

  it('returns 400 when excel data is empty', async () => {
    fakeWorkbook([]); // empty data
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'El archivo Excel está vacío' }));
  });

  it('returns 400 when cuentadante not provided for Admin', async () => {
    fakeWorkbook([{ placa: 'A001', tipo: 'PC', modelo: 'Dell', consecutivo: '001' }]);
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 0 }]])  // tabla duplicados check
      .mockResolvedValueOnce([[undefined]])    // rol del usuario (no es Cuentadante)
    ;
    const req = mockReq({ file: { buffer: Buffer.from('data') }, body: {} });
    const res = mockRes();
    await importarEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('uentadante') }));
  });

  it('returns 400 when provided cuentadante id is invalid', async () => {
    fakeWorkbook([{ placa: 'A001' }]);
    mockExecute.mockResolvedValueOnce([[undefined]]); // cuentadante not found
    const req = mockReq({
      file: { buffer: Buffer.from('data') },
      body: { id_cuentadante: '999' }
    });
    const res = mockRes();
    await importarEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Cuentadante inválido' }));
  });

  it('returns 500 on DB error', async () => {
    fakeWorkbook([{ placa: 'A001' }]);
    mockExecute.mockRejectedValueOnce(new Error('DB crash'));
    const req = mockReq({
      file: { buffer: Buffer.from('data') },
      body: { id_cuentadante: '2' }
    });
    const res = mockRes();
    await importarEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('handles rows with missing placa (skips with error)', async () => {
    fakeWorkbook([{ tipo: 'PC', modelo: 'Dell', consecutivo: '001' }]);
    mockExecute
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_rol: 'Cuentadante', nombre_usuario: 'CuentaUser' }]]) // cuentadante válido
      .mockResolvedValueOnce([[{ cnt: 0 }]]);  // inicializar tabla duplicados
    const req = mockReq({
      file: { buffer: Buffer.from('data') },
      body: { id_cuentadante: '2' }
    });
    const res = mockRes();
    await importarEquipos(req, res);
    // Should return result with fallidos > 0
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: expect.anything() }));
  });
});

// ── obtenerDuplicadosPendientes ────────────────────────────────────────────

describe('obtenerDuplicadosPendientes', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 403 for Instructor', async () => {
    const req = mockReq({ user: { id: 2, rol: 'Instructor' }, query: {} });
    const res = mockRes();
    await obtenerDuplicadosPendientes(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns duplicados for Admin', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 1 }]])  // tabla ya existe
      .mockResolvedValueOnce([[{
        id_duplicado: 1,
        id_importacion: 'import_1',
        fila_excel: 2,
        placa: 'A001',
        datos_excel: JSON.stringify({ placa: 'A001' }),
        datos_bd: JSON.stringify({ placa: 'A001', tipo: 'PC' }),
        estado: 'Pendiente'
      }]]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await obtenerDuplicadosPendientes(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, duplicados: expect.any(Array) }));
  });

  it('filters by id_importacion when provided', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 1 }]])  // tabla ya existe
      .mockResolvedValueOnce([[{
        id_duplicado: 1,
        datos_excel: '{"placa":"A"}',
        datos_bd: '{"placa":"A"}'
      }]]);
    const req = mockReq({ query: { id_importacion: 'import_123' } });
    const res = mockRes();
    await obtenerDuplicadosPendientes(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB crash'));
    const req = mockReq({ query: {} });
    const res = mockRes();
    await obtenerDuplicadosPendientes(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── procesarDuplicado ──────────────────────────────────────────────────────

describe('procesarDuplicado', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 403 for Instructor', async () => {
    const req = mockReq({ user: { id: 2, rol: 'Instructor' }, body: {} });
    const res = mockRes();
    await procesarDuplicado(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when id_duplicado or accion missing', async () => {
    mockExecute.mockResolvedValueOnce([[{ cnt: 1 }]]); // tabla exists
    const req = mockReq({ body: {} });
    const res = mockRes();
    await procesarDuplicado(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('id_duplicado') }));
  });

  it('returns 400 for invalid accion', async () => {
    mockExecute.mockResolvedValueOnce([[{ cnt: 1 }]]); // tabla exists
    const req = mockReq({ body: { id_duplicado: 1, accion: 'ignorar' } });
    const res = mockRes();
    await procesarDuplicado(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('accion') }));
  });

  it('returns 404 when duplicado not found', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 1 }]])  // tabla exists
      .mockResolvedValueOnce([[]])             // no duplicado found
    ;
    const req = mockReq({ body: { id_duplicado: 99, accion: 'aprobar' } });
    const res = mockRes();
    await procesarDuplicado(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects a duplicado successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 1 }]])     // tabla exists
      .mockResolvedValueOnce([[{                 // duplicado found
        id_duplicado: 1,
        datos_excel: JSON.stringify({ placa: 'A' }),
        datos_bd: JSON.stringify({ placa: 'A' })
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE rechazar
    const req = mockReq({ body: { id_duplicado: 1, accion: 'rechazar' } });
    const res = mockRes();
    await procesarDuplicado(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, accion: 'rechazar' }));
  });

  it('approves a duplicado when user is Cuentadante', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 1 }]])     // tabla exists
      .mockResolvedValueOnce([[{                 // duplicado found
        id_duplicado: 1,
        datos_excel: JSON.stringify({ placa: 'A', categoria_id: 1, ambiente_id: 2, tipo: 'PC', modelo: 'Dell' }),
        datos_bd: JSON.stringify({ placa: 'A' })
      }]])
      .mockResolvedValueOnce([[{ nombre_rol: 'Cuentadante' }]]) // user rol
      .mockResolvedValueOnce([[{ nombre_usuario: 'Cuentadante Tres' }]]) // SELECT nombre_usuario (cuentadante_principal)
      .mockResolvedValueOnce([{ insertId: 10 }])                // INSERT
      .mockResolvedValueOnce([{ affectedRows: 1 }]);            // UPDATE Aprobado
    const req = mockReq({
      user: { id: 3, rol: 'Cuentadante' },
      body: { id_duplicado: 1, accion: 'aprobar' }
    });
    const res = mockRes();
    await procesarDuplicado(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, accion: 'aprobar' }));
  });

  it('returns 400 when Admin approves without providing id_cuentadante', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 1 }]])     // tabla exists
      .mockResolvedValueOnce([[{
        id_duplicado: 1,
        datos_excel: JSON.stringify({ placa: 'A' }),
        datos_bd: JSON.stringify({ placa: 'A' })
      }]])
      .mockResolvedValueOnce([[{ nombre_rol: 'Administrador' }]]); // user rol (not cuentadante)
    const req = mockReq({ body: { id_duplicado: 1, accion: 'aprobar' } });
    const res = mockRes();
    await procesarDuplicado(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Cuentadante obligatorio' }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB crash'));
    const req = mockReq({ body: { id_duplicado: 1, accion: 'rechazar' } });
    const res = mockRes();
    await procesarDuplicado(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── procesarDuplicadosMasivo ───────────────────────────────────────────────

describe('procesarDuplicadosMasivo', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 403 for Instructor', async () => {
    const req = mockReq({ user: { id: 2, rol: 'Instructor' }, body: {} });
    const res = mockRes();
    await procesarDuplicadosMasivo(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when decisiones is not an array', async () => {
    mockExecute.mockResolvedValueOnce([[{ cnt: 1 }]]); // tabla exists
    const req = mockReq({ body: { decisiones: null } });
    const res = mockRes();
    await procesarDuplicadosMasivo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when decisiones is empty array', async () => {
    mockExecute.mockResolvedValueOnce([[{ cnt: 1 }]]); // tabla exists
    const req = mockReq({ body: { decisiones: [] } });
    const res = mockRes();
    await procesarDuplicadosMasivo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('processes decisions for Cuentadante user', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 1 }]])     // tabla exists
      .mockResolvedValueOnce([[{ nombre_rol: 'Cuentadante' }]]) // user rol
      .mockResolvedValueOnce([[{                 // duplicado found for decision 1
        id_duplicado: 1,
        datos_excel: JSON.stringify({ placa: 'A' }),
        datos_bd: JSON.stringify({ placa: 'A' })
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE rechazar
    const req = mockReq({
      user: { id: 3, rol: 'Cuentadante' },
      body: { decisiones: [{ id_duplicado: 1, accion: 'rechazar' }] }
    });
    const res = mockRes();
    await procesarDuplicadosMasivo(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 400 when Admin does not provide id_cuentadante', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 1 }]])     // tabla exists
      .mockResolvedValueOnce([[{ nombre_rol: 'Administrador' }]]); // user rol
    const req = mockReq({ body: { decisiones: [{ id_duplicado: 1, accion: 'aprobar' }] } });
    const res = mockRes();
    await procesarDuplicadosMasivo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Cuentadante obligatorio' }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB crash'));
    const req = mockReq({ body: { decisiones: [{ id_duplicado: 1, accion: 'rechazar' }] } });
    const res = mockRes();
    await procesarDuplicadosMasivo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── importarUsuarios ───────────────────────────────────────────────────────

describe('importarUsuarios', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    mockBcryptHash.mockResolvedValue('$2b$10$hash');
    mockGeneratePassword.mockReturnValue('TempPass123!');
  });

  it('returns 400 when no file provided', async () => {
    const req = mockReq({ file: null });
    const res = mockRes();
    await importarUsuarios(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'No se proporcionó ningún archivo' }));
  });

  it('returns 400 when excel is empty', async () => {
    fakeWorkbook([]);
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarUsuarios(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'El archivo Excel está vacío' }));
  });

  it('skips rows with missing nombre or cedula', async () => {
    fakeWorkbook([{ rol: 'Aprendiz' }]); // no nombre, no cedula
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarUsuarios(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ fallidos: 1, exitosos: 0 })
    }));
  });

  it('skips rows with duplicate cedula', async () => {
    fakeWorkbook([{ nombre_usuario: 'Juan', cedula: '12345', rol: 'Aprendiz' }]);
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 5 }]]); // cedula ya existe
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarUsuarios(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ fallidos: 1 })
    }));
  });

  it('skips rows with duplicate correo', async () => {
    fakeWorkbook([{ nombre_usuario: 'Juan', cedula: '12345', correo: 'juan@test.com', rol: 'Aprendiz' }]);
    mockExecute
      .mockResolvedValueOnce([[undefined]])              // cedula no existe
      .mockResolvedValueOnce([[{ id_usuario: 7 }]]);    // correo ya existe
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarUsuarios(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ fallidos: 1 })
    }));
  });

  it('skips rows with invalid rol', async () => {
    fakeWorkbook([{ nombre_usuario: 'Juan', cedula: '12345', rol: 'SuperAdmin' }]);
    mockExecute
      .mockResolvedValueOnce([[undefined]])    // cedula no existe
      .mockResolvedValueOnce([[undefined]]);   // rol no encontrado
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarUsuarios(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ fallidos: 1 })
    }));
  });

  it('imports a user successfully', async () => {
    fakeWorkbook([{ nombre_usuario: 'Pedro', cedula: '54321', rol: 'Aprendiz', contrasena: 'Pass123!' }]);
    mockExecute
      .mockResolvedValueOnce([[undefined]])             // cedula no existe
      .mockResolvedValueOnce([[{ id_rol: 3 }]])         // rol encontrado
      .mockResolvedValueOnce([{ insertId: 20 }]);       // INSERT usuario
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarUsuarios(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ exitosos: 1, fallidos: 0 })
    }));
  });

  it('handles DB errors in rows gracefully (adds to errores)', async () => {
    fakeWorkbook([{ nombre_usuario: 'Juan', cedula: '12345', rol: 'Aprendiz' }]);
    mockExecute.mockRejectedValueOnce(new Error('DB crash')); // cedula check throws
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarUsuarios(req, res);
    // Row-level errors are caught and added to resultados.errores, returns 200 with json
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ fallidos: 1 })
    }));
  });

  it('returns 500 when XLSX throws top-level error', async () => {
    mockRead.mockImplementationOnce(() => { throw new Error('Corrupt file'); });
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarUsuarios(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── importarAprendices ─────────────────────────────────────────────────────

describe('importarAprendices', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    mockEnsureAprendicesTable.mockResolvedValue(undefined);
  });

  it('returns 400 when no file provided', async () => {
    const req = mockReq({ file: null });
    const res = mockRes();
    await importarAprendices(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'No se proporcionó ningún archivo' }));
  });

  it('returns 400 when excel is empty', async () => {
    fakeWorkbook([]);
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarAprendices(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'El archivo Excel está vacío' }));
  });

  it('skips rows missing nombre or documento', async () => {
    fakeWorkbook([{ Ficha: '12345' }]); // no nombre, no documento
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarAprendices(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ fallidos: 1, exitosos: 0 })
    }));
  });

  it('skips rows with duplicate documento', async () => {
    fakeWorkbook([{ Nombre: 'Ana', Documento: '9876' }]);
    mockExecute.mockResolvedValueOnce([[{ id_aprendiz: 1 }]]); // doc ya existe
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarAprendices(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ fallidos: 1 })
    }));
  });

  it('imports aprendiz successfully', async () => {
    fakeWorkbook([{ Nombre: 'Ana', Documento: '9876', Ficha: '1234', Jornada: 'Mañana' }]);
    mockExecute
      .mockResolvedValueOnce([[undefined]])        // doc no existe
      .mockResolvedValueOnce([{ insertId: 5 }]);   // INSERT
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarAprendices(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ exitosos: 1, fallidos: 0 })
    }));
  });

  it('normalizes jornada values correctly', async () => {
    fakeWorkbook([
      { Nombre: 'Pedro', Documento: '1111', Jornada: 'tarde' },
      { Nombre: 'Maria', Documento: '2222', Jornada: 'noche' }
    ]);
    mockExecute
      .mockResolvedValueOnce([[undefined]])        // doc 1 no existe
      .mockResolvedValueOnce([{ insertId: 6 }])   // INSERT 1
      .mockResolvedValueOnce([[undefined]])        // doc 2 no existe
      .mockResolvedValueOnce([{ insertId: 7 }]);  // INSERT 2
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarAprendices(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ exitosos: 2 })
    }));
  });

  it('skips when tipo_documento is Otro but no especificacion', async () => {
    fakeWorkbook([{ Nombre: 'Luis', Documento: '3333', 'Tipo Documento': 'Otro' }]);
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarAprendices(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ fallidos: 1 })
    }));
  });

  it('handles DB errors in rows gracefully (adds to errores)', async () => {
    fakeWorkbook([{ Nombre: 'Ana', Documento: '9876' }]);
    mockExecute.mockRejectedValueOnce(new Error('DB crash')); // doc check throws
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarAprendices(req, res);
    // Row-level errors caught and added to resultados.errores
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      resultados: expect.objectContaining({ fallidos: 1 })
    }));
  });

  it('returns 500 when XLSX throws top-level error', async () => {
    mockRead.mockImplementationOnce(() => { throw new Error('Corrupt file'); });
    const req = mockReq({ file: { buffer: Buffer.from('data') } });
    const res = mockRes();
    await importarAprendices(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
