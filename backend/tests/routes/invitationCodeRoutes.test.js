import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockAuth = jest.fn((req, res, next) => next());
const mockRequireRole = jest.fn(() => (req, res, next) => next());
const createInvitationCodeMock = jest.fn();
const getAllInvitationCodesMock = jest.fn();
const getInvitationCodeByIdMock = jest.fn();
const deleteInvitationCodeMock = jest.fn();
const deactivateInvitationCodeMock = jest.fn();
const validateInvitationCodeMock = jest.fn();

jest.mock('../../src/middleware/authMiddleware.js', () => ({
  authenticate: mockAuth,
}), { virtual: true });

jest.mock('../../src/middleware/authorization.js', () => ({
  requireRole: mockRequireRole,
}), { virtual: true });

jest.mock('../../src/controller/invitationCodeController.js', () => ({
  createInvitationCode: createInvitationCodeMock,
  getAllInvitationCodes: getAllInvitationCodesMock,
  getInvitationCodeById: getInvitationCodeByIdMock,
  deleteInvitationCode: deleteInvitationCodeMock,
  deactivateInvitationCode: deactivateInvitationCodeMock,
  validateInvitationCode: validateInvitationCodeMock,
}), { virtual: true });

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const getRoute = (router, path, method) => {
  return router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
};

describe('invitationCodeRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe registrar las rutas publicas y protegidas esperadas', async () => {
    const { default: router } = await import('../../src/routes/invitationCodeRoutes.js');
    const routeKeys = router.stack
      .filter((layer) => layer.route)
      .map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);

    expect(routeKeys).toEqual(expect.arrayContaining([
      'post /validate',
      'post /',
      'get /',
      'get /:id',
      'delete /:id',
      'patch /:id/deactivate',
    ]));
  });

  it('POST /validate debe responder 400 cuando el body es invalido', async () => {
    const { default: router } = await import('../../src/routes/invitationCodeRoutes.js');
    const route = getRoute(router, '/validate', 'post');
    const validateMiddleware = route.route.stack[0].handle;
    const res = mockRes();

    validateMiddleware({ body: { rol: 'Administrador' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Error de validación',
    }));
    expect(validateInvitationCodeMock).not.toHaveBeenCalled();
  });

  it('POST /validate debe continuar cuando el body es valido', async () => {
    const { default: router } = await import('../../src/routes/invitationCodeRoutes.js');
    const route = getRoute(router, '/validate', 'post');
    const validateMiddleware = route.route.stack[0].handle;
    const next = jest.fn();
    const req = { body: { codigo: 'ABC123', rol: 'Instructor' } };

    validateMiddleware(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ codigo: 'ABC123', rol: 'Instructor' });
  });

  it('POST / debe responder 400 cuando falta rol_destinado', async () => {
    const { default: router } = await import('../../src/routes/invitationCodeRoutes.js');
    const route = getRoute(router, '/', 'post');
    const validateMiddleware = route.route.stack[0].handle;
    const res = mockRes();

    validateMiddleware({ body: { max_usos: 2 } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Error de validación',
    }));
  });

  it('POST / debe continuar cuando createCodeSchema es valido', async () => {
    const { default: router } = await import('../../src/routes/invitationCodeRoutes.js');
    const route = getRoute(router, '/', 'post');
    const validateMiddleware = route.route.stack[0].handle;
    const next = jest.fn();
    const req = {
      body: {
        rol_destinado: 'Aprendiz',
        fecha_expiracion: '2026-12-31T00:00:00.000Z',
        max_usos: 5,
      },
    };

    validateMiddleware(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({
      rol_destinado: 'Aprendiz',
      fecha_expiracion: '2026-12-31T00:00:00.000Z',
      max_usos: 5,
    });
  });
});