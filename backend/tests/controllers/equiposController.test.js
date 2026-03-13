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

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
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
  ,
  registrarInicioUso,
  registrarFinUso,
  obtenerSesionesActivas,
  actualizarAsignacionEquipo,
  obtenerEquiposAmbientesInstructor,
  registrarVerificacionInventario,
  consultarHistorialVerificaciones,
  obtenerHistorialEquipo,
  actualizarCuentadantePrincipal,
  obtenerCuentadantePrincipal,
  buscarCuentadantePorDocumento
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

describe('actualizarCategoria', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when id_categoria missing', async () => {
    const req = mockReq({ params: {}, body: { nombre_categoria: 'X' } });
    const res = mockRes();
    await actualizarCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when category does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id_categoria: '9' }, body: { nombre_categoria: 'X' } });
    const res = mockRes();
    await actualizarCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 409 when new category name already exists', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_categoria: 9, nombre_categoria: 'Actual' }]])
      .mockResolvedValueOnce([[{ id_categoria: 2 }]]);
    const req = mockReq({ params: { id_categoria: '9' }, body: { nombre_categoria: 'Duplicada' } });
    const res = mockRes();
    await actualizarCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('updates category successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_categoria: 9, nombre_categoria: 'Actual' }]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id_categoria: 9, nombre_categoria: 'Nueva', descripcion: null, es_componente: 0 }]]);
    const req = mockReq({ params: { id_categoria: '9' }, body: { nombre_categoria: 'Nueva' } });
    const res = mockRes();
    await actualizarCategoria(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('actualizada') }));
  });
});

describe('eliminarCategoria', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when id_categoria missing', async () => {
    const req = mockReq({ params: {} });
    const res = mockRes();
    await eliminarCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when category does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id_categoria: '7' } });
    const res = mockRes();
    await eliminarCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 409 when category has linked equipments', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_categoria: 7, nombre_categoria: 'Laptop' }]])
      .mockResolvedValueOnce([[{ total: 3 }]]);
    const req = mockReq({ params: { id_categoria: '7' } });
    const res = mockRes();
    await eliminarCategoria(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('deletes category successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_categoria: 7, nombre_categoria: 'Laptop' }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { id_categoria: '7' } });
    const res = mockRes();
    await eliminarCategoria(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id_categoria: 7 }));
  });
});

describe('registrarInicioUso', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when codigo_equipo missing', async () => {
    const req = mockReq({ body: { nombre_usuario: 'Juan' } });
    const res = mockRes();
    await registrarInicioUso(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when nombre_usuario missing', async () => {
    const req = mockReq({ body: { codigo_equipo: 1 } });
    const res = mockRes();
    await registrarInicioUso(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('registrarFinUso', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when codigo_equipo missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await registrarFinUso(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when there is no active session', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ body: { codigo_equipo: 1 }, user: { id: 5, rol: 'Aprendiz' } });
    const res = mockRes();
    await registrarFinUso(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('obtenerSesionesActivas', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns active sessions list', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_historial: 1, codigo_equipo: 10 }]]);
    const req = mockReq({ query: {}, user: { id: 1, rol: 'Administrador' } });
    const res = mockRes();
    await obtenerSesionesActivas(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('returns 500 on db error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ query: {}, user: { id: 1, rol: 'Administrador' } });
    const res = mockRes();
    await obtenerSesionesActivas(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── NEW COVERAGE TESTS ─────────────────────────────────────────────────────

describe('actualizarAsignacionEquipo', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns 404 when assignment not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' }, body: { ficha: '1234' } });
    const res = mockRes();
    await actualizarAsignacionEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when Instructor tries to update non-aprendiz assignment', async () => {
    mockExecute.mockResolvedValueOnce([[{
      id_responsable: 1, id_usuario: 2, codigo_equipo: 10, usuario_rol: 'Instructor'
    }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, params: { id: '1' }, body: { ficha: 'X' } });
    const res = mockRes();
    await actualizarAsignacionEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when no fields provided', async () => {
    mockExecute.mockResolvedValueOnce([[{
      id_responsable: 1, id_usuario: 2, codigo_equipo: 10, usuario_rol: 'Aprendiz'
    }]]);
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();
    await actualizarAsignacionEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 when schedule conflict detected', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_responsable: 1, id_usuario: 2, codigo_equipo: 10, usuario_rol: 'Aprendiz' }]])
      .mockResolvedValueOnce([[{ id_responsable: 2, nombre_usuario: 'Otro', cedula: '99', dias_semana: '["Lunes"]', hora_inicio: '08:00:00', hora_fin: '10:00:00' }]]);
    const req = mockReq({
      params: { id: '1' },
      body: { dias_semana: ['Lunes'], hora_inicio: '08:00', hora_fin: '10:00' }
    });
    const res = mockRes();
    await actualizarAsignacionEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('updates successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_responsable: 1, id_usuario: 2, codigo_equipo: 10, usuario_rol: 'Aprendiz' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { id: '1' }, body: { ficha: '2345' } });
    const res = mockRes();
    await actualizarAsignacionEquipo(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ params: { id: '1' }, body: { ficha: 'X' } });
    const res = mockRes();
    await actualizarAsignacionEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('obtenerEquiposAmbientesInstructor', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns 403 when role is not Instructor/Cuentadante', async () => {
    const req = mockReq({ user: { id: 1, rol: 'Administrador' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns empty when no active ambientes', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // no ambientes
    const req = mockReq({ user: { id: 5, rol: 'Instructor' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    expect(res.json).toHaveBeenCalledWith({ ambientes: [], equipos: [] });
  });

  it('returns ambientes and equipos when found', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab', id_responsabilidad_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ codigo_equipo: 5, placa: 'PL-001', tipo: 'Laptop' }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ambientes: expect.any(Array), equipos: expect.any(Array) }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ user: { id: 5, rol: 'Instructor' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('registrarVerificacionInventario', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns 400 when missing required fields', async () => {
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, body: { codigo_equipo: 1 } });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 when role is not Instructor/Cuentadante', async () => {
    const req = mockReq({ user: { id: 1, rol: 'Aprendiz' }, body: { codigo_equipo: 1, estado_verificacion: 'Verificado' } });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when equipo not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, body: { codigo_equipo: 99, estado_verificacion: 'Verificado' } });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when no active responsabilidad', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 1, id_ambiente: 2, nombre_ambiente: 'Lab' }]])
      .mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, body: { codigo_equipo: 1, estado_verificacion: 'Verificado' } });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when estado_verificacion is invalid', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 1, id_ambiente: 2, nombre_ambiente: 'Lab' }]])
      .mockResolvedValueOnce([[{ id_responsabilidad_ambiente: 1, id_clase: null, jornada: 'Mañana' }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, body: { codigo_equipo: 1, estado_verificacion: 'Invalid' } });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('registers verificacion successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 1, id_ambiente: 2, nombre_ambiente: 'Lab' }]])
      .mockResolvedValueOnce([[{ id_responsabilidad_ambiente: 1, id_clase: null, jornada: 'Mañana' }]])
      .mockResolvedValueOnce([{ insertId: 50 }]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, body: { codigo_equipo: 1, estado_verificacion: 'Verificado' } });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, id_verificacion: 50 }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, body: { codigo_equipo: 1, estado_verificacion: 'Verificado' } });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('consultarHistorialVerificaciones', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns paginated results', async () => {
    const fakeVerificaciones = [{ id_verificacion: 1 }];
    mockExecute
      .mockResolvedValueOnce([fakeVerificaciones])
      .mockResolvedValueOnce([[{ total: 1 }]]);
    const req = mockReq({ user: { id: 1, rol: 'Administrador' }, query: {} });
    const res = mockRes();
    await consultarHistorialVerificaciones(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ verificaciones: fakeVerificaciones }));
  });

  it('filters by instructor role', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 0 }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, query: {} });
    const res = mockRes();
    await consultarHistorialVerificaciones(req, res);
    expect(mockExecute.mock.calls[0][0]).toContain('vi.id_usuario = ?');
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ user: { id: 1, rol: 'Administrador' }, query: {} });
    const res = mockRes();
    await consultarHistorialVerificaciones(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('obtenerHistorialEquipo', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns historial and equipo info', async () => {
    const fakeHistorial = [{ id_verificacion: 1, estado_verificacion: 'Verificado' }];
    const fakeEquipo = { codigo_equipo: 5, tipo: 'Laptop' };
    mockExecute
      .mockResolvedValueOnce([fakeHistorial])
      .mockResolvedValueOnce([[fakeEquipo]]);
    const req = mockReq({ params: { codigo: '5' }, query: {} });
    const res = mockRes();
    await obtenerHistorialEquipo(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ historial: fakeHistorial, total: 1 }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ params: { codigo: '5' }, query: {} });
    const res = mockRes();
    await obtenerHistorialEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('actualizarCuentadantePrincipal', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns 403 when role is not Administrador', async () => {
    const req = mockReq({ user: { id: 1, rol: 'Instructor' }, body: { cedula: '123', equipos_ids: [1] } });
    const res = mockRes();
    await actualizarCuentadantePrincipal(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when cedula missing', async () => {
    const req = mockReq({ body: { equipos_ids: [1] } });
    const res = mockRes();
    await actualizarCuentadantePrincipal(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when user not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ body: { cedula: '999', equipos_ids: [1] } });
    const res = mockRes();
    await actualizarCuentadantePrincipal(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when user is not Cuentadante role', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Juan', cedula: '999', nombre_rol: 'Instructor' }]]);
    const req = mockReq({ body: { cedula: '999', equipos_ids: [1] } });
    const res = mockRes();
    await actualizarCuentadantePrincipal(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when no equipos specified', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Ana', cedula: '123', nombre_rol: 'Cuentadante' }]])
      .mockResolvedValueOnce([[{ cnt: 1 }]])
      .mockResolvedValueOnce([[{ cnt: 1 }]]);
    const req = mockReq({ body: { cedula: '123' } });
    const res = mockRes();
    await actualizarCuentadantePrincipal(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates with equipos_ids successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Ana', cedula: '123', nombre_rol: 'Cuentadante' }]])
      .mockResolvedValueOnce([[{ cnt: 1 }]])  // columna cuentadante_principal
      .mockResolvedValueOnce([[{ cnt: 1 }]])  // columna id_cuentadante
      .mockResolvedValueOnce([{ affectedRows: 3 }]);
    const req = mockReq({ body: { cedula: '123', equipos_ids: [1, 2, 3] } });
    const res = mockRes();
    await actualizarCuentadantePrincipal(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ body: { cedula: '123', equipos_ids: [1] } });
    const res = mockRes();
    await actualizarCuentadantePrincipal(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('obtenerCuentadantePrincipal', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns null when column does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[{ cnt: 0 }]]);
    const req = mockReq();
    const res = mockRes();
    await obtenerCuentadantePrincipal(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ cuentadante_principal: null, existe_columna: false }));
  });

  it('returns cuentadante data when column exists and data found', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ cnt: 1 }]])
      .mockResolvedValueOnce([[{ cuentadante_principal: 'Ana Garcia' }]])
      .mockResolvedValueOnce([[{ cedula: '123456' }]]);
    const req = mockReq();
    const res = mockRes();
    await obtenerCuentadantePrincipal(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ cuentadante_principal: 'Ana Garcia', existe_columna: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq();
    const res = mockRes();
    await obtenerCuentadantePrincipal(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('buscarCuentadantePorDocumento', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns 403 when role is not Administrador', async () => {
    const req = mockReq({ user: { id: 1, rol: 'Instructor' }, params: { documento: '12345' } });
    const res = mockRes();
    await buscarCuentadantePorDocumento(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when documento is missing or empty', async () => {
    const req = mockReq({ params: { documento: '   ' } });
    const res = mockRes();
    await buscarCuentadantePorDocumento(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when cuentadante not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { documento: '99999' } });
    const res = mockRes();
    await buscarCuentadantePorDocumento(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns cuentadante with inventory', async () => {
    const fakeCuentadante = { id_usuario: 2, nombre_usuario: 'Ana', cedula: '12345', nombre_rol: 'Cuentadante', correo: 'ana@test.com' };
    const fakeInventario = [{ codigo_equipo: 1, tipo: 'Laptop' }];
    const fakeEstadisticas = { total_equipos: 1, total_ambientes: 1 };
    mockExecute
      .mockResolvedValueOnce([[fakeCuentadante]])
      .mockResolvedValueOnce([fakeInventario])
      .mockResolvedValueOnce([[{ codigo_equipo: 1, total_novedades: 0, total_mantenimientos: 0 }]])
      .mockResolvedValueOnce([[fakeEstadisticas]]);
    const req = mockReq({ params: { documento: '12345' } });
    const res = mockRes();
    await buscarCuentadantePorDocumento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ cuentadante: expect.any(Object) }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ params: { documento: '12345' } });
    const res = mockRes();
    await buscarCuentadantePorDocumento(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
