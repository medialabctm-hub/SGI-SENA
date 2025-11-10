import express from 'express';
import { registrarEquipo } from '../controller/equiposController.js';

const router = express.Router();

// Registrar nuevo equipo
router.post('/', registrarEquipo);

export default router;
