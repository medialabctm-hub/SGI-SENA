import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.resolve(__dirname, '../../src/config/dbconfig.js');
const loggerPath = path.resolve(__dirname, '../../src/utils/logger.js');
const uploadAmbientePath = path.resolve(__dirname, '../../src/middleware/uploadAmbienteMiddleware.js');

const mockExecute = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const mockGetImagePath = jest.fn((filename) => `/uploads/ambientes/${filename}`);
const mockDeleteImageFile = jest.fn();

await jest.unstable_mockModule(dbPath, () => ({ default: { execute: mockExecute } }));
await jest.unstable_mockModule(loggerPath, () => ({ logger: mockLogger }));
await jest.unstable_mockModule(uploadAmbientePath, () => ({
  getImagePath: mockGetImagePath,
  deleteImageFile: mockDeleteImageFile,
}));

const {
  subirImagenesAmbiente,
  listarImagenesAmbiente,
  obtenerImagenAmbiente,
  actualizarImagenAmbiente,
  marcarImagenPrincipal,
  eliminarImagenAmbiente,
} = await import('../../src/controller/imagenesAmbienteController.js');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ───────────────────────── subirImagenesAmbiente ─────────────────────────
describe('subirImagenesAmbiente', () => {
  it('returns 400 when no files provided', async () => {
    const req = { params: { idAmbiente: '1' }, files: [], body: {}, user: { id_usuario: 10 } };
    const res = mockRes();
    await subirImagenesAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 400 when files is null and req.file is also absent', async () => {
    const req = { params: { idAmbiente: '1' }, files: null, file: null, body: {}, user: { id_usuario: 10 } };
    const res = mockRes();
    await subirImagenesAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when ambiente not found - deletes files', async () => {
    const mockFile = { filename: 'test.jpg', originalname: 'test.jpg' };
    const req = { params: { idAmbiente: '99' }, files: [mockFile], body: {}, user: { id_usuario: 10 } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // ambiente not found
    await subirImagenesAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockDeleteImageFile).toHaveBeenCalledWith('test.jpg');
  });

  it('returns 201 with single image upload - not principal', async () => {
    const mockFile = { filename: 'img1.jpg', originalname: 'img1.jpg' };
    const req = {
      params: { idAmbiente: '5' },
      files: [mockFile],
      body: { tipo_imagen: 'Detalle', es_principal: 'false' },
      user: { id_usuario: 2 },
    };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 5, nombre_ambiente: 'Sala A' }]]) // ambiente found
      .mockResolvedValueOnce([{ insertId: 11 }]); // INSERT
    await subirImagenesAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('1') }));
  });

  it('returns 201 with image marked as principal - calls UPDATE first', async () => {
    const mockFile = { filename: 'main.jpg', originalname: 'main.jpg' };
    const req = {
      params: { idAmbiente: '5' },
      files: [mockFile],
      body: { tipo_imagen: 'Principal', es_principal: 'true' },
      user: { id_usuario: 2 },
    };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 5, nombre_ambiente: 'Sala A' }]]) // ambiente found
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE desmarca otras
      .mockResolvedValueOnce([{ insertId: 12 }]); // INSERT
    await subirImagenesAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE Imagenes_Ambiente SET es_principal = FALSE'),
      expect.any(Array)
    );
  });

  it('returns 500 on DB error - deletes uploaded files', async () => {
    const mockFile = { filename: 'err.jpg', originalname: 'err.jpg' };
    const req = { params: { idAmbiente: '5' }, files: [mockFile], body: {}, user: { id_usuario: 2 } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    await subirImagenesAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockDeleteImageFile).toHaveBeenCalledWith('err.jpg');
  });

  it('returns 500 on DB error with req.file (not req.files)', async () => {
    const req = { params: { idAmbiente: '5' }, files: null, file: { filename: 'single.jpg' }, body: {}, user: { id_usuario: 2 } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    await subirImagenesAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockDeleteImageFile).toHaveBeenCalledWith('single.jpg');
  });
});

// ───────────────────────── listarImagenesAmbiente ─────────────────────────
describe('listarImagenesAmbiente', () => {
  it('returns list of images for an ambiente', async () => {
    const req = { params: { idAmbiente: '5' } };
    const res = mockRes();
    const fakeImages = [{ id_imagen_ambiente: 1, ruta_imagen: '/x.jpg' }];
    mockExecute.mockResolvedValueOnce([fakeImages]);
    await listarImagenesAmbiente(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeImages);
  });

  it('returns 500 on error', async () => {
    const req = { params: { idAmbiente: '5' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await listarImagenesAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ───────────────────────── obtenerImagenAmbiente ─────────────────────────
describe('obtenerImagenAmbiente', () => {
  it('returns 404 when image not found', async () => {
    const req = { params: { idImagen: '999' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // no image found
    await obtenerImagenAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns image when found', async () => {
    const req = { params: { idImagen: '1' } };
    const res = mockRes();
    const fakeImg = { id_imagen_ambiente: 1, ruta_imagen: '/a.jpg' };
    mockExecute.mockResolvedValueOnce([[fakeImg]]);
    await obtenerImagenAmbiente(req, res);
    expect(res.json).toHaveBeenCalledWith(fakeImg);
  });

  it('returns 500 on error', async () => {
    const req = { params: { idImagen: '1' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await obtenerImagenAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ───────────────────────── actualizarImagenAmbiente ─────────────────────────
describe('actualizarImagenAmbiente', () => {
  it('returns 404 when image not found', async () => {
    const req = { params: { idImagen: '99' }, body: { tipo_imagen: 'x' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await actualizarImagenAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when no fields to update', async () => {
    const req = { params: { idImagen: '1' }, body: {} };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ id_imagen_ambiente: 1, id_ambiente: 5, es_principal: false }]]);
    await actualizarImagenAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates tipo_imagen and descripcion', async () => {
    const req = { params: { idImagen: '1' }, body: { tipo_imagen: 'Portada', descripcion: 'desc' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_imagen_ambiente: 1, id_ambiente: 5, es_principal: false }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await actualizarImagenAmbiente(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('updates es_principal=true - clears others first', async () => {
    const req = { params: { idImagen: '1' }, body: { es_principal: 'true' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_imagen_ambiente: 1, id_ambiente: 5, es_principal: false }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE others
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE this
    await actualizarImagenAmbiente(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 500 on error', async () => {
    const req = { params: { idImagen: '1' }, body: { tipo_imagen: 'x' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await actualizarImagenAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ───────────────────────── marcarImagenPrincipal ─────────────────────────
describe('marcarImagenPrincipal', () => {
  it('returns 404 when image not found', async () => {
    const req = { params: { idImagen: '99' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await marcarImagenPrincipal(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('marks image as principal successfully', async () => {
    const req = { params: { idImagen: '3' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_imagen_ambiente: 3, id_ambiente: 5 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE others FALSE
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE this TRUE
    await marcarImagenPrincipal(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 500 on error', async () => {
    const req = { params: { idImagen: '3' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await marcarImagenPrincipal(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ───────────────────────── eliminarImagenAmbiente ─────────────────────────
describe('eliminarImagenAmbiente', () => {
  it('returns 404 when image not found', async () => {
    const req = { params: { idImagen: '99' } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // not found
    await eliminarImagenAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes image successfully and calls deleteImageFile', async () => {
    const req = { params: { idImagen: '5' } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_imagen_ambiente: 5, ruta_imagen: '/uploads/ambientes/file.jpg', nombre_archivo: 'file.jpg' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE
    await eliminarImagenAmbiente(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    expect(mockDeleteImageFile).toHaveBeenCalledWith('file.jpg');
  });

  it('returns 500 on error', async () => {
    const req = { params: { idImagen: '5' } };
    const res = mockRes();
    mockExecute.mockRejectedValueOnce(new Error('fail'));
    await eliminarImagenAmbiente(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
