import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const authPath = path.resolve(__dirname, '../../src/middleware/authMiddleware.js');
const authzPath = path.resolve(__dirname, '../../src/middleware/authorization.js');
const rolesPath = path.resolve(__dirname, '../../src/controller/rolesController.js');

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

await jest.unstable_mockModule(authPath, () => ({
  authenticate: mockAuth,
}));

await jest.unstable_mockModule(authzPath, () => ({
  requirePermission: mockRequirePermission,
}));

await jest.unstable_mockModule(rolesPath, () => ({
  listarRoles: listarRolesMock,
  obtenerRol: obtenerRolMock,
  listarPermisos: listarPermisosMock,
  crearRol: crearRolMock,
  actualizarRol: actualizarRolMock,
  eliminarRol: eliminarRolMock,
  actualizarPermisosRol: actualizarPermisosRolMock,
  togglePermisoRol: togglePermisoRolMock,
}));

const { default: router } = await import('../../src/routes/permissionsRoutes.js');

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const getRouteHandler = (routePath, method, index = 0) => {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  return layer.route.stack[index].handle;
};

describe('permissionsRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET / debe listar permisos aplanados', () => {
    const handler = getRouteHandler('/', 'get');
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

  it('POST /check debe responder 400 si no se envía permission', () => {
    const handler = getRouteHandler('/check', 'post');

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

  it('GET /roles debe delegar en rolesController.listarRoles', () => {
    listarRolesMock.mockImplementation((req, res) => {
      res.json({ total: 1, roles: [{ rol: 'Administrador' }] });
    });

    const handler = getRouteHandler('/roles', 'get');
    const req = {};
    const res = mockRes();

    handler(req, res);

    expect(listarRolesMock).toHaveBeenCalledWith(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: expect.any(Number),
        roles: expect.arrayContaining([
          expect.objectContaining({ rol: 'Administrador' }),
        ]),
      })
    );
  });

  it('GET /roles/:roleName debe delegar en rolesController.obtenerRol', () => {
    obtenerRolMock.mockImplementation((req, res) => {
      res.status(404).json({ error: 'Rol no encontrado' });
    });

    const handler = getRouteHandler('/roles/:roleName', 'get');
    const req = { params: { roleName: 'RolInexistente' } };
    const res = mockRes();

    handler(req, res);

    expect(obtenerRolMock).toHaveBeenCalledWith(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Rol no encontrado',
    }));
  });

  it('GET /me debe retornar el usuario y sus permisos', () => {
    const handler = getRouteHandler('/me', 'get');
    const res = mockRes();

    handler({ user: { id: 1, nombre: 'Admin', rol: 'Administrador' } }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      usuario: { id: 1, nombre: 'Admin', rol: 'Administrador' },
      permisos: expect.arrayContaining(['system:view_config', 'roles:manage']),
    }));
  });

  it('POST /check debe responder tiene=true cuando el permiso existe en el rol', () => {
    const handler = getRouteHandler('/check', 'post');
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

  it('debe registrar las rutas de gestion de roles y permisos', () => {
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
