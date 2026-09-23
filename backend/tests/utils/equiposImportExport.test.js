import { describe, it, expect } from '@jest/globals';
import {
  EQUIPOS_PLANTILLA_COLUMNS,
  mapEquipoImportRow,
  buildEquipoExportRow,
  toSecureEquipoImageUrl,
} from '../../src/utils/equiposImportExport.js';
import { sanitizeExcelValue } from '../../src/utils/excelSecurity.js';

describe('equiposImportExport (MDL-210)', () => {
  it('plantilla has exact contract columns including url_imagen', () => {
    expect([...EQUIPOS_PLANTILLA_COLUMNS]).toEqual([
      'placa',
      'tipo',
      'categoria',
      'modelo',
      'consecutivo',
      'descripcion',
      'fecha_adquisicion',
      'valor_ingreso',
      'r_centro',
      'atributos',
      'ambiente',
      'url_imagen',
    ]);
  });

  it('maps plantilla columns 1:1', () => {
    const mapped = mapEquipoImportRow({
      placa: '92041025706',
      tipo: '4',
      categoria: 'ACCES POINT',
      modelo: 'TL-WA801N',
      consecutivo: '232938',
      descripcion: 'ACCES POINT',
      fecha_adquisicion: '2021-12-22',
      valor_ingreso: '126050',
      r_centro: '920510',
      atributos: 'MARCA:TP-LINK',
      ambiente: 'Sin Asignar',
      url_imagen: '/api/equipos/imagenes/archivo/abc123.jpg',
    });
    expect(mapped.placa).toBe('92041025706');
    expect(mapped.categoria).toBe('ACCES POINT');
    expect(mapped.url_imagen).toBe('/api/equipos/imagenes/archivo/abc123.jpg');
  });

  it('maps documented human aliases from legacy export', () => {
    const mapped = mapEquipoImportRow({
      'Código Inventario': 'P-1',
      Tipo: 'Laptop',
      Modelo: 'X1',
      Consecutivo: '9',
      'Fecha Adquisición': '2024-01-15',
      'Valor Ingreso': '1000',
      Ambiente: 'Lab 1',
      Descripción: 'Desc',
      Atributos: 'RAM:8',
      Categoría: 'PCs',
    });
    expect(mapped).toMatchObject({
      placa: 'P-1',
      tipo: 'Laptop',
      modelo: 'X1',
      consecutivo: '9',
      categoria: 'PCs',
      ambiente: 'Lab 1',
      descripcion: 'Desc',
      atributos: 'RAM:8',
      valor_ingreso: '1000',
    });
  });

  it('round-trip: export row keys match plantilla and reimport maps back', () => {
    const exported = buildEquipoExportRow({
      codigo_inventario: 'P-9',
      tipo: 'Camara',
      nombre_categoria: 'Video',
      modelo: 'M1',
      consecutivo: '1',
      descripcion: 'd',
      fecha_adquisicion: '2023-05-01T00:00:00.000Z',
      valor_ingreso: 500,
      r_centro: '920',
      specs_completas: '4K',
      nombre_ambiente: 'Studio',
      url_imagen: '/api/equipos/imagenes/archivo/foto1.png',
    });
    expect(Object.keys(exported)).toEqual([...EQUIPOS_PLANTILLA_COLUMNS]);
    expect(exported.placa).toBe('P-9');
    expect(exported.categoria).toBe('Video');
    expect(exported.fecha_adquisicion).toBe('2023-05-01');
    expect(exported.url_imagen).toBe('/api/equipos/imagenes/archivo/foto1.png');

    const remapped = mapEquipoImportRow(exported);
    expect(remapped.placa).toBe('P-9');
    expect(remapped.categoria).toBe('Video');
    expect(remapped.url_imagen).toBe('/api/equipos/imagenes/archivo/foto1.png');
  });

  it('never leaks public /uploads paths', () => {
    expect(toSecureEquipoImageUrl('/uploads/equipos/secret.jpg')).toBe(
      '/api/equipos/imagenes/archivo/secret.jpg'
    );
    expect(toSecureEquipoImageUrl('https://cdn.example/uploads/equipos/x.png')).toBe(
      '/api/equipos/imagenes/archivo/x.png'
    );
    const row = buildEquipoExportRow({
      placa: '1',
      ruta_imagen: '/uploads/equipos/evil.jpg',
    });
    expect(row.url_imagen).toBe('/api/equipos/imagenes/archivo/evil.jpg');
    expect(row.url_imagen).not.toMatch(/\/uploads\//);
    expect(JSON.stringify(row)).not.toMatch(/\/uploads\/equipos\//);
  });

  it('omits valor_ingreso when DTO stripped it (H-01)', () => {
    const row = buildEquipoExportRow({
      placa: '1',
      tipo: 't',
      // no valor_ingreso / costo → rol restringido
    });
    expect(row.valor_ingreso).toBe('');
  });

  it('formula sanitize works on export values', () => {
    expect(sanitizeExcelValue('=CMD()')).toMatch(/^'/);
    const row = buildEquipoExportRow({
      placa: '=1+1',
      tipo: '+hack',
      descripcion: 'safe',
    });
    // sanitize is applied at AOA layer; values themselves may still be raw here
    expect(sanitizeExcelValue(row.placa).startsWith("'") || sanitizeExcelValue(row.placa).includes("'=")).toBe(true);
  });

  it('rejects unsafe filenames for image URL', () => {
    expect(toSecureEquipoImageUrl('../etc/passwd')).toBe('');
    expect(toSecureEquipoImageUrl('/api/equipos/imagenes/archivo/../x')).toBe('');
  });
});
