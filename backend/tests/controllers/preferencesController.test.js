/**
 * Tests para preferencesController
 * Cubre getPreferences y updatePreferences
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PreferencesService } from '../../src/services/preferencesService.js';
import {
  getPreferences,
  updatePreferences,
} from '../../src/controller/preferencesController.js';

describe('preferencesController', () => {
  let req, res, next;
  let spyGetPrefs, spyUpdatePrefs;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: 1 }, body: {}, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    spyGetPrefs = jest.spyOn(PreferencesService.prototype, 'getPreferences');
    spyUpdatePrefs = jest.spyOn(PreferencesService.prototype, 'updatePreferences');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getPreferences', () => {
    it('debe retornar 401 si no hay usuario', async () => {
      req.user = null;
      await getPreferences(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
    });

    it('debe retornar las preferencias del usuario', async () => {
      const prefs = { idioma: 'es', tema: 'light' };
      spyGetPrefs.mockResolvedValue(prefs);
      await getPreferences(req, res, next);
      expect(res.json).toHaveBeenCalledWith(prefs);
    });

    it('debe llamar a next(error) si el servicio falla', async () => {
      const err = new Error('DB error');
      spyGetPrefs.mockRejectedValue(err);
      await getPreferences(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('updatePreferences', () => {
    it('debe retornar 401 si no hay usuario', async () => {
      req.user = null;
      await updatePreferences(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
    });

    it('debe retornar las preferencias actualizadas', async () => {
      const updated = { idioma: 'en' };
      spyUpdatePrefs.mockResolvedValue(updated);
      req.body = { idioma: 'en' };
      await updatePreferences(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ preferences: updated })
      );
    });

    it('debe llamar a next(error) si el servicio falla', async () => {
      const err = new Error('Update failed');
      spyUpdatePrefs.mockRejectedValue(err);
      await updatePreferences(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});