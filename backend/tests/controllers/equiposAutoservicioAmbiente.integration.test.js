/**
 * Test de integración para iniciarUsoAutoservicio + verificarAmbienteEquipoAprendiz
 * SIN mockear sqlQueries.js — a diferencia de equiposAssignmentAutoservicio.test.js
 * (que mockea verificarAmbienteEquipoAprendiz a {valido:true} en todos sus casos),
 * este suite ejercita la lógica SQL real de resolución de ambiente por ficha para un
 * aprendiz importado sin cuenta de usuario. Cubre el bug donde el 4to argumento
 * (options.idAprendiz) se descartaba en silencio y todo autoservicio se rechazaba
 * con 409 APRENDIZ_OUTSIDE_AMBIENTE sin importar la clase real en curso.
 */

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
await jest.unstable_mockModule(path.resolve(__dirname, '../../src/middleware/uploadMiddleware.js'), () => ({
  getImagePath: jest.fn(), deleteImageFile: jest.fn()
}));
await jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/socketService.js'), () => ({ default: { emitToAll: jest.fn() } }));
// sqlQueries.js NO se mockea: verificarAmbienteEquipoAprendiz/obtenerAmbientesValidosAprendiz
// corren con su implementación real contra mockExecute.

const { iniciarUsoAutoservicio } = await import('../../src/controller/equiposController.js');

function res() {
  const value = { status: jest.fn(), json: jest.fn() };
  value.status.mockReturnValue(value);
  return value;
}

const APRENDIZ = { id_aprendiz: 500, nombre: 'Ana Aprendiz', documento: 'D-IMPORTADO', ficha: '2750001' };
const EQUIPO = { codigo_equipo: 42, placa: 'EQ-42', tipo: 'Laptop', modelo: 'X1', id_ambiente: 7 };
const CLASE_ACTIVA = { id_clase: 900, nombre_clase: 'Clase Autoservicio' };

// Router de queries compartido por los tests: cada uno solo cambia la respuesta de
// "ambientes de la ficha" (paso donde se decide si el ambiente del equipo coincide).
function baseRouter({ ambientesFicha }) {
  return async (sql, params = []) => {
    // Respuestas de ensureAutoservicioSchema/verificarReadinessAutoservicio: schema ya
    // migrado por completo, para no ejercitar las ramas de ALTER TABLE (fuera de alcance
    // de este test, ya cubiertas en equiposAssignmentAutoservicio.test.js).
    if (/COLUMN_NAME = 'id_usuario'/.test(sql)) return [[{ IS_NULLABLE: 'YES' }]];
    if (/COLUMN_NAME IN/.test(sql)) return [[
      { COLUMN_NAME: 'id_usuario', IS_NULLABLE: 'YES' },
      { COLUMN_NAME: 'documento_externo' },
      { COLUMN_NAME: 'nombre_externo' },
      { COLUMN_NAME: 'id_aprendiz' },
      { COLUMN_NAME: 'idempotency_key' }
    ]];
    if (/INFORMATION_SCHEMA\.STATISTICS/.test(sql)) return [[
      { INDEX_NAME: 'idx_documento_externo', COLUMN_NAME: 'documento_externo', SEQ_IN_INDEX: 1, NON_UNIQUE: 1 },
      { INDEX_NAME: 'idx_id_aprendiz', COLUMN_NAME: 'id_aprendiz', SEQ_IN_INDEX: 1, NON_UNIQUE: 1 },
      { INDEX_NAME: 'uq_autoservicio_idempotency_key', COLUMN_NAME: 'idempotency_key', SEQ_IN_INDEX: 1, NON_UNIQUE: 0 }
    ]];
    if (/INFORMATION_SCHEMA\.ROUTINES/.test(sql)) return [[{ ROUTINE_COMMENT: 'AUTOSERVICIO_CIERRE_V2' }]];
    if (/FROM Aprendices\s+WHERE documento/.test(sql)) return [[APRENDIZ]];
    if (/FROM Elementos\s+WHERE placa/.test(sql)) return [[EQUIPO]];
    if (/LEFT JOIN Estado_Equipo/.test(sql)) return [[{ estado_fisico: 'Bueno', estado_operativo: 'Disponible' }]];
    if (/estado_clase = 'En Curso'/.test(sql)) return [[CLASE_ACTIVA]];
    if (/LEFT JOIN Ambientes/.test(sql)) return [[{ id_ambiente: EQUIPO.id_ambiente, nombre_ambiente: 'Lab Autoservicio' }]];
    if (/FROM Aprendices\s+WHERE id_aprendiz/.test(sql)) {
      expect(params).toEqual([APRENDIZ.id_aprendiz]);
      return [[{ ficha: APRENDIZ.ficha }]];
    }
    if (/Participantes_Clase/.test(sql)) return [[]]; // sin cuenta -> nunca hay filas aquí
    if (/FROM Clases c\s+WHERE c\.codigo_ficha/.test(sql)) return [ambientesFicha];
    if (/FROM Historial_Uso_Equipos\s+WHERE codigo_equipo = \? AND estado = 'En Uso'/.test(sql)) return [[]]; // sin uso activo previo
    return [{ insertId: 12345 }]; // INSERT final
  };
}

describe('iniciarUsoAutoservicio + verificarAmbienteEquipoAprendiz (sin mock)', () => {
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
  });

  it('permite el préstamo cuando la ficha del aprendiz tiene clase activa en el ambiente del equipo', async () => {
    mockExecute.mockImplementation(baseRouter({ ambientesFicha: [{ id_ambiente: EQUIPO.id_ambiente }] }));

    const response = res();
    await iniciarUsoAutoservicio({ body: { documento: 'D-IMPORTADO', placa: 'EQ-42' } }, response);

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id_historial: 12345 })
    }));
    expect(mockConnection.commit).toHaveBeenCalled();
    expect(mockConnection.rollback).not.toHaveBeenCalled();
  });

  it('rechaza con 409 APRENDIZ_OUTSIDE_AMBIENTE cuando la ficha no tiene clase en el ambiente del equipo', async () => {
    mockExecute.mockImplementation(baseRouter({ ambientesFicha: [{ id_ambiente: 999 }] }));

    const response = res();
    await iniciarUsoAutoservicio({ body: { documento: 'D-IMPORTADO', placa: 'EQ-42' } }, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'APRENDIZ_OUTSIDE_AMBIENTE',
      message: expect.stringContaining('Lab Autoservicio')
    }));
    expect(mockConnection.rollback).toHaveBeenCalled();
  });

  it('rechaza con 409 APRENDIZ_OUTSIDE_AMBIENTE cuando la ficha no tiene ninguna clase activa', async () => {
    mockExecute.mockImplementation(baseRouter({ ambientesFicha: [] }));

    const response = res();
    await iniciarUsoAutoservicio({ body: { documento: 'D-IMPORTADO', placa: 'EQ-42' } }, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'APRENDIZ_OUTSIDE_AMBIENTE',
      message: expect.stringContaining('clases activas')
    }));
  });
});
