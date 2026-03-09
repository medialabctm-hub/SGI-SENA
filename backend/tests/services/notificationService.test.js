/**
 * Tests para notificationService
 * Cubre normalizeNotificationType (funcion pura, sin BD)
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizeNotificationType,
} from '../../src/services/notificationService.js';

describe('notificationService', () => {
  // ------------------------------------------------------------------
  // normalizeNotificationType
  // ------------------------------------------------------------------
  describe('normalizeNotificationType', () => {
    it('debe normalizar tipos validos', () => {
      expect(normalizeNotificationType('info')).toBe('info');
      expect(normalizeNotificationType('aviso')).toBe('aviso');
      expect(normalizeNotificationType('alerta')).toBe('alerta');
      expect(normalizeNotificationType('critica')).toBe('critica');
    });

    it('debe mapear warning, success, error', () => {
      expect(normalizeNotificationType('warning')).toBe('aviso');
      expect(normalizeNotificationType('success')).toBe('info');
      expect(normalizeNotificationType('error')).toBe('critica');
    });

    it('debe retornar info para tipos desconocidos o nulos', () => {
      expect(normalizeNotificationType(null)).toBe('info');
      expect(normalizeNotificationType(undefined)).toBe('info');
      expect(normalizeNotificationType('otro')).toBe('info');
    });

    it('debe ser case-insensitive', () => {
      expect(normalizeNotificationType('INFO')).toBe('info');
      expect(normalizeNotificationType('WARNING')).toBe('aviso');
      expect(normalizeNotificationType('ALERTA')).toBe('alerta');
    });

    it('debe ignorar espacios extra', () => {
      expect(normalizeNotificationType('  info  ')).toBe('info');
    });
  });
});