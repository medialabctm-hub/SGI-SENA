import express from 'express';
import { listarAmbientes } from '../controller/equiposController.js';

const router = express.Router();

// Listar ambientes
router.get('/ambientes', listarAmbientes);

export default router;
