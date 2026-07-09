import {
  registerUser,
  loginUser,
  loginUserWithPlaca,
  listRolesPublic,
  deleteUser,
  updateUser,
  me,
  listUsers,
  getUserDetails,
  getUserByCedula,
  cambiarContrasenaObligatorio,
  solicitarRecuperacionContrasena,
  validarTokenRecuperacion,
  restablecerContrasena,
  uploadProfilePhoto,
} from '../controller/authController.js';
import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission, requireOwnership } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { validate, registerSchema, loginSchema, updateUserSchema } from '../validators/authValidator.js';
import { authLimiter, registerLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { uploadProfileImage, handleProfileUploadError } from '../middleware/uploadProfileMiddleware.js';

const router = express.Router();

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

// Registro de usuario (público) - Protegido con rate limiting
router.post('/register', registerLimiter, validate(registerSchema), registerUser);

// Login de usuario (público) - Protegido con rate limiting
router.post('/login', authLimiter, validate(loginSchema), loginUser);

// Login de usuario con validación de placa (público) - Para app de escritorio
router.post('/login-placa', authLimiter, loginUserWithPlaca);

// Solicitar recuperación de contraseña (público) - Protegido con rate limiting
router.post('/recuperar-contrasena', passwordResetLimiter, solicitarRecuperacionContrasena);

// Validar token de recuperación (público) - Protegido con rate limiting
router.get('/validar-token/:token', passwordResetLimiter, validarTokenRecuperacion);

// Restablecer contraseña con token (público) - Protegido con rate limiting
router.post('/restablecer-contrasena', passwordResetLimiter, restablecerContrasena);

// Listar roles para formulario de registro (público)
router.get('/roles', listRolesPublic);

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

// Cambiar contraseña obligatorio (cuando requiere_cambio_contrasena es true)
router.post('/cambiar-contrasena', authenticate, cambiarContrasenaObligatorio);

// Perfil del usuario autenticado
router.get('/me', authenticate, me);

// Listar usuarios - Solo Admin e Instructor
router.get('/users', 
  authenticate,
  requirePermission(PERMISSIONS.USERS.VIEW),
  listUsers
);

// Buscar usuario por cédula
// Admin e Instructor: pueden buscar cualquier usuario
// Aprendiz: solo puede buscar su propio perfil (validado en controlador si es necesario)
router.get('/user/cedula/:cedula', 
  authenticate,
  requirePermission(PERMISSIONS.USERS.VIEW),
  getUserByCedula
);

// Obtener detalle de usuario
// Admin: puede ver cualquier usuario
// Instructor: puede ver cualquier usuario
// Aprendiz: solo su propio perfil
router.get('/user/:id', 
  authenticate,
  requireOwnership((req) => req.params.id),
  getUserDetails
);

// Actualizar usuario
// Admin: puede actualizar cualquier usuario
// Usuario: solo puede actualizar su propio perfil
router.put('/user/:id', 
  authenticate,
  requireOwnership((req) => req.params.id),
  validate(updateUserSchema),
  updateUser
);

// Eliminar usuario - Solo Admin
router.delete('/user/:id', 
  authenticate,
  requirePermission(PERMISSIONS.USERS.DELETE),
  deleteUser
);

// Subir foto de perfil - Solo el propio usuario
router.post('/user/:id/foto-perfil',
  authenticate,
  requireOwnership((req) => req.params.id),
  uploadProfileImage.single('foto'),
  handleProfileUploadError,
  uploadProfilePhoto
);

export default router;