/**
 * Tests para middleware de CORS público y Rate Limiter
 * Cubre corsPublicMiddleware y helpers de rateLimiter
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// -----------------------------------------------------------
// corsPublicMiddleware
// -----------------------------------------------------------
describe('corsPublicMiddleware', () => {
  let corsPublic;

  beforeEach(async () => {
    // Re-importar para obtener versión fresca según NODE_ENV
    const mod = await import('../../src/middleware/corsPublicMiddleware.js');
    corsPublic = mod.corsPublic;
  });

  const makeReqRes = (origin) => {
    const req = {
      method: 'GET',
      headers: { origin },
      get: (h) => (h === 'Origin' ? origin : undefined),
    };
    const res = {
      statusCode: 200,
      _headers: {},
      setHeader: jest.fn(function (k, v) { this._headers[k] = v; }),
      getHeader: jest.fn(function (k) { return this._headers[k]; }),
      end: jest.fn(),
    };
    return { req, res };
  };

  it('debe permitir solicitudes sin origen (Postman, mobile)', (done) => {
    const { req, res } = makeReqRes(undefined);
    const next = jest.fn();
    corsPublic(req, res, (err) => {
      expect(err).toBeUndefined();
      done();
    });
  });

  it('debe permitir el origen de producción permitido', (done) => {
    const { req, res } = makeReqRes('https://sgi-senadata.up.railway.app');
    corsPublic(req, res, (err) => {
      expect(err).toBeUndefined();
      done();
    });
  });

  it('debe permitir cualquier origen en modo development', (done) => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { req, res } = makeReqRes('http://localhost:3000');
    corsPublic(req, res, (err) => {
      process.env.NODE_ENV = originalEnv;
      expect(err).toBeUndefined();
      done();
    });
  });

  it('debe rechazar origen no permitido en producción', (done) => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const { req, res } = makeReqRes('https://evil.com');
    corsPublic(req, res, (err) => {
      process.env.NODE_ENV = originalEnv;
      // cors llama next con error en caso de rechazo
      expect(err).toBeTruthy();
      done();
    });
  });
});

// -----------------------------------------------------------
// rateLimiter - helpers internos (keyGenerator via exports)
// -----------------------------------------------------------
describe('rateLimiter - exportaciones', () => {
  it('debe exportar authLimiter como función middleware', async () => {
    const mod = await import('../../src/middleware/rateLimiter.js');
    expect(typeof mod.authLimiter).toBe('function');
  });

  it('debe exportar registerLimiter como función middleware', async () => {
    const mod = await import('../../src/middleware/rateLimiter.js');
    expect(typeof mod.registerLimiter).toBe('function');
  });

  it('debe exportar passwordResetLimiter como función middleware', async () => {
    const mod = await import('../../src/middleware/rateLimiter.js');
    expect(typeof mod.passwordResetLimiter).toBe('function');
  });

  it('debe exportar writeLimiter como función middleware', async () => {
    const mod = await import('../../src/middleware/rateLimiter.js');
    expect(typeof mod.writeLimiter).toBe('function');
  });

  it('debe exportar readLimiter como función middleware', async () => {
    const mod = await import('../../src/middleware/rateLimiter.js');
    expect(typeof mod.readLimiter).toBe('function');
  });

  it('debe exportar strictLimiter como función middleware', async () => {
    const mod = await import('../../src/middleware/rateLimiter.js');
    expect(typeof mod.strictLimiter).toBe('function');
  });

  it('debe exportar searchLimiter como función middleware', async () => {
    const mod = await import('../../src/middleware/rateLimiter.js');
    expect(typeof mod.searchLimiter).toBe('function');
  });

  it('debe exportar webhookLimiter como función middleware', async () => {
    const mod = await import('../../src/middleware/rateLimiter.js');
    expect(typeof mod.webhookLimiter).toBe('function');
  });
});

// -----------------------------------------------------------
// uploadMiddleware - getImagePath, deleteImageFile, handleUploadError
// -----------------------------------------------------------
describe('uploadMiddleware', () => {
  it('debe retornar la ruta correcta con getImagePath()', async () => {
    const { getImagePath } = await import('../../src/middleware/uploadMiddleware.js');
    expect(getImagePath('foto.jpg')).toBe('/uploads/equipos/foto.jpg');
    expect(getImagePath('img-001.png')).toBe('/uploads/equipos/img-001.png');
  });

  it('deleteImageFile debe retornar false si el archivo no existe', async () => {
    const { deleteImageFile } = await import('../../src/middleware/uploadMiddleware.js');
    const result = deleteImageFile('archivo_que_no_existe_xyz123.jpg');
    expect(result).toBe(false);
  });

  describe('handleUploadError', () => {
    let req, res, next;

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    it('debe responder 400 si el archivo es demasiado grande (MulterError LIMIT_FILE_SIZE)', async () => {
      const { handleUploadError } = await import('../../src/middleware/uploadMiddleware.js');
      const { default: multer } = await import('multer');
      const err = new multer.MulterError('LIMIT_FILE_SIZE');

      handleUploadError(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('10MB') })
      );
    });

    it('debe responder 400 si hay demasiados archivos (MulterError LIMIT_FILE_COUNT)', async () => {
      const { handleUploadError } = await import('../../src/middleware/uploadMiddleware.js');
      const { default: multer } = await import('multer');
      const err = new multer.MulterError('LIMIT_FILE_COUNT');

      handleUploadError(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Demasiados') })
      );
    });

    it('debe responder 400 con otro MulterError genérico', async () => {
      const { handleUploadError } = await import('../../src/middleware/uploadMiddleware.js');
      const { default: multer } = await import('multer');
      const err = new multer.MulterError('LIMIT_FIELD_KEY');
      err.message = 'Field name too long';

      handleUploadError(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Error al subir') })
      );
    });

    it('debe responder 400 con error genérico no MulterError', async () => {
      const { handleUploadError } = await import('../../src/middleware/uploadMiddleware.js');
      const err = new Error('Tipo de archivo no permitido');

      handleUploadError(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Tipo de archivo no permitido' });
    });

    it('debe llamar a next() si no hay error', async () => {
      const { handleUploadError } = await import('../../src/middleware/uploadMiddleware.js');

      handleUploadError(null, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
