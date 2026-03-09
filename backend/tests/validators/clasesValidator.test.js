/**
 * Tests para validators/clasesValidator
 *
 * Cubre: crearClaseSchema, actualizarClaseSchema,
 *        agregarParticipantesSchema, validate middleware
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  crearClaseSchema,
  actualizarClaseSchema,
  agregarParticipantesSchema,
  validate,
} from '../../src/validators/clasesValidator.js';

// ──────────────────────────────────────────────
// Base mínima válida para crearClaseSchema
// ──────────────────────────────────────────────
const baseCrear = {
  id_ambiente: 1,
  hora_inicio: '08:00',
  hora_fin: '10:00',
  fecha_clase: '2026-03-10',
};

// ──────────────────────────────────────────────
// crearClaseSchema
// ──────────────────────────────────────────────
describe('crearClaseSchema', () => {
  it('debe pasar con los campos mínimos requeridos', () => {
    expect(() => crearClaseSchema.parse(baseCrear)).not.toThrow();
  });

  it('debe convertir id_ambiente string a número', () => {
    const result = crearClaseSchema.parse({ ...baseCrear, id_ambiente: '3' });
    expect(result.id_ambiente).toBe(3);
  });

  it('debe convertir hora HH:MM a HH:MM:SS', () => {
    const result = crearClaseSchema.parse(baseCrear);
    expect(result.hora_inicio).toBe('08:00:00');
    expect(result.hora_fin).toBe('10:00:00');
  });

  it('debe aceptar hora en formato HH:MM:SS directamente', () => {
    const result = crearClaseSchema.parse({
      ...baseCrear,
      hora_inicio: '08:00:00',
      hora_fin: '10:00:00',
    });
    expect(result.hora_inicio).toBe('08:00:00');
  });

  it('debe fallar si falta id_ambiente', () => {
    const { id_ambiente, ...sin } = baseCrear;
    expect(() => crearClaseSchema.parse(sin)).toThrow();
  });

  it('debe fallar si hora_fin no es posterior a hora_inicio', () => {
    expect(() =>
      crearClaseSchema.parse({ ...baseCrear, hora_inicio: '10:00', hora_fin: '08:00' })
    ).toThrow('La hora de fin debe ser posterior a la hora de inicio');
  });

  it('debe fallar si hora_inicio igual a hora_fin', () => {
    expect(() =>
      crearClaseSchema.parse({ ...baseCrear, hora_inicio: '10:00', hora_fin: '10:00' })
    ).toThrow();
  });

  it('debe aceptar clases recurrentes con dias_semana + fecha_inicio + fecha_fin', () => {
    const data = {
      id_ambiente: 1,
      hora_inicio: '08:00',
      hora_fin: '10:00',
      dias_semana: ['lunes', 'miércoles'],
      fecha_inicio: '2026-03-10',
      fecha_fin: '2026-06-10',
    };
    const result = crearClaseSchema.parse(data);
    expect(Array.isArray(result.dias_semana)).toBe(true);
    expect(result.dias_semana).toContain(1); // lunes = 1
    expect(result.dias_semana).toContain(3); // miércoles = 3
  });

  it('debe convertir dias_semana de strings a números', () => {
    const data = {
      id_ambiente: 1,
      hora_inicio: '08:00',
      hora_fin: '10:00',
      dias_semana: ['lunes', 'viernes', 'domingo'],
      fecha_inicio: '2026-03-01',
      fecha_fin: '2026-06-01',
    };
    const result = crearClaseSchema.parse(data);
    expect(result.dias_semana).toContain(1); // lunes
    expect(result.dias_semana).toContain(5); // viernes
    expect(result.dias_semana).toContain(0); // domingo
  });

  it('debe fallar si dias_semana se provee sin fecha_inicio y fecha_fin', () => {
    const data = {
      id_ambiente: 1,
      hora_inicio: '08:00',
      hora_fin: '10:00',
      dias_semana: ['lunes'],
      // Sin fecha_clase ni fecha_inicio/fin
    };
    expect(() => crearClaseSchema.parse(data)).toThrow();
  });

  it('debe fallar si fecha_inicio > fecha_fin en modo recurrente', () => {
    const data = {
      id_ambiente: 1,
      hora_inicio: '08:00',
      hora_fin: '10:00',
      dias_semana: ['lunes'],
      fecha_inicio: '2026-06-10',
      fecha_fin: '2026-03-10',
    };
    expect(() => crearClaseSchema.parse(data)).toThrow();
  });

  it('debe fallar si no hay fecha_clase ni modo recurrente', () => {
    const data = {
      id_ambiente: 1,
      hora_inicio: '08:00',
      hora_fin: '10:00',
    };
    expect(() => crearClaseSchema.parse(data)).toThrow();
  });

  it('debe aceptar id_instructor opcional', () => {
    const result = crearClaseSchema.parse({ ...baseCrear, id_instructor: 5 });
    expect(result.id_instructor).toBe(5);
  });

  it('debe aceptar nombre_clase y codigo_ficha opcionales', () => {
    const result = crearClaseSchema.parse({
      ...baseCrear,
      nombre_clase: 'Programación Web',
      codigo_ficha: 'FICHA-2026',
    });
    expect(result.nombre_clase).toBe('Programación Web');
    expect(result.codigo_ficha).toBe('FICHA-2026');
  });

  it('debe fallar si nombre_clase tiene menos de 3 caracteres', () => {
    expect(() =>
      crearClaseSchema.parse({ ...baseCrear, nombre_clase: 'AB' })
    ).toThrow();
  });

  it('debe aceptar participantes como array de IDs', () => {
    const result = crearClaseSchema.parse({
      ...baseCrear,
      participantes: [1, 2, 3],
    });
    expect(result.participantes).toEqual([1, 2, 3]);
  });

  it('debe asignar participantes vacíos por defecto', () => {
    const result = crearClaseSchema.parse(baseCrear);
    expect(result.participantes).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// actualizarClaseSchema
// ──────────────────────────────────────────────
describe('actualizarClaseSchema', () => {
  it('debe pasar con objeto vacío (todos opcionales)', () => {
    expect(() => actualizarClaseSchema.parse({})).not.toThrow();
  });

  it('debe aceptar actualización parcial de hora_inicio', () => {
    const result = actualizarClaseSchema.parse({ hora_inicio: '09:00' });
    expect(result.hora_inicio).toBe('09:00:00');
  });

  it('debe aceptar estado_clase válido', () => {
    const result = actualizarClaseSchema.parse({ estado_clase: 'En Curso' });
    expect(result.estado_clase).toBe('En Curso');
  });

  it('debe aceptar todos los estados de clase válidos', () => {
    const estados = ['Programada', 'En Curso', 'Finalizada', 'Cancelada'];
    for (const estado of estados) {
      expect(() => actualizarClaseSchema.parse({ estado_clase: estado })).not.toThrow();
    }
  });

  it('debe fallar si estado_clase es inválido', () => {
    expect(() => actualizarClaseSchema.parse({ estado_clase: 'Suspendida' })).toThrow();
  });

  it('debe aceptar conversión de id_ambiente string a número', () => {
    const result = actualizarClaseSchema.parse({ id_ambiente: '7' });
    expect(result.id_ambiente).toBe(7);
  });
});

// ──────────────────────────────────────────────
// agregarParticipantesSchema
// ──────────────────────────────────────────────
describe('agregarParticipantesSchema', () => {
  it('debe pasar con un array válido de IDs', () => {
    const result = agregarParticipantesSchema.parse({ participantes: [1, 2, 3] });
    expect(result.participantes).toEqual([1, 2, 3]);
  });

  it('debe fallar si participantes está vacío', () => {
    expect(() => agregarParticipantesSchema.parse({ participantes: [] })).toThrow();
  });

  it('debe fallar si participantes contiene valores negativos', () => {
    expect(() => agregarParticipantesSchema.parse({ participantes: [-1, 2] })).toThrow();
  });

  it('debe fallar si participantes supera 50 elementos', () => {
    const muchos = Array.from({ length: 51 }, (_, i) => i + 1);
    expect(() => agregarParticipantesSchema.parse({ participantes: muchos })).toThrow();
  });

  it('debe fallar si falta el campo participantes', () => {
    expect(() => agregarParticipantesSchema.parse({})).toThrow();
  });

  it('debe aceptar exactamente 50 participantes', () => {
    const cincuenta = Array.from({ length: 50 }, (_, i) => i + 1);
    expect(() => agregarParticipantesSchema.parse({ participantes: cincuenta })).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// Middleware validate()
// ──────────────────────────────────────────────
describe('validate() de clases', () => {
  it('debe llamar next() con datos válidos', () => {
    const req = { body: { ...baseCrear } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearClaseSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe retornar 400 si faltan campos requeridos', () => {
    const req = { body: { hora_inicio: '08:00' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearClaseSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Error de validación' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('la respuesta 400 debe incluir detalles de error', () => {
    const req = { body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(crearClaseSchema)(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details.length).toBeGreaterThan(0);
    expect(payload.details[0]).toHaveProperty('path');
    expect(payload.details[0]).toHaveProperty('message');
  });

  it('debe llamar next(error) cuando el error no es ZodError', () => {
    const req = { body: 'texto-no-objeto' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    // Usamos un schema que lanza un error genérico pasando un valor primitivo
    // que hace que schema.parse falle sin ser ZodError
    const schemaRaro = { parse: () => { throw new TypeError('Error inesperado'); } };
    validate(schemaRaro)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(TypeError));
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// Ramas de transformadores helper
// ──────────────────────────────────────────────
describe('transformHora() – rama fallthrough', () => {
  it('debe dejar pasar un string que no coincide con ningún patrón de hora', () => {
    // 'bad' no coincide con HH:MM:SS ni HH:MM → retorna el valor y Zod falla
    expect(() =>
      crearClaseSchema.parse({
        ...baseCrear,
        hora_inicio: 'bad-time',
      })
    ).toThrow();
  });
});

describe('transformIdInstructor() – ramas de string', () => {
  it('debe convertir id_instructor string a número', () => {
    const result = crearClaseSchema.parse({ ...baseCrear, id_instructor: '7' });
    expect(result.id_instructor).toBe(7);
  });

  it('debe retornar undefined si id_instructor es cadena vacía', () => {
    const result = crearClaseSchema.parse({ ...baseCrear, id_instructor: '' });
    expect(result.id_instructor).toBeUndefined();
  });

  it('debe retornar undefined si id_instructor es null', () => {
    const result = crearClaseSchema.parse({ ...baseCrear, id_instructor: null });
    expect(result.id_instructor).toBeUndefined();
  });
});

describe('transformDiasSemana() – ramas especiales', () => {
  const baseRecurrente = {
    id_ambiente: 1,
    hora_inicio: '08:00',
    hora_fin: '10:00',
    fecha_inicio: '2026-03-10',
    fecha_fin: '2026-06-10',
  };

  it('debe retornar array de números sin convertir si todos son números', () => {
    const result = crearClaseSchema.parse({
      ...baseRecurrente,
      dias_semana: [1, 3, 5],
    });
    expect(result.dias_semana).toContain(1);
    expect(result.dias_semana).toContain(3);
    expect(result.dias_semana).toContain(5);
  });

  it('debe convertir array mixto (números y strings) a números', () => {
    const result = crearClaseSchema.parse({
      ...baseRecurrente,
      dias_semana: [1, 'viernes'],
    });
    expect(result.dias_semana).toContain(1);
    expect(result.dias_semana).toContain(5); // viernes = 5
  });

  it('debe filtrar elementos no reconocidos en array mixto', () => {
    // Array mixto con un valor que no existe en el mapa
    const result = crearClaseSchema.parse({
      ...baseRecurrente,
      dias_semana: [2, 'noexisteeste'],
    });
    // 'noexisteeste' no está en el mapa → null → se filtra
    expect(result.dias_semana).toContain(2);
    expect(result.dias_semana).toHaveLength(1);
  });

  it('debe retornar undefined si dias_semana es null', () => {
    // null → transformDiasSemana devuelve undefined → optional() acepta
    const result = crearClaseSchema.parse({ ...baseCrear, dias_semana: null });
    expect(result.dias_semana).toBeUndefined();
  });

  it('debe filtrar elemento null en array mixto [line 80]', () => {
    // null en el array es ni number ni string → return null (line 80) → se filtra
    const result = crearClaseSchema.parse({
      ...baseCrear,
      dias_semana: [1, null, 'lunes'],
      fecha_inicio: '2026-03-10',
      fecha_fin: '2026-06-10',
    });
    expect(result.dias_semana).toContain(1);
    expect(result.dias_semana).toContain(1); // lunes = 1
    expect(result.dias_semana).not.toContain(null);
  });
});

// ──────────────────────────────────────────────
// transformIdInstructor - branch line 36
// ──────────────────────────────────────────────
describe('transformIdInstructor() – fallback line 36', () => {
  it('debe pasar valor booleano sin transformar y fallar validación [line 36]', () => {
    // true no es undefined/null/'', number, ni string → return val (line 36) → z.number falla
    expect(() =>
      crearClaseSchema.parse({ ...baseCrear, id_instructor: true })
    ).toThrow();
  });
});
