import { describe, expect, test } from '@jest/globals';
import { buildPrestamosInformeQuery } from '../../src/utils/prestamosInformeQuery.js';

describe('informe de préstamos', () => {
  test('cuentadante solo ve sesiones de equipos a su cargo y mantiene los filtros en COUNT', () => {
    const result = buildPrestamosInformeQuery({ rol: 'Cuentadante', id: 8, query: { ambiente: '22', estado: 'En Uso', page: '2' } });
    expect(result.dataSql).toContain('e.id_cuentadante = ?');
    expect(result.countSql).toContain('e.id_cuentadante = ?');
    expect(result.countSql).toContain('e.id_ambiente = ?');
    expect(result.params).toEqual([8, 22, 'En Uso']);
    expect(result.page).toBe(2);
  });

  test('rechaza consultas inválidas y roles sin acceso al informe', () => {
    expect(() => buildPrestamosInformeQuery({ rol: 'Aprendiz', id: 8, query: {} })).toThrow();
    expect(() => buildPrestamosInformeQuery({ rol: 'Administrador', id: 1, query: { ambiente: '1 OR 1=1' } })).toThrow();
    expect(() => buildPrestamosInformeQuery({ rol: 'Administrador', id: 1, query: { fecha_desde: '2026-99-99' } })).toThrow();
    expect(() => buildPrestamosInformeQuery({ rol: 'Administrador', id: 1, query: { fecha_desde: '2026-09-20', fecha_hasta: '2026-09-19' } })).toThrow();
  });

  test('administrador puede filtrar por cuentadante sin exponer documentos', () => {
    const result = buildPrestamosInformeQuery({ rol: 'Administrador', id: 1, query: { cuentadante: '8', estado: 'Finalizado' } });
    expect(result.params).toEqual([8, 'Finalizado']);
    expect(result.dataSql).not.toContain('cedula');
    expect(result.dataSql).toContain('hu.fecha_hora_fin');
  });

  test('administrador puede filtrar por documento sin incluirlo en la respuesta', () => {
    const result = buildPrestamosInformeQuery({ rol: 'Administrador', id: 1, query: { documento_cuentadante: '12345678' } });
    expect(result.countSql).toContain('c.cedula = ?');
    expect(result.params).toEqual(['12345678']);
    expect(() => buildPrestamosInformeQuery({ rol: 'Cuentadante', id: 8, query: { documento_cuentadante: '12345678' } })).toThrow();
  });
});
