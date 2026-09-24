import { describe, expect, it } from 'vitest';
import { dedupeAmbientesById } from './VerificarInventario';

describe('dedupeAmbientesById (MDL-234)', () => {
  it('colapsa N filas del mismo id_ambiente a una', () => {
    const input = [
      { id_ambiente: 7, nombre_ambiente: 'Aula 107', jornada: 'Diurna' },
      { id_ambiente: 7, nombre_ambiente: 'Aula 107', jornada: 'Nocturna' },
      { id_ambiente: 1, nombre_ambiente: 'Aula 101' },
      { id_ambiente: 7, nombre_ambiente: 'Aula 107', jornada: 'Mixta' },
    ];
    const out = dedupeAmbientesById(input);
    expect(out).toHaveLength(2);
    expect(out.map((a) => a.id_ambiente)).toEqual([7, 1]);
    // Conserva la primera aparición
    expect(out[0].jornada).toBe('Diurna');
  });

  it('ignora entradas sin id_ambiente y acepta vacío/null', () => {
    expect(dedupeAmbientesById(null)).toEqual([]);
    expect(dedupeAmbientesById([])).toEqual([]);
    expect(dedupeAmbientesById([{ nombre_ambiente: 'X' }, { id_ambiente: 3 }])).toEqual([
      { id_ambiente: 3 },
    ]);
  });
});
