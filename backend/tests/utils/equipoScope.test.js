import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { construirAlcanceEquipo, normalizarIdUsuario } = await import(
  path.resolve(__dirname, '../../src/utils/equipoScope.js')
);

const dbCon = filas => ({ execute: jest.fn().mockResolvedValue([filas]) });

describe('construirAlcanceEquipo', () => {
  it('Administrador: sin restricción y sin consultar la base', async () => {
    const db = dbCon([]);
    expect(await construirAlcanceEquipo(db, { id: 1, rol: 'Administrador' })).toEqual({ sql: '', params: [], amplio: true });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('Cuentadante con ambientes: inventario propio o ambientes activos', async () => {
    const alcance = await construirAlcanceEquipo(dbCon([{ id_ambiente: 4 }, { id_ambiente: 9 }]), { id: 7, rol: 'Cuentadante' });
    expect(alcance.sql).toContain('e.id_cuentadante = ? OR e.id_ambiente IN (?,?)');
    expect(alcance.params).toEqual([7, 4, 9]);
  });

  it('Cuentadante sin ambientes: solo su inventario', async () => {
    const alcance = await construirAlcanceEquipo(dbCon([]), { id: 7, rol: 'Cuentadante' });
    expect(alcance).toEqual({ sql: ' AND e.id_cuentadante = ?', params: [7], amplio: true });
  });

  it('Instructor: ambientes con responsabilidad activa', async () => {
    const alcance = await construirAlcanceEquipo(dbCon([]), { id: 5, rol: 'Instructor' });
    expect(alcance.sql).toContain('Responsabilidades_Ambiente');
    expect(alcance.params).toEqual([5]);
  });

  it('Aprendiz: solo equipos con vínculo activo', async () => {
    const alcance = await construirAlcanceEquipo(dbCon([]), { id: '55', rol: 'Aprendiz' });
    expect(alcance.sql).toContain('Responsables_Equipo');
    expect(alcance.params).toEqual([55]);
    expect(alcance.amplio).toBe(false);
  });

  it.each([0, -3, 'abc', undefined, null, 1.5])('falla cerrado con identidad inválida (%s)', async id => {
    expect(await construirAlcanceEquipo(dbCon([]), { id, rol: 'Aprendiz' })).toBeNull();
  });
});

describe('normalizarIdUsuario', () => {
  it('acepta enteros positivos y rechaza el resto', () => {
    expect(normalizarIdUsuario('12')).toBe(12);
    expect(normalizarIdUsuario(3)).toBe(3);
    expect(normalizarIdUsuario({})).toBeNull();
    expect(normalizarIdUsuario('9007199254740993')).toBeNull();
  });
});
