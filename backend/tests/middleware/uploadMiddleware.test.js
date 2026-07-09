import { describe, it, expect, jest } from '@jest/globals';
import fs from 'fs';
import multer from 'multer';
import {
  handleUploadError,
  getImagePath,
  deleteImageFile,
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
    expect(getImagePath('img.png')).toBe('/uploads/equipos/img.png');
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
});
