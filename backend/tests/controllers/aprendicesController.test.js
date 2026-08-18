/**
 * Tests completos para aprendicesController
 * Usa jest.unstable_mockModule para interceptar la BD real
 */

import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath   = path.resolve(__dirname, '../../src/config/dbconfig.js');
const logPath  = path.resolve(__dirname, '../../src/utils/logger.js');
const sockPath = path.resolve(__dirname, '../../src/services/socketService.js');

const mockExecute = jest.fn();

await jest.unstable_mockModule(dbPath,   () => ({ default: { execute: mockExecute } }));
await jest.unstable_mockModule(logPath,  () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
await jest.unstable_mockModule(sockPath, () => ({ default: { emitToAll: jest.fn(), emitToUser: jest.fn() } }));

const { ensureAprendicesTable, listarAprendices, crearAprendiz, actualizarAprendiz, eliminarAprendiz } =
  await import('../../src/controller/aprendicesController.js');

function makeRes() {
  const r = { status: jest.fn(), json: jest.fn() };
  r.status.mockReturnValue(r);
  return r;
}

// Stub ensureAprendicesTable: tabla y todas las columnas de la migración ya existen.
function stubEnsure() {
  mockExecute
    .mockResolvedValueOnce([[{ cnt: 1 }]]) // tabla existe
    .mockResolvedValueOnce([[{ cnt: 1 }]]) // tipo_documento existe
    .mockResolvedValueOnce([[{ DATA_TYPE: 'varchar', CHARACTER_SET_NAME: 'utf8mb4' }]]) // jornada actual
    .mockResolvedValueOnce([[{ cnt: 1 }]]) // tipo_aprendiz existe
    .mockResolvedValueOnce([[{ cnt: 1 }]]) // dias_semana existe
    .mockResolvedValueOnce([[{ cnt: 1 }]]) // hora_inicio existe
    .mockResolvedValueOnce([[{ cnt: 1 }]]) // hora_fin existe
    .mockResolvedValueOnce([[{ hay_pendientes: 0 }]]);
}

describe('aprendicesController', () => {
  let req, res;

  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    req = { user: { id: 1, rol: 'Administrador' }, params: {}, query: {}, body: {} };
    res = makeRes();
  });

  describe('ensureAprendicesTable', () => {
    it('no emite ALTER ni UPDATE cuando el esquema ya está actualizado', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // tabla existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // tipo_documento existe
        .mockResolvedValueOnce([[{ DATA_TYPE: 'varchar', CHARACTER_SET_NAME: 'utf8mb4' }]])
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // tipo_aprendiz existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // dias_semana existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // hora_inicio existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // hora_fin existe
        .mockResolvedValueOnce([[{ hay_pendientes: 0 }]]);

      await ensureAprendicesTable();

      const consultasDeMigracion = mockExecute.mock.calls.filter(([sql]) =>
        /ALTER TABLE Aprendices|UPDATE Aprendices/.test(sql)
      );
      expect(consultasDeMigracion).toEqual([]);
    });

    it('repara el valor mojibake de jornada usando los bytes UTF-8 correctos', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // tabla existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // tipo_documento existe
        .mockResolvedValueOnce([[{ DATA_TYPE: 'enum', CHARACTER_SET_NAME: 'utf8mb4' }]])
        .mockResolvedValueOnce([{}]) // MODIFY jornada
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // tipo_aprendiz existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // dias_semana existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // hora_inicio existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // hora_fin existe
        .mockResolvedValueOnce([[{ hay_pendientes: 1 }]])
        .mockResolvedValueOnce([{}]); // UPDATE jornada

      await ensureAprendicesTable();

      expect(mockExecute).toHaveBeenLastCalledWith(
        expect.stringContaining('CONVERT(0x4D61C3B1616E61 USING utf8mb4)')
      );
      expect(mockExecute).toHaveBeenLastCalledWith(
        expect.stringContaining('CONVERT(0x4D61C383C2B1616E61 USING utf8mb4)')
      );
    });

    it('ejecuta backfills pendientes aun cuando el esquema ya es actual', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // tabla existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // tipo_documento existe
        .mockResolvedValueOnce([[{ DATA_TYPE: 'varchar', CHARACTER_SET_NAME: 'utf8mb4' }]])
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // tipo_aprendiz existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // dias_semana existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // hora_inicio existe
        .mockResolvedValueOnce([[{ cnt: 1 }]]) // hora_fin existe
        .mockResolvedValueOnce([[{ hay_pendientes: 1 }]])
        .mockResolvedValueOnce([{}]) // tipo_documento
        .mockResolvedValueOnce([{}]) // tipo_aprendiz
        .mockResolvedValueOnce([{}]); // jornada

      await ensureAprendicesTable();

      expect(mockExecute).toHaveBeenNthCalledWith(
        9,
        expect.stringContaining("UPDATE Aprendices SET tipo_documento = 'CC'")
      );
      expect(mockExecute).toHaveBeenNthCalledWith(
        11,
        expect.stringContaining('CONVERT(0x4D61C383C2B1616E61 USING utf8mb4)')
      );
    });
  });

  // ─── listarAprendices ─────────────────────────────────────────────
  describe('listarAprendices', () => {
    it('retorna lista de aprendices', async () => {
      stubEnsure();
      mockExecute.mockResolvedValueOnce([[{ id_aprendiz: 1, nombre: 'Ana' }]]);
      await listarAprendices(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ ok: true, aprendices: expect.any(Array) })
      );
    });

    it('500 en error de BD', async () => {
      mockExecute.mockRejectedValueOnce(new Error('DB crash'));
      await listarAprendices(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── crearAprendiz ────────────────────────────────────────────────
  describe('crearAprendiz', () => {
    it('crea un aprendiz practicante válido', async () => {
      req.body = {
        nombre: 'Ana Practicante',
        documento: '12345678',
        tipo_documento: 'CC',
        tipo_aprendiz: 'Practicante',
        dias_semana: 'Lunes a Viernes',
        hora_inicio: '08:00',
        hora_fin: '16:00',
      };

      stubEnsure();
      mockExecute
        .mockResolvedValueOnce([[undefined]])
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([[{ id_aprendiz: 1, nombre: 'Ana Practicante' }]]);

      await crearAprendiz(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('rechaza un practicante con una jornada menor a ocho horas', async () => {
      req.body = {
        nombre: 'Ana Practicante',
        documento: '12345678',
        tipo_documento: 'CC',
        tipo_aprendiz: 'Practicante',
        dias_semana: 'Lunes a Viernes',
        hora_inicio: '08:00',
        hora_fin: '15:59',
      };

      await crearAprendiz(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('ocho horas'),
      }));
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  // ─── actualizarAprendiz ───────────────────────────────────────────
  describe('actualizarAprendiz', () => {
    it('400 si id invalido', async () => {
      req.params.id = 'abc';
      req.body = { nombre: 'Juan', documento: '123' };
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 si nombre o documento vacios', async () => {
      req.params.id = '1';
      req.body = { nombre: '', documento: '' };
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 si tipo_documento invalido', async () => {
      req.params.id = '1';
      req.body = { nombre: 'Ana', documento: '123', tipo_documento: 'INVALIDO' };
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 si tipo_documento es Otro sin especificar', async () => {
      req.params.id = '1';
      req.body = { nombre: 'Ana', documento: '123', tipo_documento: 'Otro' };
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 si jornada invalida', async () => {
      req.params.id = '1';
      req.body = { nombre: 'Ana', documento: '123', ficha: '1234', jornada: 'Madrugada' };
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('404 si aprendiz no existe', async () => {
      req.params.id = '99';
      req.body = { nombre: 'Ana', documento: '123', ficha: '1234', jornada: 'Mañana' };
      stubEnsure();
      mockExecute.mockResolvedValueOnce([[undefined]]); // no existe
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('409 si documento duplicado', async () => {
      req.params.id = '1';
      req.body = { nombre: 'Ana', documento: '123', ficha: '1234', jornada: 'Mañana' };
      stubEnsure();
      mockExecute.mockResolvedValueOnce([[{ id_aprendiz: 1 }]]); // existe
      mockExecute.mockResolvedValueOnce([[{ id_aprendiz: 2 }]]); // duplicado
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('actualiza correctamente', async () => {
      req.params.id = '1';
      req.body = { nombre: 'Ana', documento: '123', ficha: '1234', jornada: 'Mañana' };
      stubEnsure();
      mockExecute
        .mockResolvedValueOnce([[{ id_aprendiz: 1 }]])  // existe
        .mockResolvedValueOnce([[undefined]])             // no hay duplicado
        .mockResolvedValueOnce([{ affectedRows: 1 }])    // update
        .mockResolvedValueOnce([[{ id_aprendiz: 1, nombre: 'Ana' }]]); // select
      await actualizarAprendiz(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ ok: true })
      );
    });

    it('500 en error de BD', async () => {
      req.params.id = '1';
      req.body = { nombre: 'Ana', documento: '123', ficha: '1234', jornada: 'Mañana' };
      stubEnsure();
      mockExecute.mockRejectedValueOnce(new Error('DB crash'));
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── eliminarAprendiz ─────────────────────────────────────────────
  describe('eliminarAprendiz', () => {
    it('400 si id invalido', async () => {
      req.params.id = 'xyz';
      await eliminarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('404 si aprendiz no existe', async () => {
      req.params.id = '99';
      stubEnsure();
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);
      await eliminarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('elimina correctamente', async () => {
      req.params.id = '1';
      stubEnsure();
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);   // delete OK
      await eliminarAprendiz(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ ok: true })
      );
    });

    it('500 en error de BD', async () => {
      req.params.id = '1';
      stubEnsure();
      mockExecute.mockRejectedValueOnce(new Error('DB crash'));
      await eliminarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
