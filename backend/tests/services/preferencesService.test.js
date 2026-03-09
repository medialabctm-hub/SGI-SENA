/**
 * Tests para services/preferencesService
 *
 * Cubre: getPreferences(), createDefaultPreferences(), updatePreferences()
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock(
  '../../src/config/dbconfig.js',
  () => ({ default: {} }),
  { virtual: true }
);

jest.mock(
  '../../src/utils/logger.js',
  () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }),
  { virtual: true }
);

import { PreferencesService } from '../../src/services/preferencesService.js';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const makeDbRow = (overrides = {}) => ({
  id_preferencia: 1,
  id_usuario: 10,
  notificaciones_email: 1,
  notificaciones_sms: 0,
  notificaciones_app: 1,
  idioma: 'es',
  zona_horaria: 'America/Bogota',
  fecha_creacion: '2026-01-01',
  fecha_actualizacion: '2026-03-01',
  ...overrides,
});

function makeMockDb(initialRows = [makeDbRow()]) {
  return {
    execute: jest.fn().mockResolvedValue([initialRows]),
  };
}

// ──────────────────────────────────────────────
// getPreferences()
// ──────────────────────────────────────────────
describe('PreferencesService - getPreferences()', () => {
  it('debe retornar las preferencias formateadas si el usuario tiene registro', async () => {
    const db = makeMockDb([makeDbRow()]);
    const service = new PreferencesService(db);

    const result = await service.getPreferences(10);

    expect(result).toMatchObject({
      id_preferencia: 1,
      id_usuario: 10,
      notificaciones: {
        email: true,
        sms: false,
        app: true,
      },
      app: {
        idioma: 'es',
        zona_horaria: 'America/Bogota',
      },
    });
  });

  it('debe usar valores por defecto si idioma/zona_horaria son null', async () => {
    const db = makeMockDb([makeDbRow({ idioma: null, zona_horaria: null })]);
    const service = new PreferencesService(db);

    const result = await service.getPreferences(10);

    expect(result.app.idioma).toBe('es');
    expect(result.app.zona_horaria).toBe('America/Bogota');
  });

  it('debe crear preferencias por defecto si el usuario no tiene registro', async () => {
    // Primera llamada → sin filas; segunda llamada (recursiva desde createDefaultPreferences) → con fila
    const db = {
      execute: jest.fn()
        .mockResolvedValueOnce([[]])                    // SELECT → vacío
        .mockResolvedValueOnce([{ insertId: 5, affectedRows: 1 }])  // INSERT
        .mockResolvedValueOnce([[makeDbRow()]])          // SELECT recursivo
    };
    const service = new PreferencesService(db);

    const result = await service.getPreferences(10);

    expect(result).toMatchObject({ id_usuario: 10 });
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it('debe propagar errores de la base de datos', async () => {
    const db = { execute: jest.fn().mockRejectedValue(new Error('DB timeout')) };
    const service = new PreferencesService(db);

    await expect(service.getPreferences(10)).rejects.toThrow('DB timeout');
  });
});

// ──────────────────────────────────────────────
// createDefaultPreferences()
// ──────────────────────────────────────────────
describe('PreferencesService - createDefaultPreferences()', () => {
  it('debe insertar preferencias y retornar las preferencias creadas', async () => {
    const db = {
      execute: jest.fn()
        .mockResolvedValueOnce([{ insertId: 7, affectedRows: 1 }]) // INSERT
        .mockResolvedValueOnce([[makeDbRow({ id_preferencia: 7 })]])  // SELECT recursivo
    };
    const service = new PreferencesService(db);

    const result = await service.createDefaultPreferences(10);

    expect(db.execute).toHaveBeenCalledTimes(2);
    const insertCall = db.execute.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT INTO Preferencias_Usuario');
    expect(result.id_preferencia).toBe(7);
  });

  it('debe propagar errores si el INSERT falla', async () => {
    const db = { execute: jest.fn().mockRejectedValue(new Error('Constraint violation')) };
    const service = new PreferencesService(db);

    await expect(service.createDefaultPreferences(10)).rejects.toThrow('Constraint violation');
  });
});

// ──────────────────────────────────────────────
// updatePreferences()
// ──────────────────────────────────────────────
describe('PreferencesService - updatePreferences()', () => {
  let service;
  let db;

  beforeEach(() => {
    db = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])   // getPreferences → existing
        .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE
        .mockResolvedValueOnce([[makeDbRow()]])   // getPreferences → retorno final
    };
    service = new PreferencesService(db);
  });

  it('debe actualizar preferencias de notificaciones (formato anidado)', async () => {
    const result = await service.updatePreferences(10, {
      notificaciones: { email: false, sms: true, app: false },
    });

    expect(result).toBeDefined();
    const updateCall = db.execute.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE Preferencias_Usuario');
    expect(updateCall[0]).toContain('notificaciones_email = ?');
    expect(updateCall[0]).toContain('notificaciones_sms = ?');
    expect(updateCall[0]).toContain('notificaciones_app = ?');
  });

  it('debe actualizar preferencias de app (idioma y zona_horaria)', async () => {
    await service.updatePreferences(10, {
      app: { idioma: 'en', zona_horaria: 'UTC' },
    });

    const updateCall = db.execute.mock.calls[1];
    expect(updateCall[0]).toContain('idioma = ?');
    expect(updateCall[0]).toContain('zona_horaria = ?');
    expect(updateCall[1]).toContain('en');
    expect(updateCall[1]).toContain('UTC');
  });

  it('debe actualizar solo idioma cuando zona_horaria no está definida [line 125 false]', async () => {
    const freshDb = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[makeDbRow()]]),
    };
    await new PreferencesService(freshDb).updatePreferences(10, {
      app: { idioma: 'fr' },
    });
    const updateCall = freshDb.execute.mock.calls[1];
    expect(updateCall[0]).toContain('idioma = ?');
    expect(updateCall[0]).not.toContain('zona_horaria');
  });

  it('debe actualizar solo zona_horaria cuando idioma no está definido [line 121 false]', async () => {
    const freshDb = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[makeDbRow()]]),
    };
    await new PreferencesService(freshDb).updatePreferences(10, {
      app: { zona_horaria: 'Europe/Madrid' },
    });
    const updateCall = freshDb.execute.mock.calls[1];
    expect(updateCall[0]).not.toContain('idioma');
    expect(updateCall[0]).toContain('zona_horaria = ?');
  });

  it('debe actualizar usando formato plano (email, sms, inApp)', async () => {
    await service.updatePreferences(10, {
      email: true,
      sms: false,
      inApp: true,
    });

    const updateCall = db.execute.mock.calls[1];
    expect(updateCall[0]).toContain('notificaciones_email = ?');
    expect(updateCall[0]).toContain('notificaciones_sms = ?');
    expect(updateCall[0]).toContain('notificaciones_app = ?');
  });

  it('debe actualizar idioma y zona_horaria en formato plano', async () => {
    await service.updatePreferences(10, {
      idioma: 'en',
      zona_horaria: 'UTC',
    });

    const updateCall = db.execute.mock.calls[1];
    expect(updateCall[0]).toContain('idioma = ?');
    expect(updateCall[0]).toContain('zona_horaria = ?');
  });

  it('debe actualizar zona_horaria usando alias "tz"', async () => {
    await service.updatePreferences(10, { tz: 'Europe/Madrid' });

    const updateCall = db.execute.mock.calls[1];
    expect(updateCall[0]).toContain('zona_horaria = ?');
    expect(updateCall[1]).toContain('Europe/Madrid');
  });

  it('debe retornar las preferencias existentes si no hay nada que actualizar', async () => {
    // Resetear el mock para este caso específico
    const emptyDb = {
      execute: jest.fn().mockResolvedValueOnce([[makeDbRow()]]),
    };
    const emptyService = new PreferencesService(emptyDb);

    const result = await emptyService.updatePreferences(10, {});

    expect(emptyDb.execute).toHaveBeenCalledTimes(1); // Solo el SELECT inicial
    expect(result).toMatchObject({ id_usuario: 10 });
  });

  it('debe actualizar notificaciones.inApp usando la clave alternativa', async () => {
    await service.updatePreferences(10, {
      notificaciones: { inApp: true },
    });

    const updateCall = db.execute.mock.calls[1];
    expect(updateCall[0]).toContain('notificaciones_app = ?');
  });

  it('debe propagar errores si el UPDATE falla', async () => {
    const failDb = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])   // getPreferences
        .mockRejectedValueOnce(new Error('UPDATE failed')),
    };
    const failService = new PreferencesService(failDb);

    await expect(
      failService.updatePreferences(10, { idioma: 'en' })
    ).rejects.toThrow('UPDATE failed');
  });

  // ── Ramas faltantes (branch coverage) ────────────────────────
  it('debe cubrir ternario email:true (1) en notificaciones anidadas', async () => {
    const freshDb = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[makeDbRow()]]),
    };
    await new PreferencesService(freshDb).updatePreferences(10, {
      notificaciones: { email: true },
    });
    const updateCall = freshDb.execute.mock.calls[1];
    // email:true → push 1
    expect(updateCall[1]).toContain(1);
  });

  it('debe cubrir ternario sms:false (0) en notificaciones anidadas', async () => {
    const freshDb = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[makeDbRow()]]),
    };
    await new PreferencesService(freshDb).updatePreferences(10, {
      notificaciones: { sms: false },
    });
    const updateCall = freshDb.execute.mock.calls[1];
    expect(updateCall[0]).toContain('notificaciones_sms = ?');
    // sms:false → push 0
    expect(updateCall[1]).toContain(0);
  });

  it('no debe incluir notificaciones_app cuando ni app ni inApp se proporcionan', async () => {
    const freshDb = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[makeDbRow()]]),
    };
    await new PreferencesService(freshDb).updatePreferences(10, {
      notificaciones: { email: false },
    });
    const updateCall = freshDb.execute.mock.calls[1];
    // Solo notificaciones_email, no notificaciones_app
    expect(updateCall[0]).not.toContain('notificaciones_app');
  });

  it('debe cubrir ternario email:false (0) en formato plano', async () => {
    const freshDb = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[makeDbRow()]]),
    };
    await new PreferencesService(freshDb).updatePreferences(10, { email: false });
    const updateCall = freshDb.execute.mock.calls[1];
    expect(updateCall[1]).toContain(0);
  });

  it('debe cubrir ternario sms:true (1) en formato plano', async () => {
    const freshDb = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[makeDbRow()]]),
    };
    await new PreferencesService(freshDb).updatePreferences(10, { sms: true });
    const updateCall = freshDb.execute.mock.calls[1];
    expect(updateCall[0]).toContain('notificaciones_sms = ?');
    expect(updateCall[1]).toContain(1);
  });

  it('debe cubrir ternario inApp:false (0) en formato plano', async () => {
    const freshDb = {
      execute: jest.fn()
        .mockResolvedValueOnce([[makeDbRow()]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[makeDbRow()]]),
    };
    await new PreferencesService(freshDb).updatePreferences(10, { inApp: false });
    const updateCall = freshDb.execute.mock.calls[1];
    expect(updateCall[0]).toContain('notificaciones_app = ?');
    expect(updateCall[1]).toContain(0);
  });
});

// ──────────────────────────────────────────────
// Constructor sin db → usa defaultDb (branch line 11)
// ──────────────────────────────────────────────
describe('PreferencesService - constructor por defecto', () => {
  it('debe instanciarse sin argumentos (usa defaultDb)', () => {
    expect(() => new PreferencesService()).not.toThrow();
  });
});
