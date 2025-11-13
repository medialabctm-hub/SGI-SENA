import { registerUser, loginUser, deleteUser, updateUser, me } from '../controller/authController.js';
import { listUsers, getUserDetails, getUserByCedula } from '../controller/authController.js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission, requireRole, requireOwnership } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = express.Router(); 

// Limitar intentos de login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máx. 10 intentos
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.' }
});

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

// Registro de usuario (público)
router.post('/register', registerUser);

// Login de usuario (público)
router.post('/login', loginLimiter, loginUser);

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

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
  updateUser
);

// Eliminar usuario - Solo Admin
router.delete('/user/:id', 
  authenticate,
  requirePermission(PERMISSIONS.USERS.DELETE),
  deleteUser
);

export default router;