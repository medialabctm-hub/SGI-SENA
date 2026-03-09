/**
 * Tests para utils/timezone
 *
 * Cubre: getColombiaDateTimeString, toColombiaDateTimeString,
 *        getColombiaDateString y la constante COLOMBIA_OFFSET_MS
 */

import { describe, it, expect } from '@jest/globals';
import {
  getColombiaDateTimeString,
  toColombiaDateTimeString,
  getColombiaDateString,
} from '../../src/utils/timezone.js';

// ──────────────────────────────────────────────
// Offset Colombia (verificado indirectamente)
// ──────────────────────────────────────────────
describe('Offset Colombia (UTC-5)', () => {
  it('UTC 10:00 debe ser 05:00 en Colombia', () => {
    const date = new Date('2024-01-01T10:00:00Z');
    const result = getColombiaDateTimeString(date);
    expect(result).toBe('2024-01-01 05:00:00');
  });
});

// ──────────────────────────────────────────────
// getColombiaDateTimeString
// ──────────────────────────────────────────────
describe('getColombiaDateTimeString()', () => {
  it('debe retornar formato YYYY-MM-DD HH:mm:ss', () => {
    const date = new Date('2024-06-15T10:30:45Z'); // UTC 10:30:45 → COL 05:30:45
    const result = getColombiaDateTimeString(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('debe aplicar el offset Colombia (UTC-5)', () => {
    // UTC 10:00:00 → Colombia 05:00:00
    const date = new Date('2024-01-01T10:00:00Z');
    const result = getColombiaDateTimeString(date);
    expect(result).toBe('2024-01-01 05:00:00');
  });

  it('debe ajustar el día cuando la hora UTC cruza medianoche hacia atrás', () => {
    // UTC 02:00:00 → Colombia 21:00:00 del día anterior
    const date = new Date('2024-03-10T02:00:00Z');
    const result = getColombiaDateTimeString(date);
    expect(result).toBe('2024-03-09 21:00:00');
  });

  it('debe retornar la hora con segundos en 00 si son cero', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const result = getColombiaDateTimeString(date);
    expect(result).toMatch(/:00:00$/);
  });

  it('debe rellenar con ceros los valores menores a 10', () => {
    // UTC 05:05:05 → COL 00:05:05
    const date = new Date('2024-01-01T05:05:05Z');
    const result = getColombiaDateTimeString(date);
    expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:05:05$/);
  });

  it('sin argumento, usa new Date() y devuelve una cadena con formato correcto', () => {
    const result = getColombiaDateTimeString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('debe respetar un timestamp concreto con minutos no cero', () => {
    // UTC 15:45:30 → COL 10:45:30
    const date = new Date('2025-07-20T15:45:30Z');
    const result = getColombiaDateTimeString(date);
    expect(result).toBe('2025-07-20 10:45:30');
  });
});

// ──────────────────────────────────────────────
// toColombiaDateTimeString
// ──────────────────────────────────────────────
describe('toColombiaDateTimeString()', () => {
  it('debe convertir un objeto Date a string Colombia', () => {
    const date = new Date('2024-01-01T10:00:00Z');
    const result = toColombiaDateTimeString(date);
    expect(result).toBe('2024-01-01 05:00:00');
  });

  it('debe convertir un string ISO válido a string Colombia', () => {
    const result = toColombiaDateTimeString('2024-01-01T10:00:00Z');
    expect(result).toBe('2024-01-01 05:00:00');
  });

  it('debe retornar null para fecha inválida (string no parseable)', () => {
    const result = toColombiaDateTimeString('no-es-fecha');
    expect(result).toBeNull();
  });

  it('debe retornar null para null', () => {
    const result = toColombiaDateTimeString(null);
    expect(result).toBeNull();
  });

  it('debe retornar null para undefined', () => {
    const result = toColombiaDateTimeString(undefined);
    expect(result).toBeNull();
  });

  it('debe retornar null para NaN', () => {
    const result = toColombiaDateTimeString(NaN);
    expect(result).toBeNull();
  });

  it('debe retornar null si getTime() lanza excepción [catch line 42]', () => {
    const badDate = { getTime: () => { throw new Error('fecha inválida'); } };
    const result = toColombiaDateTimeString(badDate);
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────
// getColombiaDateString
// ──────────────────────────────────────────────
describe('getColombiaDateString()', () => {
  it('debe retornar formato YYYY-MM-DD', () => {
    const date = new Date('2024-06-15T10:00:00Z');
    const result = getColombiaDateString(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('debe retornar la fecha Colombia correcta', () => {
    const date = new Date('2024-01-01T10:00:00Z'); // UTC → COL 05:00 → mismo día
    expect(getColombiaDateString(date)).toBe('2024-01-01');
  });

  it('debe ajustar la fecha cuando UTC es madrugada (día anterior en Colombia)', () => {
    // UTC 02:00 → COL 21:00 del día anterior
    const date = new Date('2024-03-10T02:00:00Z');
    expect(getColombiaDateString(date)).toBe('2024-03-09');
  });

  it('sin argumento, usa new Date() y devuelve formato correcto', () => {
    const result = getColombiaDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
