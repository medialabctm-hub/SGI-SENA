import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockExecute = jest.fn();
const mockConnection = {
  execute: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn()
};
const mockGetConnection = jest.fn();
const mockPoolQuery = jest.fn();

await jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: { execute: mockExecute },
  pool: { getConnection: mockGetConnection, query: mockPoolQuery }
}));
await jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/logger.js'), () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));
await jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/notificationService.js'), () => ({ notifyNuevoEquipo: jest.fn() }));
await jest.unstable_mockModule(path.resolve(__dirname, '../../src/factories/ServiceFactory.js'), () => ({ ServiceFactory: { create: jest.fn() } }));
await jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/sqlQueries.js'), () => ({
  obtenerEquipoPorCodigo: jest.fn(),
  obtenerUsuarioPorCedula: jest.fn(),
  verificarDisponibilidadEquipo: jest.fn(),
  verificarAmbienteEquipoAprendiz: jest.fn()
}));
await jest.unstable_mockModule(path.resolve(__dirname, '../../src/middleware/uploadMiddleware.js'), () => ({
  getImagePath: jest.fn(), deleteImageFile: jest.fn()
}));
await jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/socketService.js'), () => ({ default: { emitToAll: jest.fn() } }));

const { asignarEquipo, registrarUsoEquipoExterno, iniciarUsoAutoservicio, ensureAutoservicioSchema } =
  await import('../../src/controller/equiposController.js');
const { obtenerEquipoPorCodigo, verificarDisponibilidadEquipo, verificarAmbienteEquipoAprendiz } =
  await import('../../src/utils/sqlQueries.js');

function res() {
  const value = { status: jest.fn(), json: jest.fn() };
  value.status.mockReturnValue(value);
  return value;
}

describe('contratos de asignación y autoservicio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockReset();
    mockConnection.execute.mockReset();
    mockConnection.beginTransaction.mockReset();
    mockConnection.commit.mockReset();
    mockConnection.rollback.mockReset();
    mockConnection.release.mockReset();
    mockGetConnection.mockReset();
    mockPoolQuery.mockReset();
    mockGetConnection.mockResolvedValue(mockConnection);
    mockConnection.execute.mockImplementation((...args) => mockExecute(...args));
    verificarAmbienteEquipoAprendiz.mockResolvedValue({ valido: true });
  });

  it('no recrea el procedimiento de cierre desde una petición pública', async () => {
    mockExecute.mockImplementation(async (sql) => {
      if (/COLUMN_NAME = 'id_usuario'/.test(sql)) return [[{ IS_NULLABLE: 'YES' }]];
      if (/COLUMN_NAME IN/.test(sql)) return [[{ COLUMN_NAME: 'documento_externo' }]];
      if (/INFORMATION_SCHEMA\.ROUTINES/.test(sql)) return [[{ ROUTINE_COMMENT: '' }]];
      return [[]];
    });

    await ensureAutoservicioSchema({ execute: mockExecute });

    expect(mockExecute.mock.calls.some(([sql]) => /ALTER TABLE Historial_Uso_Equipos/i.test(sql))).toBe(true);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('asigna un aprendiz importado con el payload real documento_externo sin inventar id_usuario', async () => {
    obtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 3, tipo: 'Laptop', modelo: 'M' });
    verificarDisponibilidadEquipo.mockResolvedValueOnce({ disponible: true });
    verificarAmbienteEquipoAprendiz.mockResolvedValueOnce({ valido: true });
    mockExecute
      .mockResolvedValueOnce([[{ id_aprendiz: 22, nombre: 'Importado', documento: 'ABC-9', ficha: 'F2' }]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([[{ cnt: 1 }]])
      .mockResolvedValueOnce([{ insertId: 90 }]);

    const response = res();
    await asignarEquipo({ user: { id: 5, rol: 'Instructor' }, body: { codigo_equipo: 3, id_aprendiz: 22, documento_externo: ' ABC-9 ' } }, response);

    expect(response.status).toHaveBeenCalledWith(201);
    expect(mockExecute.mock.calls.find(([sql]) => /INSERT INTO Responsables_Equipo/i.test(sql))[1]).toEqual(
      expect.arrayContaining([null, 'ABC-9', 22])
    );
  });

  it('conserva el camino de usuario con cuenta', async () => {
    obtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 3, tipo: 'Laptop', modelo: 'M' });
    verificarDisponibilidadEquipo.mockResolvedValueOnce({ disponible: true });
    verificarAmbienteEquipoAprendiz.mockResolvedValueOnce({ valido: true });
    mockExecute
      .mockResolvedValueOnce([[{ id_usuario: 8, nombre_usuario: 'Cuenta', nombre_rol: 'Aprendiz' }]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([{ insertId: 91 }]);

    const response = res();
    await asignarEquipo({ user: { id: 5, rol: 'Instructor' }, body: { codigo_equipo: 3, id_usuario: 8 } }, response);

    expect(response.status).toHaveBeenCalledWith(201);
    expect(mockExecute.mock.calls.find(([sql]) => /INSERT INTO Responsables_Equipo/i.test(sql))[1]).toEqual(expect.arrayContaining([8]));
  });

  it('devuelve conflicto semántico con código y errores por usuario cuando todos fallan', async () => {
    mockExecute.mockResolvedValueOnce([[{ codigo_equipo: 3, placa: 'P3', tipo: 'Laptop', modelo: 'M', id_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_ambiente: 1, nombre_ambiente: 'A1', codigo_ambiente: '101' }]]);
    verificarDisponibilidadEquipo.mockResolvedValueOnce({ disponible: true });
    mockConnection.execute.mockImplementation(async (sql) => {
      if (/INFORMATION_SCHEMA/.test(sql)) return [[{ cnt: 1 }]];
      if (/FROM Usuarios/.test(sql)) return [[]];
      if (/FROM Aprendices/.test(sql)) return [[]];
      return [{ insertId: 1 }];
    });

    const response = res();
    await registrarUsoEquipoExterno({ body: { placa: 'P3', ambiente: '101', usuarios: [{ documento: ' NO-1 ' }] } }, response);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NO_USERS_PROCESSED', errores: [expect.objectContaining({ documento: 'NO-1' })] }));
    expect(mockConnection.rollback).toHaveBeenCalled();
  });

  it('devuelve códigos estables para 404 y 409 de autoservicio', async () => {
    mockExecute.mockImplementation(async (sql) => {
      if (/INFORMATION_SCHEMA/.test(sql)) return [[{ IS_NULLABLE: 'YES', cnt: 1 }]];
      if (/FROM Aprendices/.test(sql)) return [[{ id_aprendiz: 1, nombre: 'A', documento: 'D1', ficha: 'F' }]];
      if (/FROM Elementos/.test(sql)) return [[]];
      return [[]];
    });
    const notFound = res();
    await iniciarUsoAutoservicio({ body: { documento: ' D1 ', placa: 'P404' } }, notFound);
    expect(notFound.status).toHaveBeenCalledWith(404);
    expect(notFound.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EQUIPO_NOT_FOUND' }));

    mockExecute.mockImplementation(async (sql) => {
      if (/FROM Aprendices/.test(sql)) return [[{ id_aprendiz: 1, nombre: 'A', documento: 'D1', ficha: 'F' }]];
      if (/FROM Elementos/.test(sql)) return [[{ codigo_equipo: 3, placa: 'P3', id_ambiente: 1 }]];
      if (/FROM Clases/.test(sql)) return [[{ id_clase: 4, nombre_clase: 'Clase' }]];
      if (/Historial_Uso_Equipos/.test(sql)) return [[{ id_historial: 7, documento_externo: 'D1' }]];
      return [[{ IS_NULLABLE: 'YES', cnt: 1 }]];
    });
    verificarDisponibilidadEquipo.mockResolvedValueOnce({ disponible: false, razon: 'En uso' });
    const conflict = res();
    await iniciarUsoAutoservicio({ body: { documento: 'D1', placa: 'P3' } }, conflict);
    expect(conflict.status).toHaveBeenCalledWith(409);
    expect(conflict.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EQUIPO_NOT_AVAILABLE' }));
  });

  it('incluye aprendiz en la respuesta idempotente 200', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_aprendiz: 1, nombre: 'A', documento: 'D1', ficha: 'F' }]])
      .mockResolvedValueOnce([[{ codigo_equipo: 3, placa: 'P3', tipo: 'Laptop', modelo: 'M', id_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_clase: 4, nombre_clase: 'Clase' }]])
      .mockResolvedValueOnce([[{ id_historial: 7, documento_externo: 'D1' }]]);
    verificarDisponibilidadEquipo.mockResolvedValueOnce({ disponible: true });
    const response = res();
    await iniciarUsoAutoservicio({ body: { documento: ' D1 ', placa: 'P3' } }, response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ aprendiz: expect.objectContaining({ nombre: 'A', documento: 'D1' }) }) }));
  });

  it('recupera una solicitud repetida con Idempotency-Key sin reclamar otro préstamo', async () => {
    verificarDisponibilidadEquipo.mockResolvedValueOnce({ disponible: true });
    mockConnection.execute.mockImplementation(async (sql) => {
      if (/idempotency_key/i.test(sql)) {
        return [[{
          id_historial: 7,
          documento_externo: 'D1',
          codigo_equipo: 3,
          placa: 'P3',
          tipo: 'Laptop',
          modelo: 'M',
          id_clase: 4,
          nombre_clase: 'Clase',
          nombre_externo: 'A',
        }]];
      }
      if (/FROM Aprendices/.test(sql)) return [[{ id_aprendiz: 1, nombre: 'A', documento: 'D1', ficha: 'F' }]];
      if (/FROM Elementos/.test(sql)) return [[{ codigo_equipo: 3, placa: 'P3', tipo: 'Laptop', modelo: 'M', id_ambiente: 1 }]];
      if (/FROM Clases/.test(sql)) return [[]];
      if (/Historial_Uso_Equipos/.test(sql)) return [[]];
      return [{ insertId: 11 }];
    });

    const response = res();
    await iniciarUsoAutoservicio({
      body: { documento: 'D1', placa: 'P3' },
      get: (header) => header === 'Idempotency-Key' ? 'prestamo-123' : undefined,
    }, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      idempotent: true,
      data: expect.objectContaining({ id_historial: 7 }),
    }));
    expect(mockConnection.execute.mock.calls.some(([sql]) => /INSERT INTO Historial_Uso_Equipos/i.test(sql))).toBe(false);
  });

  it('reclama el equipo dentro de una transacción y bloquea su sesión activa', async () => {
    mockGetConnection.mockResolvedValue(mockConnection);
    mockExecute.mockImplementation(async (sql) => {
      if (/INFORMATION_SCHEMA/.test(sql)) return [[{ IS_NULLABLE: 'YES', cnt: 1 }]];
      if (/FROM Aprendices/.test(sql)) return [[{ id_aprendiz: 1, nombre: 'A', documento: 'D1', ficha: 'F' }]];
      if (/FROM Elementos/.test(sql)) return [[{ codigo_equipo: 3, placa: 'P3', tipo: 'Laptop', modelo: 'M', id_ambiente: 1 }]];
      if (/FROM Clases/.test(sql)) return [[{ id_clase: 4, nombre_clase: 'Clase' }]];
      if (/Historial_Uso_Equipos/.test(sql)) return [[]];
      return [{ insertId: 11 }];
    });
    mockConnection.execute.mockImplementation(async (sql) => {
      if (/FROM Aprendices/.test(sql)) return [[{ id_aprendiz: 1, nombre: 'A', documento: 'D1', ficha: 'F' }]];
      if (/FROM Elementos/.test(sql)) return [[{ codigo_equipo: 3, placa: 'P3', tipo: 'Laptop', modelo: 'M', id_ambiente: 1 }]];
      if (/FROM Clases/.test(sql)) return [[{ id_clase: 4, nombre_clase: 'Clase' }]];
      if (/Historial_Uso_Equipos/.test(sql)) return [[]];
      return [{ insertId: 11 }];
    });
    verificarDisponibilidadEquipo.mockResolvedValueOnce({ disponible: true });

    const response = res();
    await iniciarUsoAutoservicio({ body: { documento: 'D1', placa: 'P3' } }, response);

    expect(mockGetConnection).toHaveBeenCalledTimes(1);
    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringMatching(/FOR UPDATE/i), [3]);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(201);
  });
});
