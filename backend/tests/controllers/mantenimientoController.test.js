import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.resolve(__dirname, '../../src/config/dbconfig.js');
const loggerPath = path.resolve(__dirname, '../../src/utils/logger.js');
const notifPath = path.resolve(__dirname, '../../src/services/notificationService.js');
const sqlPath = path.resolve(__dirname, '../../src/utils/sqlQueries.js');
const socketPath = path.resolve(__dirname, '../../src/services/socketService.js');

const mockExecute = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const mockCreateForUsers = jest.fn().mockResolvedValue({ inserted: 1 });
const mockCreateForRole = jest.fn().mockResolvedValue({ inserted: 1 });
const mockObtenerEquipoPorCodigo = jest.fn();
const mockObtenerUsuarioActivo = jest.fn();
const mockDeshabilitarAsignaciones = jest.fn().mockResolvedValue({ deshabilitadas: 0, usuarios_afectados: [] });
const mockSocketEmitToAll = jest.fn();

await jest.unstable_mockModule(dbPath, () => ({ default: { execute: mockExecute } }));
await jest.unstable_mockModule(loggerPath, () => ({ logger: mockLogger }));
await jest.unstable_mockModule(notifPath, () => ({
  createForUsers: mockCreateForUsers,
  createForRole: mockCreateForRole,
}));
await jest.unstable_mockModule(sqlPath, () => ({
  obtenerEquipoPorCodigo: mockObtenerEquipoPorCodigo,
  obtenerUsuarioActivo: mockObtenerUsuarioActivo,
  deshabilitarAsignacionesActivas: mockDeshabilitarAsignaciones,
}));
await jest.unstable_mockModule(socketPath, () => ({
  default: { emitToAll: mockSocketEmitToAll },
}));

const {
  crearMantenimiento,
  listarMantenimientos,
  obtenerMantenimientoPorId,
  actualizarFechaProximo,
  actualizarFechaMantenimiento,
  actualizarEstadoMantenimiento,
  eliminarMantenimiento,
  obtenerTiposMantenimiento,
  obtenerEstadosMantenimiento,
} = await import('../../src/controller/mantenimientoController.js');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => { jest.clearAllMocks(); });

// ─────────────────────────── crearMantenimiento ───────────────────────────
describe('crearMantenimiento', () => {
  it('returns 400 when required fields missing', async () => {
    const req = { body: { tipo_mantenimiento: 'Preventivo' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    await crearMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when equipo not found', async () => {
    const req = { body: { codigo_equipo: 'E001', tipo_mantenimiento: 'Preventivo', fecha_mantenimiento: '2025-01-01' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce(null);
    await crearMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when Instructor and no asignacion', async () => {
    const req = { body: { codigo_equipo: 'E001', tipo_mantenimiento: 'Preventivo', fecha_mantenimiento: '2025-01-01' }, user: { id: 5, rol: 'Instructor' } };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P001', modelo: 'M1' });
    mockExecute.mockResolvedValueOnce([[]]); // no asignacion
    await crearMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when tecnico not found', async () => {
    const req = { body: { codigo_equipo: 'E001', tipo_mantenimiento: 'Preventivo', fecha_mantenimiento: '2025-01-01', id_usuario_tecnico: 99 }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P001', modelo: 'M1' });
    mockObtenerUsuarioActivo.mockResolvedValueOnce(null);
    await crearMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('creates mantenimiento successfully for Administrador', async () => {
    const req = {
      body: { codigo_equipo: 'E001', tipo_mantenimiento: 'Preventivo', fecha_mantenimiento: '2025-01-01', descripcion_trabajo: 'Limpieza' },
      user: { id: 1, rol: 'Administrador' },
    };
    const res = mockRes();
    const fakeEquipo = { codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P001', modelo: 'M1' };
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce(fakeEquipo);
    // INSERT mantenimiento
    mockExecute
      .mockResolvedValueOnce([{ insertId: 10 }])            // INSERT Mantenimiento
      .mockResolvedValueOnce([[]])                           // SELECT responsables (no hay)
      .mockResolvedValueOnce([{ insertId: 20 }]);            // INSERT Reportes
    await crearMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, id: 10 }));
  });

  it('creates mantenimiento with datetime-local format and fecha_proximo', async () => {
    const req = {
      body: {
        codigo_equipo: 'E001',
        tipo_mantenimiento: 'Correctivo',
        fecha_mantenimiento: '2025-06-15T10:30',
        fecha_proximo: '2025-09-15',
      },
      user: { id: 1, rol: 'Administrador' },
    };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P001', modelo: 'M1' });
    mockExecute
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE Elementos fecha_proximo
      .mockResolvedValueOnce([{ insertId: 11 }])     // INSERT Mantenimiento
      .mockResolvedValueOnce([[]])                    // SELECT responsables
      .mockResolvedValueOnce([{ insertId: 21 }]);    // INSERT Reportes
    await crearMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates mantenimiento with datetime that already has seconds', async () => {
    const req = {
      body: {
        codigo_equipo: 'E001',
        tipo_mantenimiento: 'Correctivo',
        fecha_mantenimiento: '2025-06-15T10:30:00',
      },
      user: { id: 1, rol: 'Administrador' },
    };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P001', modelo: 'M1' });
    mockExecute
      .mockResolvedValueOnce([{ insertId: 12 }])  // INSERT Mantenimiento
      .mockResolvedValueOnce([[]])                  // SELECT responsables
      .mockResolvedValueOnce([{ insertId: 22 }]); // INSERT Reportes
    await crearMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('notifies responsables when they exist', async () => {
    const req = {
      body: { codigo_equipo: 'E001', tipo_mantenimiento: 'Preventivo', fecha_mantenimiento: '2025-01-01' },
      user: { id: 1, rol: 'Administrador' },
    };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P001', modelo: 'M1' });
    mockExecute
      .mockResolvedValueOnce([{ insertId: 13 }])                          // INSERT Mantenimiento
      .mockResolvedValueOnce([[{ id_usuario: 2 }, { id_usuario: 3 }]])    // SELECT responsables
      .mockResolvedValueOnce([{ insertId: 23 }]);                         // INSERT Reportes
    await crearMantenimiento(req, res);
    expect(mockCreateForUsers).toHaveBeenCalled();
  });

  it('returns 500 on unhandled error', async () => {
    const req = { body: { codigo_equipo: 'E001', tipo_mantenimiento: 'Preventivo', fecha_mantenimiento: '2025-01-01' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockRejectedValueOnce(new Error('DB fail'));
    await crearMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── listarMantenimientos ───────────────────────────
describe('listarMantenimientos', () => {
  it('lists all mantenimientos for Administrador', async () => {
    const req = { user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    // actualizarEstadosAutomaticos calls: SELECT programados
    mockExecute
      .mockResolvedValueOnce([[]])               // SELECT programados (none)
      .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]); // SELECT mantenimientos
    await listarMantenimientos(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.any(Array));
  });

  it('filters mantenimientos for Instructor', async () => {
    const req = { user: { id: 5, rol: 'Instructor' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[]])        // SELECT programados
      .mockResolvedValueOnce([[{ id: 1 }]]); // filtered mantenimientos
    await listarMantenimientos(req, res);
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it('returns 500 on error', async () => {
    const req = { user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    await listarMantenimientos(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── obtenerMantenimientoPorId ───────────────────────────
describe('obtenerMantenimientoPorId', () => {
  it('returns 404 when not found', async () => {
    const req = { params: { id: '99' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[]])   // actualizarEstadosAutomaticos
      .mockResolvedValueOnce([[]]); // mantenimiento not found
    await obtenerMantenimientoPorId(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns mantenimiento for Administrador', async () => {
    const req = { params: { id: '1' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    const fakeM = { id_mantenimiento: 1, codigo_equipo: 'E001' };
    mockExecute
      .mockResolvedValueOnce([[]])        // actualizarEstadosAutomaticos
      .mockResolvedValueOnce([[fakeM]]); // mantenimiento found
    await obtenerMantenimientoPorId(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeM);
  });

  it('returns 403 for Instructor without asignacion', async () => {
    const req = { params: { id: '1' }, user: { id: 5, rol: 'Instructor' } };
    const res = mockRes();
    const fakeM = { id_mantenimiento: 1, codigo_equipo: 'E001' };
    mockExecute
      .mockResolvedValueOnce([[]])       // actualizarEstadosAutomaticos
      .mockResolvedValueOnce([[fakeM]]) // mantenimiento found
      .mockResolvedValueOnce([[]]);     // no asignacion
    await obtenerMantenimientoPorId(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns mantenimiento for Instructor with valid asignacion', async () => {
    const req = { params: { id: '1' }, user: { id: 5, rol: 'Instructor' } };
    const res = mockRes();
    const fakeM = { id_mantenimiento: 1, codigo_equipo: 'E001' };
    mockExecute
      .mockResolvedValueOnce([[]])                 // actualizarEstadosAutomaticos
      .mockResolvedValueOnce([[fakeM]])            // mantenimiento found
      .mockResolvedValueOnce([[{ id_responsable: 1 }]]); // asignacion found
    await obtenerMantenimientoPorId(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeM);
  });

  it('returns 500 on error', async () => {
    const req = { params: { id: '1' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    await obtenerMantenimientoPorId(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── actualizarFechaProximo ───────────────────────────
describe('actualizarFechaProximo', () => {
  it('returns 400 when fecha_proximo missing', async () => {
    const req = { params: { id: '1' }, body: {}, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    await actualizarFechaProximo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 for non-Administrador/Cuentadante role', async () => {
    const req = { params: { id: '1' }, body: { fecha_proximo: '2025-12-01' }, user: { id: 1, rol: 'Instructor' } };
    const res = mockRes();
    await actualizarFechaProximo(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when mantenimiento not found', async () => {
    const req = { params: { id: '99' }, body: { fecha_proximo: '2025-12-01' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await actualizarFechaProximo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates fecha_proximo successfully', async () => {
    const req = { params: { id: '1' }, body: { fecha_proximo: '2025-12-01' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001' }]]) // mantenimiento found
      .mockResolvedValueOnce([{ affectedRows: 1 }]);         // UPDATE Elementos
    await actualizarFechaProximo(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 400 when ER_BAD_FIELD_ERROR on column not existing', async () => {
    const req = { params: { id: '1' }, body: { fecha_proximo: '2025-12-01' }, user: { id: 1, rol: 'Cuentadante' } };
    const res = mockRes();
    const fieldErr = new Error('column missing');
    fieldErr.code = 'ER_BAD_FIELD_ERROR';
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001' }]])
      .mockRejectedValueOnce(fieldErr);
    await actualizarFechaProximo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on other DB error', async () => {
    const req = { params: { id: '1' }, body: { fecha_proximo: '2025-12-01' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await actualizarFechaProximo(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── actualizarFechaMantenimiento ───────────────────────────
describe('actualizarFechaMantenimiento', () => {
  it('returns 400 when fecha_mantenimiento missing', async () => {
    const req = { params: { id: '1' }, body: {}, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    await actualizarFechaMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 for Instructor role', async () => {
    const req = { params: { id: '1' }, body: { fecha_mantenimiento: '2025-01-01' }, user: { id: 1, rol: 'Instructor' } };
    const res = mockRes();
    await actualizarFechaMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when not found', async () => {
    const req = { params: { id: '99' }, body: { fecha_mantenimiento: '2025-01-01' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await actualizarFechaMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates fecha with T format and 16 chars', async () => {
    const req = { params: { id: '1' }, body: { fecha_mantenimiento: '2025-01-01T10:00' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001', estado_mantenimiento: 'Programado' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await actualizarFechaMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('updates fecha with T format including seconds', async () => {
    const req = { params: { id: '1' }, body: { fecha_mantenimiento: '2025-01-01T10:00:00' }, user: { id: 1, rol: 'Cuentadante' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001', estado_mantenimiento: 'Programado' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await actualizarFechaMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on error', async () => {
    const req = { params: { id: '1' }, body: { fecha_mantenimiento: '2025-01-01' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await actualizarFechaMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── actualizarEstadoMantenimiento ───────────────────────────
describe('actualizarEstadoMantenimiento', () => {
  it('returns 400 when estado missing', async () => {
    const req = { params: { id: '1' }, body: {}, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    await actualizarEstadoMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when estado invalid', async () => {
    const req = { params: { id: '1' }, body: { estado_mantenimiento: 'Invalido' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    await actualizarEstadoMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when mantenimiento not found', async () => {
    const req = { params: { id: '99' }, body: { estado_mantenimiento: 'Completado' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await actualizarEstadoMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 for Instructor without asignacion', async () => {
    const req = { params: { id: '1' }, body: { estado_mantenimiento: 'Completado' }, user: { id: 5, rol: 'Instructor' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001' }]])
      .mockResolvedValueOnce([[]]); // no asignacion
    await actualizarEstadoMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('updates to "En Proceso" - sets En Mantenimiento and disables asignaciones', async () => {
    const req = { params: { id: '1' }, body: { estado_mantenimiento: 'En Proceso' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001' }]])    // SELECT mantenimiento
      .mockResolvedValueOnce([{ affectedRows: 1 }])             // UPDATE Mantenimiento estado
      .mockResolvedValueOnce([{ affectedRows: 1 }]);            // UPDATE Estado_Equipo
    mockDeshabilitarAsignaciones.mockResolvedValueOnce({ deshabilitadas: 2, usuarios_afectados: [1, 2] });
    await actualizarEstadoMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('updates to "Completado" - sets Disponible', async () => {
    const req = { params: { id: '1' }, body: { estado_mantenimiento: 'Completado' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001' }]])    // SELECT
      .mockResolvedValueOnce([{ affectedRows: 1 }])             // UPDATE Mantenimiento
      .mockResolvedValueOnce([{ affectedRows: 1 }]);            // UPDATE Estado_Equipo Disponible
    await actualizarEstadoMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('updates to "Programado" - no estado_operativo change', async () => {
    const req = { params: { id: '1' }, body: { estado_mantenimiento: 'Programado' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001' }]])    // SELECT
      .mockResolvedValueOnce([{ affectedRows: 1 }]);            // UPDATE Mantenimiento
    await actualizarEstadoMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on error', async () => {
    const req = { params: { id: '1' }, body: { estado_mantenimiento: 'Completado' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await actualizarEstadoMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── eliminarMantenimiento ───────────────────────────
describe('eliminarMantenimiento', () => {
  it('returns 403 for non-Administrador', async () => {
    const req = { params: { id: '1' }, user: { rol: 'Instructor' } };
    const res = mockRes();
    await eliminarMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when not found', async () => {
    const req = { params: { id: '99' }, user: { rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await eliminarMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes mantenimiento successfully', async () => {
    const req = { params: { id: '1' }, user: { rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_mantenimiento: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await eliminarMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on error', async () => {
    const req = { params: { id: '1' }, user: { rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await eliminarMantenimiento(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── obtenerTiposMantenimiento ───────────────────────────
describe('obtenerTiposMantenimiento', () => {
  it('returns default types when no rows returned', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]);
    await obtenerTiposMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Preventivo']));
  });

  it('returns default types when COLUMN_TYPE is not enum', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: 'varchar(50)' }]]);
    await obtenerTiposMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Preventivo']));
  });

  it('parses ENUM values from COLUMN_TYPE', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: "enum('Preventivo','Correctivo','Actualización')" }]]);
    await obtenerTiposMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(['Preventivo', 'Correctivo', 'Actualización']);
  });

  it('returns default types on DB error', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await obtenerTiposMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Preventivo']));
  });
});

// ─────────────────────────── obtenerEstadosMantenimiento ───────────────────────────
describe('obtenerEstadosMantenimiento', () => {
  it('returns default states when no rows returned', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]);
    await obtenerEstadosMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Programado']));
  });

  it('parses ENUM values for estados', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: "enum('Programado','En Proceso','Completado','Cancelado')" }]]);
    await obtenerEstadosMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(['Programado', 'En Proceso', 'Completado', 'Cancelado']);
  });

  it('returns default states on DB error', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await obtenerEstadosMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Programado']));
  });

  it('returns default states when COLUMN_TYPE not enum', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: 'varchar(50)' }]]);
    await obtenerEstadosMantenimiento(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Programado']));
  });
});
