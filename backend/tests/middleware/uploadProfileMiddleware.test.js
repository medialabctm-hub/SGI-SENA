import { describe, it, expect, jest } from '@jest/globals';
import multer from 'multer';
import fs from 'fs';
import {
  handleProfileUploadError,
  getProfileImagePath,
  deleteProfileImageFile,
} from '../../src/middleware/uploadProfileMiddleware.js';
import { logger } from '../../src/utils/logger.js';

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('uploadProfileMiddleware.handleProfileUploadError', () => {
  it('debe responder 400 para LIMIT_FILE_SIZE con mensaje de 10MB', () => {
    const err = new multer.MulterError('LIMIT_FILE_SIZE');
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    handleProfileUploadError(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'El archivo es demasiado grande. Tamaño máximo: 10MB',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('debe responder 400 para LIMIT_FILE_COUNT', () => {
    const err = new multer.MulterError('LIMIT_FILE_COUNT');
    const res = mockRes();

    handleProfileUploadError(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Solo se permite una imagen de perfil',
    });
  });

  it('debe responder 400 para otros errores Multer', () => {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    const res = mockRes();

    handleProfileUploadError(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('Error al subir archivo:'),
    });
  });

  it('debe responder 400 para error genérico', () => {
    const res = mockRes();

    handleProfileUploadError(new Error('imagen inválida'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'imagen inválida' });
  });

  it('debe llamar next cuando no hay error', () => {
    const next = jest.fn();

    handleProfileUploadError(null, {}, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('uploadProfileMiddleware helpers', () => {
  it('getProfileImagePath retorna ruta pública', () => {
    expect(getProfileImagePath('avatar.png')).toBe('/uploads/perfiles/avatar.png');
  });

  it('deleteProfileImageFile retorna false si filename es vacío', () => {
    expect(deleteProfileImageFile('')).toBe(false);
    expect(deleteProfileImageFile(null)).toBe(false);
  });

  it('deleteProfileImageFile retorna false cuando archivo no existe', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = deleteProfileImageFile('/uploads/perfiles/nope.png');

    expect(result).toBe(false);
    existsSpy.mockRestore();
  });

  it('deleteProfileImageFile elimina archivo y registra info', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    const result = deleteProfileImageFile('/uploads/perfiles/avatar.png');

    expect(result).toBe(true);
    expect(infoSpy).toHaveBeenCalled();
    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('deleteProfileImageFile retorna false y registra error si unlink falla', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
      throw new Error('sin permisos');
    });
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    const result = deleteProfileImageFile('avatar.png');

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      'Error al eliminar foto de perfil',
      expect.objectContaining({ filename: 'avatar.png' })
    );
    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
