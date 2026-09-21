/**
 * MDL-189 / H-01 — DTO por rol
 */
import { describe, it, expect } from '@jest/globals';
import {
  toEquipoDto,
  toEquiposDtoList,
  rolPuedeVerDatosSensiblesEquipo,
} from '../../src/utils/equipoDto.js';

const sample = {
  codigo_equipo: 1,
  placa: 'X-1',
  valor_ingreso: 999,
  costo: 999,
  id_cuentadante: 5,
  cuentadante_principal: 'Secret',
  cuentadante_cedula: '100',
  nombre_ambiente: 'Lab',
};

describe('equipoDto (MDL-189 / H-01)', () => {
  it('Administrador y Cuentadante ven datos sensibles', () => {
    expect(rolPuedeVerDatosSensiblesEquipo('Administrador')).toBe(true);
    expect(rolPuedeVerDatosSensiblesEquipo('Cuentadante')).toBe(true);
    expect(toEquipoDto(sample, 'Administrador')).toHaveProperty('valor_ingreso', 999);
    expect(toEquipoDto(sample, 'Cuentadante')).toHaveProperty('id_cuentadante', 5);
  });

  it('Aprendiz no recibe valor ni PII de cuentadante', () => {
    const dto = toEquipoDto(sample, 'Aprendiz');
    expect(dto).not.toHaveProperty('valor_ingreso');
    expect(dto).not.toHaveProperty('costo');
    expect(dto).not.toHaveProperty('id_cuentadante');
    expect(dto).not.toHaveProperty('cuentadante_principal');
    expect(dto).not.toHaveProperty('cuentadante_cedula');
    expect(dto).toHaveProperty('placa', 'X-1');
    expect(dto).toHaveProperty('nombre_ambiente', 'Lab');
  });

  it('toEquiposDtoList aplica el strip a todos los ítems para Aprendiz', () => {
    const list = toEquiposDtoList([sample, { ...sample, codigo_equipo: 2 }], 'Aprendiz');
    expect(list).toHaveLength(2);
    list.forEach((e) => {
      expect(e).not.toHaveProperty('valor_ingreso');
      expect(e).not.toHaveProperty('costo');
    });
  });
});
