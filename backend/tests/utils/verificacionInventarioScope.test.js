import { describe, it, expect, jest } from '@jest/globals';
import {
  deriveAmbienteSets,
  buildVerificacionEquiposScopeClause,
  resolveVerificacionEquipoAccess,
  VERIFICACION_DENY_MESSAGE,
  SQL_RESPONSABILIDAD_EN_AMBIENTE,
} from '../../src/utils/verificacionInventarioScope.js';

describe('verificacionInventarioScope (MDL-234)', () => {
  it('deriveAmbienteSets: cta-only excluye aulas ya en resp', () => {
    const { respSet, cuentadanteOnlyAmbienteIds, allAmbienteIds } = deriveAmbienteSets(
      [7, 1],
      [7, 25],
    );
    expect([...respSet].sort((a, b) => a - b)).toEqual([1, 7]);
    expect(cuentadanteOnlyAmbienteIds).toEqual([25]);
    expect([...allAmbienteIds].sort((a, b) => a - b)).toEqual([1, 7, 25]);
  });

  it('buildVerificacionEquiposScopeClause: evita IN vacío y combina ramas', () => {
    expect(buildVerificacionEquiposScopeClause({
      responsabilidadAmbienteIds: [],
      cuentadanteOnlyAmbienteIds: [],
      userId: 2,
    })).toBeNull();

    const onlyCta = buildVerificacionEquiposScopeClause({
      responsabilidadAmbienteIds: [],
      cuentadanteOnlyAmbienteIds: [25],
      userId: 2,
    });
    expect(onlyCta.sql).toMatch(/id_cuentadante = \?/);
    expect(onlyCta.params).toEqual([25, 2]);

    const both = buildVerificacionEquiposScopeClause({
      responsabilidadAmbienteIds: [7],
      cuentadanteOnlyAmbienteIds: [25],
      userId: 2,
    });
    expect(both.sql).toContain(' OR ');
    expect(both.params).toEqual([7, 25, 2]);
  });

  it('resolveVerificacionEquipoAccess: resp → responsable', async () => {
    const execute = jest.fn().mockResolvedValueOnce([[{
      id_responsabilidad_ambiente: 1,
      id_clase: null,
      jornada: 'Diurna',
    }]]);
    const result = await resolveVerificacionEquipoAccess(
      { execute },
      { userId: 2, idAmbiente: 7, idCuentadante: 9 },
    );
    expect(result.allowed).toBe(true);
    expect(result.alcance).toBe('responsable');
    expect(execute.mock.calls[0][0]).toContain('Responsabilidades_Ambiente');
    expect(execute.mock.calls[0][1]).toEqual([7, 2]);
  });

  it('resolveVerificacionEquipoAccess: sin resp + propio → propios', async () => {
    const execute = jest.fn().mockResolvedValueOnce([[undefined]]);
    const result = await resolveVerificacionEquipoAccess(
      { execute },
      { userId: 2, idAmbiente: 25, idCuentadante: 2 },
    );
    expect(result).toEqual({
      allowed: true,
      alcance: 'propios',
      responsabilidad: null,
    });
  });

  it('resolveVerificacionEquipoAccess: sin resp + ajeno → deny', async () => {
    const execute = jest.fn().mockResolvedValueOnce([[undefined]]);
    const result = await resolveVerificacionEquipoAccess(
      { execute },
      { userId: 2, idAmbiente: 25, idCuentadante: 9 },
    );
    expect(result.allowed).toBe(false);
    expect(VERIFICACION_DENY_MESSAGE).toMatch(/permiso/i);
    expect(SQL_RESPONSABILIDAD_EN_AMBIENTE).toMatch(/En Curso/);
  });
});
