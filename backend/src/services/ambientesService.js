/**
 * AmbientesService - Servicio de gestión de ambientes
 * 
 * Patrón: Service Layer
 * Principio: Dependency Inversion Principle (DIP), Single Responsibility Principle (SRP)
 * 
 * Contiene la lógica de negocio para ambientes, incluyendo:
 * - Validación de asignaciones
 * - Expansión de asignaciones con rango de fechas y días de la semana
 * - Generación de asignaciones automáticas
 */

/**
 * Expande una asignación de ambiente basada en rango de fechas y días de la semana
 * 
 * @param {Date} fechaInicio - Fecha de inicio del rango
 * @param {Date} fechaFin - Fecha de fin del rango
 * @param {number[]} diasSemana - Array con días (0=domingo, 1=lunes, ..., 6=sábado)
 * @param {string} horaInicio - Hora de inicio (HH:mm)
 * @param {string} horaFin - Hora de fin (HH:mm)
 * @returns {Array} Array de objetos con las asignaciones expandidas
 */
export function expandirAsignacionesPorFechas(fechaInicio, fechaFin, diasSemana, horaInicio, horaFin) {
  const asignaciones = [];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  // Normalizar fechas a medianoche en zona local
  inicio.setHours(0, 0, 0, 0);
  fin.setHours(23, 59, 59, 999);

  // Iterar por cada día en el rango
  const diaActual = new Date(inicio);
  while (diaActual <= fin) {
    const diaSemana = diaActual.getDay(); // 0=domingo, 1=lunes, etc.

    // Si el día está en la lista de días seleccionados
    if (diasSemana.includes(diaSemana)) {
      asignaciones.push({
        fecha_asignacion: new Date(diaActual),
        dia_semana: diaSemana,
        nombre_dia: obtenerNombreDia(diaSemana),
        hora_inicio: horaInicio,
        hora_fin: horaFin
      });
    }

    // Avanzar al siguiente día
    diaActual.setDate(diaActual.getDate() + 1);
  }

  return asignaciones;
}

/**
 * Obtiene el nombre del día de la semana en español
 * @param {number} diaSemana - Número del día (0=domingo, 1=lunes, etc.)
 * @returns {string} Nombre del día en español
 */
export function obtenerNombreDia(diaSemana) {
  const dias = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado'
  ];
  return dias[diaSemana] || 'Desconocido';
}

/**
 * Convierte un array de nombres de días a sus números
 * @param {string[]} nombresDias - Array con nombres en español (Lunes, Martes, etc.)
 * @returns {number[]} Array con números de días (1=lunes, 2=martes, etc.)
 */
export function convertirNombresDiasANumeros(nombresDias) {
  const mapaoDias = {
    'Lunes': 1,
    'Martes': 2,
    'Miércoles': 3,
    'Jueves': 4,
    'Viernes': 5,
    'Sábado': 6,
    'Domingo': 0
  };

  return nombresDias
    .map(nombre => mapaoDias[nombre])
    .filter(dia => dia !== undefined);
}

/**
 * Valida que el rango de horas sea válido
 * @param {string} horaInicio - Hora de inicio (HH:mm)
 * @param {string} horaFin - Hora de fin (HH:mm)
 * @returns {object} {valid: boolean, error?: string}
 */
export function validarRangoHoras(horaInicio, horaFin) {
  // Validar formato HH:mm
  const regexHora = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

  if (!regexHora.test(horaInicio)) {
    return { valid: false, error: 'Hora inicio inválida. Formato: HH:mm' };
  }

  if (!regexHora.test(horaFin)) {
    return { valid: false, error: 'Hora fin inválida. Formato: HH:mm' };
  }

  // Comparar horas
  const [horaI, minutoI] = horaInicio.split(':').map(Number);
  const [horaF, minutoF] = horaFin.split(':').map(Number);

  const tiempoInicio = horaI * 60 + minutoI;
  const tiempoFin = horaF * 60 + minutoF;

  if (tiempoInicio >= tiempoFin) {
    return { valid: false, error: 'Hora fin debe ser posterior a hora inicio' };
  }

  return { valid: true };
}

/**
 * Valida que el rango de fechas sea válido
 * @param {string|Date} fechaInicio - Fecha de inicio
 * @param {string|Date} fechaFin - Fecha de fin
 * @returns {object} {valid: boolean, error?: string}
 */
export function validarRangoFechas(fechaInicio, fechaFin) {
  try {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    // Validar que sean fechas válidas
    if (isNaN(inicio.getTime())) {
      return { valid: false, error: 'Fecha inicio inválida' };
    }

    if (isNaN(fin.getTime())) {
      return { valid: false, error: 'Fecha fin inválida' };
    }

    // Normalizar a medianoche
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(23, 59, 59, 999);

    if (inicio > fin) {
      return { valid: false, error: 'Fecha fin debe ser posterior a fecha inicio' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Error al validar fechas' };
  }
}

/**
 * Calcula el número de asignaciones que se generarían
 * @param {string|Date} fechaInicio - Fecha de inicio
 * @param {string|Date} fechaFin - Fecha de fin
 * @param {number[]} diasSemana - Array de números de días
 * @returns {number} Cantidad de asignaciones
 */
export function calcularCantidadAsignaciones(fechaInicio, fechaFin, diasSemana) {
  if (!Array.isArray(diasSemana) || diasSemana.length === 0) {
    return 0;
  }

  const asignaciones = expandirAsignacionesPorFechas(fechaInicio, fechaFin, diasSemana, '00:00', '23:59');
  return asignaciones.length;
}
