import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockAuthService = {
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  loginUserWithPlaca: jest.fn(),
  getCurrentUser: jest.fn(),
  listUsers: jest.fn(),
  getUserDetails: jest.fn(),
  getUserByCedula: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  cambiarContrasenaObligatorio: jest.fn(),
  solicitarRecuperacionContrasena: jest.fn(),
  validarTokenRecuperacion: jest.fn(),
  restablecerContrasena: jest.fn(),
  updateUserProfilePhoto: jest.fn(),
};

const mockExecute = jest.fn();

const serviceFactoryMock = {
  create: jest.fn(() => mockAuthService),
};

jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: {
    execute: mockExecute,
  },
  pool: {
    execute: mockExecute,
  },
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/factories/ServiceFactory.js'), () => ({
  ServiceFactory: serviceFactoryMock,
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/logger.js'), () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/middleware/uploadProfileMiddleware.js'), () => ({
  getProfileImagePath: jest.fn((filename) => `/uploads/perfiles/${filename}`),
}));

const {
  listRolesPublic,
  registerUser,
  loginUser,
  loginUserWithPlaca,
  me,
  listUsers,
  getUserDetails,
  getUserByCedula,
  updateUser,
  deleteUser,
  cambiarContrasenaObligatorio,
  solicitarRecuperacionContrasena,
  validarTokenRecuperacion,
  restablecerContrasena,
  uploadProfilePhoto,
} = await import(path.resolve(__dirname, '../../src/controller/authController.js'));

function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: null,
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authController', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = mockReq();
    res = mockRes();
    next = jest.fn();

    jest.clearAllMocks();
    mockExecute.mockReset();

    mockAuthService.registerUser.mockResolvedValue({ ok: true });
    mockAuthService.loginUser.mockResolvedValue({ ok: true });
    mockAuthService.loginUserWithPlaca.mockResolvedValue({ ok: true });
    mockAuthService.getCurrentUser.mockResolvedValue({ id: 1 });
    mockAuthService.listUsers.mockResolvedValue([]);
    mockAuthService.getUserDetails.mockResolvedValue({ id: 1 });
    mockAuthService.getUserByCedula.mockResolvedValue({ id: 1 });
    mockAuthService.updateUser.mockResolvedValue({ ok: true });
    mockAuthService.deleteUser.mockResolvedValue({ ok: true });
    mockAuthService.cambiarContrasenaObligatorio.mockResolvedValue({ ok: true });
    mockAuthService.solicitarRecuperacionContrasena.mockResolvedValue({ ok: true });
    mockAuthService.validarTokenRecuperacion.mockResolvedValue({ ok: true });
    mockAuthService.restablecerContrasena.mockResolvedValue({ ok: true });
    mockAuthService.updateUserProfilePhoto.mockResolvedValue({ ok: true });
  });

  describe('listRolesPublic', () => {
    it('retorna roles públicos desde BD', async () => {
      mockExecute.mockResolvedValueOnce([[{ nombre_rol: 'Instructor' }, { nombre_rol: 'Aprendiz' }]]);

      await listRolesPublic(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        roles: [{ nombre_rol: 'Instructor' }, { nombre_rol: 'Aprendiz' }],
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('llama next(error) cuando falla la consulta', async () => {
      const err = new Error('db fail');
      mockExecute.mockRejectedValueOnce(err);

      await listRolesPublic(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('registerUser', () => {
    it('retorna 201 al registrar', async () => {
      req.body = { nombre: 'Juan' };
      await registerUser(req, res, next);
      expect(serviceFactoryMock.create).toHaveBeenCalledWith('authService');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('pasa error a next', async () => {
      const err = new Error('register error');
      mockAuthService.registerUser.mockRejectedValueOnce(err);
      await registerUser(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('loginUser', () => {
    it('hace login y responde json', async () => {
      req.body = { cedula: '1', contrasena: 'x' };
      await loginUser(req, res, next);
      expect(mockAuthService.loginUser).toHaveBeenCalledWith('1', 'x');
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('pasa error a next', async () => {
      const err = new Error('login error');
      mockAuthService.loginUser.mockRejectedValueOnce(err);
      await loginUser(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('loginUserWithPlaca', () => {
    it('debe devolver 400 si faltan campos obligatorios', async () => {
      req.body = { cedula: '123' };

      await loginUserWithPlaca(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Faltan campos obligatorios: cedula, contrasena, placa',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('debe devolver 400 cuando falta placa aunque cedula y contrasena existan', async () => {
      req.body = { cedula: '123', contrasena: 'abc123' };

      await loginUserWithPlaca(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('ejecuta login con placa cuando todos los campos existen', async () => {
      req.body = { cedula: '1', contrasena: 'x', placa: 'PC-01' };
      await loginUserWithPlaca(req, res, next);
      expect(mockAuthService.loginUserWithPlaca).toHaveBeenCalledWith('1', 'x', 'PC-01');
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('me', () => {
    it('debe devolver 401 si no hay usuario en la request', async () => {
      req.user = null;

      await me(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
      expect(next).not.toHaveBeenCalled();
    });

    it('retorna perfil cuando hay usuario autenticado', async () => {
      req.user = { id: 7 };
      await me(req, res, next);
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(7);
      expect(res.json).toHaveBeenCalledWith({ user: { id: 1 } });
    });
  });

  describe('listUsers/get/update/delete', () => {
    it('listUsers usa filtro de rol', async () => {
      req.query = { rol: 'Instructor' };
      await listUsers(req, res, next);
      expect(mockAuthService.listUsers).toHaveBeenCalledWith('Instructor');
    });

    it('getUserDetails obtiene por id', async () => {
      req.params = { id: '5' };
      await getUserDetails(req, res, next);
      expect(mockAuthService.getUserDetails).toHaveBeenCalledWith('5');
    });

    it('getUserByCedula obtiene por cédula', async () => {
      req.params = { cedula: '1010' };
      await getUserByCedula(req, res, next);
      expect(mockAuthService.getUserByCedula).toHaveBeenCalledWith('1010');
    });

    it('updateUser actualiza por id', async () => {
      req.params = { id: '8' };
      req.body = { nombre: 'Nuevo' };
      await updateUser(req, res, next);
      expect(mockAuthService.updateUser).toHaveBeenCalledWith('8', { nombre: 'Nuevo' });
    });

    it('deleteUser elimina por id', async () => {
      req.params = { id: '8' };
      await deleteUser(req, res, next);
      expect(mockAuthService.deleteUser).toHaveBeenCalledWith('8');
    });

    it('propaga error de listUsers a next', async () => {
      const err = new Error('list error');
      mockAuthService.listUsers.mockRejectedValueOnce(err);
      await listUsers(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('password recovery endpoints', () => {
    it('cambiarContrasenaObligatorio devuelve 401 sin usuario', async () => {
      req.user = null;
      await cambiarContrasenaObligatorio(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('cambiarContrasenaObligatorio llama al servicio', async () => {
      req.user = { id: 3 };
      req.body = { contrasenaActual: 'a', nuevaContrasena: 'b' };
      await cambiarContrasenaObligatorio(req, res, next);
      expect(mockAuthService.cambiarContrasenaObligatorio).toHaveBeenCalledWith(3, 'a', 'b');
    });

    it('solicitarRecuperacionContrasena llama al servicio', async () => {
      req.body = { cedula: '123', correo: 'x@y.com' };
      await solicitarRecuperacionContrasena(req, res, next);
      expect(mockAuthService.solicitarRecuperacionContrasena).toHaveBeenCalledWith('123', 'x@y.com');
    });

    it('validarTokenRecuperacion llama al servicio', async () => {
      req.params = { token: 'tkn' };
      await validarTokenRecuperacion(req, res, next);
      expect(mockAuthService.validarTokenRecuperacion).toHaveBeenCalledWith('tkn');
    });

    it('restablecerContrasena llama al servicio', async () => {
      req.body = { token: 'tkn', nuevaContrasena: 'new' };
      await restablecerContrasena(req, res, next);
      expect(mockAuthService.restablecerContrasena).toHaveBeenCalledWith('tkn', 'new');
    });

    it('propaga errores de recuperación a next', async () => {
      const err = new Error('recovery fail');
      mockAuthService.restablecerContrasena.mockRejectedValueOnce(err);
      req.body = { token: 'tkn', nuevaContrasena: 'new' };
      await restablecerContrasena(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('uploadProfilePhoto', () => {
    it('debe devolver 403 si intenta editar otro usuario', async () => {
      req.params = { id: '10' };
      req.user = { id: 99 };
      req.file = { filename: 'avatar.png' };

      await uploadProfilePhoto(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No tienes permiso para actualizar este perfil',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('debe devolver 400 si no se envía archivo', async () => {
      req.params = { id: '10' };
      req.user = { id: 10 };
      req.file = null;

      await uploadProfilePhoto(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No se proporcionó ninguna imagen' });
    });

    it('actualiza foto cuando request es válida', async () => {
      req.params = { id: '10' };
      req.user = { id: 10 };
      req.file = { filename: 'avatar.png' };

      await uploadProfilePhoto(req, res, next);

      expect(mockAuthService.updateUserProfilePhoto).toHaveBeenCalledWith('10', '/uploads/perfiles/avatar.png');
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
