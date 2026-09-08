/**
 * Tests para authRoutes
 * Verifica que el router registra correctamente las rutas públicas y protegidas
 */

import { describe, it, expect, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authRoutesSource = fs.readFileSync(path.resolve(__dirname, '../../src/routes/authRoutes.js'), 'utf8');

// Mock de todos los módulos con dependencias externas
jest.mock('../../src/controller/authController.js', () => ({
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  logoutUser: jest.fn(),
  loginUserWithPlaca: jest.fn(),
  listRolesPublic: jest.fn(),
  deleteUser: jest.fn(),
  updateUser: jest.fn(),
  me: jest.fn(),
  listUsers: jest.fn(),
  getUserDetails: jest.fn(),
  getUserByCedula: jest.fn(),
  cambiarContrasenaObligatorio: jest.fn(),
  solicitarRecuperacionContrasena: jest.fn(),
  validarTokenRecuperacion: jest.fn(),
  restablecerContrasena: jest.fn(),
  uploadProfilePhoto: jest.fn(),
}), { virtual: true });

jest.mock('../../src/middleware/authMiddleware.js', () => ({
  authenticate: jest.fn((req, res, next) => next()),
}), { virtual: true });

jest.mock('../../src/middleware/authorization.js', () => ({
  requirePermission: jest.fn(() => (req, res, next) => next()),
  requireOwnership: jest.fn(() => (req, res, next) => next()),
  requireAdminForRoleChange: jest.fn((req, res, next) => next()),
}), { virtual: true });

jest.mock('../../src/config/permissions.js', () => ({
  PERMISSIONS: { USERS: { VIEW: 'users.view', UPDATE: 'users.update', DELETE: 'users.delete' } },
}), { virtual: true });

jest.mock('../../src/validators/authValidator.js', () => ({
  validate: jest.fn(() => (req, res, next) => next()),
  registerSchema: {},
  loginSchema: {},
  loginPlacaSchema: {},
  updateUserSchema: {},
}), { virtual: true });

jest.mock('../../src/middleware/rateLimiter.js', () => ({
  authLimiter: jest.fn((req, res, next) => next()),
  registerLimiter: jest.fn((req, res, next) => next()),
  passwordResetLimiter: jest.fn((req, res, next) => next()),
}), { virtual: true });

jest.mock('../../src/middleware/uploadProfileMiddleware.js', () => ({
  uploadProfileImage: { single: jest.fn(() => (req, res, next) => next()) },
  handleProfileUploadError: jest.fn((req, res, next) => next()),
}), { virtual: true });

describe('authRoutes', () => {
  it('debe importar y exponer un router de Express', async () => {
    const mod = await import('../../src/routes/authRoutes.js');
    const router = mod.default;
    // Un router de Express tiene la función "stack" con las rutas registradas
    expect(router).toBeDefined();
    expect(typeof router).toBe('function'); // Express Router es una función
  });

  it('debe registrar rutas POST /login, /register, /login-placa', async () => {
    const mod = await import('../../src/routes/authRoutes.js');
    const router = mod.default;
    const routes = router.stack
      .filter(l => l.route)
      .map(l => ({ path: l.route.path, methods: Object.keys(l.route.methods) }));

    const paths = routes.map(r => r.path);
    expect(paths).toContain('/login');
    expect(paths).toContain('/register');
    expect(paths).toContain('/login-placa');
  });

  it('debe validar login-placa después del rate limiter y antes del controlador', async () => {
    const mod = await import('../../src/routes/authRoutes.js');
    const router = mod.default;
    const loginPlacaRoute = router.stack.find(layer => layer.route?.path === '/login-placa');

    expect(loginPlacaRoute.route.stack).toHaveLength(3);
    expect(authRoutesSource).toMatch(
      /router\.post\('\/login-placa',\s*authLimiter,\s*validate\(loginPlacaSchema\),\s*loginUserWithPlaca\)/,
    );
  });

  it('debe registrar la ruta POST /logout (revoca la cookie httpOnly de sesión)', async () => {
    const mod = await import('../../src/routes/authRoutes.js');
    const router = mod.default;
    const logoutRoute = router.stack
      .filter(l => l.route)
      .map(l => ({ path: l.route.path, methods: Object.keys(l.route.methods) }))
      .find(r => r.path === '/logout');

    expect(logoutRoute).toBeDefined();
    expect(logoutRoute.methods).toContain('post');
  });

  it('debe registrar rutas GET /me, /users, /roles', async () => {
    const mod = await import('../../src/routes/authRoutes.js');
    const router = mod.default;
    const paths = router.stack
      .filter(l => l.route)
      .map(l => l.route.path);

    expect(paths).toContain('/me');
    expect(paths).toContain('/users');
    expect(paths).toContain('/roles');
  });
});
