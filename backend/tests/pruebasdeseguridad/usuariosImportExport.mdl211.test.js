/**
 * Negativas de seguridad — MDL-211 Usuarios import/export.
 */
import { describe, it, expect } from '@jest/globals';
import {
  assertUsuarioImportRoleAllowed,
  buildUsuarioExportRow,
  USUARIOS_PLANTILLA_COLUMNS,
} from '../../src/utils/usuariosImportExport.js';
import { sanitizeExcelValue, assertWorkbookLimits } from '../../src/utils/excelSecurity.js';

describe('MDL-211 seguridad Usuarios import/export', () => {
  it('niega creación de Administrador y Cuentadante por import', () => {
    for (const rol of ['Administrador', 'Cuentadante', 'administrador', 'CUENTADANTE']) {
      const r = assertUsuarioImportRoleAllowed(rol);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/invitación|importación/i);
    }
  });

  it('export reimportable no incluye hashes ni tokens', () => {
    const row = buildUsuarioExportRow({
      nombre_usuario: 'Admin',
      cedula: '1',
      nombre_rol: 'Aprendiz',
      estado: 'Activo',
      contrasena: '$2b$10$abcdefghijklmnopqrstuv',
      refresh_token: 'tok',
    });
    expect(Object.keys(row)).toEqual([...USUARIOS_PLANTILLA_COLUMNS]);
    const blob = JSON.stringify(row);
    expect(blob).not.toMatch(/\$2b\$/);
    expect(blob).not.toMatch(/token/i);
    expect(blob).not.toMatch(/contrasena/i);
  });

  it('sanitiza prefijos de fórmula en celdas', () => {
    expect(sanitizeExcelValue('=HYPERLINK("http://evil")')).toBe("'=HYPERLINK(\"http://evil\")");
    expect(sanitizeExcelValue('+cmd')).toBe("'+cmd");
    expect(sanitizeExcelValue('-1+1')).toBe("'-1+1");
    expect(sanitizeExcelValue('@x')).toBe("'@x");
  });

  it('aplica límites estructurales XLSX', () => {
    expect(() =>
      assertWorkbookLimits({
        SheetNames: Array.from({ length: 20 }, (_, i) => `H${i}`),
        Sheets: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`H${i}`, { '!ref': 'A1:B2' }])),
      })
    ).toThrow(/hojas/i);
  });
});
