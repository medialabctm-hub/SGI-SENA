/**
 * Tests para repositories/UserRepository
 *
 * Cubre: findByCedulaOrEmail, findInactiveByCedulaOrEmail,
 *        findByCedula, findById
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserRepository } from '../../src/repositories/UserRepository.js';

// ──────────────────────────────────────────────
// Mock de db
// ──────────────────────────────────────────────
function makeMockDb(firstRow = null) {
  return {
    execute: jest.fn().mockResolvedValue([[firstRow].filter(Boolean)]),
    pool: { getConnection: jest.fn() },
  };
}

describe('UserRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = makeMockDb();
    repo = new UserRepository(db);
  });

  // ──────────────────────────────────────────────
  // findByCedula()
  // ──────────────────────────────────────────────
  describe('findByCedula()', () => {
    it('debe ejecutar una query con la cédula proporcionada', async () => {
      db.execute.mockResolvedValue([[{ id_usuario: 1, cedula: '12345' }]]);

      const result = await repo.findByCedula('12345');

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE u.cedula = ?'),
        ['12345']
      );
      expect(result).toEqual({ id_usuario: 1, cedula: '12345' });
    });

    it('debe retornar null si no existe usuario con esa cédula', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findByCedula('99999');

      expect(result).toBeNull();
    });

    it('la query debe filtrar solo usuarios Activos', async () => {
      db.execute.mockResolvedValue([[]]);
      await repo.findByCedula('12345');

      const query = db.execute.mock.calls[0][0];
      expect(query).toMatch(/Activo/);
    });

    it('la query debe hacer JOIN con la tabla Roles', async () => {
      db.execute.mockResolvedValue([[]]);
      await repo.findByCedula('12345');

      const query = db.execute.mock.calls[0][0];
      expect(query.toLowerCase()).toMatch(/join.*roles/i);
    });
  });

  // ──────────────────────────────────────────────
  // findById()
  // ──────────────────────────────────────────────
  describe('findById()', () => {
    it('debe ejecutar una query con el id proporcionado', async () => {
      const mockUser = { id_usuario: 42, nombre_usuario: 'Juan', nombre_rol: 'Instructor' };
      db.execute.mockResolvedValue([[mockUser]]);

      const result = await repo.findById(42);

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE u.id_usuario = ?'),
        [42]
      );
      expect(result).toEqual(mockUser);
    });

    it('debe retornar null si no existe usuario con ese id', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });

    it('la query debe filtrar solo usuarios Activos', async () => {
      db.execute.mockResolvedValue([[]]);
      await repo.findById(1);

      const query = db.execute.mock.calls[0][0];
      expect(query).toMatch(/Activo/);
    });

    it('la query debe seleccionar campos del usuario incluyendo nombre_rol', async () => {
      db.execute.mockResolvedValue([[]]);
      await repo.findById(1);

      const query = db.execute.mock.calls[0][0];
      expect(query.toLowerCase()).toMatch(/nombre_rol/);
    });
  });

  // ──────────────────────────────────────────────
  // findByCedulaOrEmail()
  // ──────────────────────────────────────────────
  describe('findByCedulaOrEmail()', () => {
    it('debe buscar por cédula y correo cuando ambos están presentes', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findByCedulaOrEmail('12345', 'test@sena.edu.co');

      const [query, params] = db.execute.mock.calls[0];
      expect(query).toMatch(/cedula = \?/);
      expect(query.toLowerCase()).toMatch(/correo/i);
      expect(params).toContain('12345');
      expect(params).toContain('test@sena.edu.co'); // normalizado a minúsculas
    });

    it('debe buscar solo por cédula cuando no hay correo', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findByCedulaOrEmail('12345', null);

      const [query, params] = db.execute.mock.calls[0];
      expect(params).toEqual(['12345']);
    });

    it('debe normalizar el correo a minúsculas', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findByCedulaOrEmail('12345', 'USUARIO@SENA.EDU.CO');

      const params = db.execute.mock.calls[0][1];
      expect(params).toContain('usuario@sena.edu.co');
    });

    it('debe retornar el usuario si existe', async () => {
      const usuario = { id_usuario: 7, cedula: '12345', estado: 'Activo' };
      db.execute.mockResolvedValue([[usuario]]);

      const result = await repo.findByCedulaOrEmail('12345', null);

      expect(result).toEqual(usuario);
    });

    it('debe retornar null si no hay coincidencias', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findByCedulaOrEmail('00000', null);

      expect(result).toBeNull();
    });

    it('la query debe filtrar solo usuarios Activos', async () => {
      db.execute.mockResolvedValue([[]]);
      await repo.findByCedulaOrEmail('12345', null);

      const query = db.execute.mock.calls[0][0];
      expect(query).toMatch(/Activo/);
    });
  });

  // ──────────────────────────────────────────────
  // findInactiveByCedulaOrEmail()
  // ──────────────────────────────────────────────
  describe('findInactiveByCedulaOrEmail()', () => {
    it('debe buscar usuarios inactivos por cédula', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findInactiveByCedulaOrEmail('12345', null);

      const query = db.execute.mock.calls[0][0];
      expect(query).toMatch(/Inactivo/);
      expect(query).toMatch(/cedula = \?/);
    });

    it('debe incluir el correo en la búsqueda cuando está presente', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findInactiveByCedulaOrEmail('12345', 'inactivo@sena.edu.co');

      const params = db.execute.mock.calls[0][1];
      expect(params.length).toBeGreaterThan(1);
      expect(params).toContain('inactivo@sena.edu.co');
    });

    it('debe retornar null si no hay usuario inactivo con esos datos', async () => {
      db.execute.mockResolvedValue([[]]);      

      const result = await repo.findInactiveByCedulaOrEmail('11111', null);

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // findAll()
  // ──────────────────────────────────────────────
  describe('findAll()', () => {
    it('debe retornar todos los usuarios activos sin filtro de rol', async () => {
      const usuarios = [{ id_usuario: 1 }, { id_usuario: 2 }];
      db.execute.mockResolvedValue([usuarios]);

      const result = await repo.findAll();

      expect(result).toEqual(usuarios);
      const query = db.execute.mock.calls[0][0];
      expect(query.toLowerCase()).toContain('left join');
    });

    it('debe filtrar por rol cuando se pasa el parámetro', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findAll('Instructor');

      const [query, params] = db.execute.mock.calls[0];
      expect(query.toLowerCase()).toContain('inner join');
      expect(query).toContain('nombre_rol = ?');
      expect(params).toContain('Instructor');
    });

    it('debe retornar array vacío si no hay usuarios', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });

    it('debe propagar errores de la base de datos', async () => {
      db.execute.mockRejectedValue(new Error('DB error'));

      await expect(repo.findAll()).rejects.toThrow('DB error');
    });
  });

  // ──────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────
  describe('create()', () => {
    const baseUser = {
      nombre: 'Carlos Pérez',
      cedula: '12345678',
      tipo_documento: 'CC',
      correo: 'carlos@sena.edu.co',
      telefono: '3001234567',
      contrasena: 'hashed_password',
      idRol: 2,
    };

    it('debe insertar usuario y retornar insertId', async () => {
      db.execute.mockResolvedValue([{ insertId: 10, affectedRows: 1 }]);

      const result = await repo.create(baseUser);

      expect(result.insertId).toBe(10);
      expect(result.affectedRows).toBe(1);
      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO Usuarios'),
        expect.arrayContaining(['Carlos Pérez', '12345678', 'CC'])
      );
    });

    it('debe normalizar el correo a minúsculas', async () => {
      db.execute.mockResolvedValue([{ insertId: 11, affectedRows: 1 }]);

      await repo.create({ ...baseUser, correo: 'CARLOS@SENA.EDU.CO' });

      const params = db.execute.mock.calls[0][1];
      expect(params).toContain('carlos@sena.edu.co');
    });

    it('debe usar CC como tipo_documento por defecto', async () => {
      db.execute.mockResolvedValue([{ insertId: 12, affectedRows: 1 }]);
      const { tipo_documento, ...sinTipo } = baseUser;

      await repo.create(sinTipo);

      const params = db.execute.mock.calls[0][1];
      expect(params).toContain('CC');
    });

    it('debe incluir tipo_documento_otro cuando tipo es Otro', async () => {
      db.execute.mockResolvedValue([{ insertId: 13, affectedRows: 1 }]);

      await repo.create({ ...baseUser, tipo_documento: 'Otro', tipo_documento_otro: 'Pasaporte' });

      const params = db.execute.mock.calls[0][1];
      expect(params).toContain('Pasaporte');
    });

    it('debe lanzar error descriptivo si cédula está duplicada', async () => {
      const dupError = new Error('Duplicate entry for cedula');
      dupError.code = 'ER_DUP_ENTRY';
      dupError.message = "Duplicate entry '12345678' for key 'cedula'";
      db.execute.mockRejectedValue(dupError);

      await expect(repo.create(baseUser)).rejects.toThrow('La cédula ya está registrada');
    });

    it('debe lanzar error descriptivo si correo está duplicado', async () => {
      const dupError = new Error('Duplicate entry for correo');
      dupError.code = 'ER_DUP_ENTRY';
      dupError.message = "Duplicate entry 'test@test.com' for key 'correo'";
      db.execute.mockRejectedValue(dupError);

      await expect(repo.create(baseUser)).rejects.toThrow('correo electrónico ya está registrado');
    });

    it('debe lanzar error genérico de duplicado si no es ni cédula ni correo', async () => {
      const dupError = new Error('Duplicate entry');
      dupError.code = 'ER_DUP_ENTRY';
      dupError.message = "Duplicate entry for key 'otro_campo'";
      db.execute.mockRejectedValue(dupError);

      await expect(repo.create(baseUser)).rejects.toThrow('ya existe');
    });

    it('debe propagar errores no relacionados con duplicados', async () => {
      db.execute.mockRejectedValue(new Error('Connection lost'));

      await expect(repo.create(baseUser)).rejects.toThrow('Connection lost');
    });
  });

  // ──────────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────────
  describe('update()', () => {
    it('debe actualizar nombre y retornar affectedRows', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await repo.update(5, { nombre: 'Nuevo Nombre' });

      expect(result.affectedRows).toBe(1);
      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE Usuarios SET'),
        ['Nuevo Nombre', 5]
      );
    });

    it('debe retornar affectedRows:0 si no hay campos a actualizar', async () => {
      const result = await repo.update(5, {});

      expect(result).toEqual({ affectedRows: 0 });
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('debe actualizar tipo_documento y limpiar tipo_documento_otro si no es Otro', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { tipo_documento: 'CE' });

      const params = db.execute.mock.calls[0][1];
      expect(params).toContain(null); // tipo_documento_otro = null
    });

    it('debe actualizar tipo_documento_otro cuando tipo es Otro', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { tipo_documento: 'Otro', tipo_documento_otro: 'TIE' });

      const params = db.execute.mock.calls[0][1];
      expect(params).toContain('TIE');
    });

    it('debe actualizar solo tipo_documento_otro independientemente', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { tipo_documento_otro: 'NIT' });

      const query = db.execute.mock.calls[0][0];
      expect(query).toContain('tipo_documento_otro = ?');
    });

    it('debe normalizar correo a minúsculas', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { correo: 'NUEVO@SENA.EDU.CO' });

      const params = db.execute.mock.calls[0][1];
      expect(params).toContain('nuevo@sena.edu.co');
    });

    it('debe mapear fotoPerfil a foto_perfil', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { fotoPerfil: '/uploads/foto.jpg' });

      const query = db.execute.mock.calls[0][0];
      expect(query).toContain('foto_perfil = ?');
    });

    it('debe actualizar idRol', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { idRol: 3 });

      const params = db.execute.mock.calls[0][1];
      expect(params).toContain(3);
    });

    it('debe actualizar cédula [lines 219-220]', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { cedula: '99887766' });

      const query = db.execute.mock.calls[0][0];
      const params = db.execute.mock.calls[0][1];
      expect(query).toContain('cedula = ?');
      expect(params).toContain('99887766');
    });

    it('debe actualizar teléfono [lines 243-244]', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { telefono: '3001234567' });

      const query = db.execute.mock.calls[0][0];
      const params = db.execute.mock.calls[0][1];
      expect(query).toContain('telefono = ?');
      expect(params).toContain('3001234567');
    });

    it('debe usar null cuando tipo_documento es Otro sin tipo_documento_otro [line 228]', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { tipo_documento: 'Otro' }); // sin tipo_documento_otro

      const params = db.execute.mock.calls[0][1];
      expect(params).toContain('Otro');
      expect(params).toContain(null);
    });

    it('debe usar null cuando tipo_documento_otro es null [line 236]', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { tipo_documento_otro: null });

      const query = db.execute.mock.calls[0][0];
      const params = db.execute.mock.calls[0][1];
      expect(query).toContain('tipo_documento_otro = ?');
      expect(params).toContain(null);
    });

    it('debe usar null cuando fotoPerfil es null [line 252]', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(5, { fotoPerfil: null });

      const query = db.execute.mock.calls[0][0];
      const params = db.execute.mock.calls[0][1];
      expect(query).toContain('foto_perfil = ?');
      expect(params).toContain(null);
    });
  });

  // ──────────────────────────────────────────────
  // delete()
  // ──────────────────────────────────────────────
  describe('delete()', () => {
    it('debe eliminar usuario y retornar affectedRows y datos del usuario', async () => {
      const usuario = { id_usuario: 5, cedula: '12345', correo: 'test@test.com' };
      db.execute
        .mockResolvedValueOnce([[usuario]])   // findOne: existe
        .mockResolvedValueOnce([{ affectedRows: 1 }])  // DELETE
        .mockResolvedValueOnce([[]])          // findOne: ya no existe
        ;

      const result = await repo.delete(5);

      expect(result.affectedRows).toBe(1);
      expect(result.usuarioEliminado).toEqual(usuario);
    });

    it('debe retornar affectedRows:0 si el usuario no existe', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.delete(999);

      expect(result).toEqual({ affectedRows: 0 });
    });

    it('debe lanzar error si el usuario sigue existiendo después del DELETE', async () => {
      const usuario = { id_usuario: 5, cedula: '12345', correo: 'test@test.com' };
      db.execute
        .mockResolvedValueOnce([[usuario]])   // findOne: existe
        .mockResolvedValueOnce([{ affectedRows: 1 }])  // DELETE
        .mockResolvedValueOnce([[usuario]])  // findOne: sigue existiendo!
        ;

      await expect(repo.delete(5)).rejects.toThrow('no fue eliminado correctamente');
    });
  });

  // ──────────────────────────────────────────────
  // getAssignedEquipos()
  // ──────────────────────────────────────────────
  describe('getAssignedEquipos()', () => {
    it('debe retornar los equipos asignados al usuario', async () => {
      const equipos = [
        { codigo_equipo: 10, tipo: 'Laptop', tipo_responsabilidad: 'Principal' },
      ];
      db.execute.mockResolvedValue([equipos]);

      const result = await repo.getAssignedEquipos(5);

      expect(result).toEqual(equipos);
      expect(db.execute).toHaveBeenCalledWith(expect.any(String), [5]);
    });

    it('debe retornar array vacío si no tiene equipos asignados', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.getAssignedEquipos(99);

      expect(result).toEqual([]);
    });

    it('la query debe filtrar por estado_responsabilidad Activo', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.getAssignedEquipos(5);

      const query = db.execute.mock.calls[0][0];
      expect(query).toContain("estado_responsabilidad = 'Activo'");
    });
  });
});
