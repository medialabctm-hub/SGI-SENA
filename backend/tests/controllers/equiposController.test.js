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

const mockNotifyNuevoEquipo = jest.fn().mockResolvedValue({});
jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/notificationService.js'), () => ({
  notifyNuevoEquipo: mockNotifyNuevoEquipo
}));

const mockEquipoService = {
  listarEquipos: jest.fn(),
  registrarEquipo: jest.fn(),
  actualizarEquipo: jest.fn()
};
jest.unstable_mockModule(path.resolve(__dirname, '../../src/factories/ServiceFactory.js'), () => ({
  ServiceFactory: {
    create: jest.fn().mockReturnValue(mockEquipoService)
  }
}));

const mockObtenerEquipoPorCodigo = jest.fn();
const mockObtenerUsuarioPorCedula = jest.fn();
const mockVerificarDisponibilidad = jest.fn();
const mockVerificarAmbienteEquipoAprendiz = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/sqlQueries.js'), () => ({
  obtenerEquipoPorCodigo: mockObtenerEquipoPorCodigo,
  obtenerUsuarioPorCedula: mockObtenerUsuarioPorCedula,
  verificarDisponibilidadEquipo: mockVerificarDisponibilidad,
  verificarAmbienteEquipoAprendiz: mockVerificarAmbienteEquipoAprendiz,
  deshabilitarAsignacionesActivas: jest.fn()
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/middleware/uploadMiddleware.js'), () => ({
  getImagePath: jest.fn(),
  deleteImageFile: jest.fn()
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/socketService.js'), () => ({
  default: { emitToAll: jest.fn() }
}));

// ── Dynamic import ─────────────────────────────────────────────────────────
const {
  listarEquipos,
  registrarEquipo,
  obtenerEquipoPorCodigo,
  actualizarEquipo,
  eliminarEquipo,
  asignarEquipo,
  obtenerMisEquipos,
  listarAsignaciones,
  eliminarAsignacion,
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
} = await import(path.resolve(__dirname, '../../src/controller/equiposController.js'));

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

describe('listarEquipos', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    mockEquipoService.listarEquipos.mockResolvedValue({ data: [], total: 0 });
  });

  it('returns result from service', async () => {
    const fakeResult = { data: [{ codigo_equipo: 1 }], total: 1 };
    mockEquipoService.listarEquipos.mockResolvedValueOnce(fakeResult);
    const req = mockReq();
    const res = mockRes();
    await listarEquipos(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeResult);
  });

  it('resolves ambiente filter by numeric id', async () => {
    const req = mockReq({ query: { ambiente: '5' } });
    const res = mockRes();
    await listarEquipos(req, res);
    expect(mockEquipoService.listarEquipos).toHaveBeenCalled();
  });

  it('resolves ambiente filter by name via DB', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_ambiente: 3 }]]);
    const req = mockReq({ query: { ambiente: 'Lab Redes' } });
    const res = mockRes();
    await listarEquipos(req, res);
    expect(mockEquipoService.listarEquipos).toHaveBeenCalled();
  });

  it('returns 500 on service error', async () => {
    mockEquipoService.listarEquipos.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq();
    const res = mockRes();
    await listarEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('registrarEquipo', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    mockEquipoService.registrarEquipo.mockResolvedValue({ codigo_equipo: 10, placa: 'PL-001' });
    mockNotifyNuevoEquipo.mockResolvedValue({});
  });

  it('creates equipo and returns 201', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab' }]]); // ambRow
    const req = mockReq({ body: { tipo: 'Laptop', modelo: 'Dell', id_ambiente: 1 } });
    const res = mockRes();
    await registrarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 400 on ValidationError', async () => {
    const err = new Error('Invalid data');
    err.name = 'ValidationError';
    err.statusCode = 400;
    mockEquipoService.registrarEquipo.mockRejectedValueOnce(err);
    const req = mockReq({ body: {} });
    const res = mockRes();
    await registrarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 on ConflictError', async () => {
    const err = new Error('Conflict');
    err.name = 'ConflictError';
    err.statusCode = 409;
    mockEquipoService.registrarEquipo.mockRejectedValueOnce(err);
    const req = mockReq({ body: {} });
    const res = mockRes();
    await registrarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 409 on ER_DUP_ENTRY', async () => {
    const err = new Error('dup');
    err.code = 'ER_DUP_ENTRY';
    mockEquipoService.registrarEquipo.mockRejectedValueOnce(err);
    const req = mockReq({ body: {} });
    const res = mockRes();
    await registrarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 500 on generic error', async () => {
    mockEquipoService.registrarEquipo.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ body: {} });
    const res = mockRes();
    await registrarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('obtenerEquipoPorCodigo', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when codigo missing', async () => {
    const req = mockReq({ params: {} });
    const res = mockRes();
    await obtenerEquipoPorCodigo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when equipo not found', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])  // placa search
      .mockResolvedValueOnce([[]]); // codigo_equipo search (numeric)
    const req = mockReq({ params: { codigo: '999' } });
    const res = mockRes();
    await obtenerEquipoPorCodigo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns equipo data when found by placa', async () => {
    const fakeEquipo = { codigo_equipo: 1, placa: 'PL-001', tipo: 'Laptop' };
    mockExecute
      .mockResolvedValueOnce([[fakeEquipo]])   // placa found
      .mockResolvedValueOnce([[]])              // responsables
      .mockResolvedValueOnce([[]])              // imagenes
      .mockResolvedValueOnce([[]])              // specs
      .mockResolvedValueOnce([[]])              // historial
      .mockResolvedValueOnce([[]])              // extras
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { codigo: 'PL-001' } });
    const res = mockRes();
    await obtenerEquipoPorCodigo(req, res);
    // The response should be json (not a 404)
    expect(res.status).not.toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { codigo: 'PL-001' } });
    const res = mockRes();
    await obtenerEquipoPorCodigo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('actualizarEquipo', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when codigo missing', async () => {
    const req = mockReq({ params: {}, body: { tipo: 'Laptop' } });
    const res = mockRes();
    await actualizarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when equipo not found by non-numeric code', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { codigo: 'PL-XXX' }, body: { tipo: 'Laptop' } });
    const res = mockRes();
    await actualizarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when no fields to update', async () => {
    const req = mockReq({ params: { codigo: '5' }, body: {} });
    const res = mockRes();
    await actualizarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates equipo by numeric id', async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { codigo: '5' }, body: { tipo: 'Desktop' } });
    const res = mockRes();
    await actualizarEquipo(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 404 when affectedRows=0', async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const req = mockReq({ params: { codigo: '5' }, body: { tipo: 'Desktop' } });
    const res = mockRes();
    await actualizarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { codigo: '5' }, body: { tipo: 'Desktop' } });
    const res = mockRes();
    await actualizarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('eliminarEquipo', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when codigo missing', async () => {
    const req = mockReq({ params: {} });
    const res = mockRes();
    await eliminarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when not found by non-numeric code', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { codigo: 'PL-XXX' } });
    const res = mockRes();
    await eliminarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes by numeric id successfully', async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { codigo: '5' } });
    const res = mockRes();
    await eliminarEquipo(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 404 when affectedRows=0', async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const req = mockReq({ params: { codigo: '5' } });
    const res = mockRes();
    await eliminarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { codigo: '5' } });
    const res = mockRes();
    await eliminarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('asignarEquipo', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    mockObtenerEquipoPorCodigo.mockReset();
    mockVerificarDisponibilidad.mockReset();
    mockVerificarAmbienteEquipoAprendiz.mockReset();
  });

  it('returns 400 when missing required fields', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await asignarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when equipo not found', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce(null);
    const req = mockReq({ body: { codigo_equipo: 1, id_usuario: 2 } });
    const res = mockRes();
    await asignarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Equipo no encontrado' }));
  });

  it('returns 404 when usuario not found', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 1, tipo: 'Laptop' });
    mockExecute.mockResolvedValueOnce([[undefined]]); // usuario not found
    const req = mockReq({ body: { codigo_equipo: 1, id_usuario: 2 } });
    const res = mockRes();
    await asignarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Usuario no encontrado o inactivo' }));
  });

  it('returns 403 when instructor tries to assign to non-Aprendiz', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 1, tipo: 'Laptop' });
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'John', nombre_rol: 'Instructor' }]]);
    const req = mockReq({
      user: { id: 10, rol: 'Instructor' },
      body: { codigo_equipo: 1, id_usuario: 2 }
    });
    const res = mockRes();
    await asignarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 409 when ambiente invalido for aprendiz', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 1, tipo: 'Laptop' });
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'John', nombre_rol: 'Aprendiz' }]]);
    mockVerificarAmbienteEquipoAprendiz.mockResolvedValueOnce({ valido: false, razon: 'Ambiente inválido' });
    const req = mockReq({ body: { codigo_equipo: 1, id_usuario: 2 } });
    const res = mockRes();
    await asignarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 409 when equipo not available', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 1, tipo: 'Laptop' });
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'John', nombre_rol: 'Aprendiz' }]]);
    mockVerificarAmbienteEquipoAprendiz.mockResolvedValueOnce({ valido: true });
    mockVerificarDisponibilidad.mockResolvedValueOnce({ disponible: false, razon: 'En mantenimiento' });
    const req = mockReq({ body: { codigo_equipo: 1, id_usuario: 2 } });
    const res = mockRes();
    await asignarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('creates assignment successfully', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 1, tipo: 'Laptop', modelo: 'Dell' });
    mockExecute
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Juan', nombre_rol: 'Aprendiz' }]]) // usuario
      .mockResolvedValueOnce([[undefined]])  // mantenimientoActivo
      .mockResolvedValueOnce([[undefined]])  // habilitacionExistente
      .mockResolvedValueOnce([{ insertId: 100 }]); // INSERT
    mockVerificarAmbienteEquipoAprendiz.mockResolvedValueOnce({ valido: true });
    mockVerificarDisponibilidad.mockResolvedValueOnce({ disponible: true });
    const req = mockReq({ body: { codigo_equipo: 1, id_usuario: 2 } });
    const res = mockRes();
    await asignarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, id: 100 }));
  });

  it('returns 500 on DB error', async () => {
    mockObtenerEquipoPorCodigo.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ body: { codigo_equipo: 1, id_usuario: 2 } });
    const res = mockRes();
    await asignarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('obtenerMisEquipos', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns assigned equipos', async () => {
    const fakeEquipos = [{ codigo_equipo: 1, tipo: 'Laptop' }];
    mockExecute.mockResolvedValueOnce([fakeEquipos]);
    const req = mockReq({ user: { id: 5, rol: 'Aprendiz' } });
    const res = mockRes();
    await obtenerMisEquipos(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeEquipos);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq();
    const res = mockRes();
    await obtenerMisEquipos(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('listarAsignaciones', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns all assignments for Admin', async () => {
    const fakeRows = [{ id_responsable: 1 }];
    mockExecute.mockResolvedValueOnce([fakeRows]);
    const req = mockReq({ user: { id: 1, rol: 'Administrador' } });
    const res = mockRes();
    await listarAsignaciones(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeRows);
  });

  it('filters Aprendiz assignments for Instructor role', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_responsable: 2 }]]);
    const req = mockReq({ user: { id: 3, rol: 'Instructor' } });
    const res = mockRes();
    await listarAsignaciones(req, res);
    expect(mockExecute.mock.calls[0][0]).toContain("Aprendiz");
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq();
    const res = mockRes();
    await listarAsignaciones(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('eliminarAsignacion', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when assignment not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await eliminarAsignacion(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns success if already deleted (idempotent)', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_responsable: 1, estado_responsabilidad: 'Finalizado', id_usuario: 2, codigo_equipo: 10, usuario_rol: 'Aprendiz' }]]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await eliminarAsignacion(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, alreadyDeleted: true }));
  });

  it('returns 403 when instructor tries to delete non-aprendiz assignment', async () => {
    mockExecute.mockResolvedValueOnce([[{
      id_responsable: 1,
      estado_responsabilidad: 'Activo',
      id_usuario: 2,
      codigo_equipo: 10,
      usuario_rol: 'Instructor'
    }]]);
    const req = mockReq({ user: { id: 3, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await eliminarAsignacion(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('deactivates assignment successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_responsable: 1, estado_responsabilidad: 'Activo', id_usuario: 2, codigo_equipo: 10, usuario_rol: 'Aprendiz' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await eliminarAsignacion(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await eliminarAsignacion(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('listarCategorias', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns categories list', async () => {
    const fakeCats = [{ id_categoria: 1, nombre_categoria: 'Laptop' }];
    mockExecute.mockResolvedValueOnce([fakeCats]);
    const req = mockReq();
    const res = mockRes();
    await listarCategorias(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeCats);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq();
    const res = mockRes();
    await listarCategorias(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('crearCategoria', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when nombre missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await crearCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates category successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[undefined]]) // no duplicate
      .mockResolvedValueOnce([{ insertId: 7 }]);
    const req = mockReq({ body: { nombre_categoria: 'Monitores', es_componente: false } });
    const res = mockRes();
    await crearCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 409 when category already exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_categoria: 2 }]]);
    const req = mockReq({ body: { nombre_categoria: 'Monitores' } });
    const res = mockRes();
    await crearCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ body: { nombre_categoria: 'Monitores' } });
    const res = mockRes();
    await crearCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
