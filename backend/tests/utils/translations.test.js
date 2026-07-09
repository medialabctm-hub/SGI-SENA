/**
 * Tests para utils/translations
 *
 * Cubre: translate(), getUserLanguage()
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock(
  '../../src/utils/logger.js',
  () => ({
    logger: {
      warn: jest.fn(),
      error: jest.fn(),
    },
  }),
  { virtual: true }
);

import { translate, getUserLanguage } from '../../src/utils/translations.js';

// ──────────────────────────────────────────────
// translate()
// ──────────────────────────────────────────────
describe('translate()', () => {
  // Español (por defecto)
  describe('idioma español (por defecto)', () => {
    it('debe retornar la traducción correcta en español', () => {
      const result = translate('nuevo_equipo_registrado');
      expect(result).toBe('Nuevo equipo registrado');
    });

    it('debe reemplazar parámetros en la traducción', () => {
      const result = translate(
        'nueva_novedad_reportada_cuerpo',
        'es',
        {
          rol: 'Aprendiz',
          nombre: 'Carlos',
          tipo_novedad: 'Daño',
          equipo: 'Portátil Dell',
        }
      );

      expect(result).toContain('Aprendiz');
      expect(result).toContain('Carlos');
      expect(result).toContain('Daño');
      expect(result).toContain('Portátil Dell');
    });

    it('debe reemplazar el parámetro {ambiente} en el cuerpo con ambiente', () => {
      const result = translate(
        'nuevo_equipo_registrado_cuerpo',
        'es',
        { descripcion: 'Monitor LG', ambiente: 'Aula 01' }
      );

      expect(result).toContain('Monitor LG');
      expect(result).toContain('Aula 01');
    });

    it('debe usar la traducción sin ambiente cuando corresponde', () => {
      const result = translate(
        'nuevo_equipo_registrado_cuerpo_sin_ambiente',
        'es',
        { descripcion: 'Teclado Logitech' }
      );

      expect(result).toContain('Teclado Logitech');
    });

    it('debe retornar la clave si la traducción no existe', () => {
      const result = translate('clave_inexistente', 'es');
      expect(result).toBe('clave_inexistente');
    });

    it('debe traducir correctamente "nuevo_usuario_registrado_cuerpo"', () => {
      const result = translate('nuevo_usuario_registrado_cuerpo', 'es', {
        nombre: 'María López',
      });
      expect(result).toContain('María López');
    });

    it('debe traducir "mantenimiento_proximo_cuerpo" con el equipo', () => {
      const result = translate('mantenimiento_proximo_cuerpo', 'es', {
        equipo: 'PC-042',
      });
      expect(result).toContain('PC-042');
    });
  });

  // Inglés
  describe('idioma inglés', () => {
    it('debe retornar la traducción correcta en inglés', () => {
      const result = translate('nuevo_equipo_registrado', 'en');
      expect(result).toBe('New equipment registered');
    });

    it('debe reemplazar parámetros en inglés', () => {
      const result = translate(
        'nuevo_equipo_registrado_cuerpo',
        'en',
        { descripcion: 'Laptop HP', ambiente: 'Lab 02' }
      );

      expect(result).toContain('Laptop HP');
      expect(result).toContain('Lab 02');
    });

    it('debe traducir "maintenance due" en inglés', () => {
      const result = translate('mantenimiento_proximo', 'en');
      expect(result).toBe('Maintenance due');
    });
  });

  // Idioma desconocido → fallback a español
  describe('idioma desconocido', () => {
    it('debe hacer fallback a español si el idioma no existe', () => {
      const result = translate('nuevo_equipo_registrado', 'fr');
      expect(result).toBe('Nuevo equipo registrado');
    });

    it('debe hacer fallback a español si lang es null', () => {
      const result = translate('nuevo_equipo_registrado', null);
      expect(result).toBe('Nuevo equipo registrado');
    });
  });

  // Parámetros vacíos / sin parámetros
  describe('llamadas sin parámetros de reemplazo', () => {
    it('debe retornar el texto sin modificar si no hay parámetros', () => {
      const result = translate('mantenimiento_proximo', 'es', {});
      expect(result).toBe('Mantenimiento próximo');
    });

    it('debe retornar el texto aunque queden placeholders sin reemplazar', () => {
      // Si no se pasa {nombre}, el placeholder queda en la cadena
      const result = translate('nuevo_usuario_registrado_cuerpo', 'es', {});
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('debe reemplazar param null con string vacío [line 54 branch ||]', () => {
      const result = translate('nuevo_usuario_registrado_cuerpo', 'es', { nombre: null });
      expect(result).not.toContain('{nombre}'); // placeholder reemplazado por ''
      expect(result).not.toContain('null');
    });
  });

  // Reemplazo múltiple del mismo parámetro
  describe('reemplazos múltiples', () => {
    it('debe reemplazar todas las ocurrencias del mismo parámetro', () => {
      const result = translate(
        'nueva_novedad_en_tu_equipo_cuerpo',
        'es',
        { tipo_novedad: 'Robo', equipo: 'Tablet Samsung' }
      );

      expect(result).toContain('Robo');
      expect(result).toContain('Tablet Samsung');
    });
  });
});

// ──────────────────────────────────────────────
// getUserLanguage()
// ──────────────────────────────────────────────
describe('getUserLanguage()', () => {
  it('debe retornar el idioma del usuario desde la BD', async () => {
    const mockDb = {
      execute: jest.fn().mockResolvedValue([[{ idioma: 'en' }]]),
    };

    const result = await getUserLanguage(1, mockDb);

    expect(result).toBe('en');
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining('Preferencias_Usuario'),
      [1]
    );
  });

  it('debe retornar "es" por defecto si el usuario no tiene preferencia', async () => {
    const mockDb = {
      execute: jest.fn().mockResolvedValue([[]]),
    };

    const result = await getUserLanguage(99, mockDb);

    expect(result).toBe('es');
  });

  it('debe retornar "es" por defecto si el campo idioma es null', async () => {
    const mockDb = {
      execute: jest.fn().mockResolvedValue([[{ idioma: null }]]),
    };

    const result = await getUserLanguage(5, mockDb);

    expect(result).toBe('es');
  });

  it('debe retornar "es" por defecto si la BD lanza un error', async () => {
    const mockDb = {
      execute: jest.fn().mockRejectedValue(new Error('Table not found')),
    };

    const result = await getUserLanguage(1, mockDb);

    expect(result).toBe('es');
  });
});
