import { registerUser, loginUser, deleteUser, updateUser, me } from '../controller/authController.js';
import { listUsers, getUserDetails } from '../controller/authController.js';
import express from 'express';
import rateLimit from 'express-rate-limit';

const router = express.Router(); 

// Limitar intentos de login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máx. 10 intentos
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.' }
});

// Eliminar usuario
router.delete('/user/:id', deleteUser);

// Obtener detalle de usuario (incluye equipos asignados activos)
router.get('/user/:id', getUserDetails);

// Listar usuarios
router.get('/users', listUsers);

// Actualizar usuario
router.put('/user/:id', updateUser);

// Registro de usuario
router.post('/register', registerUser);

// Login de usuario
router.post('/login', loginLimiter, loginUser);

// Perfil del usuario autenticado
router.get('/me', me);

export default router;