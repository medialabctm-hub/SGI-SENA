/**
 * Tests para config/permissions
 *
 * Cubre: PERMISSIONS, ROLE_PERMISSIONS, hasPermission, hasAnyPermission,
 *        hasAllPermissions, getRolePermissions, isAdmin, isInstructor,
 *        isAprendiz, isCuentadante
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasPermissionFromDB,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  isAdmin,
  isInstructor,
  isAprendiz,
  isCuentadante,
} from '../../src/config/permissions.js';

// ──────────────────────────────────────────────
// PERMISSIONS (estructura)
// ──────────────────────────────────────────────
describe('PERMISSIONS', () => {
  it('debe tener los módulos principales definidos', () => {
    expect(PERMISSIONS).toHaveProperty('USERS');
    expect(PERMISSIONS).toHaveProperty('EQUIPOS');
    expect(PERMISSIONS).toHaveProperty('NOVEDADES');
    expect(PERMISSIONS).toHaveProperty('MANTENIMIENTO');
    expect(PERMISSIONS).toHaveProperty('REPORTES');
    expect(PERMISSIONS).toHaveProperty('AMBIENTES');
    expect(PERMISSIONS).toHaveProperty('CLASES');
    expect(PERMISSIONS).toHaveProperty('ROLES');
    expect(PERMISSIONS).toHaveProperty('SYSTEM');
  });

  it('USERS debe tener las acciones CRUD y MANAGE_ROLES', () => {
    const { USERS } = PERMISSIONS;
    expect(USERS.VIEW).toBeDefined();
    expect(USERS.CREATE).toBeDefined();
    expect(USERS.UPDATE).toBeDefined();
    expect(USERS.DELETE).toBeDefined();
    expect(USERS.MANAGE_ROLES).toBeDefined();
  });

  it('EQUIPOS debe tener permisos de asignación', () => {
    const { EQUIPOS } = PERMISSIONS;
    expect(EQUIPOS.ASSIGN).toBeDefined();
    expect(EQUIPOS.ASSIGN_TO_APRENDIZ).toBeDefined();
    expect(EQUIPOS.VIEW_OWN).toBeDefined();
  });

  it('los valores de los permisos deben seguir el formato "modulo:accion"', () => {
    expect(PERMISSIONS.USERS.VIEW).toBe('users:view');
    expect(PERMISSIONS.EQUIPOS.CREATE).toBe('equipos:create');
    expect(PERMISSIONS.NOVEDADES.RESOLVE).toBe('novedades:resolve');
    expect(PERMISSIONS.ROLES.MANAGE).toBe('roles:manage');
  });
});

// ──────────────────────────────────────────────
// ROLE_PERMISSIONS (asignaciones)
// ──────────────────────────────────────────────
describe('ROLE_PERMISSIONS', () => {
  it('debe tener los 4 roles del sistema', () => {
    expect(ROLE_PERMISSIONS).toHaveProperty('Administrador');
    expect(ROLE_PERMISSIONS).toHaveProperty('Instructor');
    expect(ROLE_PERMISSIONS).toHaveProperty('Aprendiz');
    expect(ROLE_PERMISSIONS).toHaveProperty('Cuentadante');
  });

  it('el Administrador debe tener más permisos que el Aprendiz', () => {
    expect(ROLE_PERMISSIONS.Administrador.length).toBeGreaterThan(
      ROLE_PERMISSIONS.Aprendiz.length
    );
  });

  it('el Aprendiz NO debe tener permiso para eliminar equipos', () => {
    expect(ROLE_PERMISSIONS.Aprendiz).not.toContain(PERMISSIONS.EQUIPOS.DELETE);
  });

  it('el Administrador debe tener todos los permisos críticos de sistema', () => {
    expect(ROLE_PERMISSIONS.Administrador).toContain(PERMISSIONS.SYSTEM.UPDATE_CONFIG);
    expect(ROLE_PERMISSIONS.Administrador).toContain(PERMISSIONS.ROLES.MANAGE);
    expect(ROLE_PERMISSIONS.Administrador).toContain(PERMISSIONS.USERS.DELETE);
  });

  it('el Instructor debe poder asignar equipos a Aprendices', () => {
    expect(ROLE_PERMISSIONS.Instructor).toContain(
      PERMISSIONS.EQUIPOS.ASSIGN_TO_APRENDIZ
    );
  });
});

// ──────────────────────────────────────────────
// isAdmin / isInstructor / isAprendiz / isCuentadante
// ──────────────────────────────────────────────
describe('Helpers de identificación de rol', () => {
  describe('isAdmin()', () => {
    it('debe retornar true para "Administrador"', () => {
      expect(isAdmin('Administrador')).toBe(true);
    });

    it.each(['Instructor', 'Aprendiz', 'Cuentadante', '', null, undefined])(
      'debe retornar false para "%s"',
      (rol) => {
        expect(isAdmin(rol)).toBe(false);
      }
    );
  });

  describe('isInstructor()', () => {
    it('debe retornar true para "Instructor"', () => {
      expect(isInstructor('Instructor')).toBe(true);
    });

    it('debe retornar false para otros roles', () => {
      expect(isInstructor('Administrador')).toBe(false);
      expect(isInstructor('Aprendiz')).toBe(false);
    });
  });

  describe('isAprendiz()', () => {
    it('debe retornar true para "Aprendiz"', () => {
      expect(isAprendiz('Aprendiz')).toBe(true);
    });

    it('debe retornar false para otros roles', () => {
      expect(isAprendiz('Instructor')).toBe(false);
    });
  });

  describe('isCuentadante()', () => {
    it('debe retornar true para "Cuentadante"', () => {
      expect(isCuentadante('Cuentadante')).toBe(true);
    });

    it('debe retornar false para otros roles', () => {
      expect(isCuentadante('Aprendiz')).toBe(false);
    });
  });
});

// ──────────────────────────────────────────────
// hasPermission()
// ──────────────────────────────────────────────
describe('hasPermission()', () => {
  it('el Administrador debe tener cualquier permiso (bypass total)', () => {
    expect(hasPermission('Administrador', PERMISSIONS.USERS.DELETE)).toBe(true);
    expect(hasPermission('Administrador', PERMISSIONS.ROLES.MANAGE)).toBe(true);
    expect(hasPermission('Administrador', 'permiso:ficticio')).toBe(true);
  });

  it('el Instructor debe tener "equipos:view"', () => {
    expect(hasPermission('Instructor', PERMISSIONS.EQUIPOS.VIEW)).toBe(true);
  });

  it('el Instructor NO debe tener "equipos:delete"', () => {
    expect(hasPermission('Instructor', PERMISSIONS.EQUIPOS.DELETE)).toBe(false);
  });

  it('el Aprendiz debe tener "equipos:view_own"', () => {
    expect(hasPermission('Aprendiz', PERMISSIONS.EQUIPOS.VIEW_OWN)).toBe(true);
  });

  it('el Aprendiz NO debe tener "users:view"', () => {
    expect(hasPermission('Aprendiz', PERMISSIONS.USERS.VIEW)).toBe(false);
  });

  it('un rol desconocido debe retornar false', () => {
    expect(hasPermission('RolInexistente', PERMISSIONS.USERS.VIEW)).toBe(false);
  });

  it('debe retornar false si el rol es null o undefined', () => {
    expect(hasPermission(null, PERMISSIONS.USERS.VIEW)).toBe(false);
    expect(hasPermission(undefined, PERMISSIONS.USERS.VIEW)).toBe(false);
  });

  it('el Cuentadante debe poder crear equipos', () => {
    expect(hasPermission('Cuentadante', PERMISSIONS.EQUIPOS.CREATE)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// hasAnyPermission()
// ──────────────────────────────────────────────
describe('hasAnyPermission()', () => {
  it('debe retornar true si el rol tiene al menos uno de los permisos', () => {
    const result = hasAnyPermission('Instructor', [
      PERMISSIONS.EQUIPOS.DELETE, // no tiene
      PERMISSIONS.EQUIPOS.VIEW,   // sí tiene
    ]);
    expect(result).toBe(true);
  });

  it('debe retornar false si el rol no tiene ninguno de los permisos', () => {
    const result = hasAnyPermission('Aprendiz', [
      PERMISSIONS.EQUIPOS.DELETE,
      PERMISSIONS.USERS.CREATE,
    ]);
    expect(result).toBe(false);
  });

  it('el Administrador debe retornar true con cualquier lista', () => {
    const result = hasAnyPermission('Administrador', [
      'permiso:inventado1',
      'permiso:inventado2',
    ]);
    expect(result).toBe(true);
  });
});

// ──────────────────────────────────────────────
// hasAllPermissions()
// ──────────────────────────────────────────────
describe('hasAllPermissions()', () => {
  it('debe retornar true si el rol tiene TODOS los permisos listados', () => {
    const result = hasAllPermissions('Instructor', [
      PERMISSIONS.EQUIPOS.VIEW,
      PERMISSIONS.AMBIENTES.VIEW,
      PERMISSIONS.REPORTES.VIEW,
    ]);
    expect(result).toBe(true);
  });

  it('debe retornar false si le falta alguno', () => {
    const result = hasAllPermissions('Instructor', [
      PERMISSIONS.EQUIPOS.VIEW,
      PERMISSIONS.EQUIPOS.DELETE, // no tiene
    ]);
    expect(result).toBe(false);
  });

  it('el Administrador debe retornar true para cualquier combinación', () => {
    const result = hasAllPermissions('Administrador', [
      PERMISSIONS.USERS.DELETE,
      PERMISSIONS.ROLES.MANAGE,
      'permiso:inventado',
    ]);
    expect(result).toBe(true);
  });
});

// ──────────────────────────────────────────────
// getRolePermissions()
// ──────────────────────────────────────────────
describe('getRolePermissions()', () => {
  it('debe retornar el array de permisos del rol indicado', () => {
    const permisos = getRolePermissions('Instructor');
    expect(Array.isArray(permisos)).toBe(true);
    expect(permisos.length).toBeGreaterThan(0);
    expect(permisos).toContain(PERMISSIONS.EQUIPOS.VIEW);
  });

  it('debe retornar un array vacío para un rol inexistente', () => {
    const permisos = getRolePermissions('RolFantasma');
    expect(permisos).toEqual([]);
  });

  it('debe retornar el array correcto para cada rol', () => {
    expect(getRolePermissions('Administrador')).toBe(ROLE_PERMISSIONS.Administrador);
    expect(getRolePermissions('Aprendiz')).toBe(ROLE_PERMISSIONS.Aprendiz);
    expect(getRolePermissions('Cuentadante')).toBe(ROLE_PERMISSIONS.Cuentadante);
  });
});

// ──────────────────────────────────────────────
// hasPermissionFromDB()
// ──────────────────────────────────────────────
describe('hasPermissionFromDB()', () => {
  // Mock de DB reutilizable
  const makeDb = (rolesResult, permisosResult) => ({
    execute: jest.fn()
      .mockResolvedValueOnce([rolesResult])
      .mockResolvedValueOnce([permisosResult]),
  });

  it('debe retornar true para Administrador sin consultar la BD (bypass)', async () => {
    const db = { execute: jest.fn() };
    const result = await hasPermissionFromDB(db, 'Administrador', PERMISSIONS.USERS.DELETE);
    expect(result).toBe(true);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('debe retornar false si el rol no existe en la BD (fallback a hasPermission → false)', async () => {
    // roles vacío → fallback → Aprendiz no tiene 'users:delete'
    const db = { execute: jest.fn().mockResolvedValueOnce([[]]) };
    const result = await hasPermissionFromDB(db, 'Aprendiz', PERMISSIONS.USERS.DELETE);
    expect(result).toBe(false);
  });

  it('debe retornar true via fallback si el rol no existe en BD pero sí en defaults', async () => {
    // roles vacío → fallback → Aprendiz sí tiene 'equipos:view_own'
    const db = { execute: jest.fn().mockResolvedValueOnce([[]]) };
    const result = await hasPermissionFromDB(db, 'Aprendiz', PERMISSIONS.EQUIPOS.VIEW_OWN);
    expect(result).toBe(true);
  });

  it('debe retornar true si el permiso está activo en la BD', async () => {
    const db = makeDb(
      [{ id_rol: 2 }],           // roles: encontró el rol
      [{ activo: 1 }]            // permisos: permiso activo
    );
    const result = await hasPermissionFromDB(db, 'Instructor', PERMISSIONS.EQUIPOS.VIEW);
    expect(result).toBe(true);
  });

  it('debe usar fallback (hasPermission) si el permiso no está en la BD', async () => {
    // permisos vacío → fallback → Instructor sí tiene 'equipos:view' en defaults
    const db = makeDb([{ id_rol: 2 }], []);
    const result = await hasPermissionFromDB(db, 'Instructor', PERMISSIONS.EQUIPOS.VIEW);
    expect(result).toBe(true);
  });

  it('debe usar fallback (hasPermission) al fallar la consulta → false', async () => {
    const db = { execute: jest.fn().mockRejectedValue(new Error('DB error')) };
    // Aprendiz no tiene 'users:delete' en defaults
    const result = await hasPermissionFromDB(db, 'Aprendiz', PERMISSIONS.USERS.DELETE);
    expect(result).toBe(false);
  });

  it('debe usar fallback (hasPermission) al fallar la consulta → true', async () => {
    const db = { execute: jest.fn().mockRejectedValue(new Error('DB error')) };
    // Aprendiz sí tiene 'equipos:view_own' en defaults
    const result = await hasPermissionFromDB(db, 'Aprendiz', PERMISSIONS.EQUIPOS.VIEW_OWN);
    expect(result).toBe(true);
  });
});
