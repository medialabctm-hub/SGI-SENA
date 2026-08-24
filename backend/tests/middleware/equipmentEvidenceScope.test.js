import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../src/config/dbconfig.js');
const uploadPath = path.resolve(__dirname, '../../src/middleware/uploadMiddleware.js');
const execute = jest.fn();

await jest.unstable_mockModule(dbPath, () => ({ default: { execute } }));
await jest.unstable_mockModule(uploadPath, () => ({ deleteImageFile: jest.fn() }));

const { requireEquipmentEvidenceScope } = await import('../../src/middleware/equipmentEvidenceScope.js');

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('requireEquipmentEvidenceScope', () => {
  it('denies a permitted role when the equipment is outside its active environment scope', async () => {
    execute.mockResolvedValueOnce([[]]);
    const req = { params: { codigoEquipo: '8' }, user: { id: 7, rol: 'Instructor' } };
    const res = response(); const next = jest.fn();

    await requireEquipmentEvidenceScope()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(req.evidenceScope).toEqual({ canAccess: false });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an administrator without querying environment assignments', async () => {
    const req = { params: { codigoEquipo: '8' }, user: { id: 1, rol: 'Administrador' } };
    const res = response(); const next = jest.fn();

    await requireEquipmentEvidenceScope()(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.evidenceScope).toEqual({ canAccess: true });
    expect(execute).not.toHaveBeenCalled();
  });
});
