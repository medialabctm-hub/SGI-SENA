import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const middlewarePath = path.resolve(__dirname, '../../src/middleware/uploadAmbienteMiddleware.js');
const fileValidationPath = path.resolve(__dirname, '../../src/middleware/fileValidation.js');

const mockValidateImageFile = jest.fn();
const mockExistsSync = jest.fn(() => false);
const mockMkdirSync = jest.fn();

const multerMock = jest.fn((options) => ({ __options: options }));
multerMock.diskStorage = jest.fn((config) => config);
multerMock.MulterError = class MulterError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
};

await jest.unstable_mockModule('multer', () => ({ default: multerMock }));
await jest.unstable_mockModule(fileValidationPath, () => ({
  validateImageFile: mockValidateImageFile,
}));
await jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    unlinkSync: jest.fn(),
  },
}));

const {
  uploadAmbienteImage,
  getImagePath,
} = await import(`${pathToFileURL(middlewarePath).href}?cfg=uploadAmbiente`);

describe('uploadAmbienteMiddleware config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe configurar multer con límites esperados', () => {
    expect(uploadAmbienteImage.__options.limits.fileSize).toBe(5 * 1024 * 1024);
    expect(uploadAmbienteImage.__options.limits.files).toBe(10);
  });

  it('filename debe sanitizar nombre y usar idAmbiente', () => {
    const storageConfig = uploadAmbienteImage.__options.storage;
    const cb = jest.fn();

    storageConfig.filename(
      { params: { idAmbiente: '44' }, body: {} },
      { originalname: 'foto principal.png' },
      cb
    );

    const generatedName = cb.mock.calls[0][1];
    expect(generatedName).toContain('-44-foto_principal.png');
  });

  it('fileFilter debe aceptar o rechazar según validateImageFile', () => {
    const cbOk = jest.fn();
    const cbFail = jest.fn();

    mockValidateImageFile.mockReturnValueOnce({ valid: true });
    uploadAmbienteImage.__options.fileFilter({}, { mimetype: 'image/png' }, cbOk);
    expect(cbOk).toHaveBeenCalledWith(null, true);

    mockValidateImageFile.mockReturnValueOnce({ valid: false, error: 'tipo inválido' });
    uploadAmbienteImage.__options.fileFilter({}, { mimetype: 'text/plain' }, cbFail);
    expect(cbFail.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(cbFail.mock.calls[0][0].message).toBe('tipo inválido');
  });

  it('getImagePath debe mantener prefijo público', () => {
    expect(getImagePath('abc.jpg')).toBe('/uploads/ambientes/abc.jpg');
  });
});
