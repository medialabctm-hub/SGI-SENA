/**
 * Tests para middleware/authorization
 *
 * Cubre: requireRole, requirePermission, requireOwnership,
 *        requireAssignedEquipos
 *
 * Patron ESM: jest.unstable_mockModule + import dinamico
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockIsAdmin = jest.fn();
const mockHasPermissionFromDB = jest.fn();
const mockHasPermission = jest.fn();
const mockHasAnyPermission = jest.fn();

jest.unstable_mockModule(resolve(__dirname, '../../src/config/permissions.js'), () => ({
  isAdmin: mockIsAdmin,
  hasPermissionFromDB: mockHasPermissionFromDB,
  hasPermission: mockHasPermission,
  hasAnyPermission: mockHasAnyPermission,
}));

jest.unstable_mockModule(resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: {},
}));

const {
  requireRole,
  requirePermission,
  requireOwnership,
  requireAssignedEquipos,
  requireAnyPermission,
  requirePermissionAndOwnership,
} = await import(resolve(__dirname, '../../src/middleware/authorization.js'));

function makeContext(userOverrides = {}) {
  return {
    req: { user: { id: 10, rol: 'Instructor', ...userOverrides }, params: {} },
    res: { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() },
    next: jest.fn(),
  };
}

beforeEach(() => {
  mockIsAdmin.mockReturnValue(false);
  mockHasPermissionFromDB.mockReset();
  mockHasPermission.mockReset();
});

describe('requireRole()', () => {
  it('debe llamar next() si el rol esta en la lista permitida', () => {
    const { req, res, next } = makeContext({ rol: 'Instructor' });
    requireRole(['Instructor', 'Cuentadante'])(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe llamar next() si el Administrador accede (bypass)', () => {
    mockIsAdmin.mockReturnValue(true);
    const { req, res, next } = makeContext({ rol: 'Administrador' });
    requireRole(['Instructor'])(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('debe retornar 403 si el rol no esta en la lista', () => {
    const { req, res, next } = makeContext({ rol: 'Aprendiz' });
    requireRole(['Instructor', 'Cuentadante'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Acceso denegado' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('debe retornar 401 si no hay usuario', () => {
    const req = { user: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireRole(['Instructor'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('debe retornar 401 si req.user.rol esta ausente', () => {
    const { req, res, next } = makeContext();
    delete req.user.rol;
    requireRole(['Instructor'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('debe aceptar un solo rol como string', () => {
    const { req, res, next } = makeContext({ rol: 'Instructor' });
    requireRole('Instructor')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('la respuesta 403 debe incluir el rol y los roles requeridos', () => {
    const { req, res, next } = makeContext({ rol: 'Aprendiz' });
    requireRole(['Administrador'])(req, res, next);
    const payload = res.json.mock.calls[0][0];
    expect(payload.userRole).toBe('Aprendiz');
    expect(payload.requiredRoles).toEqual(['Administrador']);
  });

  it('debe retornar 500 si isAdmin lanza una excepci\u00f3n', () => {
    mockIsAdmin.mockImplementation(() => { throw new Error('DB crash'); });
    const { req, res, next } = makeContext({ rol: 'Instructor' });
    requireRole(['Instructor'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Error al validar autorizaci\u00f3n' }));
    mockIsAdmin.mockReturnValue(false);
  });
});

describe('requirePermission() – error 500', () => {
  it('debe retornar 500 si hasPermissionFromDB lanza una excepci\u00f3n', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB.mockRejectedValue(new Error('Timeout BD'));
    const { req, res, next } = makeContext({ rol: 'Instructor' });
    await requirePermission('equipos:view')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Error al validar permisos' }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireOwnership() – error 500', () => {
  it('debe retornar 500 si getResourceOwnerId lanza una excepci\u00f3n', async () => {
    mockIsAdmin.mockReturnValue(false);
    const getOwner = jest.fn().mockRejectedValue(new Error('Error al buscar recurso'));
    const { req, res, next } = makeContext({ id: 5, rol: 'Aprendiz' });
    await requireOwnership(getOwner)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Error al validar propiedad del recurso' }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAssignedEquipos() – error 500', () => {
  it('debe retornar 500 si getUserEquipos lanza una excepci\u00f3n', async () => {
    mockIsAdmin.mockReturnValue(false);
    const getEquipos = jest.fn().mockRejectedValue(new Error('Fallo en BD'));
    const { req, res, next } = makeContext({ id: 3, rol: 'Aprendiz' });
    await requireAssignedEquipos(getEquipos)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('debe retornar 403 si getUserEquipos devuelve null', async () => {
    mockIsAdmin.mockReturnValue(false);
    const getEquipos = jest.fn().mockResolvedValue(null);
    const { req, res, next } = makeContext({ id: 3, rol: 'Aprendiz' });
    await requireAssignedEquipos(getEquipos)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ──────────────────────────────────────────────
// requireAnyPermission
// ──────────────────────────────────────────────
describe('requireAnyPermission()', () => {
  it('debe llamar next() si el admin hace bypass', async () => {
    mockIsAdmin.mockReturnValue(true);
    const { req, res, next } = makeContext({ rol: 'Administrador' });
    await requireAnyPermission(['equipos:view', 'equipos:create'])(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(mockHasPermissionFromDB).not.toHaveBeenCalled();
  });

  it('debe llamar next() si el usuario tiene al menos uno de los permisos', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB
      .mockResolvedValueOnce(false)  // primer permiso: no tiene
      .mockResolvedValueOnce(true);  // segundo permiso: s\u00ed tiene
    const { req, res, next } = makeContext({ rol: 'Instructor' });
    await requireAnyPermission(['equipos:delete', 'equipos:view'])(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe llamar next() con el primer permiso v\u00e1lido (corto circuito)', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB.mockResolvedValueOnce(true); // primer permiso v\u00e1lido
    const { req, res, next } = makeContext({ rol: 'Instructor' });
    await requireAnyPermission(['equipos:view', 'equipos:create', 'equipos:delete'])(req, res, next);
    expect(next).toHaveBeenCalledWith();
    // Solo se llama una vez (corto circuito al primer true)
    expect(mockHasPermissionFromDB).toHaveBeenCalledTimes(1);
  });

  it('debe retornar 403 si el usuario no tiene ning\u00fan permiso', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB.mockResolvedValue(false);
    const { req, res, next } = makeContext({ rol: 'Aprendiz' });
    await requireAnyPermission(['equipos:delete', 'users:create'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Acceso denegado' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('la respuesta 403 debe incluir el rol y los permisos requeridos', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB.mockResolvedValue(false);
    const { req, res, next } = makeContext({ rol: 'Aprendiz' });
    await requireAnyPermission(['a:b', 'c:d'])(req, res, next);
    const payload = res.json.mock.calls[0][0];
    expect(payload.userRole).toBe('Aprendiz');
    expect(payload.requiredPermissions).toEqual(['a:b', 'c:d']);
  });

  it('debe retornar 401 si no hay usuario', async () => {
    const req = { user: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await requireAnyPermission(['equipos:view'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('debe retornar 500 si hasPermissionFromDB lanza una excepci\u00f3n', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB.mockRejectedValue(new Error('Timeout'));
    const { req, res, next } = makeContext({ rol: 'Instructor' });
    await requireAnyPermission(['equipos:view'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// requirePermissionAndOwnership
// ──────────────────────────────────────────────
describe('requirePermissionAndOwnership()', () => {
  it('debe llamar next() si admin tiene acceso total (bypass doble)', async () => {
    mockIsAdmin.mockReturnValue(true);
    const { req, res, next } = makeContext({ id: 1, rol: 'Administrador' });
    const getOwner = jest.fn().mockResolvedValue(99);
    await requirePermissionAndOwnership('equipos:update', getOwner)(req, res, next);
    // Esperar microtareas (la fn interna no est\u00e1 awaited)
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe llamar next() si tiene permiso y es propietario', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB.mockResolvedValue(true);
    const { req, res, next } = makeContext({ id: 5, rol: 'Instructor' });
    const getOwner = jest.fn().mockResolvedValue(5);
    await requirePermissionAndOwnership('equipos:update', getOwner)(req, res, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledWith();
  });

  it('debe retornar 403 si tiene permiso pero no es propietario', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB.mockResolvedValue(true);
    const { req, res, next } = makeContext({ id: 5, rol: 'Instructor' });
    const getOwner = jest.fn().mockResolvedValue(99); // otro due\u00f1o
    await requirePermissionAndOwnership('equipos:update', getOwner)(req, res, next);
    await new Promise((r) => setImmediate(r));
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalledWith();
  });

  it('debe retornar 403 si no tiene el permiso (check de permiso falla)', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB.mockResolvedValue(false);
    const { req, res, next } = makeContext({ id: 5, rol: 'Aprendiz' });
    const getOwner = jest.fn().mockResolvedValue(5);
    await requirePermissionAndOwnership('equipos:delete', getOwner)(req, res, next);
    await new Promise((r) => setImmediate(r));
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requirePermission()', () => {
  it('debe llamar next() si el usuario tiene el permiso en BD', async () => {
    mockHasPermissionFromDB.mockResolvedValue(true);
    const { req, res, next } = makeContext({ rol: 'Instructor' });
    await requirePermission('equipos:view')(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe llamar next() si el usuario es Administrador (bypass)', async () => {
    mockIsAdmin.mockReturnValue(true);
    const { req, res, next } = makeContext({ rol: 'Administrador' });
    await requirePermission('equipos:delete')(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(mockHasPermissionFromDB).not.toHaveBeenCalled();
  });

  it('debe retornar 403 si el usuario no tiene el permiso', async () => {
    mockHasPermissionFromDB.mockResolvedValue(false);
    const { req, res, next } = makeContext({ rol: 'Aprendiz' });
    await requirePermission('equipos:delete')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Acceso denegado' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('debe retornar 401 si no hay usuario', async () => {
    const req = { user: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await requirePermission('equipos:view')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('la respuesta 403 debe incluir el permiso requerido y el rol', async () => {
    mockHasPermissionFromDB.mockResolvedValue(false);
    const { req, res, next } = makeContext({ rol: 'Aprendiz' });
    await requirePermission('usuarios:delete')(req, res, next);
    const payload = res.json.mock.calls[0][0];
    expect(payload.userRole).toBe('Aprendiz');
    expect(payload.requiredPermission).toBe('usuarios:delete');
  });
});

describe('requireOwnership()', () => {
  it('debe llamar next() si el usuario es propietario', async () => {
    const { req, res, next } = makeContext({ id: 5, rol: 'Aprendiz' });
    const getOwner = jest.fn().mockResolvedValue(5);
    await requireOwnership(getOwner)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe llamar next() si el usuario es Administrador (bypass)', async () => {
    mockIsAdmin.mockReturnValue(true);
    const { req, res, next } = makeContext({ id: 1, rol: 'Administrador' });
    const getOwner = jest.fn().mockResolvedValue(99);
    await requireOwnership(getOwner)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(getOwner).not.toHaveBeenCalled();
  });

  it('debe retornar 403 si el usuario no es propietario', async () => {
    const { req, res, next } = makeContext({ id: 5, rol: 'Aprendiz' });
    const getOwner = jest.fn().mockResolvedValue(9);
    await requireOwnership(getOwner)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('debe retornar 401 si no hay usuario', async () => {
    const req = { user: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await requireOwnership(jest.fn())(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('debe comparar IDs como numeros (string vs number)', async () => {
    const { req, res, next } = makeContext({ id: 5, rol: 'Aprendiz' });
    const getOwner = jest.fn().mockResolvedValue('5');
    await requireOwnership(getOwner)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireAssignedEquipos()', () => {
  it('debe llamar next() si el usuario tiene equipos asignados', async () => {
    const { req, res, next } = makeContext({ id: 3, rol: 'Aprendiz' });
    const getEquipos = jest.fn().mockResolvedValue([{ codigo_equipo: 1 }]);
    await requireAssignedEquipos(getEquipos)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.userEquipos).toHaveLength(1);
  });

  it('debe retornar 403 si el Aprendiz no tiene equipos', async () => {
    const { req, res, next } = makeContext({ id: 3, rol: 'Aprendiz' });
    const getEquipos = jest.fn().mockResolvedValue([]);
    await requireAssignedEquipos(getEquipos)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'No tiene equipos asignados' }));
  });

  it('debe llamar next() si el usuario es Administrador (bypass)', async () => {
    mockIsAdmin.mockReturnValue(true);
    const { req, res, next } = makeContext({ id: 1, rol: 'Administrador' });
    const getEquipos = jest.fn();
    await requireAssignedEquipos(getEquipos)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(getEquipos).not.toHaveBeenCalled();
  });

  it('debe llamar next() si el usuario es Instructor (bypass)', async () => {
    const { req, res, next } = makeContext({ id: 2, rol: 'Instructor' });
    await requireAssignedEquipos(jest.fn())(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('debe llamar next() si el usuario es Cuentadante (bypass)', async () => {
    const { req, res, next } = makeContext({ id: 4, rol: 'Cuentadante' });
    await requireAssignedEquipos(jest.fn())(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('debe retornar 401 si no hay usuario', async () => {
    const req = { user: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await requireAssignedEquipos(jest.fn())(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('debe adjuntar equipos en req.userEquipos cuando pasa la validacion', async () => {
    const equipos = [{ codigo_equipo: 10 }, { codigo_equipo: 11 }];
    const { req, res, next } = makeContext({ id: 3, rol: 'Aprendiz' });
    const getEquipos = jest.fn().mockResolvedValue(equipos);
    await requireAssignedEquipos(getEquipos)(req, res, next);
    expect(req.userEquipos).toEqual(equipos);
  });
});