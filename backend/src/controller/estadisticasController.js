import defaultDb from '../config/dbconfig.js';

/**
 * Obtener estadísticas generales del sistema
 * Solo disponible para Administradores
 */
export async function obtenerEstadisticas(req, res) {
  try {
    // Verificar que el usuario sea administrador
    if (req.user?.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo los administradores pueden ver estadísticas' });
    }

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
          console.error('Error al obtener mantenimientos próximos:', e);
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
    console.log('[DEBUG] Estadísticas generadas:', JSON.stringify(stats, null, 2));

    return res.json({
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error al obtener estadísticas:', err);
    return res.status(500).json({ 
      error: 'Error al obtener estadísticas', 
      details: err.message 
    });
  }
}

