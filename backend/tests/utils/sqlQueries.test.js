/**
 * Tests para utils/sqlQueries
 *
 * Cubre: obtenerUsuarioActivo, obtenerUsuarioPorCedula,
 *        obtenerEquiposAsignados, obtenerEquipoPorCodigo,
 *        verificarAsignacionEquipo, obtenerRolUsuario,
 *        contarUsuariosActivos, contarEquipos,
 *        verificarDisponibilidadEquipo
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  obtenerUsuarioActivo,
  obtenerUsuarioPorCedula,
  obtenerEquiposAsignados,
  obtenerEquipoPorCodigo,
  verificarAsignacionEquipo,
  obtenerRolUsuario,
  contarUsuariosActivos,
  contarEquipos,
  verificarDisponibilidadEquipo,
  deshabilitarAsignacionesActivas,
  obtenerAmbientesValidosAprendiz,
  verificarAmbienteEquipoAprendiz,
} from '../../src/utils/sqlQueries.js';

// Helper: mock de db
function makeMockDb() {
  return { execute: jest.fn() };
}

// ──────────────────────────────────────────────
// obtenerUsuarioActivo
// ──────────────────────────────────────────────
describe('obtenerUsuarioActivo()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe retornar el usuario cuando existe', async () => {
    const user = { id_usuario: 1, nombre_usuario: 'Ana', nombre_rol: 'Instructor' };
    db.execute.mockResolvedValue([[user]]);

    const result = await obtenerUsuarioActivo(db, 1);

    expect(db.execute).toHaveBeenCalledWith(expect.any(String), [1]);
    expect(result).toEqual(user);
  });

  it('debe retornar null cuando el usuario no existe', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    const result = await obtenerUsuarioActivo(db, 999);

    expect(result).toBeNull();
  });

  it('la query debe filtrar por estado Activo', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    await obtenerUsuarioActivo(db, 1);

    const query = db.execute.mock.calls[0][0];
    expect(query).toContain("Activo");
  });
});

// ──────────────────────────────────────────────
// obtenerUsuarioPorCedula
// ──────────────────────────────────────────────
describe('obtenerUsuarioPorCedula()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe retornar el usuario cuando existe', async () => {
    const user = { id_usuario: 5, cedula: '12345678' };
    db.execute.mockResolvedValue([[user]]);

    const result = await obtenerUsuarioPorCedula(db, '12345678');

    expect(db.execute).toHaveBeenCalledWith(expect.any(String), ['12345678']);
    expect(result).toEqual(user);
  });

  it('debe retornar null si no se encuentra la cédula', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    const result = await obtenerUsuarioPorCedula(db, '00000000');

    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────
// obtenerEquiposAsignados
// ──────────────────────────────────────────────
describe('obtenerEquiposAsignados()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe retornar lista de equipos asignados', async () => {
    const equipos = [
      { codigo_equipo: 10, tipo: 'Laptop' },
      { codigo_equipo: 11, tipo: 'Tablet' },
    ];
    db.execute.mockResolvedValue([equipos]);

    const result = await obtenerEquiposAsignados(db, 1);

    expect(result).toEqual(equipos);
  });

  it('debe retornar array vacío si no hay equipos', async () => {
    db.execute.mockResolvedValue([[]]);

    const result = await obtenerEquiposAsignados(db, 99);

    expect(result).toEqual([]);
  });

  it('debe retornar array vacío si el resultado es null/undefined', async () => {
    db.execute.mockResolvedValue([null]);

    const result = await obtenerEquiposAsignados(db, 1);

    expect(Array.isArray(result)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// obtenerEquipoPorCodigo
// ──────────────────────────────────────────────
describe('obtenerEquipoPorCodigo()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe buscar por campos numéricos cuando el código es numérico', async () => {
    const equipo = { codigo_equipo: 5, tipo: 'Monitor' };
    db.execute.mockResolvedValue([[equipo]]);

    const result = await obtenerEquipoPorCodigo(db, '5');

    const query = db.execute.mock.calls[0][0];
    expect(query).toContain('codigo_equipo');
    expect(result).toEqual(equipo);
  });

  it('debe buscar por r_centro y consecutivo cuando el código es alfanumérico', async () => {
    const equipo = { codigo_equipo: 7, tipo: 'Impresora' };
    db.execute.mockResolvedValue([[equipo]]);

    const result = await obtenerEquipoPorCodigo(db, 'EQUIPO-ABC');

    const query = db.execute.mock.calls[0][0];
    expect(query).toContain('r_centro');
    expect(query).not.toContain('codigo_equipo = ?');
    expect(result).toEqual(equipo);
  });

  it('debe retornar null si no se encuentra el equipo', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    const result = await obtenerEquipoPorCodigo(db, 'NO-EXISTE');

    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────
// verificarAsignacionEquipo
// ──────────────────────────────────────────────
describe('verificarAsignacionEquipo()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe retornar true si existe asignación activa', async () => {
    db.execute.mockResolvedValue([[{ id_responsable: 1 }]]);

    const result = await verificarAsignacionEquipo(db, 10, 5);

    expect(result).toBe(true);
  });

  it('debe retornar false si no hay asignación activa', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    const result = await verificarAsignacionEquipo(db, 10, 5);

    expect(result).toBe(false);
  });

  it('debe pasar los parámetros correctos', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    await verificarAsignacionEquipo(db, 42, 7);

    expect(db.execute).toHaveBeenCalledWith(expect.any(String), [42, 7]);
  });
});

// ──────────────────────────────────────────────
// obtenerRolUsuario
// ──────────────────────────────────────────────
describe('obtenerRolUsuario()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe retornar el nombre del rol del usuario', async () => {
    db.execute.mockResolvedValue([[{ nombre_rol: 'Instructor' }]]);

    const result = await obtenerRolUsuario(db, 1);

    expect(result).toBe('Instructor');
  });

  it('debe retornar null si el usuario no tiene rol', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    const result = await obtenerRolUsuario(db, 99);

    expect(result).toBeNull();
  });

  it('debe retornar null si nombre_rol es undefined', async () => {
    db.execute.mockResolvedValue([[{ nombre_rol: undefined }]]);

    const result = await obtenerRolUsuario(db, 1);

    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────
// contarUsuariosActivos
// ──────────────────────────────────────────────
describe('contarUsuariosActivos()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe retornar el número de usuarios activos', async () => {
    db.execute.mockResolvedValue([[{ total: 42 }]]);

    const result = await contarUsuariosActivos(db);

    expect(result).toBe(42);
  });

  it('debe retornar 0 si no hay usuarios activos', async () => {
    db.execute.mockResolvedValue([[{ total: 0 }]]);

    const result = await contarUsuariosActivos(db);

    expect(result).toBe(0);
  });

  it('debe retornar 0 si el resultado es null/undefined', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    const result = await contarUsuariosActivos(db);

    expect(result).toBe(0);
  });

  it('debe convertir resultado string a número', async () => {
    db.execute.mockResolvedValue([[{ total: '15' }]]);

    const result = await contarUsuariosActivos(db);

    expect(result).toBe(15);
  });
});

// ──────────────────────────────────────────────
// contarEquipos
// ──────────────────────────────────────────────
describe('contarEquipos()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe retornar el número total de equipos', async () => {
    db.execute.mockResolvedValue([[{ total: 150 }]]);

    const result = await contarEquipos(db);

    expect(result).toBe(150);
  });

  it('debe retornar 0 si no hay equipos', async () => {
    db.execute.mockResolvedValue([[{ total: 0 }]]);

    const result = await contarEquipos(db);

    expect(result).toBe(0);
  });

  it('debe retornar 0 si el resultado es undefined', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    const result = await contarEquipos(db);

    expect(result).toBe(0);
  });
});

// ──────────────────────────────────────────────
// verificarDisponibilidadEquipo
// ──────────────────────────────────────────────
describe('verificarDisponibilidadEquipo()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe retornar disponible=false y razon si el equipo no existe', async () => {
    db.execute.mockResolvedValue([[undefined]]);

    const result = await verificarDisponibilidadEquipo(db, 99);

    expect(result.disponible).toBe(false);
    expect(result.razon).toMatch(/no encontrado/i);
    expect(result.estado_operativo).toBeNull();
    expect(result.estado_fisico).toBeNull();
  });

  it('debe retornar disponible=true para equipo operativo sin bloqueo', async () => {
    db.execute.mockResolvedValue([[{
      estado_fisico: 'Bueno',
      estado_operativo: 'Disponible',
      detalles_estado: null,
    }]]);

    const result = await verificarDisponibilidadEquipo(db, 1);

    expect(result.disponible).toBe(true);
    expect(result.razon).toBeNull();
  });

  it('debe retornar disponible=false para equipo Dañado', async () => {
    db.execute.mockResolvedValue([[{
      estado_fisico: 'Dañado',
      estado_operativo: 'Dañado',
      detalles_estado: 'Pantalla rota',
    }]]);

    const result = await verificarDisponibilidadEquipo(db, 2);

    expect(result.disponible).toBe(false);
    expect(result.razon).toBeTruthy();
  });

  it('debe retornar disponible=false para equipo En Mantenimiento', async () => {
    db.execute.mockResolvedValue([[{
      estado_fisico: 'Regular',
      estado_operativo: 'En Mantenimiento',
      detalles_estado: null,
    }]]);

    const result = await verificarDisponibilidadEquipo(db, 3);

    expect(result.disponible).toBe(false);
    expect(result.estado_operativo).toBe('En Mantenimiento');
  });

  it('debe retornar disponible=false para equipo Dado de Baja', async () => {
    db.execute.mockResolvedValue([[{
      estado_fisico: 'Malo',
      estado_operativo: 'Dado de Baja',
      detalles_estado: null,
    }]]);

    const result = await verificarDisponibilidadEquipo(db, 4);

    expect(result.disponible).toBe(false);
  });

  it('debe retornar disponible=false si estado_fisico es Dañado pero operativo no está sincronizado', async () => {
    db.execute.mockResolvedValue([[{
      estado_fisico: 'Dañado',
      estado_operativo: 'Disponible',
      detalles_estado: null,
    }]]);

    const result = await verificarDisponibilidadEquipo(db, 5);

    expect(result.disponible).toBe(false);
    expect(result.requiere_sincronizacion).toBe(true);
  });

  it('debe incluir estado_operativo y estado_fisico en la respuesta', async () => {
    db.execute.mockResolvedValue([[{
      estado_fisico: 'Bueno',
      estado_operativo: 'Disponible',
      detalles_estado: null,
    }]]);

    const result = await verificarDisponibilidadEquipo(db, 1);

    expect(result).toHaveProperty('estado_operativo');
    expect(result).toHaveProperty('estado_fisico');
  });

  it('debe usar "Disponible" como fallback cuando estado_operativo es null [line 200]', async () => {
    db.execute.mockResolvedValue([[{
      estado_fisico: 'Bueno',
      estado_operativo: null,
      detalles_estado: null,
    }]]);

    const result = await verificarDisponibilidadEquipo(db, 6);

    expect(result.disponible).toBe(true);
    expect(result.estado_operativo).toBe('Disponible');
  });
});

// ──────────────────────────────────────────────
// deshabilitarAsignacionesActivas
// ──────────────────────────────────────────────
describe('deshabilitarAsignacionesActivas()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe devolver {deshabilitadas:0, usuarios_afectados:[]} si no hay asignaciones activas', async () => {
    db.execute.mockResolvedValueOnce([[]]); // sin asignaciones

    const result = await deshabilitarAsignacionesActivas(db, 99, 1);

    expect(result.deshabilitadas).toBe(0);
    expect(result.usuarios_afectados).toEqual([]);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('debe deshabilitar asignaciones activas y devolver lista de usuarios afectados', async () => {
    db.execute
      .mockResolvedValueOnce([[{ id_responsable: 1, id_usuario: 5, fecha_asignacion: '2025-01-01' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
      .mockResolvedValueOnce([{ insertId: 1 }]);     // INSERT historial

    const result = await deshabilitarAsignacionesActivas(db, 10, 2, 'Equipo dañado');

    expect(result.deshabilitadas).toBe(1);
    expect(result.usuarios_afectados).toContain(5);
  });

  it('debe silenciar el error si la tabla Historial_Equipos no existe', async () => {
    db.execute
      .mockResolvedValueOnce([[{ id_responsable: 2, id_usuario: 7, fecha_asignacion: '2025-01-01' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE
      .mockRejectedValueOnce(new Error('Table Historial_Equipos does not exist')); // INSERT falla

    // No debe lanzar excepción
    await expect(
      deshabilitarAsignacionesActivas(db, 10, 2)
    ).resolves.toMatchObject({ deshabilitadas: 1 });
  });

  it('debe usar razón por defecto si no se provee', async () => {
    db.execute
      .mockResolvedValueOnce([[{ id_responsable: 3, id_usuario: 8, fecha_asignacion: '2025-01-01' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 1 }]);

    const result = await deshabilitarAsignacionesActivas(db, 10, 1);
    expect(result.deshabilitadas).toBe(1);
    // El UPDATE debe haberse llamado con la razón por defecto
    const updateCall = db.execute.mock.calls[1];
    expect(updateCall[1][0]).toContain('deshabilitado');
  });

  it('debe manejar múltiples asignaciones activas', async () => {
    db.execute
      .mockResolvedValueOnce([[
        { id_responsable: 1, id_usuario: 5, fecha_asignacion: '2025-01-01' },
        { id_responsable: 2, id_usuario: 9, fecha_asignacion: '2025-01-02' },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 2 }])  // UPDATE
      .mockResolvedValueOnce([{ insertId: 1 }])       // INSERT historial #1
      .mockResolvedValueOnce([{ insertId: 2 }]);      // INSERT historial #2

    const result = await deshabilitarAsignacionesActivas(db, 10, 1, 'Dado de baja');

    expect(result.deshabilitadas).toBe(2);
    expect(result.usuarios_afectados).toEqual([5, 9]);
  });
});

// ──────────────────────────────────────────────
// obtenerAmbientesValidosAprendiz
// ──────────────────────────────────────────────
describe('obtenerAmbientesValidosAprendiz()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe devolver array vacío si no hay ficha ni clases', async () => {
    db.execute
      .mockResolvedValueOnce([[]])   // sin aprendizData
      .mockResolvedValueOnce([[]]); // sin clases

    const result = await obtenerAmbientesValidosAprendiz(db, 1);
    expect(result).toEqual([]);
  });

  it('debe retornar ambientes de clases cuando no hay ficha', async () => {
    db.execute
      .mockResolvedValueOnce([[]])                                      // sin aprendizData
      .mockResolvedValueOnce([[{ id_ambiente: 3 }, { id_ambiente: 7 }]]); // clases

    const result = await obtenerAmbientesValidosAprendiz(db, 2);
    expect(result).toContain(3);
    expect(result).toContain(7);
  });

  it('debe combinar ambientes de clases y de ficha sin duplicados', async () => {
    db.execute
      .mockResolvedValueOnce([[{ ficha: '2750001' }]])         // ficha encontrada
      .mockResolvedValueOnce([[{ id_ambiente: 3 }]])           // clases del aprendiz
      .mockResolvedValueOnce([[{ id_ambiente: 3 }, { id_ambiente: 5 }]]); // clases de la ficha

    const result = await obtenerAmbientesValidosAprendiz(db, 3);
    expect(result).toContain(3);
    expect(result).toContain(5);
    // Sin duplicados
    expect(result.filter(a => a === 3).length).toBe(1);
  });

  it('debe no hacer tercera query si ficha es null', async () => {
    db.execute
      .mockResolvedValueOnce([[{ ficha: null }]])  // sin ficha
      .mockResolvedValueOnce([[{ id_ambiente: 4 }]]); // clases

    await obtenerAmbientesValidosAprendiz(db, 4);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });
});

// ──────────────────────────────────────────────
// verificarAmbienteEquipoAprendiz
// ──────────────────────────────────────────────
describe('verificarAmbienteEquipoAprendiz()', () => {
  let db;
  beforeEach(() => { db = makeMockDb(); });

  it('debe devolver valido:false si el equipo no existe', async () => {
    db.execute.mockResolvedValueOnce([[]]); // equipo no encontrado

    const result = await verificarAmbienteEquipoAprendiz(db, 99, 1);

    expect(result.valido).toBe(false);
    expect(result.razon).toContain('no encontrado');
    expect(result.ambiente_equipo).toBeNull();
  });

  it('debe devolver valido:false si el aprendiz no tiene clases activas', async () => {
    db.execute
      .mockResolvedValueOnce([[{ id_ambiente: 2, nombre_ambiente: 'Lab TI' }]]) // equipo
      .mockResolvedValueOnce([[]])  // sin aprendizData
      .mockResolvedValueOnce([[]]); // sin clases

    const result = await verificarAmbienteEquipoAprendiz(db, 10, 5);

    expect(result.valido).toBe(false);
    expect(result.razon).toContain('clases activas');
    expect(result.ambiente_equipo).toBe(2);
  });

  it('debe devolver valido:false si el ambiente del equipo no coincide', async () => {
    db.execute
      .mockResolvedValueOnce([[{ id_ambiente: 2, nombre_ambiente: 'Lab TI' }]]) // equipo en amb 2
      .mockResolvedValueOnce([[]])                                                // sin aprendizData
      .mockResolvedValueOnce([[{ id_ambiente: 3 }]]);                            // clases en amb 3

    const result = await verificarAmbienteEquipoAprendiz(db, 10, 5);

    expect(result.valido).toBe(false);
    expect(result.razon).toContain('Lab TI');
  });

  it('debe devolver valido:true si el ambiente del equipo coincide', async () => {
    db.execute
      .mockResolvedValueOnce([[{ id_ambiente: 2, nombre_ambiente: 'Lab TI' }]]) // equipo en amb 2
      .mockResolvedValueOnce([[]])                                                // sin aprendizData
      .mockResolvedValueOnce([[{ id_ambiente: 2 }, { id_ambiente: 4 }]]);        // clases incluyen amb 2

    const result = await verificarAmbienteEquipoAprendiz(db, 10, 5);

    expect(result.valido).toBe(true);
    expect(result.razon).toBeNull();
    expect(result.ambiente_equipo).toBe(2);
  });

  it('debe usar "N/A" cuando nombre_ambiente es null [line 403]', async () => {
    db.execute
      .mockResolvedValueOnce([[{ id_ambiente: 9, nombre_ambiente: null }]]) // equipo sin nombre
      .mockResolvedValueOnce([[]])                                           // sin aprendizData
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]]);                       // clases en amb 1 (≠ 9)

    const result = await verificarAmbienteEquipoAprendiz(db, 10, 5);

    expect(result.valido).toBe(false);
    expect(result.razon).toContain('N/A');
  });
});
