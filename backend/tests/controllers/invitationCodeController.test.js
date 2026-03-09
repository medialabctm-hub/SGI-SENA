import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loggerPath = path.resolve(__dirname, '../../src/utils/logger.js');
const serviceFactoryPath = path.resolve(__dirname, '../../src/factories/ServiceFactory.js');

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

// Mock the ServiceFactory module so ServiceFactory.create returns our mock service
const mockService = {
  createCode: jest.fn(),
  getAllCodes: jest.fn(),
  getCodeById: jest.fn(),
  deleteCode: jest.fn(),
  deactivateCode: jest.fn(),
  validateCode: jest.fn(),
};

await jest.unstable_mockModule(loggerPath, () => ({ logger: mockLogger }));
await jest.unstable_mockModule(serviceFactoryPath, () => ({
  ServiceFactory: { create: jest.fn(() => mockService) },
}));

const {
  createInvitationCode,
  getAllInvitationCodes,
  getInvitationCodeById,
  deleteInvitationCode,
  deactivateInvitationCode,
  validateInvitationCode,
} = await import('../../src/controller/invitationCodeController.js');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function mockNext() { return jest.fn(); }

beforeEach(() => { jest.clearAllMocks(); });

// ───────────────────────── createInvitationCode ─────────────────────────
describe('createInvitationCode', () => {
  it('creates a code and returns 201', async () => {
    const req = { body: { rol_destinado: 'Aprendiz', max_usos: 5 }, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    const fakeCode = { id: 1, codigo: 'ABC123', rol_destinado: 'Aprendiz' };
    mockService.createCode.mockResolvedValueOnce(fakeCode);
    await createInvitationCode(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: fakeCode }));
  });

  it('calls next with error on service failure', async () => {
    const req = { body: {}, user: { id_usuario: 1 } };
    const res = mockRes(); const next = mockNext();
    mockService.createCode.mockRejectedValueOnce(new Error('service error'));
    await createInvitationCode(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ───────────────────────── getAllInvitationCodes ─────────────────────────
describe('getAllInvitationCodes', () => {
  it('returns all codes with 200', async () => {
    const req = { query: { rol: 'Aprendiz', estado: 'activo' } };
    const res = mockRes(); const next = mockNext();
    const fakeCodes = [{ id: 1 }, { id: 2 }];
    mockService.getAllCodes.mockResolvedValueOnce(fakeCodes);
    await getAllInvitationCodes(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: fakeCodes }));
  });

  it('calls next with error on failure', async () => {
    const req = { query: {} };
    const res = mockRes(); const next = mockNext();
    mockService.getAllCodes.mockRejectedValueOnce(new Error('fail'));
    await getAllInvitationCodes(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ───────────────────────── getInvitationCodeById ─────────────────────────
describe('getInvitationCodeById', () => {
  it('returns code by id with 200', async () => {
    const req = { params: { id: '5' } };
    const res = mockRes(); const next = mockNext();
    const fakeCode = { id: 5, codigo: 'XYZ' };
    mockService.getCodeById.mockResolvedValueOnce(fakeCode);
    await getInvitationCodeById(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: fakeCode }));
    expect(mockService.getCodeById).toHaveBeenCalledWith(5);
  });

  it('calls next with error on failure', async () => {
    const req = { params: { id: '5' } };
    const res = mockRes(); const next = mockNext();
    mockService.getCodeById.mockRejectedValueOnce(new Error('not found'));
    await getInvitationCodeById(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ───────────────────────── deleteInvitationCode ─────────────────────────
describe('deleteInvitationCode', () => {
  it('deletes code and returns 200', async () => {
    const req = { params: { id: '3' } };
    const res = mockRes(); const next = mockNext();
    mockService.deleteCode.mockResolvedValueOnce(undefined);
    await deleteInvitationCode(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockService.deleteCode).toHaveBeenCalledWith(3);
  });

  it('calls next with error on failure', async () => {
    const req = { params: { id: '3' } };
    const res = mockRes(); const next = mockNext();
    mockService.deleteCode.mockRejectedValueOnce(new Error('fail'));
    await deleteInvitationCode(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ───────────────────────── deactivateInvitationCode ─────────────────────────
describe('deactivateInvitationCode', () => {
  it('deactivates code and returns 200', async () => {
    const req = { params: { id: '2' } };
    const res = mockRes(); const next = mockNext();
    mockService.deactivateCode.mockResolvedValueOnce(undefined);
    await deactivateInvitationCode(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockService.deactivateCode).toHaveBeenCalledWith(2);
  });

  it('calls next with error on failure', async () => {
    const req = { params: { id: '2' } };
    const res = mockRes(); const next = mockNext();
    mockService.deactivateCode.mockRejectedValueOnce(new Error('fail'));
    await deactivateInvitationCode(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ───────────────────────── validateInvitationCode ─────────────────────────
describe('validateInvitationCode', () => {
  it('validates code and returns 200 with usage info', async () => {
    const req = { body: { codigo: 'ABC123', rol: 'Aprendiz' } };
    const res = mockRes(); const next = mockNext();
    const fakeCode = {
      codigo: 'ABC123',
      rol_destinado: 'Aprendiz',
      fecha_expiracion: '2025-12-31',
      max_usos: 10,
      usos_actuales: 3,
    };
    mockService.validateCode.mockResolvedValueOnce(fakeCode);
    await validateInvitationCode(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ usos_restantes: 7 }),
    }));
  });

  it('returns "Ilimitado" when max_usos is 0', async () => {
    const req = { body: { codigo: 'FREE', rol: 'Aprendiz' } };
    const res = mockRes(); const next = mockNext();
    const fakeCode = {
      codigo: 'FREE',
      rol_destinado: 'Aprendiz',
      fecha_expiracion: null,
      max_usos: 0,
      usos_actuales: 5,
    };
    mockService.validateCode.mockResolvedValueOnce(fakeCode);
    await validateInvitationCode(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ usos_restantes: 'Ilimitado' }),
    }));
  });

  it('calls next with error on failure', async () => {
    const req = { body: { codigo: 'INVALID' } };
    const res = mockRes(); const next = mockNext();
    mockService.validateCode.mockRejectedValueOnce(new Error('invalid code'));
    await validateInvitationCode(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
