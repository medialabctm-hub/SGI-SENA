import { BaseRepository } from './BaseRepository.js';

/**
 * EquipoRepository - Repositorio para operaciones de equipos
 * 
 * Patrón: Repository Pattern
 * Principio: Single Responsibility Principle (SRP)
 * 
 * Encapsula toda la lógica de acceso a datos relacionada con equipos.
 */
export class EquipoRepository extends BaseRepository {
  /**
   * Busca un equipo por código
   * @param {number|string} codigoEquipo - Código del equipo
   * @returns {Promise<Object|null>} Equipo encontrado o null
   */
  async findByCodigo(codigoEquipo) {
    return this.findOne(
      `SELECT e.*, a.nombre_ambiente, a.codigo_ambiente, c.nombre_categoria
       FROM Elementos e
       LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
       LEFT JOIN Categorias_Equipo c ON c.id_categoria = e.id_categoria
       WHERE e.codigo_equipo = ?`,
      [codigoEquipo]
    );
  }

  /**
   * Busca un equipo por placa
   * @param {string} placa - Placa del equipo
   * @returns {Promise<Object|null>} Equipo encontrado o null
   */
  async findByPlaca(placa) {
    return this.findOne(
      'SELECT codigo_equipo FROM Elementos WHERE placa = ? LIMIT 1',
      [placa]
    );
  }

  /**
   * Lista equipos con filtros opcionales
   * @param {Object} filters - Filtros de búsqueda
   * @returns {Promise<Array>} Lista de equipos
   */
  async findAll(filters = {}) {
    let query = `
      SELECT e.codigo_equipo, e.placa AS codigo_inventario, e.tipo, e.modelo, e.consecutivo, e.descripcion,
             e.fecha_adquisicion, e.valor_ingreso AS costo, e.estado_fisico,
             e.specs_completas, e.id_cuentadante, e.cuentadante_principal,
             a.id_ambiente, a.nombre_ambiente, a.codigo_ambiente,
             COALESCE(ee.estado_operativo, 'Disponible') AS estado_operativo,
             ee.detalles AS detalles_estado,
             ee.fecha_actualizacion AS fecha_actualizacion_estado
      FROM Elementos e
      LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
      LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
    `;

    const params = [];
    const conditions = [];

    if (filters.cuentadanteId) {
      conditions.push('e.id_cuentadante = ?');
      params.push(filters.cuentadanteId);
    }

    if (filters.ambientesIds && filters.ambientesIds.length > 0) {
      conditions.push(`e.id_ambiente IN (${filters.ambientesIds.map(() => '?').join(',')})`);
      params.push(...filters.ambientesIds);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY e.codigo_equipo ASC';

    return this.execute(query, params);
  }

  /**
   * Crea un nuevo equipo
   * @param {Object} equipoData - Datos del equipo
   * @returns {Promise<Object>} Resultado de la inserción
   */
  async create(equipoData) {
    const {
      idCategoria,
      idTipo,
      idAmbiente,
      idCuentadante,
      tipo,
      modelo,
      descripcion,
      fechaAdquisicion,
      valorIngreso,
      estadoFisico,
      specsCompletas,
      atributos,
      rCentro,
      consecutivo,
      placa,
      registradoPor
    } = equipoData;

    const columns = [
      'id_categoria', 'id_ambiente', 'id_cuentadante', 'tipo', 'modelo',
      'descripcion', 'fecha_adquisicion', 'valor_ingreso', 'estado_fisico',
      'specs_completas', 'atributos', 'r_centro', 'consecutivo', 'placa', 'registrado_por'
    ];
    const values = [
      idCategoria, idAmbiente, idCuentadante, tipo, modelo,
      descripcion, fechaAdquisicion, valorIngreso, estadoFisico,
      specsCompletas, atributos, rCentro, consecutivo, placa, registradoPor
    ];

    if (idTipo) {
      columns.splice(2, 0, 'id_tipo');
      values.splice(2, 0, idTipo);
    }

    const placeholders = values.map(() => '?').join(', ');

    const [result] = await this.db.execute(
      `INSERT INTO Elementos (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }

  /**
   * Actualiza un equipo
   * @param {number} codigoEquipo - Código del equipo
   * @param {Object} equipoData - Datos a actualizar
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async update(codigoEquipo, equipoData) {
    const updates = [];
    const values = [];

    const allowedFields = [
      'tipo', 'modelo', 'consecutivo', 'descripcion', 'fecha_adquisicion',
      'costo', 'valor_ingreso', 'estado_fisico', 'specs_completas', 'atributos',
      'id_ambiente', 'placa', 'r_centro'
    ];

    Object.keys(equipoData).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(equipoData[key]);
      }
    });

    if (updates.length === 0) {
      return { affectedRows: 0 };
    }

    values.push(codigoEquipo);

    const [result] = await this.db.execute(
      `UPDATE Elementos SET ${updates.join(', ')} WHERE codigo_equipo = ?`,
      values
    );

    return { affectedRows: result.affectedRows };
  }

  /**
   * Elimina un equipo
   * @param {number} codigoEquipo - Código del equipo
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async delete(codigoEquipo) {
    const [result] = await this.db.execute(
      'DELETE FROM Elementos WHERE codigo_equipo = ?',
      [codigoEquipo]
    );

    return { affectedRows: result.affectedRows };
  }

  /**
   * Busca una categoría por nombre
   * @param {string} nombreCategoria - Nombre de la categoría
   * @returns {Promise<Object|null>} Categoría encontrada o null
   */
  async findCategoriaByNombre(nombreCategoria) {
    return this.findOne(
      'SELECT id_categoria, es_componente FROM Categorias_Equipo WHERE nombre_categoria = ? LIMIT 1',
      [nombreCategoria]
    );
  }

  /**
   * Crea una categoría si no existe
   * @param {string} nombreCategoria - Nombre de la categoría
   * @returns {Promise<Object>} Categoría creada o existente
   */
  async createCategoriaIfNotExists(nombreCategoria) {
    let categoria = await this.findCategoriaByNombre(nombreCategoria);

    if (!categoria) {
      try {
        const [result] = await this.db.execute(
          'INSERT INTO Categorias_Equipo (nombre_categoria, descripcion, es_componente) VALUES (?, ?, ?)',
          [nombreCategoria, `Categoría: ${nombreCategoria}`, false]
        );
        categoria = {
          id_categoria: result.insertId,
          es_componente: false
        };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          categoria = await this.findCategoriaByNombre(nombreCategoria);
        } else {
          throw err;
        }
      }
    }

    return categoria;
  }

  /**
   * Verifica si existe una columna en la tabla Elementos
   * @param {string} columnName - Nombre de la columna
   * @returns {Promise<boolean>} True si existe
   */
  async columnExists(columnName) {
    const [[result]] = await this.db.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Elementos' 
       AND COLUMN_NAME = ?`,
      [columnName]
    );
    return result.cnt > 0;
  }
}

