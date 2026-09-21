/**
 * MDL-189 / H-01 — DTO por rol para respuestas de equipos.
 *
 * Campos financieros y PII de personal (cuentadante) se omiten para roles
 * que no deben verlos (especialmente Aprendiz). Administrador y Cuentadante
 * conservan la vista completa.
 */

export const ROLES_CON_DATOS_SENSIBLES_EQUIPO = Object.freeze([
  'Administrador',
  'Cuentadante',
]);

/** Campos financieros / PII de staff a excluir del DTO restringido. */
export const CAMPOS_SENSIBLES_EQUIPO = Object.freeze([
  'valor_ingreso',
  'costo',
  'id_cuentadante',
  'cuentadante_principal',
  'cuentadante_cedula',
  'cuentadante_documento',
  'cedula_cuentadante',
  'documento_cuentadante',
]);

export function rolPuedeVerDatosSensiblesEquipo(userRole) {
  return ROLES_CON_DATOS_SENSIBLES_EQUIPO.includes(userRole);
}

/**
 * Devuelve una copia del equipo sin campos sensibles cuando el rol no debe verlos.
 * No muta el objeto original.
 */
export function toEquipoDto(equipo, userRole) {
  if (!equipo || typeof equipo !== 'object') return equipo;
  if (rolPuedeVerDatosSensiblesEquipo(userRole)) return equipo;

  const dto = { ...equipo };
  for (const campo of CAMPOS_SENSIBLES_EQUIPO) {
    if (campo in dto) delete dto[campo];
  }
  return dto;
}

export function toEquiposDtoList(equipos, userRole) {
  if (!Array.isArray(equipos)) return equipos;
  if (rolPuedeVerDatosSensiblesEquipo(userRole)) return equipos;
  return equipos.map((e) => toEquipoDto(e, userRole));
}
