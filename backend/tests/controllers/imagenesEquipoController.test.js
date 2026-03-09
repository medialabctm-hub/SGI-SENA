import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.resolve(__dirname, '../../src/config/dbconfig.js');
const loggerPath = path.resolve(__dirname, '../../src/utils/logger.js');
const errorsPath = path.resolve(__dirname, '../../src/utils/errors.js');
const uploadPath = path.resolve(__dirname, '../../src/middleware/uploadMiddleware.js');

const mockExecute = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const mockGetImagePath = jest.fn((filename) => `/uploads/equipos/${filename}`);
const mockDeleteImageFile = jest.fn();

class NotFoundError extends Error {
  constructor(resource) { super(`${resource} not found`); this.name = 'NotFoundError'; this.statusCode = 404; }
}
class ValidationError extends Error {
  constructor(msg) { super(msg); this.name = 'ValidationError'; this.statusCode = 400; }
}

await jest.unstable_mockModule(dbPath, () => ({ default: { execute: mockExecute } }));
await jest.unstable_mockModule(loggerPath, () => ({ logger: mockLogger }));
await jest.unstable_mockModule(errorsPath, () => ({ NotFoundError, ValidationError }));
await jest.unstable_mockModule(uploadPath, () => ({
  getImagePath: mockGetImagePath,
  deleteImageFile: mockDeleteImageFile,
}));

const {
  subirImagenesEquipo,
  listarImagenesEquipo,
  obtenerImagenEquipo,
  eliminarImagenEquipo,
  marcarImagenPrincipal,
  actualizarImagenEquipo,
} = await import('../../src/controller/imagenesEquipoController.js');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockNext() {
  return jest.fn();
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ───────────────────────── subirImagenesEquipo ─────────────────────────
describe('subirImagenesEquipo', () => {
  it('returns 400 when codigoEquipo is missing', async () => {
    const req = { params: {}, files: [{ filename: 'f.jpg' }], body: {}, user: {} };
    const res = mockRes(); const next = mockNext();
    await subirImagenesEquipo(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when no files', async () => {
    const req = { params: { codigoEquipo: '1' }, files: [], file: null, body: {}, user: {} };
    const res = mockRes(); const next = mockNext();
    await subirImagenesEquipo(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls next(NotFoundError) when equipo not found - deletes files', async () => {
    const req = { params: { codigoEquipo: '1' }, files: [{ filename: 'f.jpg' }], body: {}, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockResolvedValueOnce([[]]); // equipo not found
    await subirImagenesEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    expect(mockDeleteImageFile).toHaveBeenCalledWith('f.jpg');
  });

  it('returns 400 when codigoEquipo is NaN', async () => {
    const req = { params: { codigoEquipo: 'abc' }, files: [{ filename: 'f.jpg' }], body: {}, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockResolvedValueOnce([[{ codigo_equipo: 'abc' }]]); // equipo found
    await subirImagenesEquipo(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('uploads single image without es_principal', async () => {
    const req = {
      params: { codigoEquipo: '5' },
      files: [{ filename: 'img.jpg' }],
      body: { tipo_imagen: 'Detalle', es_principal: 'false' },
      user: { id_usuario: 2 },
    };
    const res = mockRes(); const next = mockNext();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 5 }]]) // equipo found
      .mockResolvedValueOnce([{ insertId: 20 }]); // INSERT
    await subirImagenesEquipo(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imagenes: expect.any(Array) }));
  });

  it('uploads image with es_principal=true', async () => {
    const req = {
      params: { codigoEquipo: '5' },
      files: [{ filename: 'main.jpg' }],
      body: { tipo_imagen: 'Principal', es_principal: 'true' },
      user: { id_usuario: 2 },
    };
    const res = mockRes(); const next = mockNext();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 5 }]]) // equipo found
      .mockResolvedValueOnce([{ insertId: 21 }]) // INSERT
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE others FALSE
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE this TRUE
    await subirImagenesEquipo(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('calls next with error on DB failure - deletes files', async () => {
    const req = {
      params: { codigoEquipo: '5' },
      files: [{ filename: 'err.jpg' }],
      file: null,
      body: {},
      user: { id_usuario: 2 },
    };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    await subirImagenesEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(mockDeleteImageFile).toHaveBeenCalledWith('err.jpg');
  });

  it('calls next with error on DB failure - deletes req.file if no req.files', async () => {
    const req = {
      params: { codigoEquipo: '5' },
      files: null,
      file: { filename: 'single.jpg' },
      body: {},
      user: { id_usuario: 2 },
    };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    await subirImagenesEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(mockDeleteImageFile).toHaveBeenCalledWith('single.jpg');
  });
});

// ───────────────────────── listarImagenesEquipo ─────────────────────────
describe('listarImagenesEquipo', () => {
  it('returns images list for equipo', async () => {
    const req = { params: { codigoEquipo: '5' } };
    const res = mockRes(); const next = mockNext();
    const fakeImages = [{ id_imagen_equipo: 1 }];
    mockExecute.mockResolvedValueOnce([fakeImages]);
    await listarImagenesEquipo(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imagenes: fakeImages }));
  });

  it('calls next(ValidationError) when codigoEquipo missing', async () => {
    const req = { params: {} };
    const res = mockRes(); const next = mockNext();
    await listarImagenesEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('calls next with error on DB failure', async () => {
    const req = { params: { codigoEquipo: '5' } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await listarImagenesEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ───────────────────────── obtenerImagenEquipo ─────────────────────────
describe('obtenerImagenEquipo', () => {
  it('calls next(NotFoundError) when image not found', async () => {
    const req = { params: { idImagen: '999' } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await obtenerImagenEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it('returns image when found', async () => {
    const req = { params: { idImagen: '1' } };
    const res = mockRes(); const next = mockNext();
    const fakeImg = { id_imagen_equipo: 1 };
    mockExecute.mockResolvedValueOnce([[fakeImg]]);
    await obtenerImagenEquipo(req, res, next);
    expect(res.json).toHaveBeenCalledWith(fakeImg);
  });

  it('calls next with error on DB failure', async () => {
    const req = { params: { idImagen: '1' } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await obtenerImagenEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ───────────────────────── eliminarImagenEquipo ─────────────────────────
describe('eliminarImagenEquipo', () => {
  it('calls next(NotFoundError) when image not found', async () => {
    const req = { params: { idImagen: '99' }, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await eliminarImagenEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it('deletes image and calls deleteImageFile', async () => {
    const req = { params: { idImagen: '5' }, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    mockExecute
      .mockResolvedValueOnce([[{ nombre_archivo: 'pic.jpg', codigo_equipo: 5 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await eliminarImagenEquipo(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    expect(mockDeleteImageFile).toHaveBeenCalledWith('pic.jpg');
  });

  it('calls next with error on DB failure', async () => {
    const req = { params: { idImagen: '5' }, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await eliminarImagenEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ───────────────────────── marcarImagenPrincipal ─────────────────────────
describe('marcarImagenPrincipal (equipo)', () => {
  it('calls next(NotFoundError) when image not found', async () => {
    const req = { params: { idImagen: '99' }, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await marcarImagenPrincipal(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it('marks image as principal', async () => {
    const req = { params: { idImagen: '3' }, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 5 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE others FALSE
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE this TRUE
    await marcarImagenPrincipal(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('calls next with error on DB failure', async () => {
    const req = { params: { idImagen: '3' }, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await marcarImagenPrincipal(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ───────────────────────── actualizarImagenEquipo ─────────────────────────
describe('actualizarImagenEquipo', () => {
  it('calls next(NotFoundError) when image not found', async () => {
    const req = { params: { idImagen: '99' }, body: { tipo_imagen: 'x' } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await actualizarImagenEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it('returns 400 when no fields to update', async () => {
    const req = { params: { idImagen: '1' }, body: {} };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockResolvedValueOnce([[{ id_imagen_equipo: 1 }]]);
    await actualizarImagenEquipo(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates tipo_imagen', async () => {
    const req = { params: { idImagen: '1' }, body: { tipo_imagen: 'Portada' } };
    const res = mockRes(); const next = mockNext();
    const updated = { id_imagen_equipo: 1, tipo_imagen: 'Portada' };
    mockExecute
      .mockResolvedValueOnce([[{ id_imagen_equipo: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
      .mockResolvedValueOnce([[updated]]); // SELECT updated
    await actualizarImagenEquipo(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imagen: updated }));
  });

  it('updates descripcion', async () => {
    const req = { params: { idImagen: '1' }, body: { descripcion: 'new desc' } };
    const res = mockRes(); const next = mockNext();
    const updated = { id_imagen_equipo: 1, descripcion: 'new desc' };
    mockExecute
      .mockResolvedValueOnce([[{ id_imagen_equipo: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);
    await actualizarImagenEquipo(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imagen: updated }));
  });

  it('calls next with error on DB failure', async () => {
    const req = { params: { idImagen: '1' }, body: { tipo_imagen: 'x' } };
    const res = mockRes(); const next = mockNext();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await actualizarImagenEquipo(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
