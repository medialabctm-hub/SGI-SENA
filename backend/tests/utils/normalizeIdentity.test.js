import { describe, it, expect } from '@jest/globals';
import {
  normalizeCedula,
  normalizeCorreo,
  normalizeIdentity,
} from '../../src/utils/normalizeIdentity.js';

describe('normalizeIdentity', () => {
  const cedulaCases = [
    { input: null, expected: '' },
    { input: undefined, expected: '' },
    { input: '123456', expected: '123456' },
    { input: ' 123456 ', expected: '123456' },
    { input: '  12 3456  ', expected: '12 3456' },
    { input: 123456, expected: '123456' },
  ];

  const correoCases = [
    { input: null, expected: '' },
    { input: undefined, expected: '' },
    { input: 'a@sena.edu.co', expected: 'a@sena.edu.co' },
    { input: ' A@Sena.Edu.Co ', expected: 'a@sena.edu.co' },
    { input: 'User@SENA.EDU.CO', expected: 'user@sena.edu.co' },
    { input: '  mixed.Case@Example.COM  ', expected: 'mixed.case@example.com' },
  ];

  it.each(cedulaCases)('normalizeCedula($input) → $expected', ({ input, expected }) => {
    expect(normalizeCedula(input)).toBe(expected);
  });

  it.each(correoCases)('normalizeCorreo($input) → $expected', ({ input, expected }) => {
    expect(normalizeCorreo(input)).toBe(expected);
  });

  it('normalizeIdentity combina ambos campos', () => {
    expect(normalizeIdentity({
      cedula: ' 999 ',
      correo: ' X@Y.COM ',
    })).toEqual({ cedula: '999', correo: 'x@y.com' });
  });
});
