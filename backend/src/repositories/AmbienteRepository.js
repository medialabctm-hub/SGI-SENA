import { BaseRepository } from './BaseRepository.js';

/**
 * AmbienteRepository - Repositorio para operaciones de ambientes
 * 
 * Patrón: Repository Pattern
 * Principio: Single Responsibility Principle (SRP)
 */
export class AmbienteRepository extends BaseRepository {
  /**
   * Busca un ambiente por ID
   * @param {number} idAmbiente - ID del ambiente
   * @returns {Promise<Object|null>} Ambiente encontrado o null
   */
  async findById(idAmbiente) {
    return this.findOne(
      'SELECT * FROM Ambientes WHERE id_ambiente = ?',
      [idAmbiente]
    );
  }

  /**
   * Busca un ambiente por código
   * @param {string} codigoAmbiente - Código del ambiente
   * @returns {Promise<Object|null>} Ambiente encontrado o null
   */
  async findByCodigo(codigoAmbiente) {
    return this.findOne(
      'SELECT * FROM Ambientes WHERE codigo_ambiente = ?',
      [codigoAmbiente]
    );
  }

  /**
   * Busca un ambiente por nombre
   * @param {string} nombreAmbiente - Nombre del ambiente
   * @returns {Promise<Object|null>} Ambiente encontrado o null
   */
  async findByNombre(nombreAmbiente) {
    return this.findOne(
      'SELECT * FROM Ambientes WHERE nombre_ambiente = ? LIMIT 1',
      [nombreAmbiente]
    );
  }

  /**
   * Lista todos los ambientes activos
   * @returns {Promise<Array>} Lista de ambientes
   */
  async findAll() {
    return this.execute(
      'SELECT * FROM Ambientes WHERE estado_ambiente = "Activo" ORDER BY codigo_ambiente'
    );
  }

  /**
   * Crea un nuevo ambiente
   * @param {Object} ambienteData - Datos del ambiente
   * @returns {Promise<Object>} Resultado de la inserción
   */
  async create(ambienteData) {
    const {
      codigoAmbiente,
      nombreAmbiente,
      tipoAmbiente,
      capacidadPersonas,
      piso,
      edificio,
      descripcion,
      estadoAmbiente = 'Activo'
    } = ambienteData;

    const [result] = await this.db.execute(
      `INSERT INTO Ambientes 
       (codigo_ambiente, nombre_ambiente, tipo_ambiente, capacidad_personas, piso, edificio, descripcion, estado_ambiente) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigoAmbiente, nombreAmbiente, tipoAmbiente, capacidadPersonas, piso, edificio, descripcion, estadoAmbiente]
    );

    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }

  /**
   * Actualiza un ambiente
   * @param {number} idAmbiente - ID del ambiente
   * @param {Object} ambienteData - Datos a actualizar
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async update(idAmbiente, ambienteData) {
    const updates = [];
    const values = [];

    const allowedFields = [
      'codigo_ambiente', 'nombre_ambiente', 'tipo_ambiente', 'capacidad_personas',
      'piso', 'edificio', 'descripcion', 'estado_ambiente'
    ];

    Object.keys(ambienteData).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(ambienteData[key]);
      }
    });

    if (updates.length === 0) {
      return { affectedRows: 0 };
    }

    values.push(idAmbiente);

    const [result] = await this.db.execute(
      `UPDATE Ambientes SET ${updates.join(', ')} WHERE id_ambiente = ?`,
      values
    );

    return { affectedRows: result.affectedRows };
  }

  /**
   * Elimina un ambiente
   * @param {number} idAmbiente - ID del ambiente
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async delete(idAmbiente) {
    const [result] = await this.db.execute(
      'DELETE FROM Ambientes WHERE id_ambiente = ?',
      [idAmbiente]
    );

    return { affectedRows: result.affectedRows };
  }
}

