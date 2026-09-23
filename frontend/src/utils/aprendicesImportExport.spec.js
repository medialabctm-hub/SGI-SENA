import { describe, it, expect } from 'vitest';
import {
  APRENDICES_PLANTILLA_COLUMNS,
  buildAprendicesExportAoa,
} from './aprendicesImportExport.js';
import { sanitizeExcelRow } from './excelSecurity.js';

describe('aprendicesImportExport FE (MDL-211)', () => {
  it('export headers match plantilla (no Registrado / Tipo de aprendiz drift)', () => {
    const aoa = buildAprendicesExportAoa(
      [
        {
          ficha: '1',
          nombre: 'A',
          documento: '9',
          tipo_documento: 'CC',
          jornada: 'Mañana',
          tipo_aprendiz: 'Regular',
        },
      ],
      sanitizeExcelRow
    );
    expect(aoa[0]).toEqual([...APRENDICES_PLANTILLA_COLUMNS]);
    expect(aoa[0]).not.toContain('Registrado');
    expect(aoa[0]).not.toContain('Tipo de aprendiz');
  });
});
