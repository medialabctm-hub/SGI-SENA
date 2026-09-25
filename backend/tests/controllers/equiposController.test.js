import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockExecute = jest.fn();
const mockConnectionExecute = jest.fn();
const mockConnection = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  execute: mockConnectionExecute,
};
const mockGetConnection = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: { execute: mockExecute, pool: { getConnection: mockGetConnection } },
  pool: { execute: mockExecute, getConnection: mockGetConnection }
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

const mockDeleteImageFile = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../src/middleware/uploadMiddleware.js'), () => ({
  getImagePath: jest.fn(),
  deleteImageFile: mockDeleteImageFile
}));

const mockEmitToAll = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/socketService.js'), () => ({
  default: { emitToAll: mockEmitToAll }
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
  obtenerHistorialEquipoUso,
  actualizarAsignacionEquipo,
  obtenerEquiposAmbientesInstructor,
  registrarVerificacionInventario,
  consultarHistorialVerificaciones,
  obtenerHistorialEquipo,
  obtenerHistorialMovimientos,
  actualizarCuentadantePrincipal,
  obtenerCuentadantePrincipal,
  buscarCuentadantePorDocumento,
  registrarUsoEquipoExterno
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

  it('allows a Cuentadante to view their own equipo outside an assigned ambiente', async () => {
    const fakeEquipo = { codigo_equipo: 42, placa: 'INV-42', id_cuentadante: 7 };
    mockExecute.mockImplementation((sql, params = []) => {
      if (sql.includes('SELECT DISTINCT ra.id_ambiente')) {
        return Promise.resolve([[{ id_ambiente: 2 }]]);
      }
      if (sql.includes('WHERE e.placa = ?')) {
        return Promise.resolve([[]]);
      }
      if (sql.includes('WHERE e.codigo_equipo = ?')) {
        const hasOwnEquipmentScope = sql.includes('e.id_cuentadante = ?');
        const hasAssignedAmbienteScope = sql.includes('e.id_ambiente IN (?)');
        return Promise.resolve([
          hasOwnEquipmentScope && hasAssignedAmbienteScope && params[1] === 7 && params[2] === 2
            ? [fakeEquipo]
            : []
        ]);
      }
      return Promise.resolve([[]]);
    });

    const req = mockReq({
      params: { codigo: '42' },
      user: { id: 7, rol: 'Cuentadante' }
    });
    const res = mockRes();

    await obtenerEquipoPorCodigo(req, res);

    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.codigo_equipo = ?'),
      [42, 7, 2]
    );
  });

  it('allows an Aprendiz to view only an actively linked equipo and hides other responsables', async () => {
    const equipo = { codigo_equipo: 10, placa: 'INV-10', tipo: 'Laptop' };
    const responsablePropio = { id_responsable: 1, id_usuario: 55, nombre_usuario: 'Aprendiz propio' };
    const responsableAjeno = { id_responsable: 2, id_usuario: 77, nombre_usuario: 'Aprendiz ajeno' };

    mockExecute.mockImplementation((sql) => {
      if (sql.includes('WHERE e.placa = ?')) {
        return Promise.resolve([[equipo]]);
      }
      if (sql.includes('FROM Responsables_Equipo re')) {
        return Promise.resolve([sql.includes('re.id_usuario = ?')
          ? [responsablePropio]
          : [responsablePropio, responsableAjeno]]);
      }
      return Promise.resolve([[]]);
    });

    const req = mockReq({
      params: { codigo: 'INV-10' },
      user: { id: 55, rol: 'Aprendiz' }
    });
    const res = mockRes();

    await obtenerEquipoPorCodigo(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response).toEqual(expect.objectContaining({ codigo_equipo: 10 }));
    expect(response.responsables).toHaveLength(1);
    expect(response.responsables[0]).toEqual(expect.objectContaining({ id_responsable: 1 }));
    expect(response.responsables).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id_responsable: 2 })
    ]));
  });

  it('fails closed without enumerating an equipo linked to another Aprendiz', async () => {
    const equipo = { codigo_equipo: 20, placa: 'INV-20', tipo: 'Laptop' };
    mockExecute.mockImplementation((sql) => {
      if (sql.includes('WHERE e.placa = ?')) {
        return Promise.resolve(sql.includes('EXISTS') ? [[]] : [[equipo]]);
      }
      return Promise.resolve([[]]);
    });

    const req = mockReq({
      params: { codigo: 'INV-20' },
      user: { id: 55, rol: 'Aprendiz' }
    });
    const res = mockRes();

    await obtenerEquipoPorCodigo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Equipo no encontrado' });
    expect(mockExecute.mock.calls.some(([sql]) => sql.includes('FROM Responsables_Equipo re') && sql.includes('LEFT JOIN Usuarios u ON re.id_usuario'))).toBe(false);
  });

  it.each([0, -1, 'not-a-number', undefined])(
    'fails closed when the Aprendiz identity is invalid (%s)',
    async (id) => {
      const req = mockReq({
        params: { codigo: 'INV-10' },
        user: { id, rol: 'Aprendiz' }
      });
      const res = mockRes();

      await obtenerEquipoPorCodigo(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Equipo no encontrado' });
      expect(mockExecute).not.toHaveBeenCalled();
    }
  );

  it.each(['Administrador', 'Instructor', 'Cuentadante'])(
    'preserves broad visibility for %s',
    async (rol) => {
      const equipo = { codigo_equipo: 30, placa: 'INV-30', tipo: 'Laptop' };
      const responsables = [
        { id_responsable: 1, id_usuario: 55, nombre_usuario: 'Aprendiz propio' },
        { id_responsable: 2, id_usuario: 77, nombre_usuario: 'Aprendiz ajeno' }
      ];
      mockExecute.mockImplementation((sql) => {
        if (sql.includes('SELECT DISTINCT ra.id_ambiente') && !sql.includes('FROM Elementos e')) {
          return Promise.resolve([[]]);
        }
        if (sql.includes('WHERE e.placa = ?')) {
          return Promise.resolve([[equipo]]);
        }
        if (sql.includes('FROM Responsables_Equipo re')) {
          return Promise.resolve([responsables]);
        }
        return Promise.resolve([[]]);
      });

      const req = mockReq({
        params: { codigo: 'INV-30' },
        user: { id: 1, rol }
      });
      const res = mockRes();

      await obtenerEquipoPorCodigo(req, res);

      expect(res.status).not.toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        codigo_equipo: 30,
        responsables: expect.arrayContaining([
          expect.objectContaining({ id_responsable: 1 }),
          expect.objectContaining({ id_responsable: 2 })
        ])
      }));
    }
  );

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
    mockConnectionExecute.mockReset();
    mockGetConnection.mockReset();
    mockGetConnection.mockResolvedValue(mockConnection);
    mockConnection.beginTransaction.mockReset();
    mockConnection.commit.mockReset();
    mockConnection.rollback.mockReset();
    mockConnection.release.mockReset();
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

  it('rolls back and returns once when a verified movement has no authorization', async () => {
    mockConnectionExecute.mockResolvedValueOnce([[{ id_ambiente: 1, verificado_ambiente: 1 }]]);
    const res = mockRes();

    await actualizarEquipo(mockReq({
      params: { codigo: '5' },
      body: { id_ambiente: 2 },
    }), res);

    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(mockEmitToAll).not.toHaveBeenCalled();
  });

  it('aplica el estado histórico Verificado aunque la bandera externa siga en cero', async () => {
    mockConnectionExecute.mockResolvedValueOnce([[
      {
        id_ambiente: 1,
        verificado_ambiente: 0,
        estado_verificacion_actual: 'Verificado',
      },
    ]]);
    const res = mockRes();

    await actualizarEquipo(mockReq({
      params: { codigo: '5' },
      body: { id_ambiente: 2 },
    }), res);

    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockConnectionExecute).toHaveBeenCalledTimes(1);
  });

  it('rolls back when the conditional authorization consumption conflicts', async () => {
    mockConnectionExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, verificado_ambiente: 1 }]])
      .mockResolvedValueOnce([[{
        id_solicitud: 12,
        codigo_equipo: 5,
        id_ambiente_origen: 1,
        id_ambiente_destino: 2,
        estado: 'Aprobada',
        fecha_uso: null,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id_historial: 99 }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = mockRes();

    await actualizarEquipo(mockReq({
      params: { codigo: '5' },
      body: { id_ambiente: 2, id_solicitud_autorizacion: 12 },
    }), res);

    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockConnectionExecute.mock.calls.some(([sql]) => /WHERE id_solicitud = \? AND fecha_uso IS NULL/i.test(sql))).toBe(true);
    expect(mockEmitToAll).not.toHaveBeenCalled();
  });

  it('consumes an authorized movement even when its history row is unavailable', async () => {
    mockConnectionExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, verificado_ambiente: 1 }]])
      .mockResolvedValueOnce([[{
        id_solicitud: 12,
        codigo_equipo: 5,
        id_ambiente_origen: 1,
        id_ambiente_destino: 2,
        id_autorizador: 20,
        motivo: 'Traslado',
        estado: 'Aprobada',
        fecha_uso: null,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = mockRes();

    await actualizarEquipo(mockReq({
      params: { codigo: '5' },
      body: { id_ambiente: 2, id_solicitud_autorizacion: 12 },
    }), res);

    expect(mockConnectionExecute.mock.calls.some(([sql]) => /WHERE id_solicitud = \? AND fecha_uso IS NULL/i.test(sql))).toBe(true);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ ok: true, updated: 1 });
  });

  it('rolls back a database error and does not publish an equipment event', async () => {
    mockConnectionExecute.mockRejectedValueOnce(new Error('DB fail'));
    const res = mockRes();

    await actualizarEquipo(mockReq({
      params: { codigo: '5' },
      body: { id_ambiente: 2 },
    }), res);

    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(mockEmitToAll).not.toHaveBeenCalled();
  });

  it('publishes the equipment event only after committing an authorized movement', async () => {
    const order = [];
    mockConnection.commit.mockImplementation(async () => { order.push('commit'); });
    mockEmitToAll.mockImplementation(() => { order.push('emit'); });
    mockConnectionExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1, verificado_ambiente: 1 }]])
      .mockResolvedValueOnce([[{
        id_solicitud: 12,
        codigo_equipo: 5,
        id_ambiente_origen: 1,
        id_ambiente_destino: 2,
        estado: 'Aprobada',
        fecha_uso: null,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id_historial: 99 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = mockRes();

    await actualizarEquipo(mockReq({
      params: { codigo: '5' },
      body: { id_ambiente: 2, id_solicitud_autorizacion: 12 },
    }), res);

    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['commit', 'emit']);
    expect(res.json).toHaveBeenCalledWith({ ok: true, updated: 1 });
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
    mockGetConnection.mockReset();
    mockGetConnection.mockResolvedValue(mockConnection);
    mockConnection.execute.mockReset();
    mockConnection.execute.mockImplementation(async (sql, params = []) => {
      if (/FROM Elementos[\s\S]*FOR UPDATE/i.test(sql)) {
        const equipo = await mockObtenerEquipoPorCodigo({}, params[0]);
        return [equipo ? [equipo] : []];
      }
      return mockExecute(sql, params);
    });
    mockConnection.beginTransaction.mockReset();
    mockConnection.commit.mockReset();
    mockConnection.rollback.mockReset();
    mockConnection.release.mockReset();
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

  // BUG-01: la visibilidad en "Mis Equipos" depende de estado_responsabilidad = 'Activo'.
  // Dejarlo al DEFAULT de la columna hace que la habilitación dependa del esquema desplegado.
  it('escribe estado_responsabilidad = Activo de forma explicita en el INSERT', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 1, tipo: 'Laptop', modelo: 'Dell' });
    mockExecute
      .mockResolvedValueOnce([[{ id_usuario: 2, nombre_usuario: 'Juan', nombre_rol: 'Aprendiz' }]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([{ insertId: 100 }]);
    mockVerificarAmbienteEquipoAprendiz.mockResolvedValueOnce({ valido: true });
    mockVerificarDisponibilidad.mockResolvedValueOnce({ disponible: true });
    const req = mockReq({ body: { codigo_equipo: 1, id_usuario: 2 } });
    const res = mockRes();
    await asignarEquipo(req, res);

    const insertCall = mockExecute.mock.calls.find(([sql]) => /INSERT INTO Responsables_Equipo/i.test(sql));
    expect(insertCall).toBeDefined();
    expect(insertCall[0]).toMatch(/estado_responsabilidad/);
    expect(insertCall[0]).toMatch(/'Activo'/);
  });

  it('returns 500 on DB error', async () => {
    mockObtenerEquipoPorCodigo.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ body: { codigo_equipo: 1, id_usuario: 2 } });
    const res = mockRes();
    await asignarEquipo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('claims the equipment row inside a transaction before creating an assignment', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 1, tipo: 'Laptop', modelo: 'Dell', id_ambiente: 4 });
    mockGetConnection.mockResolvedValueOnce(mockConnection);
    mockConnection.execute.mockImplementation(async (sql) => {
      if (/FROM Elementos/.test(sql)) {
        return [[{ codigo_equipo: 1, tipo: 'Laptop', modelo: 'Dell', id_ambiente: 4 }]];
      }
      if (/FROM Usuarios/.test(sql)) {
        return [[{ id_usuario: 2, nombre_usuario: 'Juan', nombre_rol: 'Aprendiz' }]];
      }
      if (/INSERT INTO Responsables_Equipo/.test(sql)) return [{ insertId: 100 }];
      if (/Mantenimiento/.test(sql) || /Responsables_Equipo/.test(sql)) return [[undefined]];
      return [[]];
    });
    mockVerificarDisponibilidad.mockResolvedValueOnce({ disponible: true });
    mockVerificarAmbienteEquipoAprendiz.mockResolvedValueOnce({ valido: true });

    const req = mockReq({ body: { codigo_equipo: 1, id_usuario: 2 } });
    const res = mockRes();
    await asignarEquipo(req, res);

    expect(mockGetConnection).toHaveBeenCalledTimes(1);
    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringMatching(/FROM Elementos[\s\S]*FOR UPDATE/i), [1]);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
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

  it('incluye el inventario a cargo para un cuentadante sin habilitaciones personales', async () => {
    const inventarioACargo = [{
      codigo_equipo: 101,
      codigo_inventario: 'PLACA-101',
      tipo_responsabilidad: 'Inventario a cargo',
      origen_responsabilidad: 'inventario_cuentadante'
    }];
    mockExecute.mockResolvedValueOnce([inventarioACargo]);
    const req = mockReq({ user: { id: 7, rol: 'Cuentadante' } });
    const res = mockRes();

    await obtenerMisEquipos(req, res);

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toMatch(/e\.id_cuentadante = \?/);
    expect(sql).toMatch(/inventario_cuentadante/);
    expect(params).toEqual([7, 7]);
    expect(res.json).toHaveBeenCalledWith(inventarioACargo);
  });

  // Las habilitaciones temporales de clase no pertenecen a "Mis Equipos".
  it('conserva las habilitaciones activas personales y excluye las temporales de clase', async () => {
    mockExecute.mockResolvedValueOnce([[]]);
    const req = mockReq({ user: { id: 7, rol: 'Instructor' } });
    const res = mockRes();
    await obtenerMisEquipos(req, res);

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toMatch(/re\.id_usuario = \?/);
    expect(sql).toMatch(/re\.estado_responsabilidad = 'Activo'/);
    expect(sql).toMatch(/re\.fecha_desvinculacion IS NULL/);
    expect(sql).toMatch(/inicio de clase #/);
    expect(sql).toMatch(/e\.id_cuentadante = \?/);
    expect(params).toEqual([7, 7]);
  });

  it('elige la habilitacion manual activa mas reciente cuando hay duplicados para el mismo equipo', async () => {
    mockExecute.mockResolvedValueOnce([[{ codigo_equipo: 101, id_responsable: 22 }]]);
    const req = mockReq({ user: { id: 7, rol: 'Instructor' } });
    const res = mockRes();

    await obtenerMisEquipos(req, res);

    const [sql] = mockExecute.mock.calls[0];
    expect(sql).toMatch(/NOT EXISTS/);
    expect(sql).toMatch(/re_mas_reciente\.id_responsable > re\.id_responsable/);
    expect(res.json).toHaveBeenCalledWith([{ codigo_equipo: 101, id_responsable: 22 }]);
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

  it('claims the equipment row inside a transaction before creating a usage session', async () => {
    mockGetConnection.mockResolvedValueOnce(mockConnection);
    mockConnection.execute.mockImplementation(async (sql) => {
      if (/FROM Elementos/.test(sql)) {
        return [[{ codigo_equipo: 1, tipo: 'Laptop', modelo: 'Dell' }]];
      }
      if (/id_historial/.test(sql)) return [[]];
      if (/INFORMATION_SCHEMA/.test(sql)) return [[{ cnt: 1 }]];
      if (/INSERT INTO Historial_Uso_Equipos/.test(sql)) return [{ insertId: 200 }];
      return [[]];
    });

    const req = mockReq({
      user: { id: 5, rol: 'Aprendiz' },
      body: { codigo_equipo: 1, nombre_usuario: 'Juan' }
    });
    const res = mockRes();
    await registrarInicioUso(req, res);

    expect(mockGetConnection).toHaveBeenCalledTimes(1);
    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringMatching(/FROM Elementos[\s\S]*FOR UPDATE/i), [1]);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
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
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN Ambientes'), []);
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN Usuarios'), []);
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

describe('obtenerHistorialEquipoUso', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  const fakeEquipo = { codigo_equipo: 10, codigo_inventario: 'INV-10', tipo: 'Laptop', modelo: 'X', consecutivo: 1 };

  function mockDb({ equipo = fakeEquipo, vinculo = null, historial = [] } = {}) {
    mockExecute.mockImplementation((sql) => {
      if (sql.includes('FROM Historial_Uso_Equipos')) {
        return Promise.resolve([historial]);
      }
      if (sql.includes('FROM Responsables_Equipo')) {
        return Promise.resolve([vinculo ? [vinculo] : []]);
      }
      if (sql.includes('FROM Elementos')) {
        return Promise.resolve([equipo ? [equipo] : []]);
      }
      return Promise.resolve([[]]);
    });
  }

  it('returns 400 when codigo is missing', async () => {
    const req = mockReq({ params: {}, user: { id: 1, rol: 'Administrador' } });
    const res = mockRes();
    await obtenerHistorialEquipoUso(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('allows broad roles (Administrador/Instructor/Cuentadante) to query any equipo without owner filtering', async () => {
    mockDb({ historial: [{ id_historial: 1, codigo_equipo: 10, id_usuario: 99 }] });
    const req = mockReq({ params: { codigo: '10' }, user: { id: 1, rol: 'Administrador' } });
    const res = mockRes();

    await obtenerHistorialEquipoUso(req, res);

    expect(res.status).not.toHaveBeenCalledWith(404);
    // No debe haberse consultado el vínculo de Responsables_Equipo (acceso amplio).
    expect(mockExecute.mock.calls.some(([sql]) => sql.includes('FROM Responsables_Equipo'))).toBe(false);
    // La consulta de historial no debe filtrar por hu.id_usuario para roles amplios.
    const historialCall = mockExecute.mock.calls.find(([sql]) => sql.includes('FROM Historial_Uso_Equipos'));
    expect(historialCall[0]).not.toContain('hu.id_usuario = ?');
    expect(historialCall[1]).toEqual([10]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('scopes an Aprendiz to their own historial on an equipo linked via Responsables_Equipo', async () => {
    mockDb({
      vinculo: { 1: 1 },
      historial: [{ id_historial: 5, codigo_equipo: 10, id_usuario: 55 }]
    });
    const req = mockReq({ params: { codigo: '10' }, user: { id: 55, rol: 'Aprendiz' } });
    const res = mockRes();

    await obtenerHistorialEquipoUso(req, res);

    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(mockExecute.mock.calls.some(([sql]) =>
      sql.includes('FROM Responsables_Equipo') && sql.includes("estado_responsabilidad = 'Activo'")
    )).toBe(true);
    const historialCall = mockExecute.mock.calls.find(([sql]) => sql.includes('FROM Historial_Uso_Equipos'));
    expect(historialCall[0]).toContain('AND hu.id_usuario = ?');
    expect(historialCall[1]).toEqual([10, 55]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('fails closed (404, no enumeration) when the Aprendiz has no active link to the equipo', async () => {
    mockDb({ vinculo: null });
    const req = mockReq({ params: { codigo: '10' }, user: { id: 77, rol: 'Aprendiz' } });
    const res = mockRes();

    await obtenerHistorialEquipoUso(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Equipo no encontrado' });
    // No debe haberse consultado el historial de uso para un equipo no autorizado.
    expect(mockExecute.mock.calls.some(([sql]) => sql.includes('FROM Historial_Uso_Equipos'))).toBe(false);
  });

  it('fails closed (404) when there is no valid identity for a restricted role', async () => {
    const req = mockReq({ params: { codigo: '10' }, user: { rol: 'Aprendiz' } }); // sin id
    const res = mockRes();

    await obtenerHistorialEquipoUso(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Equipo no encontrado' });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('fails closed (404) when there is no req.user at all', async () => {
    const req = mockReq({ params: { codigo: '10' }, user: undefined });
    const res = mockRes();

    await obtenerHistorialEquipoUso(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns 404 when the equipo does not exist (regression, broad role)', async () => {
    mockDb({ equipo: null });
    const req = mockReq({ params: { codigo: '999' }, user: { id: 1, rol: 'Administrador' } });
    const res = mockRes();

    await obtenerHistorialEquipoUso(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Equipo no encontrado' });
  });

  it('preserves date filters and limit pagination for broad-access roles (regression)', async () => {
    mockDb({ historial: [] });
    const req = mockReq({
      params: { codigo: '10' },
      query: { fecha_desde: '2026-01-01', fecha_hasta: '2026-01-31', limit: '5' },
      user: { id: 1, rol: 'Instructor' }
    });
    const res = mockRes();

    await obtenerHistorialEquipoUso(req, res);

    const historialCall = mockExecute.mock.calls.find(([sql]) => sql.includes('FROM Historial_Uso_Equipos'));
    expect(historialCall[0]).toContain('DATE(hu.fecha_hora_inicio) >= ?');
    expect(historialCall[0]).toContain('DATE(hu.fecha_hora_inicio) <= ?');
    expect(historialCall[0]).toContain('LIMIT 5');
    expect(historialCall[1]).toEqual([10, '2026-01-01', '2026-01-31']);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { codigo: '10' }, user: { id: 1, rol: 'Administrador' } });
    const res = mockRes();

    await obtenerHistorialEquipoUso(req, res);

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
    mockExecute
      .mockResolvedValueOnce([[]]) // resp
      .mockResolvedValueOnce([[]]); // cta
    const req = mockReq({ user: { id: 5, rol: 'Instructor' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    expect(res.json).toHaveBeenCalledWith({ ambientes: [], equipos: [] });
  });

  it('returns ambientes and equipos when found', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]]) // resp
      .mockResolvedValueOnce([[]]) // cta
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab', codigo_ambiente: '101' }]])
      .mockResolvedValueOnce([[{ codigo_equipo: 5, placa: 'PL-001', tipo: 'Laptop' }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ambientes: expect.any(Array), equipos: expect.any(Array) }));
  });

  it('uses the global latest verification status for the verification view', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'Lab', codigo_ambiente: '101' }]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' } });
    const res = mockRes();

    await obtenerEquiposAmbientesInstructor(req, res);

    const [equiposSql, equiposParams] = mockExecute.mock.calls[3];
    expect(equiposSql).toMatch(/SELECT vi\.estado_verificacion[\s\S]+WHERE vi\.codigo_equipo = e\.codigo_equipo/i);
    expect(equiposSql).toMatch(/AS estado_verificacion_actual/i);
    expect(equiposParams).toEqual([1]);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    const req = mockReq({ user: { id: 5, rol: 'Instructor' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });


  // ── MDL-234 ──────────────────────────────────────────────────────────────
  it('MDL-234: usuario sin responsabilidad ni equipos → vacío (2 queries)', async () => {
    mockExecute
      .mockResolvedValueOnce([[]]) // resp
      .mockResolvedValueOnce([[]]); // cta
    const req = mockReq({ user: { id: 99, rol: 'Instructor' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    expect(res.json).toHaveBeenCalledWith({ ambientes: [], equipos: [] });
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockExecute.mock.calls[0][1]).toEqual([99]);
    expect(mockExecute.mock.calls[1][1]).toEqual([99]);
  });

  it('MDL-234: SQL cta usa NULL-safe estado_fisico', async () => {
    mockExecute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
    const req = mockReq({ user: { id: 2, rol: 'Cuentadante' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    const [, ctaSql] = [mockExecute.mock.calls[0][0], mockExecute.mock.calls[1][0]];
    expect(ctaSql).toMatch(/e\.estado_fisico IS NULL OR e\.estado_fisico <> 'Baja'/);
    expect(ctaSql).not.toMatch(/e\.estado_fisico != 'Baja'/);
  });

  it('MDL-234 VI-01: varias responsabilidades → una fila con alcance responsable', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 7 }, { id_ambiente: 7 }]]) // resp (dup ids ok)
      .mockResolvedValueOnce([[]]) // cta
      .mockResolvedValueOnce([[{
        id_ambiente: 7,
        nombre_ambiente: 'Aula 107',
        codigo_ambiente: '107',
        jornada: 'Diurna',
      }]])
      .mockResolvedValueOnce([[{ codigo_equipo: 1, id_ambiente: 7, placa: 'P-1' }]]);
    const req = mockReq({ user: { id: 2, rol: 'Cuentadante' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.ambientes).toHaveLength(1);
    expect(body.ambientes[0]).toEqual(expect.objectContaining({
      id_ambiente: 7,
      alcance: 'responsable',
    }));
  });

  it('MDL-234: aula solo id_cuentadante → alcance propios y SQL filtra por id_cuentadante', async () => {
    mockExecute
      .mockResolvedValueOnce([[]]) // resp
      .mockResolvedValueOnce([[{ id_ambiente: 25 }]]) // cta
      .mockResolvedValueOnce([[{
        id_ambiente: 25,
        nombre_ambiente: 'Aula 303',
        codigo_ambiente: '303',
        jornada: null,
      }]])
      .mockResolvedValueOnce([[{
        codigo_equipo: 77,
        id_ambiente: 25,
        placa: 'P-77',
        estado_fisico: null,
        id_cuentadante: 2,
      }]]);
    const req = mockReq({ user: { id: 2, rol: 'Cuentadante' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);

    const [equiposSql, equiposParams] = mockExecute.mock.calls[3];
    expect(equiposSql).toMatch(/e\.id_ambiente IN \(\?\) AND e\.id_cuentadante = \?/);
    expect(equiposSql).not.toMatch(/e\.id_ambiente IN \(\?\)\s*$/m);
    expect(equiposParams).toEqual([25, 2]);

    const body = res.json.mock.calls[0][0];
    expect(body.ambientes[0].alcance).toBe('propios');
    expect(body.equipos).toHaveLength(1);
    expect(body.equipos[0].codigo_equipo).toBe(77);
  });

  it('MDL-234 NEG: aula compartida solo-propios → SQL exige id_cuentadante (no trae ajenos)', async () => {
    // El mock de DB solo devolvería filas que cumplan el SQL; verificamos la cláusula.
    mockExecute
      .mockResolvedValueOnce([[]]) // resp vacía
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]]) // cta
      .mockResolvedValueOnce([[{
        id_ambiente: 1,
        nombre_ambiente: 'Aula 101',
        codigo_ambiente: '101',
        jornada: null,
      }]])
      // Simula que la BD solo devolvió el propio (el ajeno no matchea AND id_cuentadante=?)
      .mockResolvedValueOnce([[{
        codigo_equipo: 10,
        id_ambiente: 1,
        id_cuentadante: 2,
        placa: 'OWN',
      }]]);
    const req = mockReq({ user: { id: 2, rol: 'Cuentadante' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);

    const [equiposSql, equiposParams] = mockExecute.mock.calls[3];
    expect(equiposSql).toMatch(/\(e\.id_ambiente IN \(\?\) AND e\.id_cuentadante = \?\)/);
    expect(equiposParams).toEqual([1, 2]);
    const body = res.json.mock.calls[0][0];
    expect(body.equipos.every((e) => e.id_cuentadante === 2)).toBe(true);
    expect(body.equipos.map((e) => e.codigo_equipo)).not.toContain(99); // ajeno no retornado
  });

  it('MDL-234: aula con responsabilidad → SQL trae todos (sin filtro id_cuentadante en esa rama)', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 7 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{
        id_ambiente: 7,
        nombre_ambiente: 'Aula 107',
        codigo_ambiente: '107',
        jornada: 'Diurna',
      }]])
      .mockResolvedValueOnce([
        [
          { codigo_equipo: 1, id_ambiente: 7, id_cuentadante: 2 },
          { codigo_equipo: 2, id_ambiente: 7, id_cuentadante: 9 }, // otro cuentadante
        ],
      ]);
    const req = mockReq({ user: { id: 2, rol: 'Cuentadante' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);

    const [equiposSql, equiposParams] = mockExecute.mock.calls[3];
    expect(equiposSql).toMatch(/WHERE \(e\.id_ambiente IN \(\?\)\)/);
    expect(equiposSql).not.toMatch(/id_cuentadante = \?\)/);
    expect(equiposParams).toEqual([7]);
    const body = res.json.mock.calls[0][0];
    expect(body.ambientes[0].alcance).toBe('responsable');
    expect(body.equipos.map((e) => e.codigo_equipo).sort()).toEqual([1, 2]);
  });

  it('MDL-234: aula en ambos sets → alcance responsable y ve todos', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 7 }]])
      .mockResolvedValueOnce([[{ id_ambiente: 7 }]]) // también cta
      .mockResolvedValueOnce([[{
        id_ambiente: 7,
        nombre_ambiente: 'Aula 107',
        codigo_ambiente: '107',
        jornada: 'Diurna',
      }]])
      .mockResolvedValueOnce([
        [
          { codigo_equipo: 1, id_ambiente: 7, id_cuentadante: 2 },
          { codigo_equipo: 3, id_ambiente: 7, id_cuentadante: 8 },
        ],
      ]);
    const req = mockReq({ user: { id: 2, rol: 'Cuentadante' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);

    const [equiposSql, equiposParams] = mockExecute.mock.calls[3];
    // Solo rama responsabilidad (cta-only vacío porque 7 está en resp)
    expect(equiposSql).toMatch(/WHERE \(e\.id_ambiente IN \(\?\)\)/);
    expect(equiposParams).toEqual([7]);
    expect(res.json.mock.calls[0][0].ambientes[0].alcance).toBe('responsable');
    expect(res.json.mock.calls[0][0].equipos).toHaveLength(2);
  });

  it('MDL-234: Instructor solo con responsabilidad → sin rama cta-only', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 3 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{
        id_ambiente: 3,
        nombre_ambiente: 'Lab',
        codigo_ambiente: '103',
        jornada: null,
      }]])
      .mockResolvedValueOnce([[{ codigo_equipo: 5, id_ambiente: 3 }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);

    expect(mockExecute.mock.calls[0][1]).toEqual([5]);
    expect(mockExecute.mock.calls[1][1]).toEqual([5]);
    const [equiposSql, equiposParams] = mockExecute.mock.calls[3];
    expect(equiposSql).toMatch(/WHERE \(e\.id_ambiente IN \(\?\)\)/);
    expect(equiposParams).toEqual([3]);
    expect(res.json.mock.calls[0][0].ambientes[0].alcance).toBe('responsable');
  });

  it('MDL-234: Baja excluida / NULL estado incluido en SQL de equipos', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'A', codigo_ambiente: '1', jornada: null }]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({ user: { id: 2, rol: 'Cuentadante' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    const [equiposSql] = mockExecute.mock.calls[3];
    expect(equiposSql).toMatch(/e\.estado_fisico IS NULL OR e\.estado_fisico <> 'Baja'/);
  });

  it('MDL-234: params de equipos nunca incluyen userId ajeno', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_ambiente: 25 }]])
      .mockResolvedValueOnce([
        [
          { id_ambiente: 1, nombre_ambiente: 'A', codigo_ambiente: '101', jornada: null },
          { id_ambiente: 25, nombre_ambiente: 'B', codigo_ambiente: '303', jornada: null },
        ],
      ])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({ user: { id: 2, rol: 'Cuentadante' } });
    const res = mockRes();
    await obtenerEquiposAmbientesInstructor(req, res);
    const flat = mockExecute.mock.calls.flatMap((c) => c[1] || []);
    expect(flat.every((p) => p === 2 || p === 1 || p === 25)).toBe(true);
    expect(flat).not.toContain(9);
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
      .mockResolvedValueOnce([[{ codigo_equipo: 1, id_ambiente: 2, id_cuentadante: 99, nombre_ambiente: 'Lab' }]])
      .mockResolvedValueOnce([[undefined]]); // sin resp
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, body: { codigo_equipo: 1, estado_verificacion: 'Verificado' } });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringMatching(/permiso/i),
    }));
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

  it('MDL-234 POST: propio en aula cta-only → 200 (sin responsabilidad)', async () => {
    mockExecute
      .mockResolvedValueOnce([[{
        codigo_equipo: 77,
        id_ambiente: 25,
        id_cuentadante: 2,
        nombre_ambiente: 'Aula 303',
      }]])
      .mockResolvedValueOnce([[undefined]]) // sin resp
      .mockResolvedValueOnce([{ insertId: 88 }]);
    const req = mockReq({
      user: { id: 2, rol: 'Cuentadante' },
      body: { codigo_equipo: 77, estado_verificacion: 'Verificado' },
    });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      id_verificacion: 88,
      contexto: expect.objectContaining({ alcance: 'propios' }),
    }));
    const insertParams = mockExecute.mock.calls[2][1];
    expect(insertParams[2]).toBeNull(); // id_clase
    expect(insertParams[3]).toBeNull(); // id_responsabilidad_ambiente
  });

  it('MDL-234 POST NEG: equipo de otro cuentadante en aula cta-only → 403 genérico', async () => {
    mockExecute
      .mockResolvedValueOnce([[{
        codigo_equipo: 99,
        id_ambiente: 25,
        id_cuentadante: 9,
        nombre_ambiente: 'Aula 303',
      }]])
      .mockResolvedValueOnce([[undefined]]);
    const req = mockReq({
      user: { id: 2, rol: 'Cuentadante' },
      body: { codigo_equipo: 99, estado_verificacion: 'Verificado' },
    });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/permiso/i);
    expect(JSON.stringify(body)).not.toMatch(/id_cuentadante|9|dueño|owner/i);
  });

  it('MDL-234 POST: equipo en aula con responsabilidad → 200 (ajeno permitido)', async () => {
    mockExecute
      .mockResolvedValueOnce([[{
        codigo_equipo: 3,
        id_ambiente: 7,
        id_cuentadante: 9,
        nombre_ambiente: 'Aula 107',
      }]])
      .mockResolvedValueOnce([[{
        id_responsabilidad_ambiente: 10,
        id_clase: null,
        jornada: 'Diurna',
        nombre_clase: null,
        codigo_ficha: null,
      }]])
      .mockResolvedValueOnce([{ insertId: 70 }]);
    const req = mockReq({
      user: { id: 2, rol: 'Cuentadante' },
      body: { codigo_equipo: 3, estado_verificacion: 'Verificado' },
    });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      contexto: expect.objectContaining({ alcance: 'responsable' }),
    }));
  });

  it('MDL-234 POST: Instructor sin resp ni ownership → 403 (sin cambio de rol)', async () => {
    mockExecute
      .mockResolvedValueOnce([[{
        codigo_equipo: 1,
        id_ambiente: 2,
        id_cuentadante: null,
        nombre_ambiente: 'Lab',
      }]])
      .mockResolvedValueOnce([[undefined]]);
    const req = mockReq({
      user: { id: 5, rol: 'Instructor' },
      body: { codigo_equipo: 1, estado_verificacion: 'Verificado' },
    });
    const res = mockRes();
    await registrarVerificacionInventario(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
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

describe('obtenerHistorialMovimientos', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  const fakeEquipo = { codigo_equipo: 7, codigo_inventario: 'INV-7', tipo: 'Laptop', modelo: 'X', consecutivo: 1 };

  function mockHistorialMovimientosDb({ equipo = fakeEquipo, vinculo = null, movimientos = [] } = {}) {
    mockExecute.mockImplementation((sql) => {
      if (sql.includes('FROM Elementos')) {
        return Promise.resolve([equipo ? [equipo] : []]);
      }
      if (sql.includes('FROM Responsables_Equipo')) {
        return Promise.resolve([vinculo ? [vinculo] : []]);
      }
      if (sql.includes('FROM Historial_Equipos')) {
        return Promise.resolve([movimientos]);
      }
      return Promise.resolve([[]]);
    });
  }

  it('allows an Aprendiz to read movements after an active own link', async () => {
    const movimientos = [{ id_historial: 1, codigo_equipo: 7, tipo_evento: 'Movimiento Ambiente' }];
    mockHistorialMovimientosDb({
      movimientos,
      vinculo: { id_responsable: 3, codigo_equipo: 7, id_usuario: 55, estado_responsabilidad: 'Activo' }
    });
    const req = mockReq({ params: { codigo: '7' }, user: { id: 55, rol: 'Aprendiz' } });
    const res = mockRes();

    await obtenerHistorialMovimientos(req, res);

    const calls = mockExecute.mock.calls.map(([sql]) => sql);
    const linkIndex = calls.findIndex((sql) => sql.includes('FROM Responsables_Equipo'));
    const historyIndex = calls.findIndex((sql) => sql.includes('FROM Historial_Equipos'));
    expect(linkIndex).toBeGreaterThanOrEqual(0);
    expect(linkIndex).toBeLessThan(historyIndex);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ movimientos, total: 1 }));
  });

  it('fails closed without querying movements for another Aprendiz equipo', async () => {
    mockHistorialMovimientosDb({ movimientos: [{ id_historial: 1 }], vinculo: null });
    const req = mockReq({ params: { codigo: '7' }, user: { id: 55, rol: 'Aprendiz' } });
    const res = mockRes();

    await obtenerHistorialMovimientos(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Equipo no encontrado' });
    expect(mockExecute.mock.calls.some(([sql]) => sql.includes('FROM Historial_Equipos'))).toBe(false);
  });

  it.each([0, -1, 'invalid', undefined])(
    'fails closed before any query for an invalid Aprendiz identity (%s)',
    async (id) => {
      const req = mockReq({ params: { codigo: '7' }, user: { id, rol: 'Aprendiz' } });
      const res = mockRes();

      await obtenerHistorialMovimientos(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Equipo no encontrado' });
      expect(mockExecute).not.toHaveBeenCalled();
    }
  );

  it.each(['Administrador', 'Instructor', 'Cuentadante'])(
    'preserves broad movement visibility for %s',
    async (rol) => {
      const movimientos = [{ id_historial: 8, codigo_equipo: 7, tipo_evento: 'Movimiento Ambiente' }];
      mockHistorialMovimientosDb({ movimientos });
      const req = mockReq({ params: { codigo: '7' }, user: { id: 1, rol } });
      const res = mockRes();

      await obtenerHistorialMovimientos(req, res);

      expect(res.status).not.toHaveBeenCalledWith(404);
      expect(mockExecute.mock.calls.some(([sql]) => sql.includes('FROM Responsables_Equipo'))).toBe(false);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ movimientos, total: 1 }));
    }
  );
});

describe('obtenerHistorialEquipo', () => {
  beforeEach(() => { mockExecute.mockReset(); jest.clearAllMocks(); });

  const fakeEquipo = { codigo_equipo: 5, codigo_inventario: 'INV-5', tipo: 'Laptop' };

  function mockHistorialVerificacionesDb({ equipo = fakeEquipo, vinculo = null, historial = [] } = {}) {
    mockExecute.mockImplementation((sql) => {
      if (sql.includes('FROM Elementos')) {
        return Promise.resolve([equipo ? [equipo] : []]);
      }
      if (sql.includes('FROM Responsables_Equipo')) {
        return Promise.resolve([vinculo ? [vinculo] : []]);
      }
      if (sql.includes('FROM Verificaciones_Inventario')) {
        return Promise.resolve([historial]);
      }
      return Promise.resolve([[]]);
    });
  }

  it('returns historial and equipo info', async () => {
    const fakeHistorial = [{ id_verificacion: 1, estado_verificacion: 'Verificado' }];
    mockHistorialVerificacionesDb({ historial: fakeHistorial });
    const req = mockReq({ params: { codigo: '5' }, query: {} });
    const res = mockRes();
    await obtenerHistorialEquipo(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ historial: fakeHistorial, total: 1 }));
  });

  it('allows an Aprendiz to read verifications after an active own link', async () => {
    const fakeHistorial = [{ id_verificacion: 1, estado_verificacion: 'Verificado' }];
    mockHistorialVerificacionesDb({
      historial: fakeHistorial,
      vinculo: { id_responsable: 9, codigo_equipo: 5, id_usuario: 55, estado_responsabilidad: 'Activo' }
    });
    const req = mockReq({ params: { codigo: '5' }, query: {}, user: { id: 55, rol: 'Aprendiz' } });
    const res = mockRes();

    await obtenerHistorialEquipo(req, res);

    const calls = mockExecute.mock.calls.map(([sql]) => sql);
    const linkIndex = calls.findIndex((sql) => sql.includes('FROM Responsables_Equipo'));
    const historyIndex = calls.findIndex((sql) => sql.includes('FROM Verificaciones_Inventario'));
    expect(linkIndex).toBeGreaterThanOrEqual(0);
    expect(linkIndex).toBeLessThan(historyIndex);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ historial: fakeHistorial, total: 1 }));
  });

  it('fails closed without querying verifications for another Aprendiz equipo', async () => {
    mockHistorialVerificacionesDb({
      historial: [{ id_verificacion: 1 }],
      vinculo: null
    });
    const req = mockReq({ params: { codigo: '5' }, query: {}, user: { id: 55, rol: 'Aprendiz' } });
    const res = mockRes();

    await obtenerHistorialEquipo(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Equipo no encontrado' });
    expect(mockExecute.mock.calls.some(([sql]) => sql.includes('FROM Verificaciones_Inventario'))).toBe(false);
  });

  it.each([0, -1, 'invalid', undefined])(
    'fails closed before any query for an invalid Aprendiz identity (%s)',
    async (id) => {
      const req = mockReq({ params: { codigo: '5' }, query: {}, user: { id, rol: 'Aprendiz' } });
      const res = mockRes();

      await obtenerHistorialEquipo(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Equipo no encontrado' });
      expect(mockExecute).not.toHaveBeenCalled();
    }
  );

  it.each(['Administrador', 'Instructor', 'Cuentadante'])(
    'preserves broad verification visibility for %s',
    async (rol) => {
      const fakeHistorial = [{ id_verificacion: 8, estado_verificacion: 'Verificado' }];
      mockHistorialVerificacionesDb({ historial: fakeHistorial });
      const req = mockReq({ params: { codigo: '5' }, query: {}, user: { id: 1, rol } });
      const res = mockRes();

      await obtenerHistorialEquipo(req, res);

      expect(res.status).not.toHaveBeenCalledWith(404);
      expect(mockExecute.mock.calls.some(([sql]) => sql.includes('FROM Responsables_Equipo'))).toBe(false);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ historial: fakeHistorial }));
    }
  );

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

describe('registrarUsoEquipoExterno', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockVerificarDisponibilidad.mockReset();
    mockGetConnection.mockReset();
    mockGetConnection.mockResolvedValue(mockConnection);
    mockConnectionExecute.mockReset();
    mockConnectionExecute.mockImplementation((...args) => mockExecute(...args));
    mockConnection.beginTransaction.mockReset();
    mockConnection.commit.mockReset();
    mockConnection.rollback.mockReset();
    mockConnection.release.mockReset();
    jest.clearAllMocks();
  });

  it('cleans up a renamed evidence file and fails the request when its INSERT fails', async () => {
    const existsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const renameSync = jest.spyOn(fs, 'renameSync').mockImplementation(() => {});
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 42, placa: 'EXT-42', id_ambiente: null }]])
      .mockRejectedValueOnce(new Error('INSERT Imagenes_Equipo failed'));
    mockVerificarDisponibilidad.mockResolvedValue({ disponible: true });
    const req = mockReq({
      body: { placa: 'EXT-42', usuarios: [] },
      files: [{ filename: 'temporal.png', originalname: 'evidence.png' }],
    });
    const res = mockRes();

    try {
      await registrarUsoEquipoExterno(req, res);
    } finally {
      existsSync.mockRestore();
      renameSync.mockRestore();
    }

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(mockDeleteImageFile).toHaveBeenCalledWith(expect.stringMatching(/-42-evidence\.png$/));
  });

  it('compensates persisted image metadata and every file when a later INSERT fails', async () => {
    const existsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const renameSync = jest.spyOn(fs, 'renameSync').mockImplementation(() => {});
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 42, placa: 'EXT-42', id_ambiente: null }]])
      .mockResolvedValueOnce([{ insertId: 901 }])
      .mockRejectedValueOnce(new Error('second Imagenes_Equipo INSERT failed'));
    mockVerificarDisponibilidad.mockResolvedValue({ disponible: true });
    const req = mockReq({
      body: { placa: 'EXT-42', usuarios: [] },
      files: [
        { filename: 'temporal-one.png', originalname: 'one.png' },
        { filename: 'temporal-two.png', originalname: 'two.png' },
      ],
    });
    const res = mockRes();

    try {
      await registrarUsoEquipoExterno(req, res);
    } finally {
      existsSync.mockRestore();
      renameSync.mockRestore();
    }

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM Imagenes_Equipo/i),
      [901]
    );
    expect(mockDeleteImageFile).toHaveBeenCalledWith(expect.stringMatching(/-42-one\.png$/));
    expect(mockDeleteImageFile).toHaveBeenCalledWith(expect.stringMatching(/-42-two\.png$/));
  });
});
