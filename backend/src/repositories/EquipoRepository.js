import { BaseRepository } from './BaseRepository.js';
import { logger } from '../utils/logger.js';

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
   * Lista equipos con filtros avanzados opcionales
   * @param {Object} filters - Filtros de búsqueda avanzados
   * @param {Object} pagination - Paginación (page, limit)
   * @param {Object} sorting - Ordenamiento (field, order)
   * @returns {Promise<Object>} Objeto con equipos, total y paginación
   */
  async findAll(filters = {}, pagination = {}, sorting = {}) {
    const page = Math.max(1, parseInt(pagination.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(pagination.limit) || 50));
    const offset = (page - 1) * limit;
    
    const sortField = sorting.field || 'codigo_equipo';
    const sortOrder = sorting.order === 'desc' ? 'DESC' : 'ASC';
    
    // Campos permitidos para ordenamiento
    const allowedSortFields = [
      'codigo_equipo', 'placa', 'tipo', 'modelo', 'consecutivo',
      'fecha_adquisicion', 'valor_ingreso', 'estado_fisico',
      'nombre_ambiente', 'codigo_ambiente'
    ];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'codigo_equipo';

    let query = `
      SELECT e.codigo_equipo, e.placa AS codigo_inventario, e.tipo, e.modelo, e.consecutivo, e.descripcion,
             e.fecha_adquisicion, e.valor_ingreso AS costo, e.estado_fisico,
             e.specs_completas, e.id_cuentadante, e.cuentadante_principal,
             a.id_ambiente, a.nombre_ambiente, a.codigo_ambiente,
             COALESCE(ee.estado_operativo, 'Disponible') AS estado_operativo,
             ee.detalles AS detalles_estado,
             ee.fecha_actualizacion AS fecha_actualizacion_estado,
             c.nombre_categoria
      FROM Elementos e
      LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
      LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
      LEFT JOIN Categorias_Equipo c ON c.id_categoria = e.id_categoria
    `;

    const params = [];
    const conditions = [];

    // Filtro OR: equipos de ambientes asignados O donde el usuario es cuentadante (para vista "todos" del cuentadante)
    const orFilter = filters.cuentadanteOrAmbientes;
    if (orFilter && orFilter.cuentadanteId != null) {
      const { ambientesIds = [], cuentadanteId } = orFilter;
      if (ambientesIds.length > 0) {
        conditions.push(`(e.id_ambiente IN (${ambientesIds.map(() => '?').join(',')}) OR e.id_cuentadante = ?)`);
        params.push(...ambientesIds, cuentadanteId);
      } else {
        conditions.push('e.id_cuentadante = ?');
        params.push(cuentadanteId);
      }
    } else {
      // Filtro por cuentadante
      if (filters.cuentadanteId) {
        conditions.push('e.id_cuentadante = ?');
        params.push(filters.cuentadanteId);
      }

      // Filtro por ambientes
      if (filters.ambientesIds && filters.ambientesIds.length > 0) {
        conditions.push(`e.id_ambiente IN (${filters.ambientesIds.map(() => '?').join(',')})`);
        params.push(...filters.ambientesIds);
      }
    }

    // Filtro por búsqueda de texto (placa, modelo, consecutivo, descripción)
    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      conditions.push(`(
        e.placa LIKE ? OR 
        e.modelo LIKE ? OR 
        e.consecutivo LIKE ? OR 
        e.descripcion LIKE ? OR
        e.tipo LIKE ?
      )`);
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Filtro por estado físico
    if (filters.estado_fisico && Array.isArray(filters.estado_fisico) && filters.estado_fisico.length > 0) {
      conditions.push(`e.estado_fisico IN (${filters.estado_fisico.map(() => '?').join(',')})`);
      params.push(...filters.estado_fisico);
    }

    // Filtro por estado operativo
    if (filters.estado_operativo && Array.isArray(filters.estado_operativo) && filters.estado_operativo.length > 0) {
      conditions.push(`COALESCE(ee.estado_operativo, 'Disponible') IN (${filters.estado_operativo.map(() => '?').join(',')})`);
      params.push(...filters.estado_operativo);
    }

    // Filtro por categoría
    if (filters.categoria) {
      conditions.push('c.nombre_categoria = ?');
      params.push(filters.categoria);
    }

    // Filtro por rango de fechas de adquisición
    if (filters.fecha_desde) {
      conditions.push('e.fecha_adquisicion >= ?');
      params.push(filters.fecha_desde);
    }
    if (filters.fecha_hasta) {
      conditions.push('e.fecha_adquisicion <= ?');
      params.push(filters.fecha_hasta);
    }

    // Filtro por rango de valor
    if (filters.valor_min !== undefined && filters.valor_min !== null) {
      const valorMin = parseFloat(filters.valor_min);
      if (!isNaN(valorMin)) {
        conditions.push('COALESCE(e.valor_ingreso, 0) >= ?');
        params.push(valorMin);
      }
    }
    if (filters.valor_max !== undefined && filters.valor_max !== null) {
      const valorMax = parseFloat(filters.valor_max);
      if (!isNaN(valorMax)) {
        conditions.push('COALESCE(e.valor_ingreso, 0) <= ?');
        params.push(valorMax);
      }
    }

    // Filtro por tipo
    if (filters.tipo) {
      conditions.push('e.tipo = ?');
      params.push(filters.tipo);
    }

    // Construir WHERE clause
    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    if (conditions.length > 0) {
      query += whereClause;
    }

    // Contar total de registros ANTES de agregar ORDER BY, LIMIT y OFFSET
    // Construir la query de conteo usando la misma estructura
    const countQuery = `
      SELECT COUNT(DISTINCT e.codigo_equipo) AS total
      FROM Elementos e
      LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
      LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
      LEFT JOIN Categorias_Equipo c ON c.id_categoria = e.id_categoria
      ${whereClause}
    `;
    
    // Usar los mismos parámetros pero sin limit y offset (que se agregan después)
    // Si no hay condiciones, el array de params estará vacío, lo cual es correcto
    const countParams = conditions.length > 0 ? [...params] : [];
    
    // Validar que no haya valores undefined o null problemáticos
    const sanitizedCountParams = countParams.map(param => {
      if (param === undefined) {
        logger.warn('Parámetro undefined encontrado en countQuery, convirtiendo a null');
        return null;
      }
      // Asegurar que los números sean números válidos
      if (typeof param === 'number' && (isNaN(param) || !isFinite(param))) {
        logger.warn('Parámetro numérico inválido encontrado en countQuery, convirtiendo a null');
        return null;
      }
      return param;
    });
    
    // Contar placeholders en la query
    const countPlaceholderCount = (countQuery.match(/\?/g) || []).length;
    if (countPlaceholderCount !== sanitizedCountParams.length) {
      logger.error('Desajuste de parámetros en countQuery', {
        query: countQuery,
        placeholderCount: countPlaceholderCount,
        paramsCount: sanitizedCountParams.length,
        params: sanitizedCountParams
      });
      throw new Error(`Desajuste de parámetros: ${countPlaceholderCount} placeholders, ${sanitizedCountParams.length} parámetros`);
    }
    
    // Logging para depuración
    logger.debug('Ejecutando countQuery', {
      query: countQuery.trim(),
      paramsCount: sanitizedCountParams.length,
      params: sanitizedCountParams
    });
    
    const countResult = await this.execute(countQuery, sanitizedCountParams);
    const totalRecords = Number(countResult[0]?.total) || 0;

    // Ordenamiento
    const orderByField = safeSortField === 'nombre_ambiente' || safeSortField === 'codigo_ambiente'
      ? `a.${safeSortField}`
      : `e.${safeSortField}`;
    query += ` ORDER BY ${orderByField} ${sortOrder}`;

    // Paginación
    // IMPORTANTE: LIMIT y OFFSET deben ser valores literales, no parámetros preparados
    // Algunas versiones de MySQL/MariaDB no soportan parámetros en LIMIT/OFFSET
    const validLimit = Number.isInteger(limit) && limit > 0 ? limit : 50;
    const validOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
    
    // Sanitizar valores para prevenir SQL injection (ya son números enteros validados)
    // Asegurar que sean enteros positivos
    const safeLimit = Math.max(1, Math.min(100, Math.floor(validLimit)));
    const safeOffset = Math.max(0, Math.floor(validOffset));
    
    query += ` LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    
    // Validar que no haya valores undefined o null problemáticos
    // NOTA: Ya no incluimos limit y offset en params porque los usamos como literales
    const sanitizedParams = params.map(param => {
      if (param === undefined) {
        logger.warn('Parámetro undefined encontrado en query principal, convirtiendo a null');
        return null;
      }
      // Validar NaN y valores infinitos
      if (typeof param === 'number' && (isNaN(param) || !isFinite(param))) {
        logger.warn('Parámetro numérico inválido encontrado en query principal, convirtiendo a null');
        return null;
      }
      return param;
    });
    
    // Contar placeholders en la query (ya no incluye LIMIT y OFFSET)
    const mainPlaceholderCount = (query.match(/\?/g) || []).length;
    if (mainPlaceholderCount !== sanitizedParams.length) {
      logger.error('Desajuste de parámetros en query principal', {
        query: query.trim(),
        placeholderCount: mainPlaceholderCount,
        paramsCount: sanitizedParams.length,
        params: sanitizedParams
      });
      throw new Error(`Desajuste de parámetros: ${mainPlaceholderCount} placeholders, ${sanitizedParams.length} parámetros`);
    }
    
    // Logging para depuración
    logger.debug('Ejecutando query principal', {
      query: query.trim(),
      paramsCount: sanitizedParams.length,
      params: sanitizedParams,
      limit: safeLimit,
      offset: safeOffset
    });

    const equipos = await this.execute(query, sanitizedParams);

    return {
      equipos,
      pagination: {
        page,
        limit,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        hasNext: page < Math.ceil(totalRecords / limit),
        hasPrev: page > 1
      }
    };
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

