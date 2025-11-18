/**
 * ServiceFactory - Factory para crear servicios
 * 
 * Patrón: Factory Pattern
 * Principio: Open/Closed Principle (OCP)
 * 
 * Centraliza la creación de servicios, permitiendo agregar nuevos
 * servicios sin modificar el código existente.
 */
import { container } from '../di/Container.js';

export class ServiceFactory {
  /**
   * Crea una instancia de un servicio
   * @param {string} serviceName - Nombre del servicio
   * @returns {Object} Instancia del servicio
   */
  static create(serviceName) {
    try {
      return container.resolve(serviceName);
    } catch (error) {
      throw new Error(`Error al crear servicio '${serviceName}': ${error.message}`);
    }
  }

  /**
   * Crea múltiples servicios a la vez
   * @param {Array<string>} serviceNames - Nombres de los servicios
   * @returns {Object} Objeto con las instancias de los servicios
   */
  static createMany(serviceNames) {
    const services = {};
    serviceNames.forEach((name) => {
      services[name] = this.create(name);
    });
    return services;
  }
}

