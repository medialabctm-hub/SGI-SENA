/**
 * Tests para builders/UserBuilder
 *
 * Cubre: withNombre, withCedula, withTipoDocumento, withTipoDocumentoOtro,
 *        withCorreo, withTelefono, withContrasena, withIdRol, build, reset
 */

import { describe, it, expect } from '@jest/globals';
import { UserBuilder } from '../../src/builders/UserBuilder.js';

// Helper que construye un usuario con todos los campos válidos
function usuarioCompleto() {
  return new UserBuilder()
    .withNombre('Juan Carlos')
    .withCedula('1234567890')
    .withCorreo('juan@sena.edu.co')
    .withTelefono('3001234567')
    .withContrasena('password123')
    .withIdRol(2);
}

describe('UserBuilder', () => {
  // ──────────────────────────────────────────────
  // build() - campos requeridos
  // ──────────────────────────────────────────────
  describe('build()', () => {
    it('debe construir un usuario con todos los campos obligatorios', () => {
      const user = usuarioCompleto().build();

      expect(user.nombre).toBe('Juan Carlos');
      expect(user.cedula).toBe('1234567890');
      expect(user.correo).toBe('juan@sena.edu.co');
      expect(user.telefono).toBe('3001234567');
      expect(user.contrasena).toBe('password123');
      expect(user.idRol).toBe(2);
    });

    it('debe retornar un objeto plano (no instancia de UserBuilder)', () => {
      const user = usuarioCompleto().build();

      expect(typeof user).toBe('object');
      expect(user).not.toBeInstanceOf(UserBuilder);
    });

    it('debe lanzar error si faltan campos requeridos', () => {
      expect(() => new UserBuilder().build()).toThrow('Faltan campos requeridos');
    });

    it('debe listar los campos faltantes en el mensaje de error', () => {
      expect(() => new UserBuilder().build()).toThrow(
        /nombre|cedula|correo|telefono|contrasena|idRol/
      );
    });

    it('debe lanzar error si solo faltan algunos campos', () => {
      expect(() =>
        new UserBuilder().withNombre('Juan').withCedula('12345').build()
      ).toThrow('Faltan campos requeridos');
    });
  });

  // ──────────────────────────────────────────────
  // withNombre
  // ──────────────────────────────────────────────
  describe('withNombre()', () => {
    it('debe aceptar un nombre válido', () => {
      const builder = new UserBuilder().withNombre('Maria');
      expect(builder.user.nombre).toBe('Maria');
    });

    it('debe hacer trim al nombre', () => {
      const builder = new UserBuilder().withNombre('  Pedro  ');
      expect(builder.user.nombre).toBe('Pedro');
    });

    it('debe lanzar error si el nombre tiene menos de 2 caracteres', () => {
      expect(() => new UserBuilder().withNombre('A')).toThrow(
        'El nombre debe tener al menos 2 caracteres'
      );
    });

    it('debe lanzar error si el nombre es una cadena vacía', () => {
      expect(() => new UserBuilder().withNombre('')).toThrow();
    });

    it('debe lanzar error si el nombre es null/undefined', () => {
      expect(() => new UserBuilder().withNombre(null)).toThrow();
      expect(() => new UserBuilder().withNombre(undefined)).toThrow();
    });

    it('debe retornar la instancia del builder (method chaining)', () => {
      const builder = new UserBuilder();
      const result = builder.withNombre('Test');
      expect(result).toBeInstanceOf(UserBuilder);
    });
  });

  // ──────────────────────────────────────────────
  // withCedula
  // ──────────────────────────────────────────────
  describe('withCedula()', () => {
    it('debe aceptar una cédula válida', () => {
      const builder = new UserBuilder().withCedula('12345');
      expect(builder.user.cedula).toBe('12345');
    });

    it('debe hacer trim a la cédula', () => {
      const builder = new UserBuilder().withCedula('  98765  ');
      expect(builder.user.cedula).toBe('98765');
    });

    it('debe lanzar error si la cédula tiene menos de 5 caracteres', () => {
      expect(() => new UserBuilder().withCedula('1234')).toThrow(
        'La cédula debe tener al menos 5 caracteres'
      );
    });

    it('debe lanzar error si la cédula es vacía', () => {
      expect(() => new UserBuilder().withCedula('')).toThrow();
    });

    it('debe lanzar error si la cédula es null', () => {
      expect(() => new UserBuilder().withCedula(null)).toThrow();
    });

    it('debe retornar la instancia del builder', () => {
      expect(new UserBuilder().withCedula('12345')).toBeInstanceOf(UserBuilder);
    });
  });

  // ──────────────────────────────────────────────
  // withTipoDocumento
  // ──────────────────────────────────────────────
  describe('withTipoDocumento()', () => {
    it.each(['TI', 'CC', 'CE', 'PPT', 'Otro'])(
      'debe aceptar el tipo de documento "%s"',
      (tipo) => {
        const builder = new UserBuilder().withTipoDocumento(tipo);
        expect(builder.user.tipo_documento).toBe(tipo);
      }
    );

    it('debe asignar "CC" como valor por defecto si se pasa undefined', () => {
      const builder = new UserBuilder().withTipoDocumento(undefined);
      expect(builder.user.tipo_documento).toBe('CC');
    });

    it('debe lanzar error si el tipo de documento es inválido', () => {
      expect(() => new UserBuilder().withTipoDocumento('PASAPORTE')).toThrow(
        'Tipo de documento inválido'
      );
    });

    it('debe retornar la instancia del builder', () => {
      expect(new UserBuilder().withTipoDocumento('CC')).toBeInstanceOf(UserBuilder);
    });
  });

  // ──────────────────────────────────────────────
  // withTipoDocumentoOtro
  // ──────────────────────────────────────────────
  describe('withTipoDocumentoOtro()', () => {
    it('debe asignar el valor si se provee', () => {
      const builder = new UserBuilder().withTipoDocumentoOtro('Pasaporte');
      expect(builder.user.tipo_documento_otro).toBe('Pasaporte');
    });

    it('no debe asignar el campo si el valor es falsy', () => {
      const builder = new UserBuilder().withTipoDocumentoOtro(null);
      expect(builder.user.tipo_documento_otro).toBeUndefined();
    });

    it('debe retornar la instancia del builder', () => {
      expect(new UserBuilder().withTipoDocumentoOtro('NIT')).toBeInstanceOf(UserBuilder);
    });
  });

  // ──────────────────────────────────────────────
  // withCorreo
  // ──────────────────────────────────────────────
  describe('withCorreo()', () => {
    it('debe aceptar un correo válido', () => {
      const builder = new UserBuilder().withCorreo('test@sena.edu.co');
      expect(builder.user.correo).toBe('test@sena.edu.co');
    });

    it('debe normalizar el correo a minúsculas', () => {
      // La validación con regex ocurre antes del trim, así que el correo
      // debe estar sin espacios externos para pasar la validación
      const builder = new UserBuilder().withCorreo('TEST@SENA.EDU.CO');
      expect(builder.user.correo).toBe('test@sena.edu.co');
    });

    it('debe lanzar error si el correo no tiene formato válido', () => {
      expect(() => new UserBuilder().withCorreo('no-es-un-correo')).toThrow(
        'Correo electrónico inválido'
      );
    });

    it('debe lanzar error si el correo es vacío', () => {
      expect(() => new UserBuilder().withCorreo('')).toThrow();
    });

    it('debe lanzar error si el correo es null', () => {
      expect(() => new UserBuilder().withCorreo(null)).toThrow();
    });

    it('debe retornar la instancia del builder', () => {
      expect(new UserBuilder().withCorreo('test@x.com')).toBeInstanceOf(UserBuilder);
    });
  });

  // ──────────────────────────────────────────────
  // withTelefono
  // ──────────────────────────────────────────────
  describe('withTelefono()', () => {
    it('debe aceptar un teléfono válido', () => {
      const builder = new UserBuilder().withTelefono('3001234567');
      expect(builder.user.telefono).toBe('3001234567');
    });

    it('debe hacer trim al teléfono', () => {
      const builder = new UserBuilder().withTelefono('  3001234567  ');
      expect(builder.user.telefono).toBe('3001234567');
    });

    it('debe lanzar error si el teléfono tiene menos de 7 caracteres', () => {
      expect(() => new UserBuilder().withTelefono('123456')).toThrow(
        'El teléfono debe tener al menos 7 caracteres'
      );
    });

    it('debe lanzar error si el teléfono es vacío', () => {
      expect(() => new UserBuilder().withTelefono('')).toThrow();
    });

    it('debe retornar la instancia del builder', () => {
      expect(new UserBuilder().withTelefono('1234567')).toBeInstanceOf(UserBuilder);
    });
  });

  // ──────────────────────────────────────────────
  // withContrasena
  // ──────────────────────────────────────────────
  describe('withContrasena()', () => {
    it('debe aceptar una contraseña válida', () => {
      const builder = new UserBuilder().withContrasena('secreto123');
      expect(builder.user.contrasena).toBe('secreto123');
    });

    it('debe lanzar error si la contraseña tiene menos de 6 caracteres', () => {
      expect(() => new UserBuilder().withContrasena('abc12')).toThrow(
        'La contraseña debe tener al menos 6 caracteres'
      );
    });

    it('debe lanzar error si la contraseña es vacía', () => {
      expect(() => new UserBuilder().withContrasena('')).toThrow();
    });

    it('debe lanzar error si la contraseña es null', () => {
      expect(() => new UserBuilder().withContrasena(null)).toThrow();
    });

    it('debe retornar la instancia del builder', () => {
      expect(new UserBuilder().withContrasena('abcdef')).toBeInstanceOf(UserBuilder);
    });
  });

  // ──────────────────────────────────────────────
  // withIdRol
  // ──────────────────────────────────────────────
  describe('withIdRol()', () => {
    it('debe aceptar un id de rol válido', () => {
      const builder = new UserBuilder().withIdRol(3);
      expect(builder.user.idRol).toBe(3);
    });

    it('debe lanzar error si el id es 0', () => {
      expect(() => new UserBuilder().withIdRol(0)).toThrow('ID de rol inválido');
    });

    it('debe lanzar error si el id es negativo', () => {
      expect(() => new UserBuilder().withIdRol(-1)).toThrow('ID de rol inválido');
    });

    it('debe lanzar error si el id es null', () => {
      expect(() => new UserBuilder().withIdRol(null)).toThrow();
    });

    it('debe retornar la instancia del builder', () => {
      expect(new UserBuilder().withIdRol(1)).toBeInstanceOf(UserBuilder);
    });
  });

  // ──────────────────────────────────────────────
  // reset()
  // ──────────────────────────────────────────────
  describe('reset()', () => {
    it('debe limpiar todos los campos del usuario', () => {
      const builder = usuarioCompleto();
      builder.reset();
      expect(builder.user).toEqual({});
    });

    it('debe retornar la instancia del builder para encadenamiento', () => {
      const builder = new UserBuilder();
      expect(builder.reset()).toBeInstanceOf(UserBuilder);
    });

    it('debe permitir construir un nuevo usuario después del reset', () => {
      const builder = usuarioCompleto();
      builder.reset();

      const user = builder
        .withNombre('Ana')
        .withCedula('99999')
        .withCorreo('ana@sena.edu.co')
        .withTelefono('3009999999')
        .withContrasena('ana2024!')
        .withIdRol(1)
        .build();

      expect(user.nombre).toBe('Ana');
    });
  });

  // ──────────────────────────────────────────────
  // Encadenamiento (fluent interface)
  // ──────────────────────────────────────────────
  describe('Fluent interface (method chaining)', () => {
    it('todos los métodos deben devolver la instancia del builder', () => {
      const builder = new UserBuilder();

      expect(builder.withNombre('Juan')).toBe(builder);
      expect(builder.withCedula('12345')).toBe(builder);
      expect(builder.withCorreo('j@x.com')).toBe(builder);
      expect(builder.withTelefono('1234567')).toBe(builder);
      expect(builder.withContrasena('pass12')).toBe(builder);
      expect(builder.withIdRol(1)).toBe(builder);
      expect(builder.withTipoDocumento('CC')).toBe(builder);
      expect(builder.withTipoDocumentoOtro('N/A')).toBe(builder);
      expect(builder.reset()).toBe(builder);
    });
  });
});
