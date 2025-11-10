import { registerUser, loginUser, deleteUser, updateUser } from '../controller/authController.js';
import express from 'express';

const router = express.Router(); 

// Eliminar usuario
router.delete('/user/:id', deleteUser);

// Actualizar usuario
router.put('/user/:id', updateUser);

// Registro de usuario
router.post('/register', registerUser);

// Login de usuario
router.post('/login', loginUser);

export default router;