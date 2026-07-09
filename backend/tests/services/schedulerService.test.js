import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../src/config/dbconfig.js');
const notificationPath = path.resolve(__dirname, '../../src/services/notificationService.js');
const loggerPath = path.resolve(__dirname, '../../src/utils/logger.js');
const socketPath = path.resolve(__dirname, '../../src/services/socketService.js');

const mockExecute = jest.fn();
const mockCreateForUsers = jest.fn();
const mockEmitToAll = jest.fn();

await jest.unstable_mockModule(dbPath, () => ({
  default: { execute: mockExecute },
}));

await jest.unstable_mockModule(notificationPath, () => ({
  createForUsers: mockCreateForUsers,
}));

await jest.unstable_mockModule(loggerPath, () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

await jest.unstable_mockModule(socketPath, () => ({
  default: { emitToAll: mockEmitToAll },
}));

const { default: schedulerService } = await import('../../src/services/schedulerService.js');

describe('schedulerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    schedulerService.isExecuting = false;
    schedulerService.isRunning = false;
    schedulerService.intervalId = null;
    schedulerService.notificacionesEnviadas.clear();
    schedulerService.clasesIniciadas.clear();
    schedulerService.clasesFinalizadas.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeSync', () => {
    it('start/stop debe gestionar estado de ejecución del scheduler', () => {
      const executeSpy = jest
        .spyOn(schedulerService, 'executeSync')
        .mockResolvedValue({ notificaciones: 0, clasesIniciadas: 0, clasesFinalizadas: 0, errores: [] });

      schedulerService.start(1);
      expect(schedulerService.isRunning).toBe(true);
      expect(executeSpy).toHaveBeenCalledTimes(1);

      const intervalAnterior = schedulerService.intervalId;
      schedulerService.start(1);
      expect(schedulerService.intervalId).toBe(intervalAnterior);

      schedulerService.stop();
      expect(schedulerService.isRunning).toBe(false);
      expect(schedulerService.intervalId).toBeNull();

      executeSpy.mockRestore();
    });

    it('debe omitir ejecucion concurrente cuando ya hay una en progreso', async () => {
      schedulerService.isExecuting = true;

      const result = await schedulerService.executeSync();

      expect(result).toEqual({
        notificaciones: 0,
        clasesIniciadas: 0,
        clasesFinalizadas: 0,
        errores: [{ tipo: 'concurrencia', detalle: 'Ejecución ya en curso' }],
      });
      expect(schedulerService.isExecuting).toBe(true);
    });

    it('debe enviar consentimiento cuando la clase esta en ventana de 3-5 minutos', async () => {
      jest
        .spyOn(schedulerService, 'getHoraColombia')
        .mockReturnValue(new Date('2026-03-12T09:56:00'));

      mockExecute
        .mockResolvedValueOnce([
          [
            {
              id_clase: 201,
              fecha_clase: '2026-03-12',
              hora_inicio: '10:00',
              hora_fin: '11:00',
              nombre_clase: 'Prueba consentimiento',
              id_instructor: 33,
              codigo_ambiente: 'LAB-1',
              nombre_ambiente: 'Laboratorio 1',
            },
          ],
        ])
        .mockResolvedValueOnce([[]]);

      mockCreateForUsers.mockResolvedValue({ inserted: 1, insertId: 55 });

      const result = await schedulerService.executeSync();

      expect(result.notificaciones).toBe(1);
      expect(result.clasesIniciadas).toBe(0);
      expect(result.clasesFinalizadas).toBe(0);
      expect(result.errores).toEqual([]);
      expect(mockCreateForUsers).toHaveBeenCalledTimes(1);
      expect(mockCreateForUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: [33],
          titulo: 'Consentimiento para iniciar clase',
          tipo: 'alerta',
        })
      );
      expect(schedulerService.notificacionesEnviadas.has('consentimiento_201')).toBe(true);
      expect(schedulerService.isExecuting).toBe(false);
    });

    it('debe evitar reenviar consentimiento para la misma clase', async () => {
      jest
        .spyOn(schedulerService, 'getHoraColombia')
        .mockReturnValue(new Date('2026-03-12T09:56:00'));

      schedulerService.notificacionesEnviadas.add('consentimiento_202');

      mockExecute
        .mockResolvedValueOnce([
          [
            {
              id_clase: 202,
              fecha_clase: '2026-03-12',
              hora_inicio: '10:00',
              hora_fin: '11:00',
              nombre_clase: 'Prueba no duplicado',
              id_instructor: 44,
              codigo_ambiente: 'LAB-2',
              nombre_ambiente: 'Laboratorio 2',
            },
          ],
        ])
        .mockResolvedValueOnce([[]]);

      const result = await schedulerService.executeSync();

      expect(result.notificaciones).toBe(0);
      expect(result.clasesIniciadas).toBe(0);
      expect(result.clasesFinalizadas).toBe(0);
      expect(result.errores).toEqual([]);
      expect(mockCreateForUsers).not.toHaveBeenCalled();
      expect(schedulerService.notificacionesEnviadas.has('consentimiento_202')).toBe(true);
      expect(schedulerService.isExecuting).toBe(false);
    });

    it('debe iniciar automaticamente una clase dentro del margen de +/-2 minutos', async () => {
      jest
        .spyOn(schedulerService, 'getHoraColombia')
        .mockReturnValue(new Date('2026-03-12T10:00:00'));

      mockExecute
        .mockResolvedValueOnce([
          [
            {
              id_clase: 203,
              fecha_clase: '2026-03-12',
              hora_inicio: '10:00',
              hora_fin: '11:00',
              nombre_clase: 'Prueba inicio automatico',
              id_instructor: 55,
              instructor_nombre: 'Instructor Demo',
              codigo_ambiente: 'LAB-3',
              nombre_ambiente: 'Laboratorio 3',
            },
          ],
        ])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await schedulerService.executeSync();

      expect(result.notificaciones).toBe(0);
      expect(result.clasesIniciadas).toBe(1);
      expect(result.clasesFinalizadas).toBe(0);
      expect(result.errores).toEqual([]);
      expect(mockExecute).toHaveBeenNthCalledWith(
        2,
        'CALL sp_iniciar_clase(?, ?)',
        [203, expect.any(String)]
      );
      expect(mockEmitToAll).toHaveBeenCalledWith(
        'clase:updated',
        expect.objectContaining({
          id_clase: 203,
          estado_clase: 'En Curso',
          action: 'auto_started',
        })
      );
      expect(schedulerService.isExecuting).toBe(false);
    });

    it('debe finalizar automaticamente una clase en curso dentro del margen permitido', async () => {
      jest
        .spyOn(schedulerService, 'getHoraColombia')
        .mockReturnValue(new Date('2026-03-12T11:01:00'));

      mockExecute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([
          [
            {
              id_clase: 301,
              fecha_clase: '2026-03-12',
              hora_inicio: '10:00',
              hora_fin: '11:00',
              nombre_clase: 'Finalización automática',
              id_instructor: 88,
              instructor_nombre: 'Instructor Final',
              codigo_ambiente: 'LAB-4',
              nombre_ambiente: 'Laboratorio 4',
            },
          ],
        ])
        .mockResolvedValueOnce([[]]);

      const result = await schedulerService.executeSync();

      expect(result.clasesFinalizadas).toBe(1);
      expect(result.errores).toEqual([]);
      expect(mockExecute).toHaveBeenNthCalledWith(
        3,
        'CALL sp_finalizar_clase(?, ?)',
        [301, expect.any(String)]
      );
      expect(mockEmitToAll).toHaveBeenCalledWith(
        'clase:updated',
        expect.objectContaining({
          id_clase: 301,
          estado_clase: 'Finalizada',
          action: 'auto_finished',
        })
      );
    });

    it('debe retornar error_general cuando falla la consulta principal', async () => {
      mockExecute.mockRejectedValueOnce(new Error('db down'));

      const result = await schedulerService.executeSync();

      expect(result.notificaciones).toBe(0);
      expect(result.clasesIniciadas).toBe(0);
      expect(result.clasesFinalizadas).toBe(0);
      expect(result.errores).toEqual([
        expect.objectContaining({ tipo: 'error_general', detalle: 'db down' }),
      ]);
      expect(schedulerService.isExecuting).toBe(false);
    });
  });
});
