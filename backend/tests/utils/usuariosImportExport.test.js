import { describe, it, expect } from '@jest/globals';
import {
  USUARIOS_PLANTILLA_COLUMNS,
  mapUsuarioImportRow,
  assertUsuarioImportRoleAllowed,
  buildUsuarioExportRow,
} from '../../src/utils/usuariosImportExport.js';

describe('usuariosImportExport (MDL-211)', () => {
  it('plantilla has exact contract columns', () => {
    expect([...USUARIOS_PLANTILLA_COLUMNS]).toEqual([
      'nombre_usuario',
      'cedula',
      'tipo_documento',
      'tipo_documento_otro',
      'telefono',
      'correo',
      'rol',
      'estado',
    ]);
  });

  it('maps plantilla columns 1:1', () => {
    const mapped = mapUsuarioImportRow({
      nombre_usuario: 'Ana',
      cedula: '1',
      tipo_documento: 'TI',
      tipo_documento_otro: '',
      telefono: '300',
      correo: 'a@b.c',
      rol: 'Instructor',
      estado: 'Activo',
    });
    expect(mapped.nombre_usuario).toBe('Ana');
    expect(mapped.cedula).toBe('1');
    expect(mapped.rol).toBe('Instructor');
  });

  it('maps documented human aliases', () => {
    const mapped = mapUsuarioImportRow({
      'Nombre Completo': 'Pedro',
      Documento: '99',
      'Tipo Documento': 'CC',
      'Tipo Documento (Otro)': '-',
      'Correo Electrónico': 'p@e.co',
      Teléfono: '301',
      Rol: 'Aprendiz',
      Estado: 'Inactivo',
    });
    expect(mapped).toMatchObject({
      nombre_usuario: 'Pedro',
      cedula: '99',
      correo: 'p@e.co',
      telefono: '301',
      rol: 'Aprendiz',
      estado: 'Inactivo',
    });
  });

  it('blocks Administrador and Cuentadante elevation on create and update', () => {
    for (const rol of ['Administrador', 'Cuentadante']) {
      const r = assertUsuarioImportRoleAllowed(rol);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/crearse ni asignarse|importación/i);
    }
    expect(assertUsuarioImportRoleAllowed('Aprendiz').ok).toBe(true);
    expect(assertUsuarioImportRoleAllowed('Instructor').ok).toBe(true);
  });

  it('export row matches plantilla keys and omits secrets', () => {
    const row = buildUsuarioExportRow({
      nombre_usuario: 'X',
      cedula: '1',
      tipo_documento: 'CC',
      nombre_rol: 'Aprendiz',
      estado: 'Activo',
      contrasena: '$2b$10$secret',
      token: 'abc',
    });
    expect(Object.keys(row)).toEqual([...USUARIOS_PLANTILLA_COLUMNS]);
    expect(row).not.toHaveProperty('contrasena');
    expect(row).not.toHaveProperty('token');
    expect(JSON.stringify(row)).not.toMatch(/\$2b\$/);
  });

  it('round-trip: export → mapImport preserves key fields', () => {
    const exported = buildUsuarioExportRow({
      nombre_usuario: 'Lucia',
      cedula: '555',
      tipo_documento: 'CE',
      tipo_documento_otro: '',
      telefono: '302',
      correo: 'l@sena.edu.co',
      nombre_rol: 'Instructor',
      estado: 'Activo',
    });
    const reimported = mapUsuarioImportRow(exported);
    expect(reimported.cedula).toBe('555');
    expect(reimported.rol).toBe('Instructor');
    expect(reimported.estado).toBe('Activo');
    expect(reimported.nombre_usuario).toBe('Lucia');
  });
});

  it('MDL-192: mapUsuarioImportRow normaliza correo (trim + lowercase)', () => {
    const mapped = mapUsuarioImportRow({
      nombre_usuario: 'Ana',
      cedula: ' 99 ',
      correo: ' Correo@X.com ',
      rol: 'Aprendiz',
    });
    expect(mapped.correo).toBe('correo@x.com');
    expect(mapped.cedula).toBe('99');
  });

