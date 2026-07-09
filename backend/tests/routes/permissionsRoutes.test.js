import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockAuth = jest.fn((req, res, next) => next());
const mockRequirePermission = jest.fn(() => (req, res, next) => next());

const listarRolesMock = jest.fn();
const obtenerRolMock = jest.fn();
const listarPermisosMock = jest.fn();
const crearRolMock = jest.fn();
const actualizarRolMock = jest.fn();
const eliminarRolMock = jest.fn();
const actualizarPermisosRolMock = jest.fn();
const togglePermisoRolMock = jest.fn();

jest.mock('../../src/middleware/authMiddleware.js', () => ({
  authenticate: mockAuth,
}), { virtual: true });

jest.mock('../../src/middleware/authorization.js', () => ({
  requirePermission: mockRequirePermission,
}), { virtual: true });

jest.mock('../../src/controller/rolesController.js', () => ({
  listarRoles: listarRolesMock,
  obtenerRol: obtenerRolMock,
  listarPermisos: listarPermisosMock,
  crearRol: crearRolMock,
  actualizarRol: actualizarRolMock,
  eliminarRol: eliminarRolMock,
  actualizarPermisosRol: actualizarPermisosRolMock,
  togglePermisoRol: togglePermisoRolMock,
}), { virtual: true });

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const getRouteHandler = (router, path, method, index = 0) => {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  return layer.route.stack[index].handle;
};

describe('permissionsRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET / debe listar permisos aplanados', async () => {
    const { default: router } = await import('../../src/routes/permissionsRoutes.js');
    const handler = getRouteHandler(router, '/', 'get');
    const res = mockRes();

    handler({}, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      total: expect.any(Number),
      permissions: expect.arrayContaining([
        expect.objectContaining({ permission: 'system:view_config' }),
        expect.objectContaining({ permission: 'roles:manage' }),
      ]),
    }));
  });

  it('POST /check debe responder 400 si no se envía permission', async () => {
    const { default: router } = await import('../../src/routes/permissionsRoutes.js');

    const handler = getRouteHandler(router, '/check', 'post');

    const req = {
      user: { rol: 'Administrador' },
      body: {},
    };
    const res = mockRes();

    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Permiso requerido',
      message: 'Debe proporcionar un permiso a verificar',
    });
  });

  it('GET /roles debe usar fallback ROLE_PERMISSIONS cuando listarRoles falla', async () => {
    listarRolesMock.mockImplementation(() => {
      throw new Error('BD no disponible');
    });

    const { default: router } = await import('../../src/routes/permissionsRoutes.js');

    const handler = getRouteHandler(router, '/roles', 'get');

    const req = {};
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: expect.any(Number),
        roles: expect.arrayContaining([
          expect.objectContaining({ rol: 'Administrador' }),
        ]),
      })
    );
  });

  it('GET /roles/:roleName debe responder 404 en fallback cuando el rol no existe', async () => {
    obtenerRolMock.mockImplementation(() => {
      throw new Error('BD no disponible');
    });

    const { default: router } = await import('../../src/routes/permissionsRoutes.js');
    const handler = getRouteHandler(router, '/roles/:roleName', 'get');
    const res = mockRes();

    await handler({ params: { roleName: 'RolInexistente' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Rol no encontrado',
    }));
  });

  it('GET /me debe retornar el usuario y sus permisos', async () => {
    const { default: router } = await import('../../src/routes/permissionsRoutes.js');
    const handler = getRouteHandler(router, '/me', 'get');
    const res = mockRes();

    handler({ user: { id: 1, nombre: 'Admin', rol: 'Administrador' } }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      usuario: { id: 1, nombre: 'Admin', rol: 'Administrador' },
      permisos: expect.arrayContaining(['system:view_config', 'roles:manage']),
    }));
  });

  it('POST /check debe responder tiene=true cuando el permiso existe en el rol', async () => {
    const { default: router } = await import('../../src/routes/permissionsRoutes.js');
    const handler = getRouteHandler(router, '/check', 'post');
    const res = mockRes();

    handler({
      user: { rol: 'Administrador' },
      body: { permission: 'system:view_config' },
    }, res);

    expect(res.json).toHaveBeenCalledWith({
      usuario: 'Administrador',
      permiso: 'system:view_config',
      tiene: true,
    });
  });

  it('debe registrar las rutas de gestion de roles y permisos', async () => {
    const { default: router } = await import('../../src/routes/permissionsRoutes.js');
    const routeKeys = router.stack
      .filter((layer) => layer.route)
      .map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);

    expect(routeKeys).toEqual(expect.arrayContaining([
      'get /permisos',
      'post /roles',
      'put /roles/:roleName',
      'delete /roles/:roleName',
      'put /roles/:roleName/permisos',
      'patch /roles/:roleName/permisos/:permissionCode',
    ]));
  });
});
