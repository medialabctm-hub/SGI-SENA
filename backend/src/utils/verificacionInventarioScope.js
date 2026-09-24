/**
 * MDL-234 — Alcance compartido de verificación de inventario.
 *
 * Regla (lista GET y POST /verificacion):
 * - Aula con responsabilidad activa (Activa + clase null|'En Curso') → todos los equipos.
 * - Sin responsabilidad, pero Elementos.id_cuentadante = user → solo equipos propios.
 * - Deny genérico (sin filtrar dueño) en cualquier otro caso.
 */

export const VERIFICACION_DENY_MESSAGE = 'No tienes permiso para verificar este equipo';

export const SQL_RESPONSABILIDAD_AMBIENTES = `
  SELECT DISTINCT ra.id_ambiente AS id_ambiente
  FROM Responsabilidades_Ambiente ra
  LEFT JOIN Clases c ON ra.id_clase = c.id_clase
  WHERE ra.id_usuario = ?
    AND ra.estado_responsabilidad = 'Activa'
    AND (
      ra.id_clase IS NULL
      OR (ra.id_clase IS NOT NULL AND c.estado_clase = 'En Curso')
    )
`;

export const SQL_CUENTADANTE_AMBIENTES = `
  SELECT DISTINCT e.id_ambiente AS id_ambiente
  FROM Elementos e
  WHERE e.id_cuentadante = ?
    AND e.id_ambiente IS NOT NULL
    AND (e.estado_fisico IS NULL OR e.estado_fisico <> 'Baja')
`;

export const SQL_RESPONSABILIDAD_EN_AMBIENTE = `
  SELECT
    ra.id_responsabilidad_ambiente,
    ra.id_clase,
    ra.jornada,
    ra.dias_semana,
    ra.hora_inicio,
    ra.hora_fin,
    c.fecha_clase,
    c.hora_inicio AS clase_hora_inicio,
    c.hora_fin AS clase_hora_fin,
    c.nombre_clase,
    c.codigo_ficha
  FROM Responsabilidades_Ambiente ra
  LEFT JOIN Clases c ON ra.id_clase = c.id_clase
  WHERE ra.id_ambiente = ?
    AND ra.id_usuario = ?
    AND ra.estado_responsabilidad = 'Activa'
    AND (
      ra.id_clase IS NULL
      OR (ra.id_clase IS NOT NULL AND c.estado_clase = 'En Curso')
    )
  ORDER BY ra.fecha_inicio DESC
  LIMIT 1
`;

export function normalizeAmbienteIds(rows) {
  return [...new Set(
    (rows || [])
      .map((r) => Number(r.id_ambiente))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];
}

export function deriveAmbienteSets(responsabilidadAmbienteIds, cuentadanteAmbienteIds) {
  const respSet = new Set(responsabilidadAmbienteIds);
  const cuentadanteOnlyAmbienteIds = cuentadanteAmbienteIds.filter((id) => !respSet.has(id));
  const allAmbienteIds = [...new Set([...responsabilidadAmbienteIds, ...cuentadanteAmbienteIds])];
  return { respSet, cuentadanteOnlyAmbienteIds, allAmbienteIds };
}

/**
 * Carga sets de aulas para el listado (mismo predicado que el POST).
 */
export async function loadVerificacionAmbienteIds(db, userId) {
  const [respRows] = await db.execute(SQL_RESPONSABILIDAD_AMBIENTES, [userId]);
  const [ctaRows] = await db.execute(SQL_CUENTADANTE_AMBIENTES, [userId]);
  const responsabilidadAmbienteIds = normalizeAmbienteIds(respRows);
  const cuentadanteAmbienteIds = normalizeAmbienteIds(ctaRows);
  return {
    responsabilidadAmbienteIds,
    cuentadanteAmbienteIds,
    ...deriveAmbienteSets(responsabilidadAmbienteIds, cuentadanteAmbienteIds),
  };
}

/**
 * Cláusula WHERE de equipos para el listado.
 * @returns {{ sql: string, params: number[] } | null}
 */
export function buildVerificacionEquiposScopeClause({
  responsabilidadAmbienteIds,
  cuentadanteOnlyAmbienteIds,
  userId,
}) {
  const parts = [];
  const params = [];

  if (responsabilidadAmbienteIds.length > 0) {
    parts.push(
      `e.id_ambiente IN (${responsabilidadAmbienteIds.map(() => '?').join(',')})`,
    );
    params.push(...responsabilidadAmbienteIds);
  }
  if (cuentadanteOnlyAmbienteIds.length > 0) {
    parts.push(
      `(e.id_ambiente IN (${cuentadanteOnlyAmbienteIds.map(() => '?').join(',')}) AND e.id_cuentadante = ?)`,
    );
    params.push(...cuentadanteOnlyAmbienteIds, userId);
  }
  if (parts.length === 0) return null;
  return { sql: `(${parts.join(' OR ')})`, params };
}

/**
 * Autorización de un equipo concreto (POST /verificacion).
 * Misma regla que el listado: resp activa en el aula → ok;
 * si no, solo si id_cuentadante === user.
 *
 * @returns {Promise<{ allowed: boolean, alcance: 'responsable'|'propios'|null, responsabilidad: object|null }>}
 */
export async function resolveVerificacionEquipoAccess(db, {
  userId,
  idAmbiente,
  idCuentadante,
}) {
  const [[responsabilidad]] = await db.execute(
    SQL_RESPONSABILIDAD_EN_AMBIENTE,
    [idAmbiente, userId],
  );

  if (responsabilidad) {
    return { allowed: true, alcance: 'responsable', responsabilidad };
  }

  if (idCuentadante != null && Number(idCuentadante) === Number(userId)) {
    return { allowed: true, alcance: 'propios', responsabilidad: null };
  }

  return { allowed: false, alcance: null, responsabilidad: null };
}
