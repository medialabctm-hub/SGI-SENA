import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';

/**
 * Obtener estadísticas generales del sistema
 * Solo disponible para Administradores
 */
/**
 * Obtener estadísticas generales del sistema
 * Solo disponible para Administradores (ya validado por middleware)
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
/**
 * Obtener estadísticas generales del sistema para Administrador
 * Incluye: Total Equipos, Equipos en Buen Estado, Regular, Dañados, Valor Total Inventario
 */
export async function obtenerEstadisticas(req, res) {
  try {
    // Obtener estadísticas básicas de equipos
    const [[estadisticasBasicas]] = await defaultDb.execute(
      `SELECT 
        COUNT(*) AS total_equipos,
        SUM(CASE WHEN estado_fisico = 'Nuevo' THEN 1 ELSE 0 END) AS equipos_nuevos,
        SUM(CASE WHEN estado_fisico = 'Bueno' THEN 1 ELSE 0 END) AS equipos_buenos,
        SUM(CASE WHEN estado_fisico = 'Regular' THEN 1 ELSE 0 END) AS equipos_regulares,
        SUM(CASE WHEN estado_fisico = 'Malo' THEN 1 ELSE 0 END) AS equipos_malos,
        SUM(CASE WHEN estado_fisico = 'Dañado' THEN 1 ELSE 0 END) AS equipos_danados,
        SUM(COALESCE(valor_ingreso, 0)) AS valor_total_inventario,
        AVG(COALESCE(valor_ingreso, 0)) AS valor_promedio_equipo
       FROM Elementos`
    );

    // Estadísticas por categoría
    let estadisticasCategoria = [];
    try {
      const [result] = await defaultDb.execute(
        `SELECT 
          c.nombre_categoria,
          COUNT(*) AS cantidad,
          SUM(COALESCE(e.valor_ingreso, 0)) AS valor_total
         FROM Elementos e
         INNER JOIN Categorias_Equipo c ON c.id_categoria = e.id_categoria
         GROUP BY c.id_categoria, c.nombre_categoria
         ORDER BY cantidad DESC
         LIMIT 10`
      );
      estadisticasCategoria = result || [];
    } catch (err) {
      logger.warn('Error al obtener estadísticas por categoría', { error: err.message });
      estadisticasCategoria = [];
    }

    // Estadísticas por ambiente
    let estadisticasAmbiente = [];
    try {
      const [result] = await defaultDb.execute(
        `SELECT 
          a.codigo_ambiente,
          a.nombre_ambiente,
          COUNT(*) AS cantidad_equipos,
          SUM(COALESCE(e.valor_ingreso, 0)) AS valor_total
         FROM Elementos e
         INNER JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
         GROUP BY a.id_ambiente, a.codigo_ambiente, a.nombre_ambiente
         ORDER BY cantidad_equipos DESC
         LIMIT 10`
      );
      estadisticasAmbiente = result || [];
    } catch (err) {
      logger.warn('Error al obtener estadísticas por ambiente', { error: err.message });
      estadisticasAmbiente = [];
    }

    // Estadísticas de estado operativo
    let estadisticasOperativo = [];
    try {
      const [result] = await defaultDb.execute(
        `SELECT 
          COALESCE(ee.estado_operativo, 'Disponible') AS estado_operativo,
          COUNT(*) AS cantidad
         FROM Elementos e
         LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
         GROUP BY ee.estado_operativo
         ORDER BY cantidad DESC`
      );
      estadisticasOperativo = result || [];
    } catch (err) {
      logger.warn('Error al obtener estadísticas por estado operativo', { error: err.message });
      estadisticasOperativo = [];
    }

    // Equipos registrados por mes (últimos 12 meses)
    // Usar fecha_registro si existe, sino usar fecha_adquisicion como fallback
    let equiposPorMes = [];
    try {
      const [result] = await defaultDb.execute(
        `SELECT 
          DATE_FORMAT(COALESCE(fecha_registro, fecha_adquisicion, NOW()), '%Y-%m') AS mes,
          COUNT(*) AS cantidad
         FROM Elementos
         WHERE COALESCE(fecha_registro, fecha_adquisicion, NOW()) >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY DATE_FORMAT(COALESCE(fecha_registro, fecha_adquisicion, NOW()), '%Y-%m')
         ORDER BY mes ASC`
      );
      equiposPorMes = result || [];
    } catch (err) {
      logger.warn('Error al obtener equipos por mes', { error: err.message });
      equiposPorMes = [];
    }

    // Novedades pendientes
    let novedadesPendientes = { total: 0 };
    try {
      const [[result]] = await defaultDb.execute(
        `SELECT COUNT(*) AS total
         FROM Novedades
         WHERE estado_resolucion = 'Pendiente' OR estado_resolucion = 'En Proceso'`
      );
      novedadesPendientes = result || { total: 0 };
    } catch (err) {
      logger.warn('Error al obtener novedades pendientes', { error: err.message });
      novedadesPendientes = { total: 0 };
    }

    // Mantenimientos programados próximos (próximos 30 días)
    let mantenimientosProximos = { total: 0 };
    try {
      const [[result]] = await defaultDb.execute(
        `SELECT COUNT(*) AS total
         FROM Mantenimiento
         WHERE estado_mantenimiento = 'Programado'
           AND fecha_proximo BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
      );
      mantenimientosProximos = result || { total: 0 };
    } catch (err) {
      logger.warn('Error al obtener mantenimientos próximos', { error: err.message });
      mantenimientosProximos = { total: 0 };
    }

    // Equipos sin cuentadante asignado
    let equiposSinCuentadante = { total: 0 };
    try {
      const [[result]] = await defaultDb.execute(
        `SELECT COUNT(*) AS total
         FROM Elementos
         WHERE id_cuentadante IS NULL`
      );
      equiposSinCuentadante = result || { total: 0 };
    } catch (err) {
      logger.warn('Error al obtener equipos sin cuentadante', { error: err.message });
      equiposSinCuentadante = { total: 0 };
    }

    // Equipos más utilizados (por historial de uso)
    let equiposMasUsados = [];
    try {
      const [result] = await defaultDb.execute(
        `SELECT 
          e.codigo_equipo,
          e.placa,
          e.modelo,
          COUNT(hu.id_historial) AS veces_usado
         FROM Elementos e
         LEFT JOIN Historial_Uso_Equipos hu ON e.codigo_equipo = hu.codigo_equipo
         GROUP BY e.codigo_equipo, e.placa, e.modelo
         ORDER BY veces_usado DESC
         LIMIT 10`
      );
      equiposMasUsados = result || [];
    } catch (err) {
      logger.warn('Error al obtener equipos más usados (tabla puede no existir)', { error: err.message });
      equiposMasUsados = [];
    }

    const stats = {
      // Estadísticas básicas
      total_equipos: Number(estadisticasBasicas?.total_equipos) || 0,
      equipos_nuevos: Number(estadisticasBasicas?.equipos_nuevos) || 0,
      equipos_buenos: Number(estadisticasBasicas?.equipos_buenos) || 0,
      equipos_regulares: Number(estadisticasBasicas?.equipos_regulares) || 0,
      equipos_malos: Number(estadisticasBasicas?.equipos_malos) || 0,
      equipos_danados: Number(estadisticasBasicas?.equipos_danados) || 0,
      equipos_con_novedades: Number(estadisticasBasicas?.equipos_regulares || 0) + Number(estadisticasBasicas?.equipos_malos || 0) + Number(estadisticasBasicas?.equipos_danados || 0),
      valor_total_inventario: Number(estadisticasBasicas?.valor_total_inventario) || 0,
      valor_promedio_equipo: Number(estadisticasBasicas?.valor_promedio_equipo) || 0,
      
      // Estadísticas por categoría (siempre incluir, aunque esté vacío)
      por_categoria: Array.isArray(estadisticasCategoria) ? estadisticasCategoria : [],
      
      // Estadísticas por ambiente (siempre incluir, aunque esté vacío)
      por_ambiente: Array.isArray(estadisticasAmbiente) ? estadisticasAmbiente : [],
      
      // Estadísticas por estado operativo
      por_estado_operativo: Array.isArray(estadisticasOperativo) ? estadisticasOperativo : [],
      
      // Equipos registrados por mes
      equipos_por_mes: Array.isArray(equiposPorMes) ? equiposPorMes : [],
      
      // Alertas y pendientes (siempre incluir, aunque sea 0)
      novedades_pendientes: Number(novedadesPendientes?.total) || 0,
      mantenimientos_proximos: Number(mantenimientosProximos?.total) || 0,
      equipos_sin_cuentadante: Number(equiposSinCuentadante?.total) || 0,
      
      // Equipos más utilizados
      equipos_mas_usados: Array.isArray(equiposMasUsados) ? equiposMasUsados : []
    };

    logger.debug('Estadísticas avanzadas de Administrador generadas', { stats });

    return res.json({
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Error al obtener estadísticas de Administrador', { error: err.message, stack: err.stack });
    return res.status(500).json({ 
      error: 'Error al obtener estadísticas', 
      details: err.message 
    });
  }
}
        
/**
 * Obtener estadísticas de equipos del ambiente actual para Instructor
 * Solo muestra equipos del ambiente donde el instructor está en ese momento
 */
export async function obtenerEstadisticasInstructor(req, res) {
        try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Determinar jornada actual
    const horaActual = new Date().getHours();
    let jornadaActual = 'Mañana';
    if (horaActual >= 12 && horaActual < 18) {
      jornadaActual = 'Tarde';
    } else if (horaActual >= 18) {
      jornadaActual = 'Noche';
        }
        
    // Obtener ambientes donde el instructor tiene responsabilidad activa en este momento
    const [ambientes] = await defaultDb.execute(
      `SELECT DISTINCT ra.id_ambiente
       FROM Responsabilidades_Ambiente ra
       LEFT JOIN Clases c ON ra.id_clase = c.id_clase
       WHERE ra.id_usuario = ?
         AND ra.estado_responsabilidad = 'Activa'
         AND ra.fecha_inicio <= NOW()
         AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
         AND (
           (ra.id_clase IS NULL AND ra.jornada = ?)
           OR (
             ra.id_clase IS NOT NULL 
             AND c.estado_clase IN ('Programada', 'En Curso')
             AND c.fecha_clase = CURDATE()
             AND CONCAT(c.fecha_clase, ' ', c.hora_inicio) <= NOW()
             AND CONCAT(c.fecha_clase, ' ', c.hora_fin) >= NOW()
           )
         )`,
      [userId, jornadaActual]
    );

    if (ambientes.length === 0) {
      return res.json({
        stats: {
          total_equipos: 0,
          equipos_buenos: 0,
          equipos_regulares: 0,
          equipos_danados: 0,
          valor_total_inventario: 0
        },
        generatedAt: new Date().toISOString(),
      });
    }

    const idsAmbientes = ambientes.map(a => a.id_ambiente);

    // Obtener estadísticas de equipos de esos ambientes
    const [[estadisticas]] = await defaultDb.execute(
      `SELECT 
        COUNT(*) AS total_equipos,
        SUM(CASE WHEN e.estado_fisico = 'Bueno' THEN 1 ELSE 0 END) AS equipos_buenos,
        SUM(CASE WHEN e.estado_fisico = 'Regular' THEN 1 ELSE 0 END) AS equipos_regulares,
        SUM(CASE WHEN e.estado_fisico = 'Malo' OR e.estado_fisico = 'Dañado' THEN 1 ELSE 0 END) AS equipos_danados,
        SUM(COALESCE(e.valor_ingreso, 0)) AS valor_total_inventario
       FROM Elementos e
       WHERE e.id_ambiente IN (${idsAmbientes.map(() => '?').join(',')})`,
      idsAmbientes
    );

    const stats = {
      total_equipos: Number(estadisticas?.total_equipos) || 0,
      equipos_buenos: Number(estadisticas?.equipos_buenos) || 0,
      equipos_regulares: Number(estadisticas?.equipos_regulares) || 0,
      equipos_danados: Number(estadisticas?.equipos_danados) || 0,
      valor_total_inventario: Number(estadisticas?.valor_total_inventario) || 0
    };

    logger.debug('Estadísticas de Instructor generadas', { userId, stats });

    return res.json({
      stats,
      generatedAt: new Date().toISOString(),
    });
    } catch (err) {
    logger.error('Error al obtener estadísticas de Instructor', { error: err.message, stack: err.stack });
    return res.status(500).json({ 
      error: 'Error al obtener estadísticas', 
      details: err.message 
    });
  }
}

/**
 * Obtener estadísticas del inventario del Cuentadante
 * Solo muestra equipos asignados al cuentadante (id_cuentadante)
 */
export async function obtenerEstadisticasCuentadante(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Obtener estadísticas de equipos del cuentadante
    const [[estadisticas]] = await defaultDb.execute(
      `SELECT 
        COUNT(*) AS total_equipos,
        SUM(CASE WHEN estado_fisico = 'Bueno' THEN 1 ELSE 0 END) AS equipos_buenos,
        SUM(CASE WHEN estado_fisico = 'Regular' THEN 1 ELSE 0 END) AS equipos_regulares,
        SUM(CASE WHEN estado_fisico = 'Malo' OR estado_fisico = 'Dañado' THEN 1 ELSE 0 END) AS equipos_danados,
        SUM(COALESCE(valor_ingreso, 0)) AS valor_total_inventario
       FROM Elementos
       WHERE id_cuentadante = ?`,
      [userId]
    );

    const stats = {
      total_equipos: Number(estadisticas?.total_equipos) || 0,
      equipos_buenos: Number(estadisticas?.equipos_buenos) || 0,
      equipos_regulares: Number(estadisticas?.equipos_regulares) || 0,
      equipos_danados: Number(estadisticas?.equipos_danados) || 0,
      valor_total_inventario: Number(estadisticas?.valor_total_inventario) || 0
    };

    logger.debug('Estadísticas de Cuentadante generadas', { userId, stats });

    return res.json({
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Error al obtener estadísticas de Cuentadante', { error: err.message, stack: err.stack });
    return res.status(500).json({ 
      error: 'Error al obtener estadísticas', 
      details: err.message 
    });
  }
}

