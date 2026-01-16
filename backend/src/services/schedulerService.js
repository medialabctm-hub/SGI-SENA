import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';

/**
 * Obtener fecha/hora local en formato MySQL (YYYY-MM-DD HH:MM:SS)
 * IMPORTANTE: NO usa UTC, usa la hora local del servidor
 */
function getLocalDateTimeString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Obtener fecha local en formato MySQL (YYYY-MM-DD)
 */
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
      const fechaActual = getLocalDateString(ahora);
      const horaActual = ahora.toTimeString().slice(0, 8); // HH:MM:SS
      
      // Log para debugging - verificar hora actual del servidor
      logger.debug('Sincronización automática ejecutándose', {
        fecha_actual: fechaActual,
        hora_actual: horaActual,
        timestamp_local: getLocalDateTimeString(ahora),
        timestamp_utc: ahora.toISOString()
      });

      // Buscar clases programadas que NO tienen responsabilidades asignadas
      // IMPORTANTE: NO filtrar por tiempo en SQL - hacerlo en JavaScript con hora local
      // La BD solo guarda datos, JavaScript decide el tiempo actual
      const [clasesProgramadas] = await defaultDb.execute(
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
           AND NOT EXISTS (
             SELECT 1 FROM Responsabilidades_Ambiente ra
             WHERE ra.id_clase = c.id_clase
               AND ra.estado_responsabilidad = 'Activa'
               AND ra.tipo_responsabilidad = 'Principal'
           )`,
        []
      );

      // Filtrar en JavaScript usando hora local
      // Usar las variables ya declaradas arriba (ahora, fechaActual, horaActual)
      const clasesSinResponsabilidades = clasesProgramadas.filter(clase => {
        // Convertir fecha_clase a string
        const fechaClaseStr = clase.fecha_clase instanceof Date
          ? getLocalDateString(clase.fecha_clase)
          : String(clase.fecha_clase).split('T')[0];
        
        // Solo procesar clases del día actual
        if (fechaClaseStr !== fechaActual) {
          return false;
        }
        
        // Normalizar hora_inicio y hora_fin a formato HH:MM:SS
        let horaInicio = String(clase.hora_inicio);
        if (horaInicio.split(':').length === 2) {
          horaInicio = `${horaInicio}:00`;
        }
        let horaFin = String(clase.hora_fin);
        if (horaFin.split(':').length === 2) {
          horaFin = `${horaFin}:00`;
        }
        
        // Comparar usando hora local de JavaScript
        const debeIniciar = horaActual >= horaInicio;
        const aunNoTermina = horaActual < horaFin;
        
        return debeIniciar && aunNoTermina;
      });
      
      // Log para debugging - verificar clases programadas cercanas
      const [clasesProgramadasCercanas] = await defaultDb.execute(
        `SELECT 
          c.id_clase,
          c.fecha_clase,
          c.hora_inicio,
          c.hora_fin,
          c.estado_clase
         FROM Clases c
         WHERE c.estado_clase = 'Programada'
           AND c.fecha_clase >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
           AND c.fecha_clase <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         ORDER BY c.fecha_clase, c.hora_inicio
         LIMIT 10`,
        []
      );
      
      if (clasesProgramadasCercanas.length > 0) {
        const ahoraLog = new Date();
        const fechaLog = getLocalDateString(ahoraLog);
        const horaLog = ahoraLog.toTimeString().slice(0, 8);
        
        logger.debug('Clases programadas cercanas encontradas', {
          total: clasesProgramadasCercanas.length,
          ahora_utc: ahoraLog.toISOString(),
          ahora_local_js: getLocalDateTimeString(ahoraLog),
          fecha_actual: fechaLog,
          hora_actual: horaLog,
          clases: clasesProgramadasCercanas.map(c => {
            const fechaClaseStr = c.fecha_clase instanceof Date
              ? getLocalDateString(c.fecha_clase)
              : String(c.fecha_clase).split('T')[0];
            let horaInicio = String(c.hora_inicio);
            if (horaInicio.split(':').length === 2) horaInicio = `${horaInicio}:00`;
            let horaFin = String(c.hora_fin);
            if (horaFin.split(':').length === 2) horaFin = `${horaFin}:00`;
            
            const esHoy = fechaClaseStr === fechaLog;
            const debeIniciar = esHoy && horaLog >= horaInicio;
            const aunNoTermina = esHoy && horaLog < horaFin;
            
            return {
              id: c.id_clase,
              fecha: fechaClaseStr,
              hora_inicio: horaInicio,
              hora_fin: horaFin,
              es_hoy: esHoy,
              debe_iniciar: debeIniciar,
              aun_no_termina: aunNoTermina
            };
          })
        });
      }
      
      // Log para debugging
      if (clasesSinResponsabilidades.length > 0) {
        const ahoraLog = new Date();
        logger.info(`Sincronización automática: ${clasesSinResponsabilidades.length} clase(s) encontrada(s) para iniciar`, {
          ahora_utc: ahoraLog.toISOString(),
          ahora_local_js: getLocalDateTimeString(ahoraLog),
          fecha_actual: fechaActual,
          hora_actual: horaActual,
          clases: clasesSinResponsabilidades.map(c => {
            const fechaClaseStr = c.fecha_clase instanceof Date
              ? getLocalDateString(c.fecha_clase)
              : String(c.fecha_clase).split('T')[0];
            let horaInicio = String(c.hora_inicio);
            if (horaInicio.split(':').length === 2) horaInicio = `${horaInicio}:00`;
            let horaFin = String(c.hora_fin);
            if (horaFin.split(':').length === 2) horaFin = `${horaFin}:00`;
            
            return {
              id: c.id_clase,
              fecha: fechaClaseStr,
              hora_inicio: horaInicio,
              hora_fin: horaFin,
              debe_iniciar: horaActual >= horaInicio,
              aun_no_termina: horaActual < horaFin
            };
          })
        });
      } else {
        // Log periódico para verificar que el scheduler está funcionando
        if (ahora.getMinutes() % 5 === 0) {
          logger.debug('Sincronización automática: No hay clases para iniciar', {
            ahora_utc: ahora.toISOString(),
            ahora_local: getLocalDateTimeString(ahora),
            fecha_actual: fechaActual,
            hora_actual: horaActual
          });
        }
      }

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
            logger.info(`Clase ${clase.id_clase} iniciada automáticamente - Estado cambiado a "En Curso"`);
          }

          asignadas++;
        } catch (err) {
          logger.error(`Error al asignar responsabilidades para clase ${clase.id_clase}:`, err);
          errores.push({ id_clase: clase.id_clase, error: err.message });
        }
      }

      // Finalizar responsabilidades de clases que ya terminaron
      // IMPORTANTE: NO filtrar por tiempo en SQL - hacerlo en JavaScript con hora local
      const [clasesEnCurso] = await defaultDb.execute(
        `SELECT DISTINCT 
          c.id_clase, 
          c.fecha_clase, 
          c.hora_inicio,
          c.hora_fin, 
          c.fecha_inicio_real
         FROM Clases c
         INNER JOIN Responsabilidades_Ambiente ra ON c.id_clase = ra.id_clase
         WHERE c.estado_clase = 'En Curso'
           AND ra.estado_responsabilidad = 'Activa'`,
        []
      );

      // Filtrar en JavaScript usando hora local
      const clasesFinalizadas = clasesEnCurso.filter(clase => {
        const fechaClaseStr = clase.fecha_clase instanceof Date
          ? getLocalDateString(clase.fecha_clase)
          : String(clase.fecha_clase).split('T')[0];
        
        // Normalizar hora_fin
        let horaFin = String(clase.hora_fin);
        if (horaFin.split(':').length === 2) {
          horaFin = `${horaFin}:00`;
        }
        
        // Construir datetime de fin de clase
        const datetimeFinClase = `${fechaClaseStr} ${horaFin}`;
        const datetimeFinClaseObj = new Date(datetimeFinClase.replace(' ', 'T'));
        
        // Verificar que la hora de fin ya pasó (con margen de 1 minuto)
        const ahoraObj = new Date();
        const unMinutoAtras = new Date(ahoraObj.getTime() - 60000);
        
        if (datetimeFinClaseObj > unMinutoAtras) {
          return false; // Aún no ha terminado
        }
        
        // Verificar que la clase fue iniciada hace al menos 1 minuto
        if (clase.fecha_inicio_real) {
          const fechaInicioReal = new Date(clase.fecha_inicio_real);
          const minutosDesdeInicio = Math.floor((ahoraObj - fechaInicioReal) / 60000);
          if (minutosDesdeInicio < 1) {
            return false; // Iniciada hace menos de 1 minuto
          }
        }
        
        return true;
      });

      let finalizadas = 0;
      for (const clase of clasesFinalizadas) {
        try {
          // Calcular minutos desde inicio usando JavaScript
          let minutosDesdeInicio = 0;
          if (clase.fecha_inicio_real) {
            const fechaInicioReal = new Date(clase.fecha_inicio_real);
            const ahoraObj = new Date();
            minutosDesdeInicio = Math.floor((ahoraObj - fechaInicioReal) / 60000);
          } else {
            // Si no hay fecha_inicio_real, usar hora_inicio programada
            const fechaClaseStr = clase.fecha_clase instanceof Date
              ? getLocalDateString(clase.fecha_clase)
              : String(clase.fecha_clase).split('T')[0];
            let horaInicio = String(clase.hora_inicio);
            if (horaInicio.split(':').length === 2) {
              horaInicio = `${horaInicio}:00`;
            }
            const datetimeInicio = `${fechaClaseStr} ${horaInicio}`;
            const fechaInicioObj = new Date(datetimeInicio.replace(' ', 'T'));
            const ahoraObj = new Date();
            minutosDesdeInicio = Math.floor((ahoraObj - fechaInicioObj) / 60000);
          }
          
          if (minutosDesdeInicio < 1) {
            logger.debug(`Clase ${clase.id_clase} iniciada hace menos de 1 minuto, no se finaliza automáticamente`, {
              minutos_desde_inicio: minutosDesdeInicio,
              hora_fin: clase.hora_fin
            });
            continue;
          }

          // IMPORTANTE: Usar hora local, NO UTC
          const fechaFin = getLocalDateTimeString(new Date());
          
          logger.info(`Finalizando clase ${clase.id_clase} automáticamente - Hora fin: ${clase.hora_fin}, Minutos desde inicio: ${minutosDesdeInicio}`, {
            fecha_fin_local: fechaFin,
            minutos_desde_inicio: minutosDesdeInicio
          });
          
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
        logger.info(`Sincronización automática completada: ${asignadas} clase(s) iniciada(s), ${finalizadas} clase(s) finalizada(s)`);
      } else {
        // Log periódico para verificar que el scheduler está funcionando
        const ahora = new Date();
        if (ahora.getMinutes() % 5 === 0) { // Log cada 5 minutos
          logger.debug('Sincronización automática ejecutada - No hay clases para procesar');
        }
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

