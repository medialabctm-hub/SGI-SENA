import { describe, it, expect } from '@jest/globals';
import {
  maskCedula,
  maskCorreo,
  getImportMaxRows,
  IMPORT_MAX_ROWS_DEFAULT,
  IMPORT_MAX_ROWS_CEILING,
} from '../../src/utils/maskPii.js';

describe('maskCedula (MDL-192)', () => {
  it('muestra solo los últimos 4 como ***1234', () => {
    expect(maskCedula('1234567890')).toBe('***7890');
    expect(maskCedula('ABCD1234')).toBe('***1234');
  });

  it('tolera cortos / vacíos', () => {
    expect(maskCedula('12')).toBe('***12');
    expect(maskCedula('')).toBe('N/A');
    expect(maskCedula(null)).toBe('N/A');
    expect(maskCedula('N/A')).toBe('N/A');
  });
});

describe('maskCorreo (MDL-192)', () => {
  it('enmascara local-part', () => {
    expect(maskCorreo('usuario@sena.edu.co')).toBe('u***@sena.edu.co');
  });

  it('tolera inválidos', () => {
    expect(maskCorreo(null)).toBeUndefined();
    expect(maskCorreo('sin-arroba')).toBe('***');
  });
});

describe('getImportMaxRows (MDL-192)', () => {
  it('default 5000', () => {
    expect(getImportMaxRows({})).toBe(IMPORT_MAX_ROWS_DEFAULT);
    expect(getImportMaxRows({ IMPORT_MAX_ROWS: '' })).toBe(5000);
  });

  it('respeta override válido bajo el techo', () => {
    expect(getImportMaxRows({ IMPORT_MAX_ROWS: '100' })).toBe(100);
    expect(getImportMaxRows({ IMPORT_MAX_ROWS: '8000' })).toBe(8000);
  });

  it('aplica techo duro 10000 (env 50000 → 10000)', () => {
    expect(IMPORT_MAX_ROWS_CEILING).toBe(10000);
    expect(getImportMaxRows({ IMPORT_MAX_ROWS: '50000' })).toBe(10000);
  });

  it('inválido o ≤0 cae al default', () => {
    expect(getImportMaxRows({ IMPORT_MAX_ROWS: '0' })).toBe(5000);
    expect(getImportMaxRows({ IMPORT_MAX_ROWS: '-3' })).toBe(5000);
    expect(getImportMaxRows({ IMPORT_MAX_ROWS: 'abc' })).toBe(5000);
  });
});
