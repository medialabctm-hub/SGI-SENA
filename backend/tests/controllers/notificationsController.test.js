/**
 * Tests completos para notificationsController
 * Usa jest.unstable_mockModule para interceptar la BD real
 */

import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../src/config/dbconfig.js');
const notifSvcPath = path.resolve(__dirname, '../../src/services/notificationService.js');
const socketSvcPath = path.resolve(__dirname, '../../src/services/socketService.js');

const mockExecute = jest.fn();
const mockCreateForUsers = jest.fn();

await jest.unstable_mockModule(dbPath, () => ({ default: { execute: mockExecute } }));
await jest.unstable_mockModule(notifSvcPath, () => ({
  createForUsers: mockCreateForUsers,
  normalizeNotificationType: jest.fn((t) => t ?? 'info'),
}));
await jest.unstable_mockModule(socketSvcPath, () => ({
  default: { emitToUser: jest.fn(), emitToAll: jest.fn() },
}));

const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
} = await import('../../src/controller/notificationsController.js');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('notificationsController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: 1 }, params: {}, query: {}, body: {} };
    res = makeRes();
  });

  describe('listNotifications', () => {
    it('401 si no hay usuario', async () => {
      req.user = null;
      await listNotifications(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('retorna lista con defaults de paginacion', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ unreadCount: 2, totalCount: 5 }]])
        .mockResolvedValueOnce([[{ id: 1, titulo: 'Hola' }]]);
      await listNotifications(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ notifications: expect.any(Array), unreadCount: 2 })
      );
    });

    it('respeta limit y offset de query', async () => {
      req.query = { limit: '5', offset: '10' };
      mockExecute
        .mockResolvedValueOnce([[{ unreadCount: 0, totalCount: 0 }]])
        .mockResolvedValueOnce([[]]);
      await listNotifications(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5, offset: 10 })
      );
    });

    it('cap limit a MAX_LIMIT (50)', async () => {
      req.query = { limit: '999' };
      mockExecute
        .mockResolvedValueOnce([[{ unreadCount: 0, totalCount: 0 }]])
        .mockResolvedValueOnce([[]]);
      await listNotifications(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 })
      );
    });

    it('retorna vacio si tabla no existe (ER_NO_SUCH_TABLE)', async () => {
      const err = Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
      mockExecute.mockRejectedValueOnce(err);
      await listNotifications(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ notifications: [], unreadCount: 0 })
      );
    });

    it('500 en error generico', async () => {
      mockExecute.mockRejectedValueOnce(new Error('DB crash'));
      await listNotifications(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('markNotificationRead', () => {
    it('401 si no hay usuario', async () => {
      req.user = null;
      req.params.id = '1';
      await markNotificationRead(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('400 si id no es numero', async () => {
      req.params.id = 'abc';
      await markNotificationRead(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('404 si la notificacion no existe', async () => {
      req.params.id = '99';
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);
      await markNotificationRead(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('ok:true al marcar leida', async () => {
      req.params.id = '5';
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);
      await markNotificationRead(req, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('500 en error generico', async () => {
      req.params.id = '5';
      mockExecute.mockRejectedValueOnce(new Error('DB fail'));
      await markNotificationRead(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('markAllNotificationsRead', () => {
    it('401 si no hay usuario', async () => {
      req.user = null;
      await markAllNotificationsRead(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('retorna ok:true con cantidad actualizada', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 3 }]);
      await markAllNotificationsRead(req, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true, updated: 3 });
    });

    it('ok:true si tabla no existe (ER_NO_SUCH_TABLE)', async () => {
      const err = Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
      mockExecute.mockRejectedValueOnce(err);
      await markAllNotificationsRead(req, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true, updated: 0 });
    });

    it('500 en error generico', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await markAllNotificationsRead(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createNotification', () => {
    it('400 si no hay usuario objetivo ni autenticado', async () => {
      req.user = null;
      req.body = { titulo: 'Test' };
      await createNotification(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 si titulo esta vacio', async () => {
      req.body = { id_usuario: 2, titulo: '  ' };
      await createNotification(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('crea notificacion correctamente', async () => {
      req.body = { id_usuario: 2, titulo: 'Hola', cuerpo: 'Mundo' };
      mockCreateForUsers.mockResolvedValueOnce({ inserted: 1, insertId: 10 });
      await createNotification(req, res);
      expect(mockCreateForUsers).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('500 si createForUsers lanza error', async () => {
      req.body = { id_usuario: 2, titulo: 'Test' };
      mockCreateForUsers.mockRejectedValueOnce(new Error('DB fail'));
      await createNotification(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});