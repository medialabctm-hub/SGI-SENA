/**
 * MDL-202 / H-03 — gate de registro Aprendiz.
 *
 * Mensaje genérico único para denegaciones del autoregistro Aprendiz
 * (sin invitación ni roster, invitación inválida, y casos que distinguirían
 * presencia en Usuarios vs Aprendices). Coordinado con H-05 (no enumeración).
 */
export const REGISTER_APRENDIZ_DENIED_MESSAGE = 'No se puede completar el registro';

/**
 * Camino institucional: la cédula debe existir en el roster `Aprendices`
 * (importación Excel). La vinculación operativa es por igualdad de documento
 * (`Usuarios.cedula` ↔ `Aprendices.documento`).
 */
export const APRENDIZ_ROSTER_PATH_NOTE =
  'Registro Aprendiz vía roster institucional (tabla Aprendices / import Excel).';
