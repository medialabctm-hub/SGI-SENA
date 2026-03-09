/**
 * Tests para utils/pagination
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  getPaginationParams,
  buildLimitClause,
  formatPaginatedResponse,
  executePaginatedQuery,
} from '../../src/utils/pagination.js';

describe('utils/pagination', () => {
  it('getPaginationParams debe usar valores por defecto y respetar límites', () => {
    const params = getPaginationParams({}, 10, 50);
    expect(params.page).toBe(1);
    expect(params.limit).toBe(10);

    const params2 = getPaginationParams({ page: '2', limit: '200' }, 10, 50);
    expect(params2.page).toBe(2);
    expect(params2.limit).toBe(50); // limitado por maxLimit
  });

  it('getPaginationParams debe usar defaultLimit=20 y maxLimit=100 cuando no se proveen', () => {
    const params = getPaginationParams({});
    expect(params.page).toBe(1);
    expect(params.limit).toBe(20); // defaultLimit por defecto
    expect(params.offset).toBe(0);
  });

  it('buildLimitClause debe construir cláusula LIMIT/OFFSET correcta', () => {
    const clause = buildLimitClause(20, 40);
    expect(clause).toBe('LIMIT 20 OFFSET 40');
  });

  it('formatPaginatedResponse debe calcular totalPages y flags hasNext/hasPrev', () => {
    const resp = formatPaginatedResponse([{ id: 1 }], 2, 10, 35);
    expect(resp.pagination.totalPages).toBe(4);
    expect(resp.pagination.hasNext).toBe(true);
    expect(resp.pagination.hasPrev).toBe(true);
  });
});

describe('executePaginatedQuery()', () => {
  it('debe ejecutar count + data y devolver respuesta formateada', async () => {
    const db = { execute: jest.fn() };
    db.execute
      .mockResolvedValueOnce([[{ total: 50 }]])              // count query
      .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]);     // data query

    const result = await executePaginatedQuery(
      db,
      'SELECT COUNT(*) AS total FROM Elementos',
      'SELECT * FROM Elementos',
      [],
      2,   // página 2
      10   // límite 10
    );

    expect(result.data).toHaveLength(2);
    expect(result.pagination.total).toBe(50);
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.totalPages).toBe(5);
    expect(result.pagination.hasPrev).toBe(true);
    expect(result.pagination.hasNext).toBe(true);
  });

  it('debe añadir LIMIT ? OFFSET ? a la query de datos', async () => {
    const db = { execute: jest.fn() };
    db.execute
      .mockResolvedValueOnce([[{ total: 20 }]])
      .mockResolvedValueOnce([[]]);

    await executePaginatedQuery(db, 'SELECT COUNT(*) AS total FROM T', 'SELECT * FROM T', [42], 1, 5);

    const dataCall = db.execute.mock.calls[1];
    expect(dataCall[0]).toContain('LIMIT ? OFFSET ?');
    expect(dataCall[1]).toEqual([42, 5, 0]); // params + limit + offset
  });

  it('debe calcular el offset correcto para páginas posteriores', async () => {
    const db = { execute: jest.fn() };
    db.execute
      .mockResolvedValueOnce([[{ total: 100 }]])
      .mockResolvedValueOnce([[]]);

    await executePaginatedQuery(db, 'SELECT COUNT(*) AS total FROM T', 'SELECT * FROM T', [], 3, 15);

    const dataCall = db.execute.mock.calls[1];
    // offset = (3-1)*15 = 30
    expect(dataCall[1]).toEqual([15, 30]);
  });

  it('debe propagara errores de la base de datos', async () => {
    const db = { execute: jest.fn().mockRejectedValue(new Error('DB error')) };

    await expect(
      executePaginatedQuery(db, 'SELECT COUNT(*) AS total FROM T', 'SELECT * FROM T', [], 1, 10)
    ).rejects.toThrow('DB error');
  });

  it('debe devolver hasNext:false en la última página', async () => {
    const db = { execute: jest.fn() };
    db.execute
      .mockResolvedValueOnce([[{ total: 10 }]])
      .mockResolvedValueOnce([[{ id: 1 }]]);

    const result = await executePaginatedQuery(db, 'SELECT COUNT(*) AS total FROM T', 'SELECT * FROM T', [], 1, 10);

    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(false);
  });
});
