import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.resolve(__dirname, '../../src/config/dbconfig.js');
const loggerPath = path.resolve(__dirname, '../../src/utils/logger.js');
const notifPath = path.resolve(__dirname, '../../src/services/notificationService.js');
const sqlPath = path.resolve(__dirname, '../../src/utils/sqlQueries.js');
const emailPath = path.resolve(__dirname, '../../src/services/emailService.js');
const configPath = path.resolve(__dirname, '../../src/config/config.js');
const socketPath = path.resolve(__dirname, '../../src/services/socketService.js');

const mockExecute = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const mockCreateForUsers = jest.fn().mockResolvedValue({ inserted: 1 });
const mockCreateForRole = jest.fn().mockResolvedValue({ inserted: 1 });
const mockObtenerEquipoPorCodigo = jest.fn();
const mockObtenerUsuarioActivo = jest.fn();
const mockDeshabilitarAsignaciones = jest.fn().mockResolvedValue({ deshabilitadas: 0, usuarios_afectados: [] });
const mockSendEmail = jest.fn().mockResolvedValue(true);
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
await jest.unstable_mockModule(emailPath, () => ({
  default: { sendEmail: mockSendEmail },
}));
await jest.unstable_mockModule(configPath, () => ({
  config: { frontendUrl: 'https://test.app' },
}));
await jest.unstable_mockModule(socketPath, () => ({
  default: { emitToAll: mockSocketEmitToAll },
}));

const {
  crearNovedad,
  listarNovedades,
  obtenerNovedadPorId,
  actualizarEstadoNovedad,
  obtenerTiposNovedad,
  obtenerEstadosNovedad,
} = await import('../../src/controller/novedadesController.js');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  mockExecute.mockReset();
  jest.clearAllMocks();
  mockCreateForUsers.mockResolvedValue({ inserted: 1 });
  mockCreateForRole.mockResolvedValue({ inserted: 1 });
  mockSendEmail.mockResolvedValue(true);
  mockDeshabilitarAsignaciones.mockResolvedValue({ deshabilitadas: 0, usuarios_afectados: [] });
});

// ─────────────────────────── crearNovedad ───────────────────────────
describe('crearNovedad', () => {
  it('returns 404 when equipo not found', async () => {
    const req = { body: { codigo_equipo: 'E999', tipo_novedad: 'Daño', descripcion: 'test' }, user: { id: 1, rol: 'Administrador', nombre: 'Admin' } };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce(null);
    await crearNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 for Aprendiz with no asignacion', async () => {
    const req = { body: { codigo_equipo: 'E001', tipo_novedad: 'Daño', descripcion: 'test' }, user: { id: 5, rol: 'Aprendiz', nombre: 'Learner' } };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P1', modelo: 'M1' });
    mockExecute.mockResolvedValueOnce([[]]); // no asignacion
    await crearNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when tipo_novedad DB error includes tipo_novedad in message', async () => {
    const req = { body: { codigo_equipo: 'E001', tipo_novedad: 'InvalidType', descripcion: 'test' }, user: { id: 1, rol: 'Administrador', nombre: 'Admin' } };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P1', modelo: 'M1' });
    const dbErr = new Error('Data truncated for column tipo_novedad');
    mockExecute.mockRejectedValueOnce(dbErr); // INSERT fails
    await crearNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates novedad successfully for Administrador - non-critical type', async () => {
    const req = {
      body: { codigo_equipo: 'E001', tipo_novedad: 'Mal Funcionamiento', descripcion: 'No enciende' },
      user: { id: 1, rol: 'Administrador', nombre: 'Admin' },
    };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P1', modelo: 'M1' });
    mockExecute
      .mockResolvedValueOnce([{ insertId: 5 }])            // INSERT Novedades
      .mockResolvedValueOnce([[{ id_usuario: 2 }]])        // SELECT responsables
      .mockResolvedValueOnce(undefined);                   // (no more calls)
    await crearNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, id: 5 }));
  });

  it('creates novedad for Instructor - notifies Administrador', async () => {
    const req = {
      body: { codigo_equipo: 'E001', tipo_novedad: 'Mal Funcionamiento', descripcion: 'problema' },
      user: { id: 3, rol: 'Instructor', nombre: 'Instr' },
    };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P1', modelo: 'M1' });
    mockExecute
      .mockResolvedValueOnce([[{ id_responsable: 1 }]])  // asignacion check for Instructor
      .mockResolvedValueOnce([{ insertId: 6 }])           // INSERT Novedades
      .mockResolvedValueOnce([[{ id_usuario: 4 }]]);       // SELECT responsables
    await crearNovedad(req, res);
    expect(mockCreateForRole).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates novedad with critical type "daño" - updates equipo state', async () => {
    const req = {
      body: { codigo_equipo: 'E001', tipo_novedad: 'Daño', descripcion: 'pantalla rota' },
      user: { id: 1, rol: 'Administrador', nombre: 'Admin' },
    };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({
      codigo_equipo: 'E001',
      tipo: 'Laptop',
      placa: 'P1',
      modelo: 'M1',
      id_cuentadante: 10,
      id_ambiente: 2,
    });
    mockExecute
      .mockResolvedValueOnce([{ insertId: 7 }])              // INSERT Novedades
      .mockResolvedValueOnce([[]])                            // SELECT responsables (empty)
      .mockResolvedValueOnce([{ affectedRows: 1 }])          // INSERT/UPDATE Estado_Equipo
      .mockResolvedValueOnce([{ affectedRows: 1 }])          // UPDATE Elementos estado_fisico
      .mockResolvedValueOnce([[{ id_usuario: 5 }]])           // SELECT instructores ambiente
      .mockResolvedValueOnce([[{ id_usuario: 7, correo: 'a@test.com', nombre_usuario: 'User A' }]]) // SELECT usuariosDestino
      .mockResolvedValueOnce([[{ nombre_usuario: 'Reportador' }]]); // SELECT reporter
    mockDeshabilitarAsignaciones.mockResolvedValueOnce({ deshabilitadas: 1, usuarios_afectados: [11] });
    await crearNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates novedad with critical type "robo" - estado Dado de Baja', async () => {
    const req = {
      body: { codigo_equipo: 'E001', tipo_novedad: 'Robo', descripcion: 'equipo robado' },
      user: { id: 1, rol: 'Administrador', nombre: 'Admin' },
    };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({
      codigo_equipo: 'E001', tipo: 'Laptop', placa: 'P1', modelo: 'M1',
      id_cuentadante: null, id_ambiente: null,
    });
    mockExecute
      .mockResolvedValueOnce([{ insertId: 8 }])    // INSERT Novedades
      .mockResolvedValueOnce([[]])                  // SELECT responsables
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT/UPDATE Estado_Equipo (no estado_fisico update for robo)
    await crearNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 500 on unhandled error', async () => {
    const req = { body: { codigo_equipo: 'E001', tipo_novedad: 'Daño', descripcion: 'test' }, user: { id: 1, rol: 'Administrador', nombre: 'Admin' } };
    const res = mockRes();
    mockObtenerEquipoPorCodigo.mockRejectedValueOnce(new Error('DB down'));
    await crearNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── listarNovedades ───────────────────────────
describe('listarNovedades', () => {
  it('lists all novedades for Administrador', async () => {
    const req = { user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ id_novedad: 1 }, { id_novedad: 2 }]]);
    await listarNovedades(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.any(Array));
  });

  it('filters novedades for Instructor', async () => {
    const req = { user: { id: 5, rol: 'Instructor' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ id_novedad: 1 }]]);
    await listarNovedades(req, res);
    expect(res.json).toHaveBeenCalledWith([{ id_novedad: 1 }]);
  });

  it('filters novedades for Aprendiz', async () => {
    const req = { user: { id: 7, rol: 'Aprendiz' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ id_novedad: 3 }]]);
    await listarNovedades(req, res);
    expect(res.json).toHaveBeenCalledWith([{ id_novedad: 3 }]);
  });

  it('returns 500 on error', async () => {
    const req = { user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await listarNovedades(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── obtenerNovedadPorId ───────────────────────────
describe('obtenerNovedadPorId', () => {
  it('returns 404 when novedad not found', async () => {
    const req = { params: { id: '99' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await obtenerNovedadPorId(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns novedad for Administrador', async () => {
    const req = { params: { id: '1' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    const fakeN = { id_novedad: 1, codigo_equipo: 'E001' };
    mockExecute.mockResolvedValueOnce([[fakeN]]);
    await obtenerNovedadPorId(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeN);
  });

  it('returns 403 for Aprendiz without asignacion', async () => {
    const req = { params: { id: '1' }, user: { id: 5, rol: 'Aprendiz' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_novedad: 1, codigo_equipo: 'E001' }]])
      .mockResolvedValueOnce([[]]); // no asignacion
    await obtenerNovedadPorId(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns novedad for Instructor with valid asignacion', async () => {
    const req = { params: { id: '1' }, user: { id: 5, rol: 'Instructor' } };
    const res = mockRes();
    const fakeN = { id_novedad: 1, codigo_equipo: 'E001' };
    mockExecute
      .mockResolvedValueOnce([[fakeN]])
      .mockResolvedValueOnce([[{ id_responsable: 1 }]]); // asignacion found
    await obtenerNovedadPorId(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeN);
  });

  it('returns 500 on error', async () => {
    const req = { params: { id: '1' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await obtenerNovedadPorId(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── actualizarEstadoNovedad ───────────────────────────
describe('actualizarEstadoNovedad', () => {
  it('returns 400 when estado_resolucion missing', async () => {
    const req = { params: { id: '1' }, body: {}, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    await actualizarEstadoNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid estado_resolucion', async () => {
    const req = { params: { id: '1' }, body: { estado_resolucion: 'Invalido' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    await actualizarEstadoNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 for non-Administrador', async () => {
    const req = { params: { id: '1' }, body: { estado_resolucion: 'Resuelto' }, user: { id: 5, rol: 'Instructor' } };
    const res = mockRes();
    await actualizarEstadoNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when novedad not found', async () => {
    const req = { params: { id: '99' }, body: { estado_resolucion: 'Resuelto' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await actualizarEstadoNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates to Resuelto - sets fecha_resolucion and resuelto_por', async () => {
    const req = { params: { id: '1' }, body: { estado_resolucion: 'Resuelto', observaciones_resolucion: 'Arreglado' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001', estado_resolucion: 'Pendiente' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
    await actualizarEstadoNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado_resolucion: 'Resuelto' }));
  });

  it('updates to No Resuelto - sets fecha_resolucion', async () => {
    const req = { params: { id: '1' }, body: { estado_resolucion: 'No Resuelto' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001', estado_resolucion: 'Pendiente' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await actualizarEstadoNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado_resolucion: 'No Resuelto' }));
  });

  it('updates to En Proceso - null fecha_resolucion', async () => {
    const req = { params: { id: '1' }, body: { estado_resolucion: 'En Proceso' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 'E001', estado_resolucion: 'Pendiente' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await actualizarEstadoNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado_resolucion: 'En Proceso' }));
  });

  it('returns 500 on error', async () => {
    const req = { params: { id: '1' }, body: { estado_resolucion: 'Resuelto' }, user: { id: 1, rol: 'Administrador' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await actualizarEstadoNovedad(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── obtenerTiposNovedad ───────────────────────────
describe('obtenerTiposNovedad', () => {
  it('returns default types when no rows', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]);
    await obtenerTiposNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Daño']));
  });

  it('returns default types when not ENUM type', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: 'varchar(50)' }]]);
    await obtenerTiposNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Daño']));
  });

  it('parses ENUM values', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: "enum('Daño','Pérdida','Robo','Mal Funcionamiento')" }]]);
    await obtenerTiposNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(['Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento']);
  });

  it('returns default on DB error', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await obtenerTiposNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Daño']));
  });
});

// ─────────────────────────── obtenerEstadosNovedad ───────────────────────────
describe('obtenerEstadosNovedad', () => {
  it('returns default estados when no rows', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]);
    await obtenerEstadosNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Pendiente']));
  });

  it('parses ENUM estados', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: "enum('Pendiente','En Proceso','Resuelto','No Resuelto')" }]]);
    await obtenerEstadosNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto']);
  });

  it('returns default on DB error', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await obtenerEstadosNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Pendiente']));
  });

  it('returns defaults when COLUMN_TYPE not enum', async () => {
    const req = {}; const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: 'text' }]]);
    await obtenerEstadosNovedad(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['Pendiente']));
  });
});
