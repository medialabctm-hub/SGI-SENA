import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const middlewarePath = path.resolve(__dirname, '../../src/middleware/uploadProfileMiddleware.js');
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
  uploadProfileImage,
  getProfileImagePath,
} = await import(`${pathToFileURL(middlewarePath).href}?cfg=uploadProfile`);

describe('uploadProfileMiddleware config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe configurar límite de 2MB', () => {
    expect(uploadProfileImage.__options.limits.fileSize).toBe(2 * 1024 * 1024);
  });

  it('filename debe priorizar req.user.id_usuario y sanitizar nombre', () => {
    const storageConfig = uploadProfileImage.__options.storage;
    const cb = jest.fn();

    storageConfig.filename(
      { user: { id_usuario: 88 }, params: { id: '10' } },
      { originalname: 'foto perfil.png' },
      cb
    );

    const generatedName = cb.mock.calls[0][1];
    expect(generatedName).toContain('-88-foto_perfil.png');
  });

  it('fileFilter debe respetar validateImageFile', () => {
    const cbOk = jest.fn();
    const cbFail = jest.fn();

    mockValidateImageFile.mockReturnValueOnce({ valid: true });
    uploadProfileImage.__options.fileFilter({}, { mimetype: 'image/jpeg' }, cbOk);
    expect(cbOk).toHaveBeenCalledWith(null, true);

    mockValidateImageFile.mockReturnValueOnce({ valid: false, error: 'no permitido' });
    uploadProfileImage.__options.fileFilter({}, { mimetype: 'application/pdf' }, cbFail);
    expect(cbFail.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(cbFail.mock.calls[0][0].message).toBe('no permitido');
  });

  it('getProfileImagePath debe construir ruta pública', () => {
    expect(getProfileImagePath('perfil.jpg')).toBe('/uploads/perfiles/perfil.jpg');
  });
});
