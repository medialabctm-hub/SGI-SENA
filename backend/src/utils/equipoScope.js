/**
 * Alcance por rol para consultar UN equipo (ficha, historial integral…).
 *
 * Es el mismo predicado que usaba la ficha (`obtenerEquipoPorCodigo`), movido
 * aquí para que los endpoints nuevos no definan una cuarta versión de «mis
 * ambientes» (hallazgo H11). Se aplica sobre el alias `e` de `Elementos`.
 *
 * - Administrador: sin restricción.
 * - Cuentadante: su inventario (id_cuentadante) o los ambientes con
 *   responsabilidad activa.
 * - Instructor: ambientes con responsabilidad activa sin clase, o con clase
 *   programada/en curso desde hoy.
 * - Resto (EQUIPOS.VIEW_OWN): solo equipos con vínculo activo en
 *   Responsables_Equipo.
 */

export const ROLES_EQUIPOS_VISTA_AMPLIA = Object.freeze(['Administrador', 'Instructor', 'Cuentadante']);

export function normalizarIdUsuario(rawId) {
  if (typeof rawId !== 'number' && typeof rawId !== 'string') return null;

  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * @param {{execute: Function}} db
 * @param {{id?: unknown, rol?: string}} user - req.user
 * @returns {Promise<{sql: string, params: unknown[], amplio: boolean} | null>}
 *   `null` cuando el usuario no puede ver ningún equipo (fallar cerrado).
 */
export async function construirAlcanceEquipo(db, user) {
  const userId = user?.id;
  const userRole = user?.rol;
  const amplio = ROLES_EQUIPOS_VISTA_AMPLIA.includes(userRole);
  const userIdNormalizado = normalizarIdUsuario(userId);

  if (!amplio && !userIdNormalizado) return null;

  if (userRole === 'Cuentadante') {
    // El inventario propio sigue siendo visible aunque tenga ambientes habilitados.
    const [ambientesCuentadante] = await db.execute(
      `SELECT DISTINCT ra.id_ambiente FROM Responsabilidades_Ambiente ra
       WHERE ra.id_usuario = ? AND ra.estado_responsabilidad = 'Activa'`,
      [userId]
    );
    if (ambientesCuentadante?.length > 0) {
      const ids = ambientesCuentadante.map(a => a.id_ambiente);
      const placeholders = ids.map(() => '?').join(',');
      return {
        sql: ` AND (e.id_cuentadante = ? OR e.id_ambiente IN (${placeholders}))`,
        params: [userId, ...ids],
        amplio,
      };
    }
    return { sql: ' AND e.id_cuentadante = ?', params: [userId], amplio };
  }

  if (userRole === 'Instructor') {
    return {
      sql: ` AND e.id_ambiente IN (
        SELECT DISTINCT ra.id_ambiente
        FROM Responsabilidades_Ambiente ra
        LEFT JOIN Clases c ON ra.id_clase = c.id_clase
        WHERE ra.id_usuario = ?
          AND ra.estado_responsabilidad = 'Activa'
          AND (
            -- Asignaciones permanentes (con días/horarios o jornada)
            (ra.id_clase IS NULL)
            OR
            -- Asignaciones temporales (clases) que estén programadas o en curso
            (ra.id_clase IS NOT NULL
             AND c.estado_clase IN ('Programada', 'En Curso')
             AND c.fecha_clase >= CURDATE())
          )
      )`,
      params: [userId],
      amplio,
    };
  }

  if (!amplio) {
    // EQUIPOS.VIEW_OWN: resolver solo equipos vinculados al usuario actual.
    // El EXISTS evita filtrar después de haber obtenido filas duplicadas por placa.
    return {
      sql: ` AND EXISTS (
        SELECT 1
        FROM Responsables_Equipo re_scope
        WHERE re_scope.codigo_equipo = e.codigo_equipo
          AND re_scope.id_usuario = ?
          AND re_scope.estado_responsabilidad = 'Activo'
      )`,
      params: [userIdNormalizado],
      amplio,
    };
  }

  return { sql: '', params: [], amplio };
}
