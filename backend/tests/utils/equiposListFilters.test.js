import { describe, it, expect, jest } from '@jest/globals';
import {
  parseListarEquiposQuery,
  resolverAmbientesIds,
  escaparLike,
} from '../../src/utils/equiposListFilters.js';

describe('parseListarEquiposQuery', () => {
  it('normaliza listas, textos y paginación con los mismos valores para tabla y exportación', () => {
    const { filters, pagination, sorting } = parseListarEquiposQuery({
      search: '  latitude ',
      estado_fisico: 'Bueno',
      estado_operativo: ['Disponible', ' En Uso '],
      ambiente: ['12', '14'],
      placa: ' 9211 ',
      tipo_modelo: 'Portátil',
      en_prestamo: 'si',
      id_cuentadante: '7',
      page: 3,
      limit: 25,
      sort: 'placa',
      order: 'desc',
    });

    expect(filters).toMatchObject({
      search: 'latitude',
      estado_fisico: ['Bueno'],
      estado_operativo: ['Disponible', 'En Uso'],
      ambiente: ['12', '14'],
      placa: '9211',
      tipo_modelo: 'Portátil',
      en_prestamo: 'si',
      id_cuentadante: 7,
    });
    expect(pagination).toEqual({ page: 3, limit: 25 });
    expect(sorting).toEqual({ field: 'placa', order: 'desc' });
  });

  it('descarta valores vacíos o fuera del dominio sin inventar filtros', () => {
    const { filters, pagination, sorting } = parseListarEquiposQuery({
      search: '   ',
      estado_fisico: [],
      ambiente: '',
      en_prestamo: 'quizas',
      id_cuentadante: '-3',
    });

    expect(filters.search).toBeNull();
    expect(filters.estado_fisico).toBeNull();
    expect(filters.ambiente).toBeNull();
    expect(filters.en_prestamo).toBeNull();
    expect(filters.id_cuentadante).toBeNull();
    expect(pagination).toEqual({ page: 1, limit: 50 });
    expect(sorting).toEqual({ field: 'codigo_equipo', order: 'asc' });
  });

  it('acepta el query vacío', () => {
    expect(parseListarEquiposQuery().filters.placa).toBeNull();
  });
});

describe('resolverAmbientesIds', () => {
  it('usa los ids numéricos sin consultar y resuelve código o nombre en BD', async () => {
    const db = { execute: jest.fn().mockResolvedValueOnce([[{ id_ambiente: 9 }]]) };

    const ids = await resolverAmbientesIds(db, ['12', 'AMB-303', '12']);

    expect(ids).toEqual([12, 9]);
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.execute.mock.calls[0][1]).toEqual(['AMB-303', 'AMB-303']);
  });

  it('omite referencias inexistentes', async () => {
    const db = { execute: jest.fn().mockResolvedValueOnce([[]]) };
    await expect(resolverAmbientesIds(db, ['No existe'])).resolves.toEqual([]);
  });

  it('tolera referencias nulas', async () => {
    await expect(resolverAmbientesIds({ execute: jest.fn() }, null)).resolves.toEqual([]);
  });
});

describe('escaparLike', () => {
  it('escapa comodines para buscar el texto literal', () => {
    expect(escaparLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });
});
