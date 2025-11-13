import defaultDb from '../config/dbconfig.js'

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

function buildRows({ userIds, titulo, cuerpo, tipo, metadata, creadoPor }) {
  const normalizedType = normalizeNotificationType(tipo)
  const meta = metadata ? JSON.stringify(metadata) : null
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

async function fetchActiveUserIdsByRole(roleName) {
  const [[role]] = await defaultDb.execute(
    'SELECT id_rol FROM Roles WHERE nombre_rol = ? LIMIT 1',
    [roleName]
  )
  if (!role?.id_rol) return []

  const [rows] = await defaultDb.execute(
    `SELECT id_usuario
     FROM Usuarios
     WHERE id_rol = ? AND estado = 'Activo'`,
    [role.id_rol]
  )
  return rows.map((row) => row.id_usuario)
}

async function fetchAllActiveUserIds() {
  const [rows] = await defaultDb.execute(
    `SELECT id_usuario
     FROM Usuarios
     WHERE estado = 'Activo'`
  )
  return rows.map((row) => row.id_usuario)
}

export async function createForUsers({ userIds = [], titulo, cuerpo = '', tipo = 'info', metadata = null, creadoPor = null }) {
  const uniqueIds = [...new Set((userIds || []).filter(Number.isFinite))]
  if (!uniqueIds.length || !titulo) {
    return { inserted: 0, insertId: null }
  }
  const rows = buildRows({ userIds: uniqueIds, titulo, cuerpo, tipo, metadata, creadoPor })
  return insertRows(rows)
}

export async function createForRole({ rolNombre, titulo, cuerpo = '', tipo = 'info', metadata = null, creadoPor = null }) {
  if (!rolNombre || !titulo) {
    return { inserted: 0, insertId: null }
  }
  const roleUserIds = await fetchActiveUserIdsByRole(rolNombre)
  return createForUsers({ userIds: roleUserIds, titulo, cuerpo, tipo, metadata, creadoPor })
}

export async function createBroadcast({ titulo, cuerpo = '', tipo = 'info', metadata = null, creadoPor = null }) {
  const userIds = await fetchAllActiveUserIds()
  return createForUsers({ userIds, titulo, cuerpo, tipo, metadata, creadoPor })
}

export async function notifyNuevoEquipo({ equipoId, tipoEquipo, marca, modelo, ambiente, creadoPor, metadataExtra = {} }) {
  if (!equipoId || !tipoEquipo) {
    return { inserted: 0 }
  }

  const titulo = 'Nuevo equipo registrado'
  const subtipo = [marca, modelo].filter(Boolean).join(' ')
  const descripcion = subtipo ? `${tipoEquipo} ${subtipo}` : tipoEquipo
  const cuerpo = ambiente
    ? `Se ha registrado ${descripcion} en el ambiente ${ambiente}.`
    : `Se ha registrado ${descripcion}.`

  const metadata = {
    codigo_equipo: equipoId,
    tipo: tipoEquipo,
    marca,
    modelo,
    ambiente,
    ruta: `/equipos/${equipoId}`,
    ...metadataExtra,
  }

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

