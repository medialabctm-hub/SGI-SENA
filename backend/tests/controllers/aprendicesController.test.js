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

const { listarAprendices, actualizarAprendiz, eliminarAprendiz } =
  await import('../../src/controller/aprendicesController.js');

function makeRes() {
  const r = { status: jest.fn(), json: jest.fn() };
  r.status.mockReturnValue(r);
  return r;
}

// Stub ensureAprendicesTable: table already exists (cnt=1) + column exists (cnt=1)
function stubEnsure() {
  mockExecute
    .mockResolvedValueOnce([[{ cnt: 1 }]])  // tabla existe
    .mockResolvedValueOnce([[{ cnt: 1 }]]); // columna existe
}

describe('aprendicesController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: 1, rol: 'Administrador' }, params: {}, query: {}, body: {} };
    res = makeRes();
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
      req.body = { nombre: 'Ana', documento: '123', jornada: 'Madrugada' };
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('404 si aprendiz no existe', async () => {
      req.params.id = '99';
      req.body = { nombre: 'Ana', documento: '123' };
      stubEnsure();
      mockExecute.mockResolvedValueOnce([[undefined]]); // no existe
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('409 si documento duplicado', async () => {
      req.params.id = '1';
      req.body = { nombre: 'Ana', documento: '123' };
      stubEnsure();
      mockExecute.mockResolvedValueOnce([[{ id_aprendiz: 1 }]]); // existe
      mockExecute.mockResolvedValueOnce([[{ id_aprendiz: 2 }]]); // duplicado
      await actualizarAprendiz(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('actualiza correctamente', async () => {
      req.params.id = '1';
      req.body = { nombre: 'Ana', documento: '123', jornada: 'Mañana' };
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
      req.body = { nombre: 'Ana', documento: '123' };
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
