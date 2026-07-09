import { PreferencesService } from '../services/preferencesService.js';
import { logger } from '../utils/logger.js';

/**
 * Controlador de preferencias de usuario - Solo orquestación, sin lógica de negocio
 * 
 * Patrón: Controller Pattern
 * Principio: Single Responsibility Principle (SRP)
 */
export const getPreferences = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const preferencesService = new PreferencesService();
    const preferences = await preferencesService.getPreferences(req.user.id);
    
    return res.json(preferences);
  } catch (error) {
    logger.error('Error en getPreferences', { error: error.message });
    return next(error);
  }
};

/**
 * Actualizar preferencias de usuario
 */
export const updatePreferences = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const preferencesService = new PreferencesService();
    const preferences = await preferencesService.updatePreferences(req.user.id, req.body);
    
    return res.json({
      message: 'Preferencias actualizadas correctamente',
      preferences
    });
  } catch (error) {
    logger.error('Error en updatePreferences', { error: error.message });
    return next(error);
  }
};

