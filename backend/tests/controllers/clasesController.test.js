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

const mockGetColombiaDateTime = jest.fn().mockReturnValue('2020-01-01 00:00:00');
const mockToColombiaDateTime = jest.fn(dt => dt);
jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/timezone.js'), () => ({
  getColombiaDateTimeString: mockGetColombiaDateTime,
  toColombiaDateTimeString: mockToColombiaDateTime
}));

const mockSchedulerService = { scheduleClaseEnd: jest.fn() };
jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/schedulerService.js'), () => ({
  default: mockSchedulerService
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/socketService.js'), () => ({
  default: { emitToAll: jest.fn() }
}));

// horariosController needs to be mocked since clasesController imports from it
const mockObtenerFechas = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../src/controller/horariosController.js'), () => ({
  obtenerFechasPorRangoYDias: mockObtenerFechas
}));

// ── Dynamic import ─────────────────────────────────────────────────────────
const {
  crearClase,
  listarClases,
  obtenerClase,
  iniciarClase,
  finalizarClase,
  agregarParticipantes,
  obtenerResponsablesAmbiente,
  actualizarClase,
  cancelarClase,
  obtenerNombresClases,
  crearNombreClase,
  aceptarConsentimiento,
  rechazarConsentimiento
} = await import(path.resolve(__dirname, '../../src/controller/clasesController.js'));

// ── Helpers ────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ip: '127.0.0.1',
    get: jest.fn(() => 'jest-test-agent'),
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

// ── crearClase ─────────────────────────────────────────────────────────────

describe('crearClase', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    // Return a past reference date so future dates (2099-xx-xx) pass the "date not passed" check
    mockGetColombiaDateTime.mockReturnValue('2020-01-01 00:00:00');
  });

  it('returns 400 when Admin does not provide id_instructor', async () => {
    const req = mockReq({ body: { id_ambiente: 1, hora_inicio: '08:00', hora_fin: '10:00', fecha_clase: '2099-12-31' } });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    // Error is 'Falta campo obligatorio', detalle mentions id_instructor
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Falta campo obligatorio' }));
  });

  it('returns 404 when ambiente not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]); // ambiente not found
    const req = mockReq({
      body: { id_ambiente: 99, id_instructor: 2, hora_inicio: '08:00', hora_fin: '10:00', fecha_clase: '2099-12-31' }
    });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Ambiente no encontrado o inactivo' }));
  });

  it('returns 404 when instructor not found', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab' }]]) // ambiente found
      .mockResolvedValueOnce([[undefined]]); // instructor not found
    const req = mockReq({
      body: { id_ambiente: 1, id_instructor: 99, hora_inicio: '08:00', hora_fin: '10:00', fecha_clase: '2099-12-31' }
    });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Instructor') }));
  });

  it('returns 400 for invalid hora format', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab' }]])
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Prof', nombre_rol: 'Instructor' }]]);
    const req = mockReq({
      body: { id_ambiente: 1, id_instructor: 2, hora_inicio: 'abc', hora_fin: 'xyz', fecha_clase: '2099-12-31' }
    });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('hora') }));
  });

  it('returns 400 when hora_fin <= hora_inicio', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab' }]])
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Prof', nombre_rol: 'Instructor' }]]);
    const req = mockReq({
      body: { id_ambiente: 1, id_instructor: 2, hora_inicio: '10:00', hora_fin: '08:00', fecha_clase: '2099-12-31' }
    });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when missing fecha_clase for single class', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab' }]])
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Prof', nombre_rol: 'Instructor' }]]);
    const req = mockReq({
      body: { id_ambiente: 1, id_instructor: 2, hora_inicio: '08:00', hora_fin: '10:00' }
    });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a single clase successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab' }]])   // ambiente
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Prof', nombre_rol: 'Instructor' }]])  // instructor
      .mockResolvedValueOnce([[]])  // no conflictos
      .mockResolvedValueOnce([{ insertId: 50 }])  // INSERT clase
      .mockResolvedValueOnce([[{ estado_clase: 'Programada', fecha_clase: '2099-12-31', hora_inicio: '08:00:00', hora_fin: '10:00:00' }]]); // verificación
    const req = mockReq({
      body: { id_ambiente: 1, id_instructor: 2, hora_inicio: '08:00', hora_fin: '10:00', fecha_clase: '2099-12-31' }
    });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, id_clase: 50 }));
  });

  it('instructor role auto-assigns self', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab' }]])
      .mockResolvedValueOnce([[{ id_usuario: 5, nombre_usuario: 'InstrUser', nombre_rol: 'Instructor' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 51 }])
      .mockResolvedValueOnce([[{ estado_clase: 'Programada', fecha_clase: '2099-12-31', hora_inicio: '09:00:00', hora_fin: '11:00:00' }]]);
    const req = mockReq({
      user: { id: 5, rol: 'Instructor' },
      body: { id_ambiente: 1, hora_inicio: '09:00', hora_fin: '11:00', fecha_clase: '2099-12-31' }
    });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, id_clase: 51 }));
  });

  it('returns 400 when all dates have conflicts', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab' }]])
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Prof', nombre_rol: 'Instructor' }]])
      .mockResolvedValueOnce([[{ id_clase: 9 }]]);  // conflict
    const req = mockReq({
      body: { id_ambiente: 1, id_instructor: 2, hora_inicio: '08:00', hora_fin: '10:00', fecha_clase: '2099-12-31' }
    });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({
      body: { id_ambiente: 1, id_instructor: 2, hora_inicio: '08:00', hora_fin: '10:00', fecha_clase: '2099-12-31' }
    });
    const res = mockRes();
    await crearClase(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── listarClases ───────────────────────────────────────────────────────────

describe('listarClases', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns paginated classes for Admin', async () => {
    const fakeClases = [{ id_clase: 1, nombre_clase: 'Redes' }];
    mockExecute
      .mockResolvedValueOnce([fakeClases])         // clases query
      .mockResolvedValueOnce([[{ total: 1 }]]);     // count query
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listarClases(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      clases: fakeClases,
      paginacion: expect.objectContaining({ pagina: 1 })
    }));
  });

  it('filters by instructor for Instructor role', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 0 }]]);
    const req = mockReq({ user: { id: 3, rol: 'Instructor' }, query: {} });
    const res = mockRes();
    await listarClases(req, res);
    expect(mockExecute.mock.calls[0][0]).toContain('id_instructor = ?');
  });

  it('applies optional filters', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 0 }]]);
    const req = mockReq({ query: { id_ambiente: '1', fecha: '2099-12-31', estado_clase: 'Programada' } });
    const res = mockRes();
    await listarClases(req, res);
    expect(mockExecute.mock.calls[0][0]).toContain('id_ambiente = ?');
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq();
    const res = mockRes();
    await listarClases(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── obtenerClase ───────────────────────────────────────────────────────────

describe('obtenerClase', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await obtenerClase(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns clase with details', async () => {
    const fakeClase = { id_clase: 1, nombre_clase: 'Redes', nombre_ambiente: 'Lab' };
    mockExecute
      .mockResolvedValueOnce([[fakeClase]])
      .mockResolvedValueOnce([[{ id_participante: 1, aprendiz_nombre: 'Juan' }]])
      .mockResolvedValueOnce([[{ id_responsabilidad_ambiente: 1 }]]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await obtenerClase(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id_clase: 1,
      participantes: expect.any(Array)
    }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await obtenerClase(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── iniciarClase ───────────────────────────────────────────────────────────

describe('iniciarClase', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    mockGetColombiaDateTime.mockReturnValue('2099-12-31 09:00:00');
  });

  it('returns 404 when clase not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await iniciarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when clase not in Programada state', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'En Curso', id_ambiente: 1, id_instructor: 2 }]]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await iniciarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('iniciada') }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await iniciarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── agregarParticipantes ───────────────────────────────────────────────────

describe('agregarParticipantes', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when participantes not provided', async () => {
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();
    await agregarParticipantes(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when clase not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' }, body: { participantes: [1] } });
    const res = mockRes();
    await agregarParticipantes(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' }, body: { participantes: [1] } });
    const res = mockRes();
    await agregarParticipantes(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── cancelarClase ──────────────────────────────────────────────────────────

describe('cancelarClase', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when clase not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await cancelarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when clase already finalizada (cannot cancel)', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'Finalizada', id_instructor: 1 }]]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await cancelarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('finalizada') }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await cancelarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── obtenerNombresClases ───────────────────────────────────────────────────

describe('obtenerNombresClases', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns list of class names', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ nombre_clase: 'Redes I' }]])  // query from Clases
      .mockResolvedValueOnce([[{ nombre_clase: 'Redes II' }]]); // query from Nombres_Clases
    const req = mockReq();
    const res = mockRes();
    await obtenerNombresClases(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, nombres: expect.any(Array) }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq();
    const res = mockRes();
    await obtenerNombresClases(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── crearNombreClase ───────────────────────────────────────────────────────

describe('crearNombreClase', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when nombre_clase missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await crearNombreClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates nombre successfully (returns 200)', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])              // no existing in Nombres_Clases
      .mockResolvedValueOnce([[]])              // no existing in Clases
      .mockResolvedValueOnce([{ insertId: 15 }]); // INSERT
    const req = mockReq({ body: { nombre_clase: 'Redes II' } });
    const res = mockRes();
    await crearNombreClase(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 409 when nombre_clase already in Nombres_Clases', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_nombre_clase: 3, nombre_clase: 'REDES II' }]]); // existing in Nombres_Clases
    const req = mockReq({ body: { nombre_clase: 'Redes II' } });
    const res = mockRes();
    await crearNombreClase(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 409 when nombre_clase already in Clases', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])              // not in Nombres_Clases
      .mockResolvedValueOnce([[{ nombre_clase: 'REDES II' }]]); // found in Clases
    const req = mockReq({ body: { nombre_clase: 'Redes II' } });
    const res = mockRes();
    await crearNombreClase(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ body: { nombre_clase: 'Redes II' } });
    const res = mockRes();
    await crearNombreClase(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── NEW COVERAGE TESTS ─────────────────────────────────────────────────────

describe('finalizarClase', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns 404 when clase not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await finalizarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when clase is not En Curso', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'Programada', fecha_inicio_real: null }]]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await finalizarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('finalizes clase successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'En Curso', fecha_inicio_real: '2024-01-01 08:00' }]])
      .mockResolvedValueOnce([[]])   // CALL sp_finalizar_clase
      .mockResolvedValueOnce([[{ estado_clase: 'Finalizada', fecha_fin_real: '2024-01-01 10:00' }]]);
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();
    await finalizarClase(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await finalizarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('obtenerResponsablesAmbiente', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns responsables list', async () => {
    const fakeResponsables = [{ id_usuario: 1, nombre_usuario: 'Carlos' }];
    mockExecute.mockResolvedValueOnce([[fakeResponsables]]);
    const req = mockReq({ params: { id_ambiente: '3' }, query: {} });
    const res = mockRes();
    await obtenerResponsablesAmbiente(req, res);
    expect(res.json).toHaveBeenCalled();
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ params: { id_ambiente: '3' }, query: {} });
    const res = mockRes();
    await obtenerResponsablesAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('actualizarClase', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns 404 when clase not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' }, body: {} });
    const res = mockRes();
    await actualizarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when Instructor tries to update another instructor class', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'Programada', id_instructor: 99 }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, params: { id: '1' }, body: {} });
    const res = mockRes();
    await actualizarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when clase is not Programada', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'En Curso', id_instructor: 1 }]]);
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();
    await actualizarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();
    await actualizarClase(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('aceptarConsentimiento', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns 404 when clase not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await aceptarConsentimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user is not the instructor', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'Programada', id_instructor: 99 }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await aceptarConsentimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when clase is not Programada', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'En Curso', id_instructor: 1 }]]);
    const req = mockReq({ user: { id: 1, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await aceptarConsentimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('starts clase and returns ok', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'Programada', id_instructor: 1 }]])
      .mockResolvedValueOnce([[]]); // CALL sp_iniciar_clase
    const req = mockReq({ user: { id: 1, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await aceptarConsentimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await aceptarConsentimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('rechazarConsentimiento', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  it('returns 404 when clase not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await rechazarConsentimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user is not the instructor', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'Programada', id_instructor: 99 }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await rechazarConsentimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when clase is not Programada', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'Cancelada', id_instructor: 1 }]]);
    const req = mockReq({ user: { id: 1, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await rechazarConsentimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('cancels clase and returns ok', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_clase: 1, estado_clase: 'Programada', id_instructor: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ user: { id: 1, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await rechazarConsentimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await rechazarConsentimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
