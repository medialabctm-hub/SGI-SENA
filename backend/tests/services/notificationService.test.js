/**
 * Tests para notificationService
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  normalizeNotificationType,
  createForUsers,
  createForRole,
  createBroadcast,
  notifyNuevoEquipo,
} from '../../src/services/notificationService.js';
import defaultDb from '../../src/config/dbconfig.js';
import socketService from '../../src/services/socketService.js';

describe('notificationService', () => {
  let executeSpy;
  let emitToUserSpy;

  beforeEach(() => {
    executeSpy = jest.spyOn(defaultDb, 'execute');
    emitToUserSpy = jest.spyOn(socketService, 'emitToUser').mockImplementation(() => {});
  });

  afterEach(() => {
    executeSpy.mockRestore();
    emitToUserSpy.mockRestore();
  });

  describe('normalizeNotificationType', () => {
    it('debe normalizar tipos validos', () => {
      expect(normalizeNotificationType('info')).toBe('info');
      expect(normalizeNotificationType('aviso')).toBe('aviso');
      expect(normalizeNotificationType('alerta')).toBe('alerta');
      expect(normalizeNotificationType('critica')).toBe('critica');
    });

    it('debe mapear warning, success, error', () => {
      expect(normalizeNotificationType('warning')).toBe('aviso');
      expect(normalizeNotificationType('success')).toBe('info');
      expect(normalizeNotificationType('error')).toBe('critica');
    });

    it('debe retornar info para tipos desconocidos o nulos', () => {
      expect(normalizeNotificationType(null)).toBe('info');
      expect(normalizeNotificationType(undefined)).toBe('info');
      expect(normalizeNotificationType('otro')).toBe('info');
    });

    it('debe ser case-insensitive', () => {
      expect(normalizeNotificationType('INFO')).toBe('info');
      expect(normalizeNotificationType('WARNING')).toBe('aviso');
      expect(normalizeNotificationType('ALERTA')).toBe('alerta');
    });

    it('debe ignorar espacios extra', () => {
      expect(normalizeNotificationType('  info  ')).toBe('info');
    });
  });

  describe('createForUsers', () => {
    it('debe retornar inserted=0 e insertId=null cuando falta titulo', async () => {
      const result = await createForUsers({
        userIds: [1, 2],
        titulo: '',
        cuerpo: 'contenido',
      });

      expect(result).toEqual({ inserted: 0, insertId: null });
      expect(executeSpy).not.toHaveBeenCalled();
      expect(emitToUserSpy).not.toHaveBeenCalled();
    });

    it('debe filtrar por usuarios activos con notificaciones_app habilitadas', async () => {
      executeSpy
        .mockResolvedValueOnce([
          [
            { id_usuario: 1 },
            { id_usuario: 3 },
          ],
        ])
        .mockResolvedValueOnce([
          { affectedRows: 2, insertId: 77 },
        ]);

      const result = await createForUsers({
        userIds: [1, 2, 3],
        titulo: 'Nueva novedad',
        cuerpo: 'Revisa el sistema',
        tipo: 'info',
      });

      expect(result).toEqual({ inserted: 2, insertId: 77 });
      expect(executeSpy).toHaveBeenCalledTimes(2);
      expect(emitToUserSpy).toHaveBeenCalledTimes(2);
      expect(emitToUserSpy).toHaveBeenNthCalledWith(
        1,
        1,
        'notification:new',
        expect.objectContaining({ message: 'Nueva notificación disponible' })
      );
      expect(emitToUserSpy).toHaveBeenNthCalledWith(
        2,
        3,
        'notification:new',
        expect.objectContaining({ message: 'Nueva notificación disponible' })
      );
    });

    it('debe emitir notification:new para cada usuario filtrado tras insercion exitosa', async () => {
      executeSpy
        .mockResolvedValueOnce([
          [
            { id_usuario: 10 },
            { id_usuario: 11 },
            { id_usuario: 12 },
          ],
        ])
        .mockResolvedValueOnce([
          { affectedRows: 3, insertId: 91 },
        ]);

      await createForUsers({
        userIds: [10, 11, 12],
        titulo: 'Titulo',
        cuerpo: 'Cuerpo',
      });

      expect(emitToUserSpy).toHaveBeenCalledTimes(3);
      expect(emitToUserSpy).toHaveBeenCalledWith(10, 'notification:new', expect.any(Object));
      expect(emitToUserSpy).toHaveBeenCalledWith(11, 'notification:new', expect.any(Object));
      expect(emitToUserSpy).toHaveBeenCalledWith(12, 'notification:new', expect.any(Object));
    });

    it('debe traducir titulo y cuerpo por idioma del usuario cuando recibe claves de traducción', async () => {
      executeSpy
        .mockResolvedValueOnce([[{ id_usuario: 7 }, { id_usuario: 8 }]])
        .mockResolvedValueOnce([[{ id_usuario: 8, idioma: 'en' }]])
        .mockResolvedValueOnce([{ affectedRows: 2, insertId: 150 }]);

      const result = await createForUsers({
        userIds: [7, 8],
        titulo: { key: 'nuevo_equipo_registrado', params: {} },
        cuerpo: {
          key: 'nuevo_equipo_registrado_cuerpo',
          params: { descripcion: 'Laptop Dell', ambiente: 'Aula 1' },
        },
        tipo: 'warning',
        metadata: { origen: 'test' },
        creadoPor: 99,
      });

      expect(result).toEqual({ inserted: 2, insertId: 150 });
      expect(executeSpy).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO Notificaciones'),
        expect.arrayContaining([
          7,
          'Nuevo equipo registrado',
          'Se ha registrado Laptop Dell en el ambiente Aula 1.',
          'aviso',
          JSON.stringify({ origen: 'test' }),
          99,
          8,
          'New equipment registered',
          'Laptop Dell has been registered in environment Aula 1.',
          'aviso',
        ])
      );
    });

    it('debe usar todos los usuarios cuando falla la consulta de preferencias', async () => {
      executeSpy
        .mockRejectedValueOnce(new Error('tabla preferencias no disponible'))
        .mockResolvedValueOnce([{ affectedRows: 2, insertId: 81 }]);

      const result = await createForUsers({
        userIds: [20, 21],
        titulo: 'Titulo fallback',
        cuerpo: 'Cuerpo fallback',
      });

      expect(result).toEqual({ inserted: 2, insertId: 81 });
      expect(emitToUserSpy).toHaveBeenCalledTimes(2);
      expect(emitToUserSpy).toHaveBeenCalledWith(20, 'notification:new', expect.any(Object));
      expect(emitToUserSpy).toHaveBeenCalledWith(21, 'notification:new', expect.any(Object));
    });

    it('debe omitir la inserción si la tabla de notificaciones no existe', async () => {
      executeSpy
        .mockResolvedValueOnce([[{ id_usuario: 30 }]])
        .mockRejectedValueOnce({ code: 'ER_NO_SUCH_TABLE' });

      const result = await createForUsers({
        userIds: [30],
        titulo: 'Titulo',
        cuerpo: 'Cuerpo',
      });

      expect(result).toEqual({ inserted: 0, insertId: null, skipped: true });
      expect(emitToUserSpy).not.toHaveBeenCalled();
    });
  });

  describe('createForRole', () => {
    it('returns inserted=0 when rolNombre is missing', async () => {
      const result = await createForRole({ titulo: 'Test', cuerpo: 'Body' });
      expect(result).toEqual({ inserted: 0, insertId: null });
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it('returns inserted=0 when titulo is missing', async () => {
      const result = await createForRole({ rolNombre: 'Administrador', cuerpo: 'Body' });
      expect(result).toEqual({ inserted: 0, insertId: null });
    });

    it('returns inserted=0 when no active users for role', async () => {
      executeSpy
        .mockResolvedValueOnce([[{ id_rol: 1 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);
      const result = await createForRole({ rolNombre: 'Administrador', titulo: 'T', cuerpo: 'B' });
      expect(result.inserted).toBe(0);
    });

    it('excluye al usuario creador de la notificación del rol destino', async () => {
      executeSpy
        .mockResolvedValueOnce([[{ id_rol: 1 }]])
        .mockResolvedValueOnce([[{ id_usuario: 40 }, { id_usuario: 41 }]])
        .mockResolvedValueOnce([[{ id_usuario: 41 }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 201 }]);

      const result = await createForRole({
        rolNombre: 'Administrador',
        titulo: 'T',
        cuerpo: 'B',
        creadoPor: 40,
      });

      expect(result).toEqual({ inserted: 1, insertId: 201 });
      expect(emitToUserSpy).toHaveBeenCalledTimes(1);
      expect(emitToUserSpy).toHaveBeenCalledWith(41, 'notification:new', expect.any(Object));
    });
  });

  describe('createBroadcast', () => {
    it('returns inserted=0 when titulo is missing', async () => {
      const result = await createBroadcast({ cuerpo: 'Body' });
      expect(result).toEqual({ inserted: 0, insertId: null });
    });

    it('returns inserted=0 when no active users exist', async () => {
      executeSpy
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);
      const result = await createBroadcast({ titulo: 'Broadcast', cuerpo: 'Body' });
      expect(result.inserted).toBe(0);
    });

    it('excluye al usuario creador del broadcast', async () => {
      executeSpy
        .mockResolvedValueOnce([[{ id_usuario: 50 }, { id_usuario: 51 }]])
        .mockResolvedValueOnce([[{ id_usuario: 51 }]])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 301 }]);

      const result = await createBroadcast({
        titulo: 'Broadcast',
        cuerpo: 'Body',
        creadoPor: 50,
      });

      expect(result).toEqual({ inserted: 1, insertId: 301 });
      expect(emitToUserSpy).toHaveBeenCalledTimes(1);
      expect(emitToUserSpy).toHaveBeenCalledWith(51, 'notification:new', expect.any(Object));
    });
  });

  describe('notifyNuevoEquipo', () => {
    it('returns inserted=0 when equipoId is missing', async () => {
      const result = await notifyNuevoEquipo({ tipoEquipo: 'Laptop' });
      expect(result).toEqual({ inserted: 0 });
    });

    it('returns inserted=0 when tipoEquipo is missing', async () => {
      const result = await notifyNuevoEquipo({ equipoId: 5 });
      expect(result).toEqual({ inserted: 0 });
    });

    it('delegates to createForRole for Administrador role', async () => {
      executeSpy
        .mockResolvedValueOnce([[{ id_rol: 1 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);
      const result = await notifyNuevoEquipo({ equipoId: 1, tipoEquipo: 'Laptop', modelo: 'Dell' });
      expect(result).toBeDefined();
    });
  });
});
