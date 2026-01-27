import defaultDb from '../config/dbconfig.js'
import { getUserLanguage, translate } from '../utils/translations.js'
import socketService from './socketService.js'

const ALLOWED_TYPES = new Set(['info', 'aviso', 'alerta', 'critica'])

export function normalizeNotificationType(tipo) {
  if (!tipo) return 'info'
  const value = tipo.toString().trim().toLowerCase()
  if (ALLOWED_TYPES.has(value)) return value
  if (value === 'warning') return 'aviso'
  if (value === 'success') return 'info'
  if (value === 'error') return 'critica'
  return 'info'
}

/**
 * Construye las filas de notificaciones con traducciones por usuario
 * @param {Array<number>} userIds - IDs de usuarios
 * @param {string|Object} titulo - Título o clave de traducción
 * @param {string|Object} cuerpo - Cuerpo o clave de traducción
 * @param {string} tipo - Tipo de notificación
 * @param {Object} metadata - Metadatos
 * @param {number} creadoPor - ID del usuario que creó la notificación
 * @returns {Promise<Array>} Array de filas para insertar
 */
async function buildRows({ userIds, titulo, cuerpo, tipo, metadata, creadoPor }) {
  const normalizedType = normalizeNotificationType(tipo)
  const meta = metadata ? JSON.stringify(metadata) : null

  // Si titulo y cuerpo son objetos con clave de traducción, traducir por usuario
  const needsTranslation = typeof titulo === 'object' && titulo.key;
  
  if (needsTranslation) {
    // Obtener idiomas de todos los usuarios
    if (userIds.length === 0) {
      return [];
    }
    const placeholders = userIds.map(() => '?').join(',');
    const [prefs] = await defaultDb.execute(
      `SELECT id_usuario, idioma FROM Preferencias_Usuario WHERE id_usuario IN (${placeholders})`,
      userIds
    );
    
    const userLangs = {};
    // Inicializar todos los usuarios con español por defecto
    userIds.forEach(id => {
      userLangs[id] = 'es';
    });
    // Actualizar con preferencias reales
    prefs.forEach(p => {
      if (p.idioma) {
        userLangs[p.id_usuario] = p.idioma;
      }
    });

    return userIds.map((idUsuario) => {
      const lang = userLangs[idUsuario] || 'es';
      const title = translate(titulo.key, lang, titulo.params || {});
      const body = cuerpo?.key 
        ? translate(cuerpo.key, lang, { ...cuerpo.params, ...titulo.params })
        : (cuerpo || '');

      return [
        idUsuario,
        title.toString().trim().slice(0, 140),
        body ? body.toString().trim() : null,
        normalizedType,
        meta,
        creadoPor ?? null,
      ];
    });
  }

  // Formato simple (sin traducción)
  const title = titulo.toString().trim().slice(0, 140)
  const body = cuerpo ? cuerpo.toString().trim() : null

  return userIds.map((idUsuario) => [
    idUsuario,
    title,
    body,
    normalizedType,
    meta,
    creadoPor ?? null,
  ])
}

async function insertRows(rows) {
  if (!rows.length) {
    return { inserted: 0 }
  }

  const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
  const flatParams = rows.flat()

  try {
    const [result] = await defaultDb.execute(
      `INSERT INTO Notificaciones (id_usuario, titulo, cuerpo, tipo, metadata, creado_por)
       VALUES ${placeholders}`,
      flatParams
    )
    return {
      inserted: result.affectedRows ?? rows.length,
      insertId: result.insertId ?? null,
    }
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      // La tabla aún no existe: devolvemos conteo cero para no romper el flujo principal.
      return { inserted: 0, insertId: null, skipped: true }
    }
    throw err
  }
}

/**
 * Obtiene IDs de usuarios activos por rol que tengan notificaciones en app habilitadas
 * @param {string} roleName - Nombre del rol
 * @returns {Promise<Array<number>>} Array de IDs de usuarios
 */
async function fetchActiveUserIdsByRole(roleName) {
  const [[role]] = await defaultDb.execute(
    'SELECT id_rol FROM Roles WHERE nombre_rol = ? LIMIT 1',
    [roleName]
  )
  if (!role?.id_rol) return []

  // Obtener usuarios activos del rol que tengan notificaciones en app habilitadas
  const [rows] = await defaultDb.execute(
    `SELECT u.id_usuario
     FROM Usuarios u
     LEFT JOIN Preferencias_Usuario p ON u.id_usuario = p.id_usuario
     WHERE u.id_rol = ? 
       AND u.estado = 'Activo'
       AND (p.notificaciones_app IS NULL OR p.notificaciones_app = 1)`,
    [role.id_rol]
  )
  return rows.map((row) => row.id_usuario)
}

/**
 * Obtiene IDs de todos los usuarios activos que tengan notificaciones en app habilitadas
 * @returns {Promise<Array<number>>} Array de IDs de usuarios
 */
async function fetchAllActiveUserIds() {
  const [rows] = await defaultDb.execute(
    `SELECT u.id_usuario
     FROM Usuarios u
     LEFT JOIN Preferencias_Usuario p ON u.id_usuario = p.id_usuario
     WHERE u.estado = 'Activo'
       AND (p.notificaciones_app IS NULL OR p.notificaciones_app = 1)`
  )
  return rows.map((row) => row.id_usuario)
}

/**
 * Crea notificaciones para usuarios específicos
 * Filtra automáticamente usuarios que tengan notificaciones en app deshabilitadas
 * @param {Array<number>} userIds - IDs de usuarios
 * @param {string|Object} titulo - Título o {key: 'clave', params: {}}
 * @param {string|Object} cuerpo - Cuerpo o {key: 'clave', params: {}}
 * @param {string} tipo - Tipo de notificación
 * @param {Object} metadata - Metadatos
 * @param {number} creadoPor - ID del usuario que creó la notificación
 * @returns {Promise<Object>} Resultado de la inserción
 */
export async function createForUsers({ userIds = [], titulo, cuerpo = '', tipo = 'info', metadata = null, creadoPor = null }) {
  const uniqueIds = [...new Set((userIds || []).filter(Number.isFinite))]
  if (!uniqueIds.length || !titulo) {
    return { inserted: 0, insertId: null }
  }

  // Filtrar usuarios que tengan notificaciones en app habilitadas
  if (uniqueIds.length === 0) {
    return { inserted: 0, insertId: null };
  }
  
  const placeholders = uniqueIds.map(() => '?').join(',');
  const [enabledUsers] = await defaultDb.execute(
    `SELECT u.id_usuario
     FROM Usuarios u
     LEFT JOIN Preferencias_Usuario p ON u.id_usuario = p.id_usuario
     WHERE u.id_usuario IN (${placeholders})
       AND u.estado = 'Activo'
       AND (p.notificaciones_app IS NULL OR p.notificaciones_app = 1)`,
    uniqueIds
  ).catch(() => {
    // Si la tabla de preferencias no existe, usar todos los usuarios
    return [uniqueIds.map(id => ({ id_usuario: id }))];
  });

  const filteredIds = enabledUsers.map(u => u.id_usuario);
  if (!filteredIds.length) {
    return { inserted: 0, insertId: null }
  }

  const rows = await buildRows({ userIds: filteredIds, titulo, cuerpo, tipo, metadata, creadoPor })
  const result = await insertRows(rows)
  
  // Emitir eventos WebSocket a los usuarios afectados
  if (result.inserted > 0) {
    filteredIds.forEach(userId => {
      socketService.emitToUser(userId, 'notification:new', {
        message: 'Nueva notificación disponible',
        timestamp: new Date().toISOString(),
      });
    });
  }
  
  return result
}

export async function createForRole({ rolNombre, titulo, cuerpo = '', tipo = 'info', metadata = null, creadoPor = null }) {
  if (!rolNombre || !titulo) {
    return { inserted: 0, insertId: null }
  }
  let roleUserIds = await fetchActiveUserIdsByRole(rolNombre)
  
  // Excluir al usuario que creó la notificación (no debe recibir notificación de sus propias acciones)
  if (creadoPor && roleUserIds.includes(creadoPor)) {
    roleUserIds = roleUserIds.filter(id => id !== creadoPor)
  }
  
  return createForUsers({ userIds: roleUserIds, titulo, cuerpo, tipo, metadata, creadoPor })
}

export async function createBroadcast({ titulo, cuerpo = '', tipo = 'info', metadata = null, creadoPor = null }) {
  let userIds = await fetchAllActiveUserIds()
  
  // Excluir al usuario que creó la notificación (no debe recibir notificación de sus propias acciones)
  if (creadoPor && userIds.includes(creadoPor)) {
    userIds = userIds.filter(id => id !== creadoPor)
  }
  
  return createForUsers({ userIds, titulo, cuerpo, tipo, metadata, creadoPor })
}

export async function notifyNuevoEquipo({ equipoId, tipoEquipo, modelo, ambiente, creadoPor, metadataExtra = {} }) {
  if (!equipoId || !tipoEquipo) {
    return { inserted: 0 }
  }

  const descripcion = modelo ? `${tipoEquipo} ${modelo}` : tipoEquipo

  const metadata = {
    codigo_equipo: equipoId,
    tipo: tipoEquipo,
    modelo,
    ambiente,
    ruta: `/equipos/detalle/${equipoId}`,
    ...metadataExtra,
  }

  // Usar traducciones
  const titulo = {
    key: 'nuevo_equipo_registrado',
    params: {}
  };

  const cuerpo = {
    key: ambiente ? 'nuevo_equipo_registrado_cuerpo' : 'nuevo_equipo_registrado_cuerpo_sin_ambiente',
    params: {
      descripcion,
      ambiente: ambiente || ''
    }
  };

  return createForRole({
    rolNombre: 'Administrador',
    titulo,
    cuerpo,
    tipo: 'info',
    metadata,
    creadoPor,
  })
}

export default {
  normalizeNotificationType,
  createForUsers,
  createForRole,
  createBroadcast,
  notifyNuevoEquipo,
}

