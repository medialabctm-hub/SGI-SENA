import express from 'express';
import { registrarEquipo, obtenerEquipoPorCodigo } from '../controller/equiposController.js';

const router = express.Router();

// Registrar nuevo equipo
router.post('/', registrarEquipo);

// Consultar equipo por código
router.get('/:codigo', obtenerEquipoPorCodigo);

export default router;
