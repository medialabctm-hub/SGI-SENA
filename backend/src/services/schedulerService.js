import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import { createForUsers } from './notificationService.js';
import { getColombiaDateTimeString } from '../utils/timezone.js';

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
 * Servicio de AUTOMATIZACIÓN de gestión de horarios de clases
 * 
 * Este servicio AUTOMÁTICAMENTE:
 * - Inicia clases cuando llega la hora de inicio programada (con margen de ±2 minutos)
 * - Finaliza clases cuando pasa la hora de fin programada (con margen de ±2 minutos)
 * - Envía notificaciones de advertencia 5 minutos antes del inicio/fin
 * 
 * Los procedimientos almacenados utilizados son:
 * - sp_iniciar_clase() - Cambia estado a "En Curso" y asigna responsabilidades
 * - sp_finalizar_clase() - Cambia estado a "Finalizada" y cierra responsabilidades
 * 
 * ZONA HORARIA: Colombia (UTC-5) para todas las comparaciones y ejecuciones
 */
class SchedulerService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.isExecuting = false;
    this.intervalMinutes = 1;
    this._syncRetry = false; // Flag para reintento único ante ETIMEDOUT/ECONNREFUSED
    this.notificacionesEnviadas = new Set(); // Para evitar notificaciones duplicadas
    this.clasesIniciadas = new Set(); // Para evitar iniciar la misma clase múltiples veces en una ejecución
    this.clasesFinalizadas = new Set(); // Para evitar finalizar la misma clase múltiples veces en una ejecución
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
    logger.info(`Scheduler de automatización de clases iniciado. Ejecución cada ${intervalMinutes} minuto(s)`);
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
   * Ejecutar automatización de clases: iniciar y finalizar automáticamente según horarios
   * 
   * Este método:
   * - Inicia automáticamente clases programadas cuando llega la hora de inicio (margen ±2 min)
   * - Finaliza automáticamente clases en curso cuando pasa la hora de fin (margen ±2 min)
   * - Envía notificaciones de advertencia 5 minutos antes del inicio/fin
   * 
   * Zona horaria: Colombia (UTC-5) para todas las comparaciones y ejecuciones
   */
  async executeSync() {
    if (this.isExecuting) {
      logger.warn('Automatización en progreso. Se omite ejecución concurrente.');
      return { 
        notificaciones: 0, 
        clasesIniciadas: 0, 
        clasesFinalizadas: 0,
        errores: [{ tipo: 'concurrencia', detalle: 'Ejecución ya en curso' }] 
      };
    }

    this.isExecuting = true;
    // Limpiar sets de clases procesadas para esta ejecución
    this.clasesIniciadas.clear();
    this.clasesFinalizadas.clear();
    
    const resultado = { 
      notificaciones: 0, 
      clasesIniciadas: 0, 
      clasesFinalizadas: 0,
      errores: [] 
    };

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

      // Separar clases para consentimiento (3-5 min antes) y para inicio automático (hora exacta ±2 min)
      const clasesParaConsentimiento = [];
      const clasesParaIniciarAuto = [];
      
      clasesProgramadas.forEach((clase) => {
        const fechaClaseStr = obtenerFechaISO(clase.fecha_clase);
        const horaInicio = normalizarHora(clase.hora_inicio);
        const inicioProgramado = crearDateTime(fechaClaseStr, horaInicio);
        
        // Margen para inicio automático: ±2 minutos
        const margenInicio = 2 * 60000; // 2 minutos en milisegundos
        const tiempoInicioMin = new Date(inicioProgramado.getTime() - margenInicio);
        const tiempoInicioMax = new Date(inicioProgramado.getTime() + margenInicio);
        
        // Consentimiento: 3-5 minutos antes de la hora de inicio
        const minutosConsentimientoMin = 3;
        const minutosConsentimientoMax = 5;
        const tiempoConsentimientoMin = new Date(inicioProgramado.getTime() - (minutosConsentimientoMax * 60000));
        const tiempoConsentimientoMax = new Date(inicioProgramado.getTime() - (minutosConsentimientoMin * 60000));
        
        // Si está en el rango de inicio automático (y ya pasó el tiempo de consentimiento)
        if (ahoraColombia >= tiempoInicioMin && ahoraColombia <= tiempoInicioMax) {
          clasesParaIniciarAuto.push(clase);
        }
        
        // Si está en el rango de consentimiento (3-5 minutos antes)
        if (ahoraColombia >= tiempoConsentimientoMin && ahoraColombia <= tiempoConsentimientoMax) {
          clasesParaConsentimiento.push(clase);
        }
      });

      // ENVIAR NOTIFICACIONES DE CONSENTIMIENTO (3-5 minutos antes)
      for (const clase of clasesParaConsentimiento) {
        const claveConsentimiento = `consentimiento_${clase.id_clase}`;
        
        // Evitar enviar múltiples notificaciones de consentimiento
        if (this.notificacionesEnviadas.has(claveConsentimiento)) {
          continue;
        }

        try {
          const fechaClaseStr = obtenerFechaISO(clase.fecha_clase);
          const horaInicio = normalizarHora(clase.hora_inicio);
          const inicioProgramado = crearDateTime(fechaClaseStr, horaInicio);
          const minutosRestantes = Math.floor((inicioProgramado.getTime() - ahoraColombia.getTime()) / 60000);

          await createForUsers({
            userIds: [clase.id_instructor],
            titulo: 'Consentimiento para iniciar clase',
            cuerpo: `¿Seguro que desea convertirse en CUENTADANTE TEMPORAL del inventario correspondiente al Ambiente ${clase.codigo_ambiente} (${clase.nombre_ambiente})?`,
            tipo: 'alerta',
            metadata: {
              id_clase: clase.id_clase,
              id_ambiente: clase.id_ambiente,
              tipo: 'consentimiento_inicio',
              hora_inicio: horaInicio,
              minutos_restantes: minutosRestantes,
              acciones: [
                {
                  tipo: 'aceptar_consentimiento',
                  label: 'Aceptar',
                  endpoint: `/api/clases/${clase.id_clase}/consentimiento/aceptar`,
                  metodo: 'POST'
                },
                {
                  tipo: 'rechazar_consentimiento',
                  label: 'Rechazar',
                  endpoint: `/api/clases/${clase.id_clase}/consentimiento/rechazar`,
                  metodo: 'POST'
                }
              ]
            },
            creadoPor: null
          });

          this.notificacionesEnviadas.add(claveConsentimiento);
          resultado.notificaciones += 1;
          
          logger.info(`📋 Notificación de consentimiento enviada: Clase ${clase.id_clase}`, {
            id_clase: clase.id_clase,
            instructor: clase.instructor_nombre,
            minutos_restantes: minutosRestantes
          });
        } catch (err) {
          logger.error(`Error al enviar notificación de consentimiento para clase ${clase.id_clase}`, { error: err.message });
          resultado.errores.push({ id_clase: clase.id_clase, error: err.message });
        }
      }

      // AUTOMATIZACIÓN: Iniciar clases automáticamente (solo si ya pasó el tiempo de consentimiento)
      // Esto solo ocurre si el instructor no respondió al consentimiento
      for (const clase of clasesParaIniciarAuto) {
        // Verificar si ya se envió consentimiento (si pasó el tiempo de consentimiento sin respuesta, iniciar automáticamente)
        const claveConsentimiento = `consentimiento_${clase.id_clase}`;
        const yaEnviadoConsentimiento = this.notificacionesEnviadas.has(claveConsentimiento);
        
        // Si ya se envió consentimiento, no iniciar automáticamente (esperar respuesta)
        if (yaEnviadoConsentimiento) {
          continue;
        }
        
        // Evitar iniciar la misma clase múltiples veces
        if (this.clasesIniciadas.has(clase.id_clase)) {
          continue;
        }

        try {
          const fechaInicio = getColombiaDateTimeString();
          
          logger.info(`🟢 AUTOMATIZACIÓN: Iniciando clase ${clase.id_clase} automáticamente (sin consentimiento previo)`, {
            id_clase: clase.id_clase,
            nombre_clase: clase.nombre_clase,
            instructor: clase.instructor_nombre,
            ambiente: clase.codigo_ambiente,
            fecha_inicio: fechaInicio,
            hora_programada: clase.hora_inicio
          });

          // Ejecutar procedimiento almacenado para iniciar la clase
          await defaultDb.execute(
            'CALL sp_iniciar_clase(?, ?)',
            [clase.id_clase, fechaInicio]
          );

          this.clasesIniciadas.add(clase.id_clase);
          resultado.clasesIniciadas += 1;
          
          // Emitir evento WebSocket para actualización en tiempo real
          try {
            const socketService = (await import('./socketService.js')).default;
            socketService.emitToAll('clase:updated', {
              id_clase: clase.id_clase,
              estado_clase: 'En Curso',
              action: 'auto_started',
              timestamp: new Date().toISOString(),
            });
          } catch (socketErr) {
            logger.warn('Error al emitir evento Socket.io', { error: socketErr.message });
          }
          
          logger.info(`✅ Clase ${clase.id_clase} iniciada automáticamente`, {
            id_clase: clase.id_clase,
            instructor: clase.instructor_nombre
          });
        } catch (err) {
          logger.error(`❌ Error al iniciar automáticamente la clase ${clase.id_clase}`, { 
            id_clase: clase.id_clase, 
            error: err.message,
            stack: err.stack 
          });
          resultado.errores.push({ 
            tipo: 'inicio_automatico', 
            id_clase: clase.id_clase, 
            error: err.message 
          });
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

      // Clases para finalización automática (solo después de la hora de fin)
      const clasesParaFinalizarAuto = [];
      
      clasesEnCurso.forEach((clase) => {
        const fechaClaseStr = obtenerFechaISO(clase.fecha_clase);
        const horaFin = normalizarHora(clase.hora_fin);
        const finProgramado = crearDateTime(fechaClaseStr, horaFin);

        // Margen para finalización automática: solo DESPUÉS de la hora de fin (no antes)
        // La clase debe finalizarse cuando haya pasado la hora de fin, con un margen de 2 minutos después
        const margenFin = 2 * 60000; // 2 minutos en milisegundos
        const tiempoFinMin = finProgramado; // No permitir finalizar antes de la hora programada
        const tiempoFinMax = new Date(finProgramado.getTime() + margenFin); // Permitir hasta 2 minutos después
        
        // Si está en el rango de finalización automática (después de la hora de fin)
        if (ahoraColombia >= tiempoFinMin && ahoraColombia <= tiempoFinMax) {
          clasesParaFinalizarAuto.push(clase);
        }
      });

      // AUTOMATIZACIÓN: Finalizar clases automáticamente
      for (const clase of clasesParaFinalizarAuto) {
        // Evitar finalizar la misma clase múltiples veces
        if (this.clasesFinalizadas.has(clase.id_clase)) {
          continue;
        }

        try {
          const fechaFin = getColombiaDateTimeString();
          
          logger.info(`🔴 AUTOMATIZACIÓN: Finalizando clase ${clase.id_clase} automáticamente`, {
            id_clase: clase.id_clase,
            nombre_clase: clase.nombre_clase,
            instructor: clase.instructor_nombre,
            ambiente: clase.codigo_ambiente,
            fecha_fin: fechaFin,
            hora_programada: clase.hora_fin
          });

          // Ejecutar procedimiento almacenado para finalizar la clase
          await defaultDb.execute(
            'CALL sp_finalizar_clase(?, ?)',
            [clase.id_clase, fechaFin]
          );

          this.clasesFinalizadas.add(clase.id_clase);
          resultado.clasesFinalizadas += 1;
          
          // Emitir evento WebSocket para actualización en tiempo real
          try {
            const socketService = (await import('./socketService.js')).default;
            socketService.emitToAll('clase:updated', {
              id_clase: clase.id_clase,
              estado_clase: 'Finalizada',
              action: 'auto_finished',
              timestamp: new Date().toISOString(),
            });
          } catch (socketErr) {
            logger.warn('Error al emitir evento Socket.io', { error: socketErr.message });
          }
          
          logger.info(`✅ Clase ${clase.id_clase} finalizada automáticamente`, {
            id_clase: clase.id_clase,
            instructor: clase.instructor_nombre
          });
        } catch (err) {
          logger.error(`❌ Error al finalizar automáticamente la clase ${clase.id_clase}`, { 
            id_clase: clase.id_clase, 
            error: err.message,
            stack: err.stack 
          });
          resultado.errores.push({ 
            tipo: 'finalizacion_automatica', 
            id_clase: clase.id_clase, 
            error: err.message 
          });
        }
      }

      // Notificaciones de finalización eliminadas - las clases se finalizan automáticamente sin notificaciones
      // Solo se envían notificaciones de consentimiento para el inicio de clases

      // 3. Limpiar notificaciones enviadas de clases que ya no aplican
      const clasesProgramadasIds = new Set(clasesProgramadas.map(c => c.id_clase));
      
      for (const clave of this.notificacionesEnviadas) {
        const matchConsentimiento = clave.match(/consentimiento_(\d+)/);
        
        // Limpiar notificaciones de consentimiento de clases que ya no están programadas
        if (matchConsentimiento && !clasesProgramadasIds.has(parseInt(matchConsentimiento[1]))) {
          this.notificacionesEnviadas.delete(clave);
        }
      }

      // Log resumen de la ejecución
      if (resultado.clasesIniciadas > 0 || resultado.clasesFinalizadas > 0 || resultado.notificaciones > 0) {
        logger.info(`Automatización completada`, {
          clases_iniciadas: resultado.clasesIniciadas,
          clases_finalizadas: resultado.clasesFinalizadas,
          notificaciones: resultado.notificaciones
        });
      }

      return resultado;
    } catch (error) {
      // Reintento único ante fallos transitorios de conexión a BD (p. ej. tras reinicio de MySQL)
      const esErrorConexion = error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';
      if (!this._syncRetry && esErrorConexion) {
        logger.warn('Error de conexión a BD en monitoreo de clases, reintentando en 3s...', { code: error.code });
        this.isExecuting = false;
        await new Promise((r) => setTimeout(r, 3000));
        this._syncRetry = true;
        return this.executeSync();
      }
      this._syncRetry = false;
      logger.error('Error en monitoreo de clases:', error);
      resultado.errores.push({ tipo: 'error_general', detalle: error.message });
      return resultado;
    } finally {
      this.isExecuting = false;
      this._syncRetry = false;
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

