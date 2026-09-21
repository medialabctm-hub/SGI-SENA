import { describe, it, expect } from '@jest/globals';
import {
  evidenceFilenameParamSchema,
  idImagenParamSchema,
  codigoEquipoParamSchema,
} from '../../src/validators/imagenesEquipoValidator.js';

describe('imagenesEquipoValidator', () => {
  it('acepta nombres de imagen seguros', () => {
    expect(evidenceFilenameParamSchema.parse({ filename: '1234-5-foto.jpg' }).filename)
      .toBe('1234-5-foto.jpg');
  });

  it.each([
    '../secret.jpg',
    '..\\secret.jpg',
    '/etc/passwd',
    'dir/secret.jpg',
    'payload.exe',
    'notes.txt',
    '',
  ])('rechaza filename inseguro o no-imagen: %s', (filename) => {
    expect(() => evidenceFilenameParamSchema.parse({ filename })).toThrow();
  });

  it('acepta idImagen y codigoEquipo numéricos', () => {
    expect(idImagenParamSchema.parse({ idImagen: '42' }).idImagen).toBe('42');
    expect(codigoEquipoParamSchema.parse({ codigoEquipo: '7' }).codigoEquipo).toBe('7');
  });

  it('rechaza idImagen / codigoEquipo no numéricos', () => {
    expect(() => idImagenParamSchema.parse({ idImagen: 'abc' })).toThrow();
    expect(() => codigoEquipoParamSchema.parse({ codigoEquipo: '../1' })).toThrow();
  });
});
