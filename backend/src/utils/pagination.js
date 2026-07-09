/**
 * Utilidades para paginación de resultados
 * Mejora el rendimiento al limitar la cantidad de datos retornados
 * 
 * @module utils/pagination
 */

/**
 * Calcula los parámetros de paginación desde query params
 * @param {Object} query - Query params del request
 * @param {number} defaultLimit - Límite por defecto
 * @param {number} maxLimit - Límite máximo permitido
 * @returns {Object} Objeto con page, limit, offset
 */
export function getPaginationParams(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Construye la cláusula LIMIT para SQL
 * @param {number} limit - Límite de resultados
 * @param {number} offset - Offset de resultados
 * @returns {string} Cláusula LIMIT SQL
 */
export function buildLimitClause(limit, offset) {
  return `LIMIT ${limit} OFFSET ${offset}`;
}

/**
 * Formatea la respuesta con información de paginación
 * @param {Array} data - Datos a retornar
 * @param {number} page - Página actual
 * @param {number} limit - Límite por página
 * @param {number} total - Total de registros
 * @returns {Object} Respuesta formateada con paginación
 */
export function formatPaginatedResponse(data, page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Ejecuta una query con paginación y retorna resultados formateados
 * @param {Object} db - Instancia de la base de datos
 * @param {string} countQuery - Query para contar total de registros
 * @param {string} dataQuery - Query para obtener datos
 * @param {Array} params - Parámetros para las queries
 * @param {number} page - Página actual
 * @param {number} limit - Límite por página
 * @returns {Promise<Object>} Resultados paginados
 */
export async function executePaginatedQuery(db, countQuery, dataQuery, params, page, limit) {
  // Ejecutar query de conteo
  const [[{ total }]] = await db.execute(countQuery, params);
  
  // Calcular offset
  const offset = (page - 1) * limit;
  
  // Ejecutar query de datos con LIMIT
  const dataQueryWithLimit = `${dataQuery} LIMIT ? OFFSET ?`;
  const [data] = await db.execute(dataQueryWithLimit, [...params, limit, offset]);
  
  return formatPaginatedResponse(data, page, limit, total);
}

