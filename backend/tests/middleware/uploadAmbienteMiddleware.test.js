import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import fs from 'fs';
import multer from 'multer';
import {
  handleUploadError,
  getImagePath,
  deleteImageFile,
} from '../../src/middleware/uploadAmbienteMiddleware.js';
import { logger } from '../../src/utils/logger.js';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('uploadAmbienteMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handleUploadError responde 400 para LIMIT_FILE_SIZE', () => {
    const err = new multer.MulterError('LIMIT_FILE_SIZE');
    const res = mockRes();
    const next = jest.fn();

    handleUploadError(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'El archivo es demasiado grande. Tamaño máximo: 5MB',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('handleUploadError responde 400 para LIMIT_FILE_COUNT', () => {
    const err = new multer.MulterError('LIMIT_FILE_COUNT');
    const res = mockRes();

    handleUploadError(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Demasiados archivos. Máximo permitido: 10',
    });
  });

  it('handleUploadError responde 400 para otros errores Multer', () => {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'images');
    const res = mockRes();

    handleUploadError(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('Error al subir archivo:'),
    });
  });

  it('handleUploadError responde 400 para errores genéricos', () => {
    const res = mockRes();

    handleUploadError(new Error('tipo inválido'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'tipo inválido' });
  });

  it('handleUploadError llama next cuando no hay error', () => {
    const next = jest.fn();

    handleUploadError(null, {}, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('getImagePath retorna la ruta pública esperada', () => {
    expect(getImagePath('foto.png')).toBe('/uploads/ambientes/foto.png');
  });

  it('deleteImageFile retorna false cuando el archivo no existe', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = deleteImageFile('no-existe.png');

    expect(result).toBe(false);
    existsSpy.mockRestore();
  });

  it('deleteImageFile retorna true cuando elimina el archivo', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    const result = deleteImageFile('imagen-ok.png');

    expect(result).toBe(true);
    expect(unlinkSpy).toHaveBeenCalled();
    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
  });

  it('debe retornar false y registrar error cuando unlinkSync falla', () => {
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
      throw new Error('permiso denegado');
    });

    const result = deleteImageFile('imagen-falla.png');

    expect(result).toBe(false);
    expect(loggerSpy).toHaveBeenCalledWith(
      'Error al eliminar archivo de ambiente',
      expect.objectContaining({
        filename: 'imagen-falla.png',
      })
    );

    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
    loggerSpy.mockRestore();
  });
});
