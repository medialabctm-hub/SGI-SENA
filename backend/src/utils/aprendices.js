const TIPOS_APRENDIZ = {
  regular: 'Regular',
  practicante: 'Practicante',
  semillero: 'Semillero',
};

const JORNADAS_REGULAR = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
};

function normalizarClave(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizarHora(valor) {
  const coincidencia = texto(valor).match(/^(\d{1,2}):(\d{2})$/);

  if (!coincidencia) return null;

  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) return null;

  return `${String(horas).padStart(2, '0')}:${coincidencia[2]}`;
}

function minutosDesdeMedianoche(hora) {
  const [horas, minutos] = hora.split(':').map(Number);
  return (horas * 60) + minutos;
}

function error(datos, mensaje) {
  return { datos, error: mensaje };
}

export function normalizarYValidarAprendiz(datos = {}) {
  const tipoClave = normalizarClave(datos.tipo_aprendiz || 'Regular');
  const tipoAprendiz = TIPOS_APRENDIZ[tipoClave];
  const normalizados = {
    ...datos,
    tipo_aprendiz: tipoAprendiz || texto(datos.tipo_aprendiz),
    ficha: texto(datos.ficha),
    dias_semana: texto(datos.dias_semana),
  };

  if (!tipoAprendiz) {
    return error(normalizados, 'El tipo de aprendiz debe ser Regular, Practicante o Semillero.');
  }

  if (tipoAprendiz === 'Regular') {
    if (!normalizados.ficha) {
      return error(normalizados, 'Un aprendiz regular debe tener ficha.');
    }

    const jornadaClave = normalizarClave(datos.jornada).replace(/^jornada\s+/, '');
    const jornada = JORNADAS_REGULAR[jornadaClave];
    normalizados.jornada = jornada || texto(datos.jornada);

    if (!jornada) {
      return error(normalizados, 'La jornada de un aprendiz regular debe ser Mañana, Tarde o Noche.');
    }

    return { datos: normalizados, error: null };
  }

  normalizados.jornada = tipoAprendiz === 'Practicante' ? 'Completa' : 'Flexible';
  normalizados.hora_inicio = normalizarHora(datos.hora_inicio);
  normalizados.hora_fin = normalizarHora(datos.hora_fin);

  if (!normalizados.dias_semana || !normalizados.hora_inicio || !normalizados.hora_fin) {
    return error(normalizados, 'Los días y las horas de inicio y fin son obligatorios.');
  }

  const inicio = minutosDesdeMedianoche(normalizados.hora_inicio);
  const fin = minutosDesdeMedianoche(normalizados.hora_fin);
  if (fin <= inicio) {
    return error(normalizados, 'La hora de fin debe ser posterior a la hora de inicio.');
  }

  if (tipoAprendiz === 'Practicante' && fin - inicio < 8 * 60) {
    return error(normalizados, 'Un practicante debe tener una duración diaria mínima de ocho horas.');
  }

  return { datos: normalizados, error: null };
}
