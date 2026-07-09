import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';
import crypto from 'crypto';

/**
 * InvitationCodeService - Servicio para lógica de negocio de códigos de invitación
 * 
 * Patrón: Service Layer Pattern
 * Principio: Single Responsibility Principle (SRP)
 */
export class InvitationCodeService {
  constructor(invitationCodeRepository, logger) {
    this.invitationCodeRepository = invitationCodeRepository;
    this.logger = logger;
  }

  /**
   * Genera un código único de invitación
   * @returns {string} Código generado
   */
  generateCode() {
    // Genera un código de 12 caracteres alfanuméricos
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }

  /**
   * Valida un código de invitación
   * @param {string} codigo - Código a validar
   * @param {string} rol - Rol que se intenta registrar
   * @returns {Promise<Object>} Código validado
   */
  async validateCode(codigo, rol) {
    if (!codigo || !codigo.trim()) {
      throw new ValidationError('El código de invitación es requerido para registrarse como Instructor');
    }

    // Actualizar códigos expirados antes de validar
    await this.invitationCodeRepository.updateExpiredCodes();

    const invitationCode = await this.invitationCodeRepository.findByCode(codigo.trim());

    if (!invitationCode) {
      throw new ValidationError('Código de invitación inválido o no encontrado');
    }

    // Validar que el código esté activo
    if (invitationCode.estado !== 'Activo') {
      throw new ValidationError(`El código de invitación está ${invitationCode.estado.toLowerCase()}`);
    }

    // Validar que el rol coincida
    if (invitationCode.rol_destinado !== rol) {
      throw new ValidationError(`Este código es válido solo para el rol: ${invitationCode.rol_destinado}`);
    }

    // Validar expiración
    if (invitationCode.fecha_expiracion && new Date(invitationCode.fecha_expiracion) < new Date()) {
      await this.invitationCodeRepository.updateStatus(codigo, 'Expirado');
      throw new ValidationError('El código de invitación ha expirado');
    }

    // Validar usos máximos
    if (invitationCode.max_usos > 0 && invitationCode.usos_actuales >= invitationCode.max_usos) {
      await this.invitationCodeRepository.updateStatus(codigo, 'Agotado');
      throw new ValidationError('El código de invitación ha alcanzado su límite de usos');
    }

    return invitationCode;
  }

  /**
   * Usa un código de invitación (incrementa contador)
   * @param {string} codigo - Código a usar
   * @returns {Promise<void>}
   */
  async useCode(codigo) {
    await this.invitationCodeRepository.incrementUsage(codigo);
    
    // Verificar si se agotó
    const code = await this.invitationCodeRepository.findByCode(codigo);
    if (code && code.max_usos > 0 && code.usos_actuales >= code.max_usos) {
      await this.invitationCodeRepository.updateStatus(codigo, 'Agotado');
    }

    this.logger.info('Código de invitación usado', { codigo });
  }

  /**
   * Crea un nuevo código de invitación
   * @param {Object} codeData - Datos del código
   * @returns {Promise<Object>} Código creado
   */
  async createCode(codeData) {
    const { rol_destinado, fecha_expiracion, max_usos, creado_por } = codeData;

    if (!rol_destinado) {
      throw new ValidationError('El rol destinado es requerido');
    }

    // Validar fecha de expiración
    if (fecha_expiracion && new Date(fecha_expiracion) < new Date()) {
      throw new ValidationError('La fecha de expiración no puede ser en el pasado');
    }

    // Generar código único
    let codigo = this.generateCode();
    let attempts = 0;
    while (await this.invitationCodeRepository.findByCode(codigo)) {
      codigo = this.generateCode();
      attempts++;
      if (attempts > 10) {
        throw new Error('No se pudo generar un código único después de varios intentos');
      }
    }

    const result = await this.invitationCodeRepository.create({
      codigo,
      rol_destinado,
      fecha_expiracion: fecha_expiracion || null,
      max_usos: max_usos || 1,
      creado_por
    });

    this.logger.info('Código de invitación creado', { codigo, rol_destinado });

    return {
      id_codigo: result.insertId,
      codigo,
      rol_destinado,
      fecha_expiracion,
      max_usos: max_usos || 1,
      estado: 'Activo'
    };
  }

  /**
   * Obtiene todos los códigos de invitación
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Array>} Lista de códigos
   */
  async getAllCodes(filters = {}) {
    // Actualizar códigos expirados antes de listar
    await this.invitationCodeRepository.updateExpiredCodes();
    
    return this.invitationCodeRepository.findAll(filters);
  }

  /**
   * Obtiene un código por ID
   * @param {number} id - ID del código
   * @returns {Promise<Object>} Código encontrado
   */
  async getCodeById(id) {
    const code = await this.invitationCodeRepository.findById(id);
    if (!code) {
      throw new NotFoundError('Código de invitación no encontrado');
    }
    return code;
  }

  /**
   * Elimina un código de invitación
   * @param {number} id - ID del código
   * @returns {Promise<void>}
   */
  async deleteCode(id) {
    const code = await this.invitationCodeRepository.findById(id);
    if (!code) {
      throw new NotFoundError('Código de invitación no encontrado');
    }

    await this.invitationCodeRepository.delete(id);
    this.logger.info('Código de invitación eliminado', { id });
  }

  /**
   * Desactiva un código de invitación
   * @param {number} id - ID del código
   * @returns {Promise<void>}
   */
  async deactivateCode(id) {
    const code = await this.invitationCodeRepository.findById(id);
    if (!code) {
      throw new NotFoundError('Código de invitación no encontrado');
    }

    await this.invitationCodeRepository.updateStatus(code.codigo, 'Inactivo');
    this.logger.info('Código de invitación desactivado', { id, codigo: code.codigo });
  }
}

