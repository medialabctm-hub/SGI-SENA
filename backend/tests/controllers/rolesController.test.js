import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockExecute = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: { execute: mockExecute },
  pool: { execute: mockExecute }
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/permissions.js'), () => ({
  PERMISSIONS: {}
}));

// ── Dynamic import ─────────────────────────────────────────────────────────
const {
  listarRoles,
  obtenerRol,
  crearRol,
  actualizarRol,
  eliminarRol,
  actualizarPermisosRol,
  togglePermisoRol,
  listarPermisos
} = await import(path.resolve(__dirname, '../../src/controller/rolesController.js'));

// ── Helpers ────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1, rol: 'Administrador' },
    ...overrides
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('listarRoles', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns roles with permissions', async () => {
    const fakeRoles = [{ id_rol: 1, nombre_rol: 'Administrador', descripcion: 'Admin', estado: 'Activo', fecha_creacion: '2024-01-01' }];
    const fakeTodosPermisos = [{ id_permiso: 1, codigo_permiso: 'admin.all', modulo: 'admin', accion: 'all' }];
    const fakePermisosActivos = [{ codigo_permiso: 'admin.all' }];
    mockExecute
      .mockResolvedValueOnce([fakeRoles])        // roles query
      .mockResolvedValueOnce([fakeTodosPermisos]) // todos permisos for rol 1
      .mockResolvedValueOnce([fakePermisosActivos]); // permisos activos for rol 1
    const req = mockReq();
    const res = mockRes();
    await listarRoles(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      total: 1,
      roles: expect.arrayContaining([expect.objectContaining({ rol: 'Administrador' })])
    }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq();
    const res = mockRes();
    await listarRoles(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('obtenerRol', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when rol not found', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // empty roles
    const req = mockReq({ params: { roleName: 'FakeRol' } });
    const res = mockRes();
    await obtenerRol(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns rol with permissions', async () => {
    const fakeRoles = [{ id_rol: 2, nombre_rol: 'Instructor', descripcion: '', estado: 'Activo', fecha_creacion: '2024-01-01' }];
    const fakePermisos = [{ id_permiso: 3, codigo_permiso: 'clases.leer', modulo: 'clases', accion: 'leer', activo: 1 }];
    mockExecute
      .mockResolvedValueOnce([fakeRoles])
      .mockResolvedValueOnce([fakePermisos]);
    const req = mockReq({ params: { roleName: 'Instructor' } });
    const res = mockRes();
    await obtenerRol(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rol: 'Instructor' }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { roleName: 'Admin' } });
    const res = mockRes();
    await obtenerRol(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('crearRol', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when nombre_rol missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await crearRol(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when nombre_rol is empty string', async () => {
    const req = mockReq({ body: { nombre_rol: '   ' } });
    const res = mockRes();
    await crearRol(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when rol already exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_rol: 5 }]]); // existing
    const req = mockReq({ body: { nombre_rol: 'NuevoRol' } });
    const res = mockRes();
    await crearRol(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates rol without permissions', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])              // no existing
      .mockResolvedValueOnce([{ insertId: 7 }]); // INSERT
    const req = mockReq({ body: { nombre_rol: 'NuevoRol', descripcion: 'Descripcion' } });
    const res = mockRes();
    await crearRol(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rol: expect.objectContaining({ id_rol: 7 }) }));
  });

  it('creates rol with permissions', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])              // no existing
      .mockResolvedValueOnce([{ insertId: 8 }]) // INSERT rol
      .mockResolvedValueOnce([[{ id_permiso: 1 }]]) // permisos found
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT Rol_Permisos
    const req = mockReq({ body: { nombre_rol: 'OtroRol', permisos: ['clases.leer'] } });
    const res = mockRes();
    await crearRol(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ body: { nombre_rol: 'NuevoRol' } });
    const res = mockRes();
    await crearRol(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('actualizarRol', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when rol not found', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // not found
    const req = mockReq({ params: { roleName: 'FakeRol' }, body: { descripcion: 'X' } });
    const res = mockRes();
    await actualizarRol(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 for invalid estado', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_rol: 3, nombre_rol: 'Aprendiz' }]]);
    const req = mockReq({ params: { roleName: 'Aprendiz' }, body: { estado: 'Borrado' } });
    const res = mockRes();
    await actualizarRol(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates rol successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_rol: 3, nombre_rol: 'Aprendiz' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { roleName: 'Aprendiz' }, body: { descripcion: 'Nuevo desc' } });
    const res = mockRes();
    await actualizarRol(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('actualizado') }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { roleName: 'Admin' }, body: {} });
    const res = mockRes();
    await actualizarRol(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('eliminarRol', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when rol not found', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // not found
    const req = mockReq({ params: { roleName: 'FakeRol' } });
    const res = mockRes();
    await eliminarRol(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { roleName: 'Admin' } });
    const res = mockRes();
    await eliminarRol(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 400 when role has assigned users', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_rol: 9 }]])
      .mockResolvedValueOnce([[{ total: 2 }]]);
    const req = mockReq({ params: { roleName: 'Aprendiz' } });
    const res = mockRes();
    await eliminarRol(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('deletes role successfully when no users assigned', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_rol: 9 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({ params: { roleName: 'Temporal' } });
    const res = mockRes();
    await eliminarRol(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('eliminado') }));
  });
});

describe('actualizarPermisosRol', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when permisos is not array', async () => {
    const req = mockReq({ params: { roleName: 'Instructor' }, body: { permisos: 'bad' } });
    const res = mockRes();
    await actualizarPermisosRol(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when role does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { roleName: 'NoExiste' }, body: { permisos: [] } });
    const res = mockRes();
    await actualizarPermisosRol(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when includes invalid permissions', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_rol: 3 }]])
      .mockResolvedValueOnce([[{ id_permiso: 1, codigo_permiso: 'clases:ver' }]]);
    const req = mockReq({
      params: { roleName: 'Instructor' },
      body: { permisos: ['invalido'] }
    });
    const res = mockRes();
    await actualizarPermisosRol(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates permissions with add/remove/reactivate counts', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_rol: 3 }]])
      .mockResolvedValueOnce([[
        { id_permiso: 1, codigo_permiso: 'clases:ver' },
        { id_permiso: 2, codigo_permiso: 'clases:crear' },
        { id_permiso: 3, codigo_permiso: 'clases:editar' }
      ]])
      .mockResolvedValueOnce([[{ id_permiso: 1, activo: 1 }, { id_permiso: 3, activo: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = mockReq({
      user: { id: 50, rol: 'Administrador' },
      params: { roleName: 'Instructor' },
      body: { permisos: ['clases:ver', 'clases:editar', 'clases:crear'] }
    });
    const res = mockRes();
    await actualizarPermisosRol(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Permisos actualizados'),
      agregados: expect.any(Number),
      reactivados: expect.any(Number)
    }));
  });
});

describe('togglePermisoRol', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 400 when activo is not boolean', async () => {
    const req = mockReq({
      params: { roleName: 'Instructor', permissionCode: 'clases:ver' },
      body: { activo: 'si' }
    });
    const res = mockRes();
    await togglePermisoRol(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when role not found', async () => {
    mockExecute.mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { roleName: 'NoExiste', permissionCode: 'clases:ver' },
      body: { activo: true }
    });
    const res = mockRes();
    await togglePermisoRol(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 when permission not found', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_rol: 1 }]])
      .mockResolvedValueOnce([[]]);
    const req = mockReq({
      params: { roleName: 'Instructor', permissionCode: 'no:permiso' },
      body: { activo: true }
    });
    const res = mockRes();
    await togglePermisoRol(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('creates relation when it does not exist', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_rol: 1 }]])
      .mockResolvedValueOnce([[{ id_permiso: 2 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({
      user: { id: 99, rol: 'Administrador' },
      params: { roleName: 'Instructor', permissionCode: 'clases:ver' },
      body: { activo: true }
    });
    const res = mockRes();
    await togglePermisoRol(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ activo: true }));
  });

  it('updates relation when it already exists', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_rol: 1 }]])
      .mockResolvedValueOnce([[{ id_permiso: 2 }]])
      .mockResolvedValueOnce([[{ activo: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = mockReq({
      params: { roleName: 'Instructor', permissionCode: 'clases:ver' },
      body: { activo: false }
    });
    const res = mockRes();
    await togglePermisoRol(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ activo: false }));
  });
});

describe('listarPermisos', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns permissions list', async () => {
    const fakePermisos = [{ id_permiso: 1, codigo_permiso: 'clases.leer', modulo: 'clases', accion: 'leer' }];
    mockExecute.mockResolvedValueOnce([fakePermisos]);
    const req = mockReq();
    const res = mockRes();
    await listarPermisos(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq();
    const res = mockRes();
    await listarPermisos(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});