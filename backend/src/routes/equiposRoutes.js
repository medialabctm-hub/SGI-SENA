import express from 'express';
import { registrarEquipo, obtenerEquipoPorCodigo, listarEquipos, actualizarEquipo, eliminarEquipo } from '../controller/equiposController.js';

const router = express.Router();

// Registrar nuevo equipo
router.post('/', registrarEquipo);

// Listar todos los equipos
router.get('/', listarEquipos);

// Consultar equipo por código
router.get('/:codigo', obtenerEquipoPorCodigo);

// Actualizar equipo por código
router.put('/:codigo', actualizarEquipo);

// Eliminar equipo por código
router.delete('/:codigo', eliminarEquipo);

export default router;
