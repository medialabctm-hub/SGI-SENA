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
    // Obtener estadísticas de equipos por estado físico
    const [[estadisticas]] = await defaultDb.execute(
      `SELECT 
        COUNT(*) AS total_equipos,
        SUM(CASE WHEN estado_fisico = 'Bueno' THEN 1 ELSE 0 END) AS equipos_buenos,
        SUM(CASE WHEN estado_fisico = 'Regular' THEN 1 ELSE 0 END) AS equipos_regulares,
        SUM(CASE WHEN estado_fisico = 'Malo' OR estado_fisico = 'Dañado' THEN 1 ELSE 0 END) AS equipos_danados,
        SUM(COALESCE(valor_ingreso, 0)) AS valor_total_inventario
       FROM Elementos`
    );

    const stats = {
      total_equipos: Number(estadisticas?.total_equipos) || 0,
      equipos_buenos: Number(estadisticas?.equipos_buenos) || 0,
      equipos_regulares: Number(estadisticas?.equipos_regulares) || 0,
      equipos_danados: Number(estadisticas?.equipos_danados) || 0,
      valor_total_inventario: Number(estadisticas?.valor_total_inventario) || 0
    };

    logger.debug('Estadísticas de Administrador generadas', { stats });

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

