const ASSIGNMENT_PERMISSIONS = ['equipos:assign', 'equipos:assign_to_aprendiz'];

// Fallback aligned with the server defaults. The user payload can include an
// explicit permission list when the authentication response provides one.
const DEFAULT_ROLE_PERMISSIONS = {
  Administrador: ASSIGNMENT_PERMISSIONS,
  Instructor: ['equipos:assign_to_aprendiz'],
  Cuentadante: ['equipos:assign_to_aprendiz'],
};

export function canManageEquipoAssignments(user) {
  const permissions = Array.isArray(user?.permisos)
    ? user.permisos
    : DEFAULT_ROLE_PERMISSIONS[user?.nombre_rol] || [];

  return ASSIGNMENT_PERMISSIONS.some(permission =>
    permissions.includes(permission)
  );
}
