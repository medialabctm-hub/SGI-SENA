/**
 * UserBuilder - Builder para construir objetos de usuario
 * 
 * Patrón: Builder Pattern
 * Principio: Single Responsibility Principle (SRP)
 * 
 * Permite construir objetos de usuario de forma fluida y validada,
 * separando la construcción de la representación.
 */
export class UserBuilder {
  constructor() {
    this.user = {};
  }

  /**
   * Establece el nombre del usuario
   * @param {string} nombre - Nombre del usuario
   * @returns {UserBuilder} Instancia del builder para method chaining
   */
  withNombre(nombre) {
    if (!nombre || nombre.trim().length < 2) {
      throw new Error('El nombre debe tener al menos 2 caracteres');
    }
    this.user.nombre = nombre.trim();
    return this;
  }

  /**
   * Establece la cédula del usuario
   * @param {string} cedula - Cédula del usuario
   * @returns {UserBuilder} Instancia del builder para method chaining
   */
  withCedula(cedula) {
    if (!cedula || cedula.trim().length < 5) {
      throw new Error('La cédula debe tener al menos 5 caracteres');
    }
    this.user.cedula = cedula.trim();
    return this;
  }

  /**
   * Establece el correo del usuario
   * @param {string} correo - Correo del usuario
   * @returns {UserBuilder} Instancia del builder para method chaining
   */
  withCorreo(correo) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo || !emailRegex.test(correo)) {
      throw new Error('Correo electrónico inválido');
    }
    this.user.correo = correo.toLowerCase().trim();
    return this;
  }

  /**
   * Establece el teléfono del usuario
   * @param {string} telefono - Teléfono del usuario
   * @returns {UserBuilder} Instancia del builder para method chaining
   */
  withTelefono(telefono) {
    if (!telefono || telefono.trim().length < 7) {
      throw new Error('El teléfono debe tener al menos 7 caracteres');
    }
    this.user.telefono = telefono.trim();
    return this;
  }

  /**
   * Establece la contraseña del usuario
   * @param {string} contrasena - Contraseña del usuario
   * @returns {UserBuilder} Instancia del builder para method chaining
   */
  withContrasena(contrasena) {
    if (!contrasena || contrasena.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    this.user.contrasena = contrasena;
    return this;
  }

  /**
   * Establece el ID del rol
   * @param {number} idRol - ID del rol
   * @returns {UserBuilder} Instancia del builder para method chaining
   */
  withIdRol(idRol) {
    if (!idRol || idRol <= 0) {
      throw new Error('ID de rol inválido');
    }
    this.user.idRol = idRol;
    return this;
  }

  /**
   * Construye el objeto de usuario final
   * @returns {Object} Objeto de usuario validado
   */
  build() {
    // Validar campos requeridos
    const required = ['nombre', 'cedula', 'correo', 'telefono', 'contrasena', 'idRol'];
    const missing = required.filter((field) => !this.user[field]);

    if (missing.length > 0) {
      throw new Error(`Faltan campos requeridos: ${missing.join(', ')}`);
    }

    return { ...this.user };
  }

  /**
   * Resetea el builder para construir un nuevo usuario
   * @returns {UserBuilder} Instancia del builder
   */
  reset() {
    this.user = {};
    return this;
  }
}

