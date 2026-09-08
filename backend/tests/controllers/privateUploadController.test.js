import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../src/config/dbconfig.js');
const permissionsPath = path.resolve(__dirname, '../../src/config/permissions.js');
const loggerPath = path.resolve(__dirname, '../../src/utils/logger.js');
const helpersPath = path.resolve(__dirname, '../../src/utils/controllerHelpers.js');
const privateUploadPath = path.resolve(__dirname, '../../src/utils/privateUpload.js');

const mockExecute = jest.fn();
const mockHasPermissionFromDB = jest.fn();
const mockResolvePrivateUploadPath = jest.fn();
const mockSendPrivateUpload = jest.fn();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

await jest.unstable_mockModule(dbPath, () => ({ default: { execute: mockExecute } }));
await jest.unstable_mockModule(permissionsPath, () => ({
  PERMISSIONS: { USERS: { VIEW_DETAIL: 'users:view_detail' } },
  isAdmin: role => role === 'Administrador',
  hasPermissionFromDB: mockHasPermissionFromDB,
}));
await jest.unstable_mockModule(loggerPath, () => ({ logger: mockLogger }));
await jest.unstable_mockModule(helpersPath, () => ({
  handleControllerError: jest.fn((error, res) => res.status(500).json({ error: error.message })),
}));
await jest.unstable_mockModule(privateUploadPath, () => ({
  PRIVATE_UPLOAD_DIRS: { perfiles: '/private/perfiles', ambientes: '/private/ambientes' },
  getSafeUploadFilename: jest.fn(filename => (
    typeof filename === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename) ? filename : null
  )),
  resolvePrivateUploadPath: mockResolvePrivateUploadPath,
  sendPrivateUpload: mockSendPrivateUpload,
}));

const { serveProfileImage, serveEnvironmentImage } = await import(
  '../../src/controller/privateUploadController.js'
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPermissionFromDB.mockResolvedValue(false);
  mockResolvePrivateUploadPath.mockResolvedValue('/private/image.jpg');
  mockSendPrivateUpload.mockReturnValue(undefined);
});

describe('serveProfileImage', () => {
  it('returns 404 without querying metadata for traversal input', async () => {
    const res = mockRes();
    await serveProfileImage({ params: { filename: '../secret.jpg' }, user: { id: 1 } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockSendPrivateUpload).not.toHaveBeenCalled();
  });

  it('serves the owner image after metadata and confined path checks', async () => {
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 7 }]]);

    await serveProfileImage({ params: { filename: 'avatar.jpg' }, user: { id: 7, rol: 'Aprendiz' } }, res);

    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('foto_perfil = ?'), ['/uploads/perfiles/avatar.jpg']);
    expect(mockResolvePrivateUploadPath).toHaveBeenCalledWith('/private/perfiles', 'avatar.jpg');
    expect(mockSendPrivateUpload).toHaveBeenCalledWith(res, '/private/image.jpg');
  });

  it('hides another profile from a role without users:view_detail', async () => {
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 7 }]]);

    await serveProfileImage({ params: { filename: 'avatar.jpg' }, user: { id: 8, rol: 'Aprendiz' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockResolvePrivateUploadPath).not.toHaveBeenCalled();
    expect(mockSendPrivateUpload).not.toHaveBeenCalled();
  });

  it('allows an authorized detail role to view another profile', async () => {
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ id_usuario: 7 }]]);
    mockHasPermissionFromDB.mockResolvedValueOnce(true);

    await serveProfileImage({ params: { filename: 'avatar.jpg' }, user: { id: 8, rol: 'Instructor' } }, res);

    expect(mockHasPermissionFromDB).toHaveBeenCalledWith(expect.anything(), 'Instructor', 'users:view_detail');
    expect(mockSendPrivateUpload).toHaveBeenCalledWith(res, '/private/image.jpg');
  });
});

describe('serveEnvironmentImage', () => {
  it('returns 404 for an orphaned or unknown image path', async () => {
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]);

    await serveEnvironmentImage({ params: { filename: 'orphan.jpg' }, user: { id: 1, rol: 'Instructor' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockResolvePrivateUploadPath).not.toHaveBeenCalled();
  });

  it('serves only an image whose metadata path matches exactly', async () => {
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[{ id_imagen_ambiente: 4 }]]);

    await serveEnvironmentImage({ params: { filename: 'room.jpg' }, user: { id: 2, rol: 'Instructor' } }, res);

    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('ruta_imagen = ?'), ['/uploads/ambientes/room.jpg']);
    expect(mockResolvePrivateUploadPath).toHaveBeenCalledWith('/private/ambientes', 'room.jpg');
    expect(mockSendPrivateUpload).toHaveBeenCalledWith(res, '/private/image.jpg');
  });
});
