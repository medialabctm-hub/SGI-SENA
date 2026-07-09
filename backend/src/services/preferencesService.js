import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio para gestionar preferencias de usuario
 * 
 * Patrón: Service Pattern
 * Principio: Single Responsibility Principle (SRP)
 */
export class PreferencesService {
  constructor(db = defaultDb) {
    this.db = db;
  }

  /**
   * Obtiene las preferencias de un usuario
   * Si no existen, crea unas por defecto
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Preferencias del usuario
   */
  async getPreferences(userId) {
    try {
      const [rows] = await this.db.execute(
        `SELECT 
          id_preferencia,
          id_usuario,
          notificaciones_email,
          notificaciones_sms,
          notificaciones_app,
          idioma,
          zona_horaria,
          fecha_creacion,
          fecha_actualizacion
        FROM Preferencias_Usuario
        WHERE id_usuario = ?`,
        [userId]
      );

      if (rows.length === 0) {
        // Crear preferencias por defecto
        return await this.createDefaultPreferences(userId);
      }

      const prefs = rows[0];
      return {
        id_preferencia: prefs.id_preferencia,
        id_usuario: prefs.id_usuario,
        notificaciones: {
          email: Boolean(prefs.notificaciones_email),
          sms: Boolean(prefs.notificaciones_sms),
          app: Boolean(prefs.notificaciones_app)
        },
        app: {
          idioma: prefs.idioma || 'es',
          zona_horaria: prefs.zona_horaria || 'America/Bogota'
        },
        fecha_creacion: prefs.fecha_creacion,
        fecha_actualizacion: prefs.fecha_actualizacion
      };
    } catch (error) {
      logger.error('Error al obtener preferencias', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Crea preferencias por defecto para un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Preferencias creadas
   */
  async createDefaultPreferences(userId) {
    try {
      const [result] = await this.db.execute(
        `INSERT INTO Preferencias_Usuario 
        (id_usuario, notificaciones_email, notificaciones_sms, notificaciones_app, idioma, zona_horaria)
        VALUES (?, 1, 0, 1, 'es', ?)`,
        [userId, Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota']
      );

      logger.info('Preferencias por defecto creadas', { userId, id_preferencia: result.insertId });

      return await this.getPreferences(userId);
    } catch (error) {
      logger.error('Error al crear preferencias por defecto', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualiza las preferencias de un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} preferences - Objeto con las preferencias a actualizar
   * @returns {Promise<Object>} Preferencias actualizadas
   */
  async updatePreferences(userId, preferences) {
    try {
      // Verificar si existen preferencias
      const existing = await this.getPreferences(userId);

      const updates = [];
      const values = [];

      // Actualizar preferencias de notificaciones
      if (preferences.notificaciones !== undefined) {
        if (preferences.notificaciones.email !== undefined) {
          updates.push('notificaciones_email = ?');
          values.push(preferences.notificaciones.email ? 1 : 0);
        }
        if (preferences.notificaciones.sms !== undefined) {
          updates.push('notificaciones_sms = ?');
          values.push(preferences.notificaciones.sms ? 1 : 0);
        }
        if (preferences.notificaciones.app !== undefined || preferences.notificaciones.inApp !== undefined) {
          updates.push('notificaciones_app = ?');
          values.push((preferences.notificaciones.app ?? preferences.notificaciones.inApp) ? 1 : 0);
        }
      }

      // Actualizar preferencias de aplicación
      if (preferences.app !== undefined) {
        if (preferences.app.idioma !== undefined) {
          updates.push('idioma = ?');
          values.push(preferences.app.idioma);
        }
        if (preferences.app.zona_horaria !== undefined) {
          updates.push('zona_horaria = ?');
          values.push(preferences.app.zona_horaria);
        }
      }

      // También aceptar formato plano para compatibilidad
      if (preferences.email !== undefined) {
        updates.push('notificaciones_email = ?');
        values.push(preferences.email ? 1 : 0);
      }
      if (preferences.sms !== undefined) {
        updates.push('notificaciones_sms = ?');
        values.push(preferences.sms ? 1 : 0);
      }
      if (preferences.inApp !== undefined) {
        updates.push('notificaciones_app = ?');
        values.push(preferences.inApp ? 1 : 0);
      }
      if (preferences.idioma !== undefined) {
        updates.push('idioma = ?');
        values.push(preferences.idioma);
      }
      if (preferences.zona_horaria !== undefined || preferences.tz !== undefined) {
        updates.push('zona_horaria = ?');
        values.push(preferences.zona_horaria || preferences.tz);
      }

      if (updates.length === 0) {
        return existing;
      }

      values.push(userId);

      await this.db.execute(
        `UPDATE Preferencias_Usuario 
        SET ${updates.join(', ')}, fecha_actualizacion = NOW()
        WHERE id_usuario = ?`,
        values
      );

      logger.info('Preferencias actualizadas', { userId, updates: updates.length });

      return await this.getPreferences(userId);
    } catch (error) {
      logger.error('Error al actualizar preferencias', { userId, error: error.message });
      throw error;
    }
  }
}

