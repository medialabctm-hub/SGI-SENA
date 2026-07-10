/**
 * Tests para validators/equiposValidator
 *
 * Cubre: registrarEquipoSchema, actualizarEquipoSchema, validate()
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  registrarEquipoSchema,
  actualizarEquipoSchema,
  validate,
} from '../../src/validators/equiposValidator.js';

function makeReqRes(body) {
  const req = { body };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

const estadosFisicosValidos = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado'];

// ──────────────────────────────────────────────
// registrarEquipoSchema
// ──────────────────────────────────────────────
describe('registrarEquipoSchema', () => {
  const base = {
    tipo: 'Portátil',
    estado_fisico: 'Nuevo',
  };

  it('debe pasar con los campos mínimos requeridos', () => {
    expect(() => registrarEquipoSchema.parse(base)).not.toThrow();
  });

  it('debe pasar con un equipo completo', () => {
    expect(() =>
      registrarEquipoSchema.parse({
        ...base,
        placa: 'SENA-001',
        modelo: 'Dell Latitude 5420',
        descripcion: 'Portátil Dell para uso educativo',
        fecha_adquisicion: '2024-01-15',
        costo: 2500000,
        id_ambiente: 3,
      })
    ).not.toThrow();
  });

  it('debe fallar si falta el campo "tipo"', () => {
    const { tipo, ...sin } = base;
    expect(() => registrarEquipoSchema.parse(sin)).toThrow('El tipo es requerido');
  });

  it('debe fallar si "tipo" está vacío', () => {
    expect(() =>
      registrarEquipoSchema.parse({ ...base, tipo: '' })
    ).toThrow();
  });

  it('debe fallar si falta "estado_fisico"', () => {
    const { estado_fisico, ...sin } = base;
    expect(() => registrarEquipoSchema.parse(sin)).toThrow();
  });

  it.each(estadosFisicosValidos)(
    'debe aceptar el estado físico "%s"',
    (estado) => {
      expect(() =>
        registrarEquipoSchema.parse({ ...base, estado_fisico: estado })
      ).not.toThrow();
    }
  );

  it('debe fallar si estado_fisico es inválido', () => {
    expect(() =>
      registrarEquipoSchema.parse({ ...base, estado_fisico: 'Excelente' })
    ).toThrow('Estado físico inválido');
  });

  it('debe convertir costo numérico correctamente', () => {
    const result = registrarEquipoSchema.parse({ ...base, costo: 1500000 });
    expect(result.costo).toBe(1500000);
  });

  it('debe convertir costo como string a número', () => {
    const result = registrarEquipoSchema.parse({ ...base, costo: '2500000' });
    expect(result.costo).toBe(2500000);
  });

  it('debe convertir costo vacío a null', () => {
    const result = registrarEquipoSchema.parse({ ...base, costo: '' });
    expect(result.costo).toBeNull();
  });

  it('debe convertir id_ambiente como string a número', () => {
    const result = registrarEquipoSchema.parse({ ...base, id_ambiente: '5' });
    expect(result.id_ambiente).toBe(5);
  });

  it('debe convertir id_ambiente vacío a null', () => {
    const result = registrarEquipoSchema.parse({ ...base, id_ambiente: '' });
    expect(result.id_ambiente).toBeNull();
  });

  it('debe aceptar id_cuentadante como número', () => {
    expect(() =>
      registrarEquipoSchema.parse({ ...base, id_cuentadante: 7 })
    ).not.toThrow();
  });

  it('debe aceptar comentarios opcionales', () => {
    expect(() =>
      registrarEquipoSchema.parse({ ...base, comentarios: 'Equipo en buenas condiciones.' })
    ).not.toThrow();
  });

  it('debe fallar si comentarios supera 1000 caracteres', () => {
    expect(() =>
      registrarEquipoSchema.parse({ ...base, comentarios: 'C'.repeat(1001) })
    ).toThrow();
  });
});

// ──────────────────────────────────────────────
// actualizarEquipoSchema
// ──────────────────────────────────────────────
describe('actualizarEquipoSchema', () => {
  it('debe pasar con un objeto vacío (todos los campos son opcionales)', () => {
    expect(() => actualizarEquipoSchema.parse({})).not.toThrow();
  });

  it('debe aceptar actualización parcial del tipo', () => {
    const result = actualizarEquipoSchema.parse({ tipo: 'Impresora' });
    expect(result.tipo).toBe('Impresora');
  });

  it('debe aceptar actualización del estado_fisico', () => {
    const result = actualizarEquipoSchema.parse({ estado_fisico: 'Malo' });
    expect(result.estado_fisico).toBe('Malo');
  });

  it('debe fallar si estado_fisico es inválido', () => {
    expect(() =>
      actualizarEquipoSchema.parse({ estado_fisico: 'Destruido' })
    ).toThrow();
  });

  it('debe convertir costo string a número en actualización', () => {
    const result = actualizarEquipoSchema.parse({ costo: '3000000' });
    expect(result.costo).toBe(3000000);
  });

  it('debe convertir id_ambiente string a número en actualización', () => {
    const result = actualizarEquipoSchema.parse({ id_ambiente: '2' });
    expect(result.id_ambiente).toBe(2);
  });

  it('debe aceptar múltiples campos en la actualización', () => {
    expect(() =>
      actualizarEquipoSchema.parse({
        tipo: 'Monitor',
        modelo: 'LG 24"',
        estado_fisico: 'Bueno',
        costo: 800000,
      })
    ).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// Middleware validate()
// ──────────────────────────────────────────────
describe('Middleware validate() de equipos', () => {
  it('debe llamar next() con datos de registro válidos', () => {
    const { req, res, next } = makeReqRes({ tipo: 'Tablet', estado_fisico: 'Bueno' });

    validate(registrarEquipoSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe retornar 400 si falta el tipo', () => {
    const { req, res, next } = makeReqRes({ estado_fisico: 'Bueno' });

    validate(registrarEquipoSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Error de validación' })
    );
  });

  it('debe retornar 400 si el estado_fisico es inválido', () => {
    const { req, res, next } = makeReqRes({ tipo: 'Laptop', estado_fisico: 'Roto' });

    validate(registrarEquipoSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('la respuesta 400 debe incluir detalles con path y message', () => {
    const { req, res, next } = makeReqRes({});

    validate(registrarEquipoSchema)(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details[0]).toHaveProperty('path');
    expect(payload.details[0]).toHaveProperty('message');
    expect(payload.details[0]).toHaveProperty('code');
  });

  it('debe llamar next() con actualización vacía (todos opcionales)', () => {
    const { req, res, next } = makeReqRes({});

    validate(actualizarEquipoSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

// ──────────────────────────────────────────────
// asignarEquipoSchema
// ──────────────────────────────────────────────
import {
  asignarEquipoSchema,
  verificarInventarioSchema,
  crearCategoriaSchema,
  actualizarCategoriaSchema,
  registrarUsoEquipoSchema,
  actualizarUsoEquipoSchema,
  actualizarAsignacionEquipoSchema,
  registrarUsoEquipoExternoSchema,
} from '../../src/validators/equiposValidator.js';

describe('asignarEquipoSchema', () => {
  const base = {
    codigo_equipo: 'EQ-001',
    id_usuario: 5,
    tipo_responsabilidad: 'Principal',
  };

  it('debe pasar con los campos mínimos', () => {
    expect(() => asignarEquipoSchema.parse(base)).not.toThrow();
  });

  it('debe aceptar tipo_responsabilidad Secundario', () => {
    expect(() =>
      asignarEquipoSchema.parse({ ...base, tipo_responsabilidad: 'Secundario' })
    ).not.toThrow();
  });

  it('debe fallar si tipo_responsabilidad es inválido', () => {
    expect(() =>
      asignarEquipoSchema.parse({ ...base, tipo_responsabilidad: 'Temporal' })
    ).toThrow();
  });

  it('debe aceptar codigo_equipo como número', () => {
    expect(() =>
      asignarEquipoSchema.parse({ ...base, codigo_equipo: 10 })
    ).not.toThrow();
  });

  it('debe convertir dias_asignados string a número', () => {
    const result = asignarEquipoSchema.parse({ ...base, dias_asignados: '30' });
    expect(result.dias_asignados).toBe(30);
  });

  it('debe convertir dias_asignados vacío a null', () => {
    const result = asignarEquipoSchema.parse({ ...base, dias_asignados: '' });
    expect(result.dias_asignados).toBeNull();
  });

  it('debe aceptar observaciones opcionales', () => {
    expect(() =>
      asignarEquipoSchema.parse({ ...base, observaciones: 'Asignación temporal' })
    ).not.toThrow();
  });

  it('debe fallar si falta id_usuario', () => {
    const { id_usuario, ...sin } = base;
    expect(() => asignarEquipoSchema.parse(sin)).toThrow();
  });
});

// ──────────────────────────────────────────────
// verificarInventarioSchema
// ──────────────────────────────────────────────
describe('verificarInventarioSchema', () => {
  it.each(['Verificado', 'Con Novedad', 'No Verificado'])(
    'debe aceptar estado_verificacion "%s"',
    (estado) => {
      expect(() =>
        verificarInventarioSchema.parse({ codigo_equipo: 'EQ-001', estado_verificacion: estado })
      ).not.toThrow();
    }
  );

  it('debe fallar si estado_verificacion es inválido', () => {
    expect(() =>
      verificarInventarioSchema.parse({ codigo_equipo: 'EQ-001', estado_verificacion: 'Bueno' })
    ).toThrow();
  });

  it('debe aceptar observaciones opcionales', () => {
    expect(() =>
      verificarInventarioSchema.parse({
        codigo_equipo: 1,
        estado_verificacion: 'Verificado',
        observaciones: 'Todo en orden',
      })
    ).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// crearCategoriaSchema
// ──────────────────────────────────────────────
describe('crearCategoriaSchema', () => {
  it('debe pasar con nombre_categoria obligatorio', () => {
    expect(() =>
      crearCategoriaSchema.parse({ nombre_categoria: 'Periférico' })
    ).not.toThrow();
  });

  it('debe asignar false como valor por defecto a es_componente', () => {
    const result = crearCategoriaSchema.parse({ nombre_categoria: 'Monitor' });
    expect(result.es_componente).toBe(false);
  });

  it('debe convertir es_componente "1" a true', () => {
    const result = crearCategoriaSchema.parse({ nombre_categoria: 'RAM', es_componente: '1' });
    expect(result.es_componente).toBe(true);
  });

  it('debe convertir es_componente "true" a true', () => {
    const result = crearCategoriaSchema.parse({ nombre_categoria: 'RAM', es_componente: 'true' });
    expect(result.es_componente).toBe(true);
  });

  it('debe aceptar es_componente como booleano', () => {
    const result = crearCategoriaSchema.parse({ nombre_categoria: 'SSD', es_componente: true });
    expect(result.es_componente).toBe(true);
  });

  it('debe aceptar es_componente como número 0 o 1', () => {
    const r1 = crearCategoriaSchema.parse({ nombre_categoria: 'GPU', es_componente: 1 });
    expect(r1.es_componente).toBe(1); // number branch pasa a través
  });

  it('debe fallar si nombre_categoria está vacío', () => {
    expect(() =>
      crearCategoriaSchema.parse({ nombre_categoria: '' })
    ).toThrow();
  });

  it('debe fallar si nombre_categoria supera 50 caracteres', () => {
    expect(() =>
      crearCategoriaSchema.parse({ nombre_categoria: 'A'.repeat(51) })
    ).toThrow();
  });

  it('debe aceptar descripcion opcional', () => {
    expect(() =>
      crearCategoriaSchema.parse({ nombre_categoria: 'CPU', descripcion: 'Procesador central' })
    ).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// actualizarCategoriaSchema
// ──────────────────────────────────────────────
describe('actualizarCategoriaSchema', () => {
  it('debe pasar con objeto vacío (todos opcionales)', () => {
    expect(() => actualizarCategoriaSchema.parse({})).not.toThrow();
  });

  it('debe aceptar actualización parcial de nombre', () => {
    const result = actualizarCategoriaSchema.parse({ nombre_categoria: 'NIC' });
    expect(result.nombre_categoria).toBe('NIC');
  });

  it('debe fallar si nombre_categoria está vacío', () => {
    expect(() =>
      actualizarCategoriaSchema.parse({ nombre_categoria: '' })
    ).toThrow();
  });

  it('debe transformar es_componente string "1" a booleano [line 159]', () => {
    const result = actualizarCategoriaSchema.parse({ es_componente: '1' });
    expect(result.es_componente).toBe(true);
  });

  it('debe transformar es_componente string "true" a booleano', () => {
    const result = actualizarCategoriaSchema.parse({ es_componente: 'true' });
    expect(result.es_componente).toBe(true);
  });

  it('debe transformar es_componente string "0" a false', () => {
    const result = actualizarCategoriaSchema.parse({ es_componente: '0' });
    expect(result.es_componente).toBe(false);
  });
});

// ──────────────────────────────────────────────
// registrarUsoEquipoSchema
// ──────────────────────────────────────────────
describe('registrarUsoEquipoSchema', () => {
  const base = {
    codigo_equipo: 'EQ-010',
    nombre_usuario: 'María López',
  };

  it('debe pasar con los campos mínimos', () => {
    expect(() => registrarUsoEquipoSchema.parse(base)).not.toThrow();
  });

  it('debe aceptar fecha_hora_inicio válida', () => {
    expect(() =>
      registrarUsoEquipoSchema.parse({ ...base, fecha_hora_inicio: '2026-03-10T08:00:00' })
    ).not.toThrow();
  });

  it('debe fallar si fecha_hora_inicio es inválida', () => {
    expect(() =>
      registrarUsoEquipoSchema.parse({ ...base, fecha_hora_inicio: 'no-es-fecha' })
    ).toThrow('fecha de inicio debe ser una fecha válida');
  });

  it('debe aceptar fecha_hora_fin válida', () => {
    expect(() =>
      registrarUsoEquipoSchema.parse({ ...base, fecha_hora_fin: '2026-03-10T10:00:00' })
    ).not.toThrow();
  });

  it('debe fallar si fecha_hora_fin es inválida', () => {
    expect(() =>
      registrarUsoEquipoSchema.parse({ ...base, fecha_hora_fin: 'texto' })
    ).toThrow('fecha de fin debe ser una fecha válida');
  });

  it('debe aceptar observaciones opcionales', () => {
    expect(() =>
      registrarUsoEquipoSchema.parse({ ...base, observaciones: 'Uso normal' })
    ).not.toThrow();
  });

  it('debe fallar si falta nombre_usuario', () => {
    const { nombre_usuario, ...sin } = base;
    expect(() => registrarUsoEquipoSchema.parse(sin)).toThrow();
  });
});

// ──────────────────────────────────────────────
// actualizarUsoEquipoSchema
// ──────────────────────────────────────────────
describe('actualizarUsoEquipoSchema', () => {
  it('debe pasar con objeto vacío (todos opcionales)', () => {
    expect(() => actualizarUsoEquipoSchema.parse({})).not.toThrow();
  });

  it('debe aceptar fecha_hora_fin válida', () => {
    expect(() =>
      actualizarUsoEquipoSchema.parse({ fecha_hora_fin: '2026-03-10T10:00:00' })
    ).not.toThrow();
  });

  it('debe fallar si fecha_hora_fin es inválida', () => {
    expect(() =>
      actualizarUsoEquipoSchema.parse({ fecha_hora_fin: 'invalida' })
    ).toThrow();
  });

  it('debe aceptar observaciones opcionales', () => {
    expect(() =>
      actualizarUsoEquipoSchema.parse({ observaciones: 'Uso terminado' })
    ).not.toThrow();
  });
});

// ──────────────────────────────────────────────
// actualizarAsignacionEquipoSchema
// ──────────────────────────────────────────────
describe('actualizarAsignacionEquipoSchema', () => {
  it('debe pasar con objeto vacío (todos opcionales)', () => {
    expect(() => actualizarAsignacionEquipoSchema.parse({})).not.toThrow();
  });

  it('debe normalizar dias_semana de string a mayúscula correcta', () => {
    const result = actualizarAsignacionEquipoSchema.parse({
      dias_semana: ['lunes', 'viernes'],
    });
    expect(result.dias_semana).toContain('Lunes');
    expect(result.dias_semana).toContain('Viernes');
  });

  it('debe aceptar alias diasSemana y normalizarlo', () => {
    const result = actualizarAsignacionEquipoSchema.parse({
      diasSemana: ['Martes'],
    });
    expect(result.dias_semana).toContain('Martes');
  });

  it('debe aceptar hora_inicio y hora_fin válidos', () => {
    expect(() =>
      actualizarAsignacionEquipoSchema.parse({
        hora_inicio: '08:00',
        hora_fin: '10:00',
      })
    ).not.toThrow();
  });

  it('debe aceptar alias horaInicio y horaFin', () => {
    const result = actualizarAsignacionEquipoSchema.parse({
      horaInicio: '08:00',
      horaFin: '10:00',
    });
    expect(result.hora_inicio).toBe('08:00');
    expect(result.hora_fin).toBe('10:00');
  });

  it('debe fallar si hora_inicio sin hora_fin', () => {
    expect(() =>
      actualizarAsignacionEquipoSchema.parse({ hora_inicio: '08:00' })
    ).toThrow();
  });

  it('debe fallar si hora_fin sin hora_inicio', () => {
    expect(() =>
      actualizarAsignacionEquipoSchema.parse({ hora_fin: '10:00' })
    ).toThrow();
  });

  it('debe fallar si hora_inicio tiene formato inválido', () => {
    expect(() =>
      actualizarAsignacionEquipoSchema.parse({ hora_inicio: '25:00', hora_fin: '26:00' })
    ).toThrow();
  });
});

// ──────────────────────────────────────────────
// registrarUsoEquipoExternoSchema
// ──────────────────────────────────────────────
describe('registrarUsoEquipoExternoSchema', () => {
  const baseNuevo = {
    placa: 'SENA-001',
    ambiente: 'Aula 01',
    usuarios: [{ documento: '12345678' }],
  };

  const baseAntiguo = {
    placa: 'SENA-002',
    ambiente: 'Aula 02',
    documento: '87654321',
  };

  it('debe pasar con formato nuevo (array de usuarios)', () => {
    expect(() => registrarUsoEquipoExternoSchema.parse(baseNuevo)).not.toThrow();
  });

  it('debe pasar con formato antiguo (documento en raíz)', () => {
    const result = registrarUsoEquipoExternoSchema.parse(baseAntiguo);
    expect(Array.isArray(result.usuarios)).toBe(true);
    expect(result.usuarios[0].documento).toBe('87654321');
  });

  it('debe convertir ambiente numérico a string', () => {
    const result = registrarUsoEquipoExternoSchema.parse({ ...baseNuevo, ambiente: 101 });
    expect(result.ambiente).toBe('101');
  });

  it('debe fallar si no hay usuarios en el array', () => {
    expect(() =>
      registrarUsoEquipoExternoSchema.parse({ ...baseNuevo, usuarios: [] })
    ).toThrow();
  });

  it('debe fallar si falta placa', () => {
    const { placa, ...sin } = baseNuevo;
    expect(() => registrarUsoEquipoExternoSchema.parse(sin)).toThrow();
  });

  it('debe aceptar que falte ambiente (opcional para uso autenticado desde web/app)', () => {
    const { ambiente, ...sin } = baseNuevo;
    expect(() => registrarUsoEquipoExternoSchema.parse(sin)).not.toThrow();
  });

  it('debe aceptar usuarios como string JSON válido', () => {
    const data = {
      placa: 'SENA-003',
      ambiente: 'Lab 01',
      usuarios: JSON.stringify([{ documento: '11111111' }]),
    };
    const result = registrarUsoEquipoExternoSchema.parse(data);
    expect(result.usuarios[0].documento).toBe('11111111');
  });

  it('debe fallar si usuarios como string JSON inválido', () => {
    const data = {
      placa: 'SENA-003',
      ambiente: 'Lab 01',
      usuarios: 'texto-invalido',
    };
    expect(() => registrarUsoEquipoExternoSchema.parse(data)).toThrow();
  });

  it('debe incluir ficha cuando está presente en usuario', () => {
    const result = registrarUsoEquipoExternoSchema.parse({
      ...baseNuevo,
      usuarios: [{ documento: '12345678', ficha: '2750001' }],
    });
    // ficha se transforma con trim()
    expect(result.usuarios[0].documento).toBe('12345678');
  });

  it('debe transformar formato antiguo con ficha (trim branch true)', () => {
    const result = registrarUsoEquipoExternoSchema.parse({
      placa: 'SENA-005',
      ambiente: 'Aula 03',
      documento: '99887766',
      ficha: '  2750005  ',
    });
    expect(result.usuarios[0].ficha).toBe('2750005');
    expect(result.usuarios[0].documento).toBe('99887766');
  });
});

// ──────────────────────────────────────────────
// Branches faltantes: transforms de string en schemas numéricos
// Lines 30-32, 55-57, 84-86
// ──────────────────────────────────────────────
describe('registrarEquipoSchema - transforms de string (branches 30-32, 84-86)', () => {
  const base = { tipo: 'Portátil', estado_fisico: 'Nuevo' };

  it('debe retornar null para valor_ingreso como string vacío [line 30]', () => {
    const result = registrarEquipoSchema.parse({ ...base, valor_ingreso: '' });
    expect(result.valor_ingreso).toBeNull();
  });

  it('debe retornar null para valor_ingreso como string no numérico [line 32]', () => {
    const result = registrarEquipoSchema.parse({ ...base, valor_ingreso: 'precio_invalido' });
    expect(result.valor_ingreso).toBeNull();
  });

  it('debe retornar null para costo como string vacío', () => {
    const result = registrarEquipoSchema.parse({ ...base, costo: '' });
    expect(result.costo).toBeNull();
  });

  it('debe retornar null para costo como string no numérico', () => {
    const result = registrarEquipoSchema.parse({ ...base, costo: 'no-es-numero' });
    expect(result.costo).toBeNull();
  });

  it('debe retornar null para id_ambiente como string vacío [line 84]', () => {
    const result = registrarEquipoSchema.parse({ ...base, id_ambiente: '' });
    expect(result.id_ambiente).toBeNull();
  });

  it('debe retornar null para id_ambiente como "0" (no positivo) [line 86]', () => {
    const result = registrarEquipoSchema.parse({ ...base, id_ambiente: '0' });
    expect(result.id_ambiente).toBeNull();
  });

  it('debe retornar null para id_cuentadante como string no numérico', () => {
    const result = registrarEquipoSchema.parse({ ...base, id_cuentadante: 'abc' });
    expect(result.id_cuentadante).toBeNull();
  });

  it('debe convertir costo string numérico a número [branch isNaN=false]', () => {
    const result = registrarEquipoSchema.parse({ ...base, costo: '750.50' });
    expect(result.costo).toBe(750.50);
  });

  it('debe convertir valor_ingreso string numérico a número [branch isNaN=false]', () => {
    const result = registrarEquipoSchema.parse({ ...base, valor_ingreso: '1200.00' });
    expect(result.valor_ingreso).toBe(1200);
  });

  it('debe convertir id_ambiente string positivo a número', () => {
    const result = registrarEquipoSchema.parse({ ...base, id_ambiente: '7' });
    expect(result.id_ambiente).toBe(7);
  });

  it('debe convertir id_cuentadante string positivo a número', () => {
    const result = registrarEquipoSchema.parse({ ...base, id_cuentadante: '15' });
    expect(result.id_cuentadante).toBe(15);
  });
});

describe('actualizarEquipoSchema - transforms de string (branches 55-57)', () => {
  it('debe retornar null para costo como string vacío', () => {
    const result = actualizarEquipoSchema.parse({ costo: '' });
    expect(result.costo).toBeNull();
  });

  it('debe retornar null para costo como string no numérico', () => {
    const result = actualizarEquipoSchema.parse({ costo: 'no-numero' });
    expect(result.costo).toBeNull();
  });

  it('debe retornar null para valor_ingreso como string vacío', () => {
    const result = actualizarEquipoSchema.parse({ valor_ingreso: '' });
    expect(result.valor_ingreso).toBeNull();
  });

  it('debe retornar null para valor_ingreso como string no numérico [line 86]', () => {
    const result = actualizarEquipoSchema.parse({ valor_ingreso: 'precio_invalido' });
    expect(result.valor_ingreso).toBeNull();
  });

  it('debe convertir valor_ingreso string numérico a número [line 85-86]', () => {
    const result = actualizarEquipoSchema.parse({ valor_ingreso: '1500.75' });
    expect(result.valor_ingreso).toBe(1500.75);
  });

  it('debe convertir costo string numérico a número [branch isNaN=false]', () => {
    const result = actualizarEquipoSchema.parse({ costo: '299.99' });
    expect(result.costo).toBe(299.99);
  });

  it('debe retornar null para id_ambiente string vacío', () => {
    const result = actualizarEquipoSchema.parse({ id_ambiente: '' });
    expect(result.id_ambiente).toBeNull();
  });

  it('debe retornar null para id_ambiente string "0"', () => {
    const result = actualizarEquipoSchema.parse({ id_ambiente: '0' });
    expect(result.id_ambiente).toBeNull();
  });

  it('debe convertir id_ambiente string positivo a número', () => {
    const result = actualizarEquipoSchema.parse({ id_ambiente: '3' });
    expect(result.id_ambiente).toBe(3);
  });
});

// ──────────────────────────────────────────────
// Branch faltante: non-ZodError en validate() [lines 367-368]
// ──────────────────────────────────────────────
describe('validate() de equipos - non-ZodError', () => {
  it('debe llamar next(error) cuando el error no es ZodError [lines 367-368]', () => {
    const req = {
      get body() { throw new Error('Unexpected parse error'); },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(registrarEquipoSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });
});
