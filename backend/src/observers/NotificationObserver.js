/**
 * NotificationObserver - Observer para el sistema de notificaciones
 * 
 * Patrón: Observer Pattern
 * Principio: Open/Closed Principle (OCP)
 * 
 * Permite que múltiples observadores se suscriban a eventos del sistema
 * y sean notificados cuando ocurren cambios relevantes.
 */

/**
 * Interfaz base para observadores
 */
export class Observer {
  /**
   * Método que se llama cuando ocurre un evento
   * @param {string} event - Tipo de evento
   * @param {Object} data - Datos del evento
   */
  update(event, data) {
    throw new Error('Método update debe ser implementado por las subclases');
  }
}

/**
 * Subject - Clase base para sujetos observables
 */
export class Subject {
  constructor() {
    this.observers = [];
  }

  /**
   * Suscribe un observador
   * @param {Observer} observer - Observador a suscribir
   */
  subscribe(observer) {
    if (!(observer instanceof Observer)) {
      throw new Error('El observador debe ser una instancia de Observer');
    }
    this.observers.push(observer);
  }

  /**
   * Desuscribe un observador
   * @param {Observer} observer - Observador a desuscribir
   */
  unsubscribe(observer) {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  /**
   * Notifica a todos los observadores
   * @param {string} event - Tipo de evento
   * @param {Object} data - Datos del evento
   */
  notify(event, data) {
    this.observers.forEach((observer) => {
      try {
        observer.update(event, data);
      } catch (error) {
        // Importar logger dinámicamente para evitar dependencia circular
        try {
          const { logger } = await import('../utils/logger.js');
          logger.error('Error al notificar observador', { 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          });
        } catch {
          // Fallback silencioso si no se puede importar logger
          // En producción, los errores se manejarán en el nivel superior
        }
      }
    });
  }
}

/**
 * NotificationObserver - Observador específico para notificaciones
 */
export class NotificationObserver extends Observer {
  constructor(notificationService) {
    super();
    this.notificationService = notificationService;
  }

  /**
   * Maneja eventos de notificación
   * @param {string} event - Tipo de evento
   * @param {Object} data - Datos del evento
   */
  async update(event, data) {
    switch (event) {
      case 'user.registered':
        await this.handleUserRegistered(data);
        break;
      case 'equipo.created':
        await this.handleEquipoCreated(data);
        break;
      case 'mantenimiento.due':
        await this.handleMantenimientoDue(data);
        break;
      default:
        // Evento no manejado
        break;
    }
  }

  /**
   * Maneja el evento de usuario registrado
   * @param {Object} data - Datos del usuario
   */
  async handleUserRegistered(data) {
    // Notificar a administradores sobre nuevo usuario
    await this.notificationService.createForRole({
      rolNombre: 'Administrador',
      titulo: {
        key: 'nuevo_usuario_registrado',
        params: {}
      },
      cuerpo: {
        key: 'nuevo_usuario_registrado_cuerpo',
        params: {
          nombre: data.nombre
        }
      },
      tipo: 'info',
      metadata: { userId: data.id },
    });
  }

  /**
   * Maneja el evento de equipo creado
   * @param {Object} data - Datos del equipo
   */
  async handleEquipoCreated(data) {
    await this.notificationService.notifyNuevoEquipo({
      equipoId: data.codigo_equipo,
      tipoEquipo: data.tipo,
      modelo: data.modelo,
      ambiente: data.ambiente,
      creadoPor: data.creadoPor,
    });
  }

  /**
   * Maneja el evento de mantenimiento próximo
   * @param {Object} data - Datos del mantenimiento
   */
  async handleMantenimientoDue(data) {
    await this.notificationService.createForUsers({
      userIds: [data.userId],
      titulo: {
        key: 'mantenimiento_proximo',
        params: {}
      },
      cuerpo: {
        key: 'mantenimiento_proximo_cuerpo',
        params: {
          equipo: data.equipo
        }
      },
      tipo: 'aviso',
      metadata: { equipoId: data.equipoId },
    });
  }
}

