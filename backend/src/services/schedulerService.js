import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio de tareas programadas para sincronización automática
 * Ejecuta la sincronización de responsabilidades cada minuto
 */
class SchedulerService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Iniciar el scheduler
   * @param {number} intervalMinutes - Intervalo en minutos (default: 1)
   */
  start(intervalMinutes = 1) {
    if (this.isRunning) {
      logger.warn('Scheduler ya está en ejecución');
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    
    // Ejecutar inmediatamente al iniciar
    this.executeSync();

    // Programar ejecución periódica
    this.intervalId = setInterval(() => {
      this.executeSync();
    }, intervalMs);

    this.isRunning = true;
    logger.info(`Scheduler iniciado. Sincronización cada ${intervalMinutes} minuto(s)`);
  }

  /**
   * Detener el scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('Scheduler detenido');
    }
  }

  /**
   * Ejecutar sincronización de responsabilidades
   */
  async executeSync() {
    try {
      const ahora = new Date();
      const fechaActual = ahora.toISOString().split('T')[0];
      const horaActual = ahora.toTimeString().slice(0, 5);

      // Buscar clases que deberían estar activas pero no tienen responsabilidades asignadas
      // Buscar clases programadas que ya deberían haber comenzado (no solo del día actual)
      // Usar TIMESTAMP para comparar correctamente fecha y hora
      const [clasesSinResponsabilidades] = await defaultDb.execute(
        `SELECT 
          c.id_clase,
          c.id_ambiente,
          c.id_instructor,
          c.fecha_clase,
          c.hora_inicio,
          c.hora_fin,
          c.estado_clase
         FROM Clases c
         WHERE c.estado_clase = 'Programada'
           AND TIMESTAMP(c.fecha_clase, c.hora_inicio) <= NOW()
           AND TIMESTAMP(c.fecha_clase, c.hora_fin) >= NOW()
           AND NOT EXISTS (
             SELECT 1 FROM Responsabilidades_Ambiente ra
             WHERE ra.id_clase = c.id_clase
               AND ra.estado_responsabilidad = 'Activa'
               AND ra.tipo_responsabilidad = 'Principal'
           )`,
        []
      );

      let asignadas = 0;
      const errores = [];

      if (clasesSinResponsabilidades.length > 0) {
        logger.info(`Sincronización automática: ${clasesSinResponsabilidades.length} clase(s) encontrada(s) para iniciar`);
      }

      for (const clase of clasesSinResponsabilidades) {
        try {
          // Convertir fecha_clase a string en formato YYYY-MM-DD
          const fechaClaseStr = clase.fecha_clase instanceof Date
            ? clase.fecha_clase.toISOString().split('T')[0]
            : String(clase.fecha_clase).split('T')[0];
          
          // Asegurar formato correcto de hora (puede venir con o sin segundos)
          let horaInicio = String(clase.hora_inicio);
          if (horaInicio.split(':').length === 2) {
            horaInicio = `${horaInicio}:00`;
          }
          
          let horaFin = String(clase.hora_fin);
          if (horaFin.split(':').length === 2) {
            horaFin = `${horaFin}:00`;
          }
          
          const fechaInicioClase = `${fechaClaseStr} ${horaInicio}`;
          const fechaFinClase = `${fechaClaseStr} ${horaFin}`;
          
          logger.info(`Sincronización automática: Procesando clase ${clase.id_clase} - Inicio=${fechaInicioClase}`);

          // Finalizar responsabilidades anteriores que se solapen
          await defaultDb.execute(
            `UPDATE Responsabilidades_Ambiente
             SET estado_responsabilidad = 'Finalizada',
                 fecha_fin = ?
             WHERE id_ambiente = ?
               AND estado_responsabilidad = 'Activa'
               AND (
                 (fecha_inicio < ? AND fecha_fin > ?) OR
                 (fecha_inicio < ? AND fecha_fin > ?) OR
                 (fecha_inicio >= ? AND fecha_fin <= ?)
               )`,
            [fechaInicioClase, clase.id_ambiente, fechaInicioClase, fechaInicioClase, fechaFinClase, fechaFinClase, fechaInicioClase, fechaFinClase]
          );

          // Asignar responsabilidad principal al instructor
          await defaultDb.execute(
            `INSERT INTO Responsabilidades_Ambiente
             (id_ambiente, id_clase, id_usuario, tipo_responsabilidad, fecha_inicio, fecha_fin, estado_responsabilidad, asignacion_automatica, creado_por)
             VALUES (?, ?, ?, 'Principal', ?, ?, 'Activa', TRUE, ?)`,
            [clase.id_ambiente, clase.id_clase, clase.id_instructor, fechaInicioClase, fechaFinClase, clase.id_instructor]
          );

          // Obtener aprendices y asignar responsabilidades secundarias
          const [aprendices] = await defaultDb.execute(
            `SELECT id_aprendiz FROM Participantes_Clase WHERE id_clase = ? AND presente = TRUE`,
            [clase.id_clase]
          );

          for (const aprendiz of aprendices) {
            await defaultDb.execute(
              `INSERT INTO Responsabilidades_Ambiente
               (id_ambiente, id_clase, id_usuario, tipo_responsabilidad, fecha_inicio, fecha_fin, estado_responsabilidad, asignacion_automatica, creado_por)
               VALUES (?, ?, ?, 'Secundario', ?, ?, 'Activa', TRUE, ?)`,
              [clase.id_ambiente, clase.id_clase, aprendiz.id_aprendiz, fechaInicioClase, fechaFinClase, clase.id_instructor]
            );
          }

          // Actualizar estado de la clase a "En Curso"
          if (clase.estado_clase === 'Programada') {
            await defaultDb.execute(
              `UPDATE Clases SET estado_clase = 'En Curso', fecha_inicio_real = ? WHERE id_clase = ?`,
              [fechaInicioClase, clase.id_clase]
            );
          }

          asignadas++;
        } catch (err) {
          logger.error(`Error al asignar responsabilidades para clase ${clase.id_clase}:`, err);
          errores.push({ id_clase: clase.id_clase, error: err.message });
        }
      }

      // Finalizar responsabilidades de clases que ya terminaron
      // Buscar clases en curso que ya pasaron su hora de fin (no solo del día actual)
      const [clasesFinalizadas] = await defaultDb.execute(
        `SELECT DISTINCT c.id_clase
         FROM Clases c
         INNER JOIN Responsabilidades_Ambiente ra ON c.id_clase = ra.id_clase
         WHERE TIMESTAMP(c.fecha_clase, c.hora_fin) < NOW()
           AND c.estado_clase = 'En Curso'
           AND ra.estado_responsabilidad = 'Activa'`,
        []
      );

      let finalizadas = 0;
      for (const clase of clasesFinalizadas) {
        try {
          const fechaFin = ahora.toISOString().slice(0, 19).replace('T', ' ');
          await defaultDb.execute(
            `UPDATE Responsabilidades_Ambiente
             SET estado_responsabilidad = 'Finalizada',
                 fecha_fin = ?
             WHERE id_clase = ? AND estado_responsabilidad = 'Activa'`,
            [fechaFin, clase.id_clase]
          );

          await defaultDb.execute(
            `UPDATE Clases SET estado_clase = 'Finalizada', fecha_fin_real = ? WHERE id_clase = ?`,
            [fechaFin, clase.id_clase]
          );

          finalizadas++;
        } catch (err) {
          logger.error(`Error al finalizar clase ${clase.id_clase}:`, err);
          errores.push({ id_clase: clase.id_clase, error: err.message });
        }
      }


      if (asignadas > 0 || finalizadas > 0) {
        logger.info(`Sincronización automática: ${asignadas} clase(s) iniciada(s), ${finalizadas} clase(s) finalizada(s)`);
      }
    } catch (error) {
      logger.error('Error en sincronización automática:', error);
    }
  }

  /**
   * Verificar estado del scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalId ? 1 : null
    };
  }
}

// Singleton
const schedulerService = new SchedulerService();

export default schedulerService;

