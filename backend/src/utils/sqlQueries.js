/**
 * Módulo de utilidades SQL compartidas
 * 
 * Este módulo centraliza queries SQL comunes que se repiten en múltiples controladores.
 * Esto ayuda a:
 * 1. Evitar duplicación de código
 * 2. Mantener consistencia en las queries
 * 3. Facilitar el mantenimiento (cambios en un solo lugar)
 * 4. Mejorar la legibilidad del código
 * 
 * USO:
 * import { obtenerUsuarioActivo, obtenerEquiposAsignados } from '../utils/sqlQueries.js';
 * 
 * const user = await obtenerUsuarioActivo(db, userId);
 * const equipos = await obtenerEquiposAsignados(db, userId);
 */

/**
 * Obtener un usuario activo por ID
 * @param {Object} db - Instancia de la base de datos
 * @param {number} userId - ID del usuario
 * @returns {Promise<Object|null>} Usuario o null si no existe
 */
export async function obtenerUsuarioActivo(db, userId) {
  const [[user]] = await db.execute(
    `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, u.telefono, 
            r.nombre_rol, r.id_rol, u.foto_perfil
     FROM Usuarios u
     LEFT JOIN Roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = ? AND u.estado = 'Activo'`,
    [userId]
  );
  return user || null;
}

/**
 * Obtener un usuario activo por cédula
 * @param {Object} db - Instancia de la base de datos
 * @param {string} cedula - Cédula del usuario
 * @returns {Promise<Object|null>} Usuario o null si no existe
 */
export async function obtenerUsuarioPorCedula(db, cedula) {
  const [[user]] = await db.execute(
    `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, u.telefono,
            r.nombre_rol, r.id_rol
     FROM Usuarios u
     LEFT JOIN Roles r ON r.id_rol = u.id_rol
     WHERE u.cedula = ? AND u.estado = 'Activo'`,
    [cedula]
  );
  return user || null;
}

/**
 * Obtener equipos asignados a un usuario
 * @param {Object} db - Instancia de la base de datos
 * @param {number} userId - ID del usuario
 * @returns {Promise<Array>} Lista de equipos asignados
 */
export async function obtenerEquiposAsignados(db, userId) {
  const [equipos] = await db.execute(
    `SELECT 
       e.codigo_equipo, e.r_centro, e.consecutivo, e.tipo, e.placa, e.modelo, 
       e.estado_fisico, e.descripcion,
       a.nombre_ambiente, a.codigo_ambiente,
       re.fecha_asignacion, re.tipo_responsabilidad, re.observaciones,
       DATEDIFF(NOW(), re.fecha_asignacion) AS dias_asignado,
       u_asignado.nombre_usuario AS asignado_por_nombre
     FROM Responsables_Equipo re
     INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
     LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
     LEFT JOIN Usuarios u_asignado ON re.asignado_por = u_asignado.id_usuario
     WHERE re.id_usuario = ? AND re.estado_responsabilidad = 'Activo'
     ORDER BY re.fecha_asignacion DESC`,
    [userId]
  );
  return equipos || [];
}

/**
 * Obtener un equipo por código (inventario o ID)
 * @param {Object} db - Instancia de la base de datos
 * @param {string|number} codigo - Código de inventario o ID del equipo
 * @returns {Promise<Object|null>} Equipo o null si no existe
 */
export async function obtenerEquipoPorCodigo(db, codigo) {
  const queryBase = `
    SELECT e.codigo_equipo, e.r_centro, e.consecutivo, e.tipo, e.placa, e.modelo, 
           e.descripcion, e.fecha_adquisicion, e.costo, e.valor_ingreso,
           e.vida_util_meses, e.estado_fisico,
           e.specs_completas, e.atributos,
           e.id_cuentadante,
           a.id_ambiente, a.nombre_ambiente, a.codigo_ambiente
    FROM Elementos e
    LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
  `;

  // Optimización: Intentar buscar por ID numérico primero si es posible
  const codigoNumerico = Number.parseInt(codigo, 10);
  const esNumero = Number.isFinite(codigoNumerico);

  // Query optimizado: busca en un solo query usando OR
  // Esto reduce las consultas a la base de datos de 3 a 1 en el peor caso
  const query = esNumero
    ? `${queryBase} WHERE e.r_centro = ? OR e.consecutivo = ? OR e.codigo_equipo = ?`
    : `${queryBase} WHERE e.r_centro = ? OR e.consecutivo = ?`;
  
  const params = esNumero ? [codigo, codigo, codigoNumerico] : [codigo, codigo];
  
  const [[row]] = await db.execute(query, params);
  
  return row || null;
}

/**
 * Verificar si un equipo está asignado a un usuario
 * @param {Object} db - Instancia de la base de datos
 * @param {number} codigoEquipo - Código del equipo
 * @param {number} userId - ID del usuario
 * @returns {Promise<boolean>} true si está asignado, false en caso contrario
 */
export async function verificarAsignacionEquipo(db, codigoEquipo, userId) {
  const [[asignacion]] = await db.execute(
    `SELECT id_responsable FROM Responsables_Equipo 
     WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
    [codigoEquipo, userId]
  );
  return !!asignacion;
}

/**
 * Obtener el rol de un usuario por ID
 * @param {Object} db - Instancia de la base de datos
 * @param {number} userId - ID del usuario
 * @returns {Promise<string|null>} Nombre del rol o null
 */
export async function obtenerRolUsuario(db, userId) {
  const [[rol]] = await db.execute(
    `SELECT r.nombre_rol 
     FROM Usuarios u
     LEFT JOIN Roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = ? AND u.estado = 'Activo'`,
    [userId]
  );
  return rol?.nombre_rol || null;
}

/**
 * Contar usuarios activos
 * @param {Object} db - Instancia de la base de datos
 * @returns {Promise<number>} Número de usuarios activos
 */
export async function contarUsuariosActivos(db) {
  const [[result]] = await db.execute(
    'SELECT COUNT(*) AS total FROM Usuarios WHERE estado = "Activo"'
  );
  return Number(result?.total) || 0;
}

/**
 * Contar equipos totales
 * @param {Object} db - Instancia de la base de datos
 * @returns {Promise<number>} Número total de equipos
 */
export async function contarEquipos(db) {
  const [[result]] = await db.execute('SELECT COUNT(*) AS total FROM Elementos');
  return Number(result?.total) || 0;
}

