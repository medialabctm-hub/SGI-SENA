import { describe, it, expect } from '@jest/globals';
import {
  sanitizeExcelValue,
  sanitizeExcelRow,
  assertWorkbookLimits,
  decodeRef,
  sheetToSanitizedObjects,
  EXCEL_STRUCTURAL_LIMITS,
} from '../../src/utils/excelSecurity.js';

describe('excelSecurity (MDL-211)', () => {
  describe('sanitizeExcelValue', () => {
    it.each(['=1+1', '+1234', '-SUM(A1)', '@cmd', '  =CMD()'])(
      'prefixes dangerous value %j',
      (raw) => {
        const out = sanitizeExcelValue(raw);
        expect(String(out).trimStart().startsWith("'")).toBe(true);
      }
    );

    it('leaves safe strings and numbers alone', () => {
      expect(sanitizeExcelValue('Juan')).toBe('Juan');
      expect(sanitizeExcelValue(42)).toBe(42);
      expect(sanitizeExcelValue(null)).toBe(null);
      expect(sanitizeExcelValue('hola=mundo')).toBe('hola=mundo');
    });
  });

  describe('assertWorkbookLimits', () => {
    it('rejects too many sheets', () => {
      const names = Array.from({ length: EXCEL_STRUCTURAL_LIMITS.maxSheets + 1 }, (_, i) => `S${i}`);
      const sheets = Object.fromEntries(names.map((n) => [n, { '!ref': 'A1:B2' }]));
      expect(() => assertWorkbookLimits({ SheetNames: names, Sheets: sheets })).toThrow(/hojas/i);
    });

    it('rejects oversized sheet', () => {
      expect(() =>
        assertWorkbookLimits({
          SheetNames: ['Big'],
          Sheets: { Big: { '!ref': 'A1:A50001' } },
        })
      ).toThrow(/filas/i);
    });

    it('accepts normal workbook', () => {
      expect(() =>
        assertWorkbookLimits({
          SheetNames: ['Ok'],
          Sheets: { Ok: { '!ref': 'A1:H100' } },
        })
      ).not.toThrow();
    });
  });

  it('decodeRef parses A1 ranges', () => {
    expect(decodeRef('A1:H10')).toEqual({ s: { c: 0, r: 0 }, e: { c: 7, r: 9 } });
  });

  it('sheetToSanitizedObjects skips title row and sanitizes', () => {
    const XLSX = {
      utils: {
        sheet_to_json: () => [
          ['LISTADO DE USUARIOS - SENA'],
          ['nombre_usuario', 'cedula', 'rol'],
          ['=HACK()', '123', 'Aprendiz'],
        ],
      },
    };
    const { rows, headerRowIndex } = sheetToSanitizedObjects(
      {},
      XLSX,
      ['nombre_usuario', 'cedula', 'rol']
    );
    expect(headerRowIndex).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].nombre_usuario).toBe("'=HACK()");
    expect(rows[0].cedula).toBe('123');
  });
});
