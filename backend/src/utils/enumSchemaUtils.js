/**
 * Utilidad compartida para leer los valores permitidos de una columna ENUM
 * de MySQL vía INFORMATION_SCHEMA. Centraliza un patrón que antes estaba
 * duplicado en mantenimientoController, novedadesController y reportesController.
 *
 * @module utils/enumSchemaUtils
 */

/**
 * Obtiene y parsea los valores de una columna ENUM de MySQL.
 * Si la columna no existe, no es un ENUM, o la consulta falla, devuelve
 * `valoresPorDefecto` en su lugar (nunca lanza).
 *
 * @param {Object} db - Instancia de la base de datos (debe exponer .execute)
 * @param {string} tabla - Nombre de la tabla
 * @param {string} columna - Nombre de la columna ENUM
 * @param {string[]} valoresPorDefecto - Valores a usar si no se puede leer el ENUM
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger opcional (info/warn/error)
 * @param {string} [options.logLabel] - Etiqueta para los mensajes de log (por defecto "tabla.columna")
 * @returns {Promise<string[]>} Valores del ENUM, o los valores por defecto
 */
export async function obtenerValoresEnumColumna(db, tabla, columna, valoresPorDefecto, options = {}) {
  const { logger, logLabel = `${tabla}.${columna}` } = options;

  try {
    const [rows] = await db.execute(
      `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
      [tabla, columna]
    );

    if (!rows || rows.length === 0) {
      logger?.warn(`No se encontró información del ENUM ${logLabel} en INFORMATION_SCHEMA`);
      return valoresPorDefecto;
    }

    const enumString = rows[0].COLUMN_TYPE;
    if (!enumString || !enumString.toLowerCase().startsWith('enum')) {
      logger?.warn('El tipo de columna no es un ENUM:', enumString);
      return valoresPorDefecto;
    }

    const valores = enumString
      .replace(/^enum\(/i, '')
      .replace(/\)$/i, '')
      .split(',')
      .map((val) => val.trim().replace(/^'|'$/g, ''))
      .filter((val) => val.length > 0);

    if (valores.length === 0) {
      logger?.warn('No se pudieron extraer valores del ENUM');
      return valoresPorDefecto;
    }

    logger?.info(`Valores ENUM de ${logLabel} cargados desde BD`, { valores });
    return valores;
  } catch (err) {
    logger?.error(`Error al obtener valores ENUM de ${logLabel}`, { error: err.message, stack: err.stack });
    return valoresPorDefecto;
  }
}
