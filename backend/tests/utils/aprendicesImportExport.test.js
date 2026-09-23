import { describe, it, expect } from '@jest/globals';
import {
  APRENDICES_PLANTILLA_COLUMNS,
  mapAprendizImportRow,
  buildAprendizExportRow,
} from '../../src/utils/aprendicesImportExport.js';

describe('aprendicesImportExport (MDL-211)', () => {
  it('plantilla columns are the export contract', () => {
    expect([...APRENDICES_PLANTILLA_COLUMNS]).toEqual([
      'Ficha',
      'Nombre',
      'Documento',
      'Tipo Documento',
      'Tipo Documento Otro',
      'Jornada',
      'Tipo Aprendiz',
      'Días',
      'Hora Inicio',
      'Hora Fin',
    ]);
  });

  it('maps legacy "Tipo de aprendiz" alias', () => {
    const mapped = mapAprendizImportRow({
      Nombre: 'Juan',
      Documento: '101',
      'Tipo de aprendiz': 'Practicante',
      Ficha: '-',
      Jornada: 'Completa',
      Días: 'Lunes a Viernes',
      'Hora Inicio': '08:00',
      'Hora Fin': '16:00',
    });
    expect(mapped['Tipo Aprendiz']).toBe('Practicante');
    expect(mapped.Documento).toBe('101');
  });

  it('export → import round-trip keeps documento/ficha/tipo', () => {
    const exported = buildAprendizExportRow({
      ficha: '2478901',
      nombre: 'María',
      documento: '1090',
      tipo_documento: 'TI',
      tipo_documento_otro: null,
      jornada: 'Mañana',
      tipo_aprendiz: 'Regular',
      dias_semana: null,
      hora_inicio: null,
      hora_fin: null,
    });
    expect(Object.keys(exported)).toEqual([...APRENDICES_PLANTILLA_COLUMNS]);
    expect(exported).not.toHaveProperty('Registrado');

    const mapped = mapAprendizImportRow(exported);
    expect(mapped.Documento).toBe('1090');
    expect(mapped.Ficha).toBe('2478901');
    expect(mapped['Tipo Aprendiz']).toBe('Regular');
    expect(mapped.Jornada).toBe('Mañana');
  });
});
