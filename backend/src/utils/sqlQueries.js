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
    `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.tipo_documento, u.tipo_documento_otro,
            u.correo, u.telefono, 
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
    `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.tipo_documento, u.tipo_documento_otro,
            u.correo, u.telefono,
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
           e.estado_fisico,
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

/**
 * Verificar si un equipo está disponible para asignación
 * Valida estado_operativo y estado_fisico para determinar si puede ser asignado
 * @param {Object} db - Instancia de la base de datos
 * @param {number} codigoEquipo - Código del equipo
 * @returns {Promise<Object>} { disponible: boolean, razon: string|null, estado_operativo: string|null, estado_fisico: string|null }
 */
export async function verificarDisponibilidadEquipo(db, codigoEquipo) {
  const [[equipo]] = await db.execute(
    `SELECT 
       e.estado_fisico,
       COALESCE(ee.estado_operativo, 'Disponible') AS estado_operativo,
       ee.detalles AS detalles_estado
     FROM Elementos e
     LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
     WHERE e.codigo_equipo = ?`,
    [codigoEquipo]
  );

  if (!equipo) {
    return {
      disponible: false,
      razon: 'Equipo no encontrado',
      estado_operativo: null,
      estado_fisico: null
    };
  }

  const estadoOperativo = equipo.estado_operativo || 'Disponible';
  const estadoFisico = equipo.estado_fisico;

  // Estados operativos que bloquean la asignación
  const estadosBloqueados = ['Dañado', 'En Mantenimiento', 'Dado de Baja'];
  
  if (estadosBloqueados.includes(estadoOperativo)) {
    const razones = {
      'Dañado': 'Equipo dañado, no disponible para asignación',
      'En Mantenimiento': 'Equipo en mantenimiento, no disponible para asignación',
      'Dado de Baja': 'Equipo dado de baja, no disponible para asignación'
    };
    
    return {
      disponible: false,
      razon: razones[estadoOperativo] || `Equipo no disponible (${estadoOperativo})`,
      estado_operativo: estadoOperativo,
      estado_fisico: estadoFisico,
      detalles: equipo.detalles_estado
    };
  }

  // Si el estado físico es 'Dañado' pero el operativo no está sincronizado, también bloquear
  if (estadoFisico === 'Dañado' && estadoOperativo !== 'Dañado') {
    return {
      disponible: false,
      razon: 'Equipo con estado físico dañado, requiere revisión antes de asignación',
      estado_operativo: estadoOperativo,
      estado_fisico: estadoFisico,
      requiere_sincronizacion: true
    };
  }

  // Si está 'En Uso', verificar si ya está asignado (esto se maneja en otra validación)
  // pero no bloqueamos aquí porque podría ser reasignación al mismo usuario

  return {
    disponible: true,
    razon: null,
    estado_operativo: estadoOperativo,
    estado_fisico: estadoFisico
  };
}

/**
 * Deshabilitar todas las asignaciones activas de un equipo
 * Se usa cuando un equipo cambia a un estado crítico (Dañado, Dado de Baja, etc.)
 * @param {Object} db - Instancia de la base de datos
 * @param {number} codigoEquipo - Código del equipo
 * @param {number} deshabilitadoPor - ID del usuario que realiza la deshabilitación
 * @param {string} razon - Razón de la deshabilitación
 * @returns {Promise<Object>} { deshabilitadas: number, usuarios_afectados: Array<number> }
 */
export async function deshabilitarAsignacionesActivas(db, codigoEquipo, deshabilitadoPor, razon = 'Equipo deshabilitado por cambio de estado') {
  // Obtener todas las asignaciones activas
  const [asignaciones] = await db.execute(
    `SELECT id_responsable, id_usuario, fecha_asignacion
     FROM Responsables_Equipo
     WHERE codigo_equipo = ? AND estado_responsabilidad = 'Activo'`,
    [codigoEquipo]
  );

  if (asignaciones.length === 0) {
    return { deshabilitadas: 0, usuarios_afectados: [] };
  }

  const usuariosAfectados = asignaciones.map(a => a.id_usuario);

  // Deshabilitar todas las asignaciones
  await db.execute(
    `UPDATE Responsables_Equipo
     SET estado_responsabilidad = 'Finalizado',
         fecha_desvinculacion = NOW(),
         observaciones = CONCAT(COALESCE(observaciones, ''), 
           CASE WHEN observaciones IS NOT NULL AND observaciones != '' THEN ' | ' ELSE '' END,
           ?)
     WHERE codigo_equipo = ? AND estado_responsabilidad = 'Activo'`,
    [razon, codigoEquipo]
  );

  // Registrar en historial si existe la tabla
  try {
    for (const asignacion of asignaciones) {
      await db.execute(
        `INSERT INTO Historial_Equipos 
         (codigo_equipo, tipo_evento, descripcion, estado_nuevo, registrado_por)
         VALUES (?, 'Deshabilitación', ?, 'Finalizado', ?)`,
        [codigoEquipo, razon, deshabilitadoPor]
      );
    }
  } catch (histErr) {
    // No fallar si no existe la tabla de historial
    // Error silencioso
  }

  return {
    deshabilitadas: asignaciones.length,
    usuarios_afectados: usuariosAfectados
  };
}

/**
 * Obtener los ambientes válidos para un aprendiz basado en su ficha y clases
 * Un aprendiz solo puede recibir equipos de los ambientes donde tiene clases activas
 * @param {Object} db - Instancia de la base de datos
 * @param {number} idAprendiz - ID del usuario aprendiz
 * @returns {Promise<Array<number>>} Array de IDs de ambientes válidos
 */
export async function obtenerAmbientesValidosAprendiz(db, idAprendiz) {
  // Obtener la ficha del aprendiz desde la tabla Aprendices o desde Participantes_Clase
  // Primero intentar obtener desde Usuarios si tiene ficha asociada, luego desde clases
  
  // Opción 1: Si el aprendiz tiene ficha directa en Aprendices (tabla de aprendices importados)
  const [[aprendizData]] = await db.execute(
    `SELECT a.ficha 
     FROM Aprendices a
     INNER JOIN Usuarios u ON a.documento = u.cedula
     WHERE u.id_usuario = ? AND u.estado = 'Activo'
     LIMIT 1`,
    [idAprendiz]
  );

  const fichaAprendiz = aprendizData?.ficha || null;

  // Obtener ambientes desde clases donde el aprendiz participa
  // Un aprendiz puede estar en múltiples clases, cada una con su ambiente
  const [ambientesDesdeClases] = await db.execute(
    `SELECT DISTINCT c.id_ambiente
     FROM Participantes_Clase pc
     INNER JOIN Clases c ON pc.id_clase = c.id_clase
     WHERE pc.id_aprendiz = ?
       AND c.estado_clase IN ('Programada', 'En Curso')
       AND c.fecha_clase >= CURDATE()`,
    [idAprendiz]
  );

  // Si tiene ficha, también buscar clases por código de ficha
  let ambientesDesdeFicha = [];
  if (fichaAprendiz) {
    const [ambientesFicha] = await db.execute(
      `SELECT DISTINCT c.id_ambiente
       FROM Clases c
       WHERE c.codigo_ficha = ?
         AND c.estado_clase IN ('Programada', 'En Curso')
         AND c.fecha_clase >= CURDATE()`,
      [fichaAprendiz]
    );
    ambientesDesdeFicha = ambientesFicha;
  }

  // Combinar y deduplicar ambientes
  const ambientesUnicos = new Set();
  ambientesDesdeClases.forEach(a => ambientesUnicos.add(a.id_ambiente));
  ambientesDesdeFicha.forEach(a => ambientesUnicos.add(a.id_ambiente));

  return Array.from(ambientesUnicos);
}

/**
 * Verificar si un equipo puede ser asignado a un aprendiz
 * Valida que el equipo pertenezca a un ambiente válido para el aprendiz
 * @param {Object} db - Instancia de la base de datos
 * @param {number} codigoEquipo - Código del equipo
 * @param {number} idAprendiz - ID del usuario aprendiz
 * @returns {Promise<Object>} { valido: boolean, razon: string|null, ambiente_equipo: number|null, ambientes_validos: Array<number> }
 */
export async function verificarAmbienteEquipoAprendiz(db, codigoEquipo, idAprendiz) {
  // Obtener el ambiente del equipo
  const [[equipo]] = await db.execute(
    `SELECT e.id_ambiente, a.nombre_ambiente
     FROM Elementos e
     LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
     WHERE e.codigo_equipo = ?`,
    [codigoEquipo]
  );

  if (!equipo) {
    return {
      valido: false,
      razon: 'Equipo no encontrado',
      ambiente_equipo: null,
      ambientes_validos: []
    };
  }

  const ambienteEquipo = equipo.id_ambiente;

  // Obtener ambientes válidos para el aprendiz
  const ambientesValidos = await obtenerAmbientesValidosAprendiz(db, idAprendiz);

  if (ambientesValidos.length === 0) {
    return {
      valido: false,
      razon: 'El aprendiz no tiene clases activas asignadas. No se puede asignar equipos sin un ambiente asociado.',
      ambiente_equipo: ambienteEquipo,
      ambientes_validos: [],
      nombre_ambiente_equipo: equipo.nombre_ambiente
    };
  }

  if (!ambientesValidos.includes(ambienteEquipo)) {
    return {
      valido: false,
      razon: `El equipo pertenece al ambiente "${equipo.nombre_ambiente || 'N/A'}", que no corresponde a las clases activas del aprendiz. Solo se pueden asignar equipos de los ambientes de su ficha.`,
      ambiente_equipo: ambienteEquipo,
      ambientes_validos: ambientesValidos,
      nombre_ambiente_equipo: equipo.nombre_ambiente
    };
  }

  return {
    valido: true,
    razon: null,
    ambiente_equipo: ambienteEquipo,
    ambientes_validos: ambientesValidos,
    nombre_ambiente_equipo: equipo.nombre_ambiente
  };
}

