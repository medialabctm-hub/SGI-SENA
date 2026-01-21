import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import { createForUsers } from './notificationService.js';

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

function normalizarHora(hora) {
  const horaStr = String(hora);
  if (horaStr.split(':').length === 2) {
    return `${horaStr}:00`;
  }
  return horaStr;
}

function crearDateTime(fecha, hora) {
  const horaNormalizada = normalizarHora(hora);
  return new Date(`${fecha}T${horaNormalizada}`);
}

function convertirFechaMySqlALocal(fecha) {
  if (!fecha) return null;
  const fechaStr = fecha instanceof Date ? fecha.toISOString().slice(0, 19).replace('T', ' ') : String(fecha);
  // Interpretar como hora local (sin aplicar UTC) para evitar sumar/restar horas por zona
  return new Date(fechaStr.replace(' ', 'T'));
}

/**
 * Extraer YYYY-MM-DD sin depender de la zona horaria del Date
 */
function obtenerFechaISO(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; // usar componentes locales para evitar corrimientos
  }
  const str = String(fecha);
  if (str.includes('T')) return str.split('T')[0];
  return str.split(' ')[0];
}

/**
 * Servicio de MONITOREO y NOTIFICACIONES de clases (SISTEMA 100% MANUAL)
 * 
 * IMPORTANTE: Este servicio SOLO envía alertas informativas.
 * NO cambia estados automáticamente.
 * NO inicia ni finaliza clases.
 * NO activa ni desactiva responsabilidades.
 * 
 * Los estados se cambian ÚNICAMENTE mediante acciones manuales:
 * - iniciarClase() -> sp_iniciar_clase()
 * - finalizarClase() -> sp_finalizar_clase()
 * 
 * El tiempo es SOLO INFORMATIVO para alertas de UX.
 * 
 * ZONA HORARIA: Colombia (UTC-5) para comparaciones de horarios (solo informativo)
 */
class SchedulerService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.isExecuting = false;
    this.intervalMinutes = 1;
    this.notificacionesEnviadas = new Set(); // Para evitar notificaciones duplicadas
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

    this.intervalMinutes = intervalMinutes;
    const intervalMs = intervalMinutes * 60 * 1000;
    
    // Ejecutar inmediatamente al iniciar
    this.executeSync();

    // Programar ejecución periódica
    this.intervalId = setInterval(() => {
      this.executeSync();
    }, intervalMs);

    this.isRunning = true;
    logger.info(`Scheduler de monitoreo iniciado. Ejecución cada ${intervalMinutes} minuto(s)`);
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
   * Obtener hora actual en zona horaria de Colombia (UTC-5)
   */
  getHoraColombia() {
    const ahora = new Date();
    // Colombia está en UTC-5 (sin horario de verano)
    const offsetColombia = -5 * 60; // -5 horas en minutos
    const utc = ahora.getTime() + (ahora.getTimezoneOffset() * 60000);
    return new Date(utc + (offsetColombia * 60000));
  }

  /**
   * Ejecutar monitoreo de clases y enviar notificaciones (SISTEMA 100% MANUAL)
   * 
   * IMPORTANTE: Este método SOLO envía alertas informativas.
   * NO cambia estados automáticamente.
   * NO inicia ni finaliza clases.
   * NO activa ni desactiva responsabilidades.
   * 
   * Los estados se cambian ÚNICAMENTE mediante acciones manuales del usuario.
   * El tiempo es SOLO INFORMATIVO para alertas de UX.
   * 
   * Zona horaria: Colombia (UTC-5) para comparaciones (solo informativo)
   */
  async executeSync() {
    if (this.isExecuting) {
      logger.warn('Monitoreo en progreso. Se omite ejecución concurrente.');
      return { notificaciones: 0, errores: [{ tipo: 'concurrencia', detalle: 'Ejecución ya en curso' }] };
    }

    this.isExecuting = true;
    const resultado = { notificaciones: 0, errores: [] };

    try {
      // Usar hora de Colombia (UTC-5) para comparaciones
      const ahoraColombia = this.getHoraColombia();
      const fechaHoy = obtenerFechaISO(ahoraColombia);

      // 1. MONITOREAR CLASES PROGRAMADAS QUE DEBEN INICIARSE
      const [clasesProgramadas] = await defaultDb.execute(
        `SELECT c.id_clase, c.fecha_clase, c.hora_inicio, c.hora_fin, 
                c.nombre_clase, c.id_instructor,
                a.codigo_ambiente, a.nombre_ambiente,
                u.nombre_usuario AS instructor_nombre
         FROM Clases c
         INNER JOIN Ambientes a ON c.id_ambiente = a.id_ambiente
         INNER JOIN Usuarios u ON c.id_instructor = u.id_usuario
         WHERE c.estado_clase = 'Programada'
           AND c.fecha_clase = ?`,
        [fechaHoy]
      );

      const clasesParaIniciar = clasesProgramadas.filter((clase) => {
        const fechaClaseStr = obtenerFechaISO(clase.fecha_clase);
        const horaInicio = normalizarHora(clase.hora_inicio);
        const inicioProgramado = crearDateTime(fechaClaseStr, horaInicio);
        
        // Enviar notificación 5 minutos antes y en el momento exacto (con margen de 10 minutos)
        const minutosAntes = 5;
        const tiempoLimite = new Date(inicioProgramado.getTime() - (minutosAntes * 60000));
        const tiempoLimiteFinal = new Date(inicioProgramado.getTime() + (10 * 60000)); // 10 min de margen
        
        return ahoraColombia >= tiempoLimite && ahoraColombia <= tiempoLimiteFinal;
      });

      // Enviar notificaciones para iniciar clases
      for (const clase of clasesParaIniciar) {
        const claveNotificacion = `clase_iniciar_${clase.id_clase}`;
        
        if (this.notificacionesEnviadas.has(claveNotificacion)) {
          continue;
        }

        try {
          const fechaClaseStr = obtenerFechaISO(clase.fecha_clase);
          const horaInicio = normalizarHora(clase.hora_inicio);
          const inicioProgramado = crearDateTime(fechaClaseStr, horaInicio);
          const minutosRestantes = Math.floor((inicioProgramado.getTime() - ahoraColombia.getTime()) / 60000);

          await createForUsers({
            userIds: [clase.id_instructor],
            titulo: minutosRestantes > 0 
              ? `Clase por iniciar en ${minutosRestantes} minuto(s)`
              : 'Es hora de iniciar tu clase',
            cuerpo: `La clase "${clase.nombre_clase}" en el ambiente ${clase.codigo_ambiente} (${clase.nombre_ambiente}) ${minutosRestantes > 0 ? `inicia en ${minutosRestantes} minuto(s)` : 'debe iniciarse ahora'}.`,
            tipo: minutosRestantes > 0 ? 'aviso' : 'alerta',
            metadata: {
              id_clase: clase.id_clase,
              id_ambiente: clase.id_ambiente,
              tipo: 'clase_iniciar',
              hora_inicio: horaInicio,
              acciones: [
                {
                  tipo: 'iniciar_clase',
                  label: 'Iniciar Clase',
                  endpoint: `/api/clases/${clase.id_clase}/iniciar`,
                  metodo: 'POST'
                },
                {
                  tipo: 'cancelar_clase',
                  label: 'Cancelar Clase',
                  endpoint: `/api/clases/${clase.id_clase}/cancelar`,
                  metodo: 'POST'
                }
              ]
            },
            creadoPor: null
          });

          this.notificacionesEnviadas.add(claveNotificacion);
          resultado.notificaciones += 1;
          
          logger.info(`Notificación enviada: Clase ${clase.id_clase} por iniciar`, {
            id_clase: clase.id_clase,
            instructor: clase.instructor_nombre,
            minutos_restantes: minutosRestantes
          });
        } catch (err) {
          logger.error(`Error al enviar notificación para clase ${clase.id_clase}`, { error: err.message });
          resultado.errores.push({ id_clase: clase.id_clase, error: err.message });
        }
      }

      // 2. MONITOREAR CLASES EN CURSO QUE DEBEN FINALIZARSE
      const [clasesEnCurso] = await defaultDb.execute(
        `SELECT c.id_clase, c.fecha_clase, c.hora_inicio, c.hora_fin, 
                c.fecha_inicio_real, c.nombre_clase, c.id_instructor,
                a.codigo_ambiente, a.nombre_ambiente,
                u.nombre_usuario AS instructor_nombre
         FROM Clases c
         INNER JOIN Ambientes a ON c.id_ambiente = a.id_ambiente
         INNER JOIN Usuarios u ON c.id_instructor = u.id_usuario
         WHERE c.estado_clase = 'En Curso'`
      );

      const clasesParaFinalizar = clasesEnCurso.filter((clase) => {
        const fechaClaseStr = obtenerFechaISO(clase.fecha_clase);
        const horaFin = normalizarHora(clase.hora_fin);
        const finProgramado = crearDateTime(fechaClaseStr, horaFin);

        // Enviar notificación 5 minutos antes y cuando llegue la hora
        const minutosAntes = 5;
        const tiempoLimite = new Date(finProgramado.getTime() - (minutosAntes * 60000));
        
        return ahoraColombia >= tiempoLimite;
      });

      // Enviar notificaciones para finalizar clases
      for (const clase of clasesParaFinalizar) {
        const claveNotificacion = `clase_finalizar_${clase.id_clase}`;
        
        if (this.notificacionesEnviadas.has(claveNotificacion)) {
          continue;
        }

        try {
          const fechaClaseStr = obtenerFechaISO(clase.fecha_clase);
          const horaFin = normalizarHora(clase.hora_fin);
          const finProgramado = crearDateTime(fechaClaseStr, horaFin);
          const minutosRestantes = Math.floor((finProgramado.getTime() - ahoraColombia.getTime()) / 60000);

          await createForUsers({
            userIds: [clase.id_instructor],
            titulo: minutosRestantes > 0 
              ? `Clase por finalizar en ${minutosRestantes} minuto(s)`
              : 'Es hora de finalizar tu clase',
            cuerpo: `La clase "${clase.nombre_clase}" en el ambiente ${clase.codigo_ambiente} (${clase.nombre_ambiente}) ${minutosRestantes > 0 ? `finaliza en ${minutosRestantes} minuto(s)` : 'debe finalizarse ahora'}.`,
            tipo: minutosRestantes > 0 ? 'aviso' : 'alerta',
            metadata: {
              id_clase: clase.id_clase,
              id_ambiente: clase.id_ambiente,
              tipo: 'clase_finalizar',
              hora_fin: horaFin,
              acciones: [
                {
                  tipo: 'finalizar_clase',
                  label: 'Finalizar Clase',
                  endpoint: `/api/clases/${clase.id_clase}/finalizar`,
                  metodo: 'POST'
                },
                {
                  tipo: 'cancelar_clase',
                  label: 'Cancelar Clase',
                  endpoint: `/api/clases/${clase.id_clase}/cancelar`,
                  metodo: 'POST'
                }
              ]
            },
            creadoPor: null
          });

          this.notificacionesEnviadas.add(claveNotificacion);
          resultado.notificaciones += 1;
          
          logger.info(`Notificación enviada: Clase ${clase.id_clase} por finalizar`, {
            id_clase: clase.id_clase,
            instructor: clase.instructor_nombre,
            minutos_restantes: minutosRestantes
          });
        } catch (err) {
          logger.error(`Error al enviar notificación para clase ${clase.id_clase}`, { error: err.message });
          resultado.errores.push({ id_clase: clase.id_clase, error: err.message });
        }
      }

      // 3. Limpiar notificaciones enviadas de clases que ya no aplican
      const clasesEnCursoIds = new Set(clasesEnCurso.map(c => c.id_clase));
      const clasesProgramadasIds = new Set(clasesProgramadas.map(c => c.id_clase));
      
      for (const clave of this.notificacionesEnviadas) {
        const matchIniciar = clave.match(/clase_iniciar_(\d+)/);
        const matchFinalizar = clave.match(/clase_finalizar_(\d+)/);
        
        if (matchIniciar && !clasesProgramadasIds.has(parseInt(matchIniciar[1]))) {
          this.notificacionesEnviadas.delete(clave);
        }
        if (matchFinalizar && !clasesEnCursoIds.has(parseInt(matchFinalizar[1]))) {
          this.notificacionesEnviadas.delete(clave);
        }
      }

      if (resultado.notificaciones > 0) {
        logger.info(`Monitoreo completado: ${resultado.notificaciones} notificación(es) enviada(s)`);
      }

      return resultado;
    } catch (error) {
      logger.error('Error en monitoreo de clases:', error);
      resultado.errores.push({ tipo: 'error_general', detalle: error.message });
      return resultado;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Verificar estado del scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalId ? this.intervalMinutes : null,
      isExecuting: this.isExecuting
    };
  }
}

// Singleton
const schedulerService = new SchedulerService();

export default schedulerService;

