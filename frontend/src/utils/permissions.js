const ASSIGNMENT_PERMISSIONS = ['equipos:assign', 'equipos:assign_to_aprendiz'];

// Fallback aligned with the server defaults. The user payload can include an
// explicit permission list when the authentication response provides one.
const DEFAULT_ROLE_PERMISSIONS = {
  Administrador: ASSIGNMENT_PERMISSIONS,
  Instructor: ['equipos:assign_to_aprendiz'],
  Cuentadante: ['equipos:assign_to_aprendiz'],
};

// Roles que por defecto tienen equipos:update (config/permissions.js del backend).
const DEFAULT_UPDATE_ROLES = ['Administrador', 'Cuentadante'];

/**
 * ¿Puede editar equipos (p. ej. moverlos de ambiente)? Solo decide qué se
 * muestra: el backend exige equipos:update en PUT /api/equipos/:codigo.
 */
export function canUpdateEquipos(user) {
  if (Array.isArray(user?.permisos)) return user.permisos.includes('equipos:update');
  return DEFAULT_UPDATE_ROLES.includes(user?.nombre_rol);
}

export function canManageEquipoAssignments(user) {
  const permissions = Array.isArray(user?.permisos)
    ? user.permisos
    : DEFAULT_ROLE_PERMISSIONS[user?.nombre_rol] || [];

  return ASSIGNMENT_PERMISSIONS.some(permission =>
    permissions.includes(permission)
  );
}
