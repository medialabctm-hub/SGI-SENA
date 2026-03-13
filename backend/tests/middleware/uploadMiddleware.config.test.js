import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const middlewarePath = path.resolve(__dirname, '../../src/middleware/uploadMiddleware.js');
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
  uploadEquipoImage,
  uploadEquipoImagePublico,
  getImagePath,
} = await import(`${pathToFileURL(middlewarePath).href}?cfg=uploadEquipos`);

describe('uploadMiddleware config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe configurar limits en uploads privados y públicos', () => {
    expect(uploadEquipoImage.__options.limits.fileSize).toBe(10 * 1024 * 1024);
    expect(uploadEquipoImagePublico.__options.limits.fileSize).toBe(10 * 1024 * 1024);
    expect(uploadEquipoImagePublico.__options.limits.files).toBe(10);
  });

  it('filename de storage principal debe usar codigo_equipo', () => {
    const storageConfig = uploadEquipoImage.__options.storage;
    const cb = jest.fn();

    storageConfig.filename(
      { params: { codigoEquipo: 'EQ-9' }, body: {} },
      { originalname: 'imagen equipo.png' },
      cb
    );

    const generatedName = cb.mock.calls[0][1];
    expect(generatedName).toContain('-EQ-9-imagen_equipo.png');
  });

  it('filename de storage público debe incluir random y nombre saneado', () => {
    const storagePublicConfig = uploadEquipoImagePublico.__options.storage;
    const cb = jest.fn();

    storagePublicConfig.filename(
      { params: {}, body: {} },
      { originalname: 'equipo público.png' },
      cb
    );

    const generatedName = cb.mock.calls[0][1];
    expect(generatedName).toMatch(/-equipo_p_blico\.png$/);
  });

  it('fileFilter privado y público deben usar validateImageFile', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    mockValidateImageFile.mockReturnValueOnce({ valid: true });
    uploadEquipoImage.__options.fileFilter({}, { mimetype: 'image/png' }, cb1);
    expect(cb1).toHaveBeenCalledWith(null, true);

    mockValidateImageFile.mockReturnValueOnce({ valid: false, error: 'invalid mime' });
    uploadEquipoImagePublico.__options.fileFilter({}, { mimetype: 'application/pdf' }, cb2);
    expect(cb2.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(cb2.mock.calls[0][0].message).toBe('invalid mime');
  });

  it('getImagePath mantiene ruta pública de equipos', () => {
    expect(getImagePath('x.png')).toBe('/uploads/equipos/x.png');
  });
});
