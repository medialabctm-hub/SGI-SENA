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
export async function obtenerEstadisticas(req, res) {
  try {
    // El rol ya está validado por el middleware requireRole
    // Obtener estadísticas usando queries directas (más confiable que procedimiento almacenado)
    let stats;
    
    try {
        // Obtener total de equipos
        const [[equiposTotal]] = await defaultDb.execute(
          'SELECT COUNT(*) AS total FROM Elementos'
        );
        
        // Obtener equipos por estado (si existe la tabla Estado_Equipo)
        let equiposDisponibles = 0;
        let equiposEnUso = 0;
        let equiposEnMantenimiento = 0;
        let equiposDanados = 0;
        
        try {
          const [estadosEquipos] = await defaultDb.execute(
            `SELECT estado_operativo, COUNT(*) AS cantidad 
             FROM Estado_Equipo 
             GROUP BY estado_operativo`
          );
          
          estadosEquipos.forEach(row => {
            const cantidad = Number(row.cantidad) || 0;
            switch (row.estado_operativo) {
              case 'Disponible':
                equiposDisponibles = cantidad;
                break;
              case 'En Uso':
                equiposEnUso = cantidad;
                break;
              case 'En Mantenimiento':
                equiposEnMantenimiento = cantidad;
                break;
              case 'Dañado':
                equiposDanados = cantidad;
                break;
            }
          });
        } catch (e) {
          // Tabla Estado_Equipo no existe, usar valores por defecto
          logger.debug('Tabla Estado_Equipo no encontrada, usando valores por defecto', { error: e.message });
        }
        
        // Obtener usuarios activos
        const [[usuariosActivos]] = await defaultDb.execute(
          'SELECT COUNT(*) AS total FROM Usuarios WHERE estado = "Activo"'
        );
        
        // Obtener ambientes activos
        let ambientesActivos = 0;
        try {
          const [[ambientes]] = await defaultDb.execute(
            'SELECT COUNT(*) AS total FROM Ambientes WHERE estado_ambiente = "Activo"'
          );
          ambientesActivos = Number(ambientes?.total) || 0;
        } catch (e) {
          // Tabla Ambientes no existe o no tiene estado_ambiente
          logger.debug('Error al obtener ambientes activos', { error: e.message });
        }
        
        // Obtener novedades pendientes
        let novedadesPendientes = 0;
        try {
          const [[novedades]] = await defaultDb.execute(
            'SELECT COUNT(*) AS total FROM Novedades WHERE estado_resolucion = "Pendiente"'
          );
          novedadesPendientes = Number(novedades?.total) || 0;
        } catch (e) {
          // Tabla Novedades no existe
          logger.debug('Error al obtener novedades pendientes', { error: e.message });
        }
        
        // Obtener mantenimientos próximos (próximos 30 días)
        // Usa fecha_mantenimiento (obligatorio) en lugar de fecha_proximo
        // Solo cuenta mantenimientos programados o en proceso
        let mantenimientosProximos = 0;
        try {
          const [[mantenimientos]] = await defaultDb.execute(
            `SELECT COUNT(*) AS total FROM Mantenimiento 
             WHERE estado_mantenimiento IN ('Programado', 'En Proceso')
             AND DATE(fecha_mantenimiento) >= CURDATE()
             AND DATE(fecha_mantenimiento) <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
          );
          mantenimientosProximos = Number(mantenimientos?.total) || 0;
        } catch (e) {
          // Tabla Mantenimiento no existe o error en la query
          logger.error('Error al obtener mantenimientos próximos', { error: e.message });
        }
        
        stats = {
          equipos: {
            total: Number(equiposTotal?.total) || 0,
            disponibles: equiposDisponibles,
            enUso: equiposEnUso,
            enMantenimiento: equiposEnMantenimiento,
            danados: equiposDanados,
          },
          usuarios: {
            activos: Number(usuariosActivos?.total) || 0,
          },
          ambientes: {
            activos: ambientesActivos,
          },
          novedades: {
            pendientes: novedadesPendientes,
          },
          mantenimientos: {
            proximos30Dias: mantenimientosProximos,
          },
        };
    } catch (err) {
      // Si hay un error, lanzarlo para que se maneje arriba
      throw err;
    }

    // Log para debug
    logger.debug('Estadísticas generadas', { stats });

    return res.json({
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Error al obtener estadísticas', { error: err.message, stack: err.stack });
    return res.status(500).json({ 
      error: 'Error al obtener estadísticas', 
      details: err.message 
    });
  }
}

