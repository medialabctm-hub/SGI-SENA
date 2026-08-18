import { describe, expect, it } from '@jest/globals';

import { normalizarYValidarAprendiz } from '../../src/utils/aprendices.js';

describe('normalizarYValidarAprendiz()', () => {
  it('normaliza un practicante de jornada completa y conserva un horario de ocho horas', () => {
    const resultado = normalizarYValidarAprendiz({
      nombre: 'Ana',
      documento: '100',
      tipo_aprendiz: 'Practicante',
      jornada: 'Jornada completa',
      dias_semana: 'Lunes a Viernes',
      hora_inicio: '08:00',
      hora_fin: '16:00',
    });

    expect(resultado).toEqual(expect.objectContaining({
      error: null,
      datos: expect.objectContaining({
        tipo_aprendiz: 'Practicante',
        jornada: 'Completa',
        dias_semana: 'Lunes a Viernes',
        hora_inicio: '08:00',
        hora_fin: '16:00',
      }),
    }));
  });

  it('rechaza un aprendiz regular sin ficha', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Regular',
      jornada: 'Mañana',
    });

    expect(resultado.error).toMatch(/ficha/i);
  });

  it('rechaza una jornada no permitida para un aprendiz regular', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Regular',
      ficha: '2999999',
      jornada: 'Completa',
    });

    expect(resultado.error).toMatch(/mañana.*tarde.*noche/i);
  });

  it('rechaza un practicante con una duración menor a ocho horas', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Practicante',
      dias_semana: 'Lunes a Viernes',
      hora_inicio: '08:00',
      hora_fin: '15:59',
    });

    expect(resultado.error).toMatch(/ocho horas/i);
  });

  it('rechaza un practicante cuando una hora tiene un formato inválido', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Practicante',
      dias_semana: 'Lunes a Viernes',
      hora_inicio: '8am',
      hora_fin: '16:00',
    });

    expect(resultado.error).toMatch(/horas.*inicio.*fin/i);
  });

  it('rechaza un practicante cuya hora de fin es igual a la de inicio', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Practicante',
      dias_semana: 'Lunes a Viernes',
      hora_inicio: '08:00',
      hora_fin: '08:00',
    });

    expect(resultado.error).toMatch(/fin.*posterior/i);
  });

  it('rechaza un practicante cuya hora de fin es anterior a la de inicio', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Practicante',
      dias_semana: 'Lunes a Viernes',
      hora_inicio: '16:00',
      hora_fin: '08:00',
    });

    expect(resultado.error).toMatch(/fin.*posterior/i);
  });

  it('exige días y horas para un practicante', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Practicante',
      dias_semana: '',
      hora_inicio: '08:00',
      hora_fin: '16:00',
    });

    expect(resultado.error).toMatch(/días.*horas/i);
  });

  it('rechaza un practicante sin hora de inicio', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Practicante',
      dias_semana: 'Lunes a Viernes',
      hora_fin: '16:00',
    });

    expect(resultado.error).toMatch(/horas.*inicio.*fin/i);
  });

  it('rechaza un practicante sin hora de fin', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Practicante',
      dias_semana: 'Lunes a Viernes',
      hora_inicio: '08:00',
    });

    expect(resultado.error).toMatch(/horas.*inicio.*fin/i);
  });

  it('acepta un practicante con una jornada diaria de exactamente ocho horas', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Practicante',
      dias_semana: 'Lunes a Viernes',
      hora_inicio: '08:00',
      hora_fin: '16:00',
    });

    expect(resultado.error).toBeNull();
  });

  it('normaliza un semillero a jornada flexible y permite una duración menor a ocho horas', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Semillero',
      jornada: 'Mañana',
      dias_semana: 'Sábado',
      hora_inicio: '09:00',
      hora_fin: '12:00',
    });

    expect(resultado).toEqual(expect.objectContaining({
      error: null,
      datos: expect.objectContaining({
        tipo_aprendiz: 'Semillero',
        jornada: 'Flexible',
      }),
    }));
  });

  it('exige días y horas para un semillero', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Semillero',
      dias_semana: '',
      hora_inicio: '09:00',
    });

    expect(resultado.error).toMatch(/días.*horas/i);
  });

  it('rechaza un tipo de aprendiz no permitido', () => {
    const resultado = normalizarYValidarAprendiz({
      tipo_aprendiz: 'Visitante',
    });

    expect(resultado.error).toMatch(/tipo de aprendiz/i);
  });

  it('trata las filas de la plantilla anterior sin tipo como aprendices regulares', () => {
    const resultado = normalizarYValidarAprendiz({
      ficha: '2999999',
      jornada: 'Jornada mañana',
    });

    expect(resultado).toEqual(expect.objectContaining({
      error: null,
      datos: expect.objectContaining({
        tipo_aprendiz: 'Regular',
        jornada: 'Mañana',
      }),
    }));
  });
});
