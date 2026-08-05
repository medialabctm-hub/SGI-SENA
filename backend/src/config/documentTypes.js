/**
 * Tipos de documento de identidad soportados en todo el sistema.
 * Única fuente de verdad: antes se repetía este mismo array en 6 lugares
 * (authValidator, aprendicesController, importController, UserBuilder).
 */
export const TIPOS_DOCUMENTO = ['TI', 'CC', 'CE', 'PPT', 'Otro'];
