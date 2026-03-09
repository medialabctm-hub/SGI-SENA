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

jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/ambientesService.js'), () => ({
  expandirAsignacionesPorFechas: jest.fn(),
  convertirNombresDiasANumeros: jest.fn(),
  validarRangoHoras: jest.fn(),
  validarRangoFechas: jest.fn(),
  calcularCantidadAsignaciones: jest.fn(),
  obtenerNombreDia: jest.fn()
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/socketService.js'), () => ({
  default: { emitToAll: jest.fn() }
}));

// ── Dynamic import ─────────────────────────────────────────────────────────
const {
  listarAmbientes,
  obtenerAmbiente,
  crearAmbiente,
  actualizarAmbiente,
  eliminarAmbiente,
  listarAmbientesActivos
} = await import(path.resolve(__dirname, '../../src/controller/ambientesController.js'));

// ── Helpers ────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1, rol: 'Administrador' },
    ...overrides
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('listarAmbientes', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns all ambientes', async () => {
    const fakeAmbientes = [{ id_ambiente: 1, codigo_ambiente: 'LAB-1', nombre_ambiente: 'Lab 1' }];
    mockExecute.mockResolvedValueOnce([fakeAmbientes]);
    const req = mockReq();
    const res = mockRes();
    await listarAmbientes(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeAmbientes);
  });

  it('applies estado_ambiente filter', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_ambiente: 1 }]]);
    const req = mockReq({ query: { estado_ambiente: 'Activo' } });
    const res = mockRes();
    await listarAmbientes(req, res);
    expect(mockExecute.mock.calls[0][0]).toContain('estado_ambiente = ?');
  });

  it('applies tipo_ambiente filter', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_ambiente: 2 }]]);
    const req = mockReq({ query: { tipo_ambiente: 'Laboratorio' } });
    const res = mockRes();
    await listarAmbientes(req, res);
    expect(mockExecute.mock.calls[0][0]).toContain('tipo_ambiente = ?');
  });

  it('applies edificio and piso filters', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_ambiente: 3 }]]);
    const req = mockReq({ query: { edificio: 'A', piso: '2' } });
    const res = mockRes();
    await listarAmbientes(req, res);
    expect(mockExecute.mock.calls[0][0]).toContain('edificio = ?');
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq();
    const res = mockRes();
    await listarAmbientes(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('obtenerAmbiente', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await obtenerAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns ambiente with equipos, responsables, imagenes', async () => {
    const fakeAmbiente = { id_ambiente: 1, codigo_ambiente: 'LAB-1' };
    mockExecute
      .mockResolvedValueOnce([[fakeAmbiente]])
      .mockResolvedValueOnce([[{ codigo_equipo: 10 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_imagen_ambiente: 5 }]]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await obtenerAmbiente(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id_ambiente: 1,
      equipos: expect.any(Array),
      responsables_actuales: expect.any(Array)
    }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await obtenerAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('crearAmbiente', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when required fields missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await crearAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 when codigo already exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_ambiente: 1 }]]);
    const req = mockReq({ body: { codigo_ambiente: 'LAB-1', nombre_ambiente: 'Lab 1', tipo_ambiente: 'Laboratorio' } });
    const res = mockRes();
    await crearAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 400 for invalid tipo_ambiente', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ body: { codigo_ambiente: 'LAB-1', nombre_ambiente: 'Lab 1', tipo_ambiente: 'Cocina' } });
    const res = mockRes();
    await crearAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates ambiente successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([{ insertId: 5 }]);
    const req = mockReq({
      body: {
        codigo_ambiente: 'LAB-1',
        nombre_ambiente: 'Lab 1',
        tipo_ambiente: 'Laboratorio',
        estado_ambiente: 'Activo'
      }
    });
    const res = mockRes();
    await crearAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, id_ambiente: 5 }));
  });

  it('returns 400 for invalid estado_ambiente', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({
      body: {
        codigo_ambiente: 'LAB-1',
        nombre_ambiente: 'Lab 1',
        tipo_ambiente: 'Laboratorio',
        estado_ambiente: 'Roto'
      }
    });
    const res = mockRes();
    await crearAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 on ER_DUP_ENTRY', async () => {
    mockExecute
      .mockResolvedValueOnce([[undefined]])
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    const req = mockReq({
      body: { codigo_ambiente: 'LAB-1', nombre_ambiente: 'Lab 1', tipo_ambiente: 'Laboratorio' }
    });
    const res = mockRes();
    await crearAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 500 on generic DB error', async () => {
    mockExecute
      .mockResolvedValueOnce([[undefined]])
      .mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({
      body: { codigo_ambiente: 'LAB-1', nombre_ambiente: 'Lab 1', tipo_ambiente: 'Laboratorio' }
    });
    const res = mockRes();
    await crearAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('actualizarAmbiente', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' }, body: { nombre_ambiente: 'New' } });
    const res = mockRes();
    await actualizarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 409 when codigo already in use', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_ambiente: 2 }]]);
    const req = mockReq({ params: { id: '1' }, body: { codigo_ambiente: 'LAB-2' } });
    const res = mockRes();
    await actualizarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 400 when no fields to update', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_ambiente: 1 }]]);
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();
    await actualizarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { id: '1' }, body: { nombre_ambiente: 'New Name' } });
    const res = mockRes();
    await actualizarAmbiente(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 400 for invalid tipo_ambiente', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_ambiente: 1 }]]);
    const req = mockReq({ params: { id: '1' }, body: { tipo_ambiente: 'Sauna' } });
    const res = mockRes();
    await actualizarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid estado_ambiente', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_ambiente: 1 }]]);
    const req = mockReq({ params: { id: '1' }, body: { estado_ambiente: 'Roto' } });
    const res = mockRes();
    await actualizarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' }, body: { nombre_ambiente: 'New' } });
    const res = mockRes();
    await actualizarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('eliminarAmbiente', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await eliminarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 409 when ambiente has equipos', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, codigo_ambiente: 'LAB-1', nombre_ambiente: 'Lab 1' }]])
      .mockResolvedValueOnce([[{ total: 3 }]]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await eliminarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 409 when ambiente has clases programadas', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, codigo_ambiente: 'LAB-1', nombre_ambiente: 'Lab 1' }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 2 }]]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await eliminarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('deletes successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, codigo_ambiente: 'LAB-1', nombre_ambiente: 'Lab 1' }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await eliminarAmbiente(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await eliminarAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('listarAmbientesActivos', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns active ambientes', async () => {
    const fakeList = [{ id_ambiente: 1, nombre_ambiente: 'Lab 1' }];
    mockExecute.mockResolvedValueOnce([fakeList]);
    const req = mockReq();
    const res = mockRes();
    await listarAmbientesActivos(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeList);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq();
    const res = mockRes();
    await listarAmbientesActivos(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});