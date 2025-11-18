/**
 * Dependency Injection Container
 * 
 * Patrón: Dependency Injection / Service Locator
 * Principio: Dependency Inversion Principle (DIP)
 * 
 * Centraliza la creación y gestión de dependencias,
 * permitiendo inyección de dependencias y facilitando testing.
 */
export class Container {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  /**
   * Registra un servicio en el contenedor
   * @param {string} name - Nombre del servicio
   * @param {Function|Object} factory - Factory function o instancia
   * @param {boolean} singleton - Si es singleton (default: true)
   */
  register(name, factory, singleton = true) {
    this.services.set(name, { factory, singleton });
  }

  /**
   * Resuelve una dependencia
   * @param {string} name - Nombre del servicio
   * @returns {any} Instancia del servicio
   */
  resolve(name) {
    const service = this.services.get(name);

    if (!service) {
      throw new Error(`Servicio '${name}' no registrado en el contenedor`);
    }

    // Si es singleton y ya existe, retornar la instancia existente
    if (service.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Crear nueva instancia
    const instance = typeof service.factory === 'function'
      ? service.factory(this)
      : service.factory;

    // Si es singleton, guardar la instancia
    if (service.singleton) {
      this.singletons.set(name, instance);
    }

    return instance;
  }

  /**
   * Verifica si un servicio está registrado
   * @param {string} name - Nombre del servicio
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Limpia todas las instancias singleton (útil para testing)
   */
  clear() {
    this.singletons.clear();
  }
}

// Instancia singleton del contenedor
export const container = new Container();

