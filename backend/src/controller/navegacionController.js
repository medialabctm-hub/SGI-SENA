import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import { ServiceFactory } from '../factories/ServiceFactory.js';
import { handleControllerError } from '../utils/controllerHelpers.js';
import { obtenerEstadoNavegacion } from '../services/estadoNavegacionService.js';

/**
 * Estado resumido para el sidebar de consulta (contadores por entrada).
 * Cada bloque usa el alcance del usuario autenticado; ver estadoNavegacionService.
 */
export async function obtenerEstado(req, res) {
  try {
    const equipoService = ServiceFactory.create('equipoService');
    const estado = await obtenerEstadoNavegacion(
      { db: defaultDb, equipoService, logger },
      { id: req.user?.id, rol: req.user?.rol }
    );
    // Contadores personales: no deben quedar en cachés compartidas.
    res.set('Cache-Control', 'private, no-store');
    return res.json(estado);
  } catch (err) {
    return handleControllerError(err, res, 'obtenerEstadoNavegacion', 'No se pudo cargar el estado del menú');
  }
}
