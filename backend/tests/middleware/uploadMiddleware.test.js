import { describe, it, expect, jest } from '@jest/globals';
import fs from 'fs';
import multer from 'multer';
import {
  handleUploadError,
  getImagePath,
  deleteImageFile,
  backfillLegacyEquipoImagePaths,
} from '../../src/middleware/uploadMiddleware.js';
import { logger } from '../../src/utils/logger.js';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('uploadMiddleware', () => {
  it('handleUploadError responde 400 para LIMIT_FILE_SIZE', () => {
    const res = mockRes();

    handleUploadError(new multer.MulterError('LIMIT_FILE_SIZE'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'El archivo es demasiado grande. Tamaño máximo: 10MB',
    });
  });

  it('handleUploadError responde 400 para LIMIT_FILE_COUNT', () => {
    const res = mockRes();

    handleUploadError(new multer.MulterError('LIMIT_FILE_COUNT'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Demasiados archivos. Máximo permitido: 10',
    });
  });

  it('handleUploadError responde 400 para otros errores Multer', () => {
    const res = mockRes();

    handleUploadError(new multer.MulterError('LIMIT_UNEXPECTED_FILE'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('Error al subir archivo:'),
    });
  });

  it('handleUploadError responde 400 para error genérico', () => {
    const res = mockRes();

    handleUploadError(new Error('archivo inválido'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'archivo inválido' });
  });

  it('handleUploadError llama next cuando no hay error', () => {
    const next = jest.fn();

    handleUploadError(null, {}, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('getImagePath retorna ruta esperada', () => {
    expect(getImagePath('img.png')).toBe('/api/equipos/imagenes/archivo/img.png');
  });

  it('handleUploadError elimina temporales ya escritos cuando Multer rechaza una subida', () => {
    const res = mockRes();
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    handleUploadError(
      new multer.MulterError('LIMIT_FILE_COUNT'),
      { files: [{ filename: 'temporal.png' }] },
      res,
      jest.fn()
    );

    expect(unlinkSpy).toHaveBeenCalled();
    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
  });

  it('getImagePath rechaza nombres que intentan salir del directorio de evidencias', () => {
    expect(() => getImagePath('../secreto.png')).toThrow(/nombre de archivo/i);
  });

  it('deleteImageFile retorna false cuando archivo no existe', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = deleteImageFile('missing.png');

    expect(result).toBe(false);
    existsSpy.mockRestore();
  });

  it('deleteImageFile elimina archivo y retorna true', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    const result = deleteImageFile('ok.png');

    expect(result).toBe(true);
    expect(unlinkSpy).toHaveBeenCalled();
    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
  });

  it('deleteImageFile retorna false cuando unlink falla', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
      throw new Error('sin permisos');
    });
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    const result = deleteImageFile('fail.png');

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      'Error al eliminar archivo',
      expect.objectContaining({ filename: 'fail.png' })
    );
    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('backfillLegacyEquipoImagePaths', () => {
    it('reescribe filas con ruta_imagen legada (/uploads/equipos/) al formato de endpoint autenticado', async () => {
      const execute = jest.fn()
        .mockResolvedValueOnce([[
          { id_imagen_equipo: 51, nombre_archivo: '1787074695288-51-image.jpg' },
          { id_imagen_equipo: 62, nombre_archivo: '1787075246545-62-image.jpg' },
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const db = { execute };

      const result = await backfillLegacyEquipoImagePaths(db);

      expect(execute).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/SELECT id_imagen_equipo, nombre_archivo FROM Imagenes_Equipo WHERE ruta_imagen LIKE \?/),
        ['/uploads/equipos/%']
      );
      expect(execute).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/UPDATE Imagenes_Equipo SET ruta_imagen = \? WHERE id_imagen_equipo = \?/),
        ['/api/equipos/imagenes/archivo/1787074695288-51-image.jpg', 51]
      );
      expect(execute).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/UPDATE Imagenes_Equipo SET ruta_imagen = \? WHERE id_imagen_equipo = \?/),
        ['/api/equipos/imagenes/archivo/1787075246545-62-image.jpg', 62]
      );
      expect(result).toEqual({ migradas: 2, omitidas: 0 });
    });

    it('es idempotente: no hace UPDATEs cuando no quedan filas con el prefijo legado', async () => {
      const execute = jest.fn().mockResolvedValueOnce([[]]);
      const db = { execute };

      const result = await backfillLegacyEquipoImagePaths(db);

      expect(execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ migradas: 0, omitidas: 0 });
    });

    it('omite y loguea filas cuyo nombre_archivo es inválido en lugar de fallar toda la migración', async () => {
      const execute = jest.fn()
        .mockResolvedValueOnce([[
          { id_imagen_equipo: 99, nombre_archivo: '../escape.png' },
          { id_imagen_equipo: 100, nombre_archivo: 'valido.png' },
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const db = { execute };
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

      const result = await backfillLegacyEquipoImagePaths(db);

      expect(result).toEqual({ migradas: 1, omitidas: 1 });
      expect(warnSpy).toHaveBeenCalledWith(
        'No se pudo migrar ruta_imagen legada: nombre_archivo inválido',
        expect.objectContaining({ id_imagen_equipo: 99 })
      );
      // Solo el UPDATE de la fila válida (100) — la fila 99 no debe intentar UPDATE.
      expect(execute).toHaveBeenCalledTimes(2);
      expect(execute).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/UPDATE Imagenes_Equipo/),
        ['/api/equipos/imagenes/archivo/valido.png', 100]
      );
      warnSpy.mockRestore();
    });
  });
});
