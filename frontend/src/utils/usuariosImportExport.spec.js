import { describe, it, expect } from 'vitest';
import {
  USUARIOS_PLANTILLA_COLUMNS,
  buildUsuarioExportRow,
  buildUsuariosExportAoa,
} from './usuariosImportExport.js';
import { sanitizeExcelRow } from './excelSecurity.js';

describe('usuariosImportExport FE (MDL-211)', () => {
  it('export AOA headers match plantilla exactly (no title row)', () => {
    const aoa = buildUsuariosExportAoa(
      [
        {
          nombre_usuario: 'Ana',
          cedula: '1',
          tipo_documento: 'CC',
          nombre_rol: 'Aprendiz',
          estado: 'Activo',
        },
      ],
      sanitizeExcelRow
    );
    expect(aoa[0]).toEqual([...USUARIOS_PLANTILLA_COLUMNS]);
    expect(aoa[0].some((h) => /^(LISTADO|Documento|Nombre Completo)$/i.test(h))).toBe(false);
    expect(aoa).toHaveLength(2);
  });

  it('sanitizes formula cells on export', () => {
    const row = buildUsuarioExportRow({
      nombre_usuario: '=1+1',
      cedula: '1',
      nombre_rol: 'Aprendiz',
      estado: 'Activo',
    });
    const aoa = buildUsuariosExportAoa([row], sanitizeExcelRow);
    expect(aoa[1][0]).toBe("'=1+1");
  });
});
