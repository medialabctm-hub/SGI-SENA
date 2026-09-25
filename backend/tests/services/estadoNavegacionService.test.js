import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  obtenerEstadoNavegacion,
  SESION_LARGA_MINUTOS,
} from '../../src/services/estadoNavegacionService.js';

// Responde según la tabla consultada para no depender del orden de las consultas.
function makeDb(respuestas = {}) {
  return {
    execute: jest.fn(async (sql) => {
      if (sql.includes('Historial_Uso_Equipos')) return [[respuestas.prestados ?? { en_uso: 12, por_revisar: 1 }]];
      if (sql.includes('Solicitudes_Autorizacion_Movimiento')) return [[respuestas.autorizaciones ?? { por_aprobar: 3, mis_pendientes: 1 }]];
      if (sql.includes('FROM Novedades')) return [[respuestas.novedades ?? { pendientes: 5 }]];
      if (sql.includes('FROM Mantenimiento')) return [[respuestas.mantenimientos ?? { en_proceso: 2, proximos: 4 }]];
      if (sql.includes('FROM Ambientes')) return [[respuestas.ambientes ?? { activos: 3, en_mantenimiento: 1 }]];
      if (sql.includes('FROM Clases')) return [[respuestas.horarios ?? { hoy: 6, en_curso: 2 }]];
      throw new Error(`consulta inesperada: ${sql}`);
    }),
  };
}

describe('obtenerEstadoNavegacion', () => {
  let equipoService;
  let logger;

  beforeEach(() => {
    equipoService = { listarEquipos: jest.fn().mockResolvedValue({ pagination: { total: 312 } }) };
    logger = { warn: jest.fn() };
  });

  it('Administrador recibe todos los bloques con números', async () => {
    const db = makeDb();
    const estado = await obtenerEstadoNavegacion({ db, equipoService, logger }, { id: 1, rol: 'Administrador' });

    expect(estado).toEqual({
      inventario: { total: 312 },
      prestados: { en_uso: 12, por_revisar: 1 },
      autorizaciones: { por_aprobar: 3, mis_pendientes: 1 },
      novedades: { pendientes: 5 },
      horarios: { hoy: 6, en_curso: 2 },
      mantenimientos: { en_proceso: 2, proximos: 4 },
      ambientes: { activos: 3, en_mantenimiento: 1 },
    });
  });

  it('el total de inventario sale del mismo servicio y alcance que el listado', async () => {
    await obtenerEstadoNavegacion({ db: makeDb(), equipoService, logger }, { id: 7, rol: 'Cuentadante' });

    expect(equipoService.listarEquipos).toHaveBeenCalledWith({}, { page: 1, limit: 1 }, {}, 7, 'Cuentadante');
  });

  it('Instructor no recibe mantenimientos ni ambientes y cuenta novedades de sus equipos y sus clases', async () => {
    const db = makeDb();
    const estado = await obtenerEstadoNavegacion({ db, equipoService, logger }, { id: 5, rol: 'Instructor' });

    expect(estado).not.toHaveProperty('mantenimientos');
    expect(estado).not.toHaveProperty('ambientes');

    const novedadesCall = db.execute.mock.calls.find(([sql]) => sql.includes('FROM Novedades'));
    expect(novedadesCall[0]).toContain('Responsables_Equipo');
    expect(novedadesCall[1]).toEqual([5]);

    const clasesCall = db.execute.mock.calls.find(([sql]) => sql.includes('FROM Clases'));
    expect(clasesCall[0]).toContain('id_instructor = ?');
    expect(clasesCall[1]).toEqual([5]);
  });

  it('Aprendiz solo recibe el total de sus equipos habilitados', async () => {
    equipoService.listarEquipos.mockResolvedValueOnce({ pagination: { total: 2 } });
    const db = makeDb();
    const estado = await obtenerEstadoNavegacion({ db, equipoService, logger }, { id: 9, rol: 'Aprendiz' });

    expect(estado).toEqual({ inventario: { total: 2 } });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('marca por revisar las sesiones abiertas más de 24 h sin cerrarlas', async () => {
    const db = makeDb();
    await obtenerEstadoNavegacion({ db, equipoService, logger }, { id: 1, rol: 'Administrador' });

    const call = db.execute.mock.calls.find(([sql]) => sql.includes('Historial_Uso_Equipos'));
    expect(call[0]).toMatch(/^\s*SELECT/);
    expect(call[0]).not.toMatch(/UPDATE|INSERT|DELETE/i);
    expect(call[1]).toEqual([SESION_LARGA_MINUTOS]);
    expect(SESION_LARGA_MINUTOS).toBe(1440);
  });

  it('ninguna consulta escribe en la base de datos', async () => {
    const db = makeDb();
    await obtenerEstadoNavegacion({ db, equipoService, logger }, { id: 1, rol: 'Administrador' });
    for (const [sql] of db.execute.mock.calls) {
      expect(sql).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/i);
    }
  });

  it('un bloque que falla devuelve null sin romper los demás', async () => {
    const db = makeDb();
    db.execute.mockImplementationOnce(async () => { throw new Error('tabla no disponible'); });
    const estado = await obtenerEstadoNavegacion({ db, equipoService, logger }, { id: 1, rol: 'Administrador' });

    expect(estado.prestados).toBeNull();
    expect(estado.autorizaciones).toEqual({ por_aprobar: 3, mis_pendientes: 1 });
    expect(logger.warn).toHaveBeenCalledWith(
      'No se pudo calcular el estado del sidebar',
      expect.objectContaining({ bloque: 'prestados' })
    );
  });

  it('convierte valores nulos de SUM en cero', async () => {
    const db = makeDb({ prestados: { en_uso: 0, por_revisar: null }, horarios: {} });
    const estado = await obtenerEstadoNavegacion({ db, equipoService, logger }, { id: 1, rol: 'Administrador' });
    expect(estado.prestados).toEqual({ en_uso: 0, por_revisar: 0 });
    expect(estado.horarios).toEqual({ hoy: 0, en_curso: 0 });
  });
});
