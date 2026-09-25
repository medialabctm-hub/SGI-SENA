export const EQUIPO_VERIFICADO = 'Verificado';

const ALIAS_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertTableAlias(alias) {
  if (!ALIAS_PATTERN.test(alias)) {
    throw new Error('Alias SQL inválido');
  }
}

/**
 * Estado actual de verificación de un equipo.
 *
 * El último registro de Verificaciones_Inventario es la fuente de verdad del
 * flujo manual. La columna verificado_ambiente solo se usa como compatibilidad
 * para equipos antiguos que todavía no tienen historial manual; su significado
 * de primera verificación externa no cambia.
 */
export function currentEquipmentVerificationStatusSql(elementAlias = 'e') {
  assertTableAlias(elementAlias);

  return `COALESCE(
    (
      SELECT vi.estado_verificacion
      FROM Verificaciones_Inventario vi
      WHERE vi.codigo_equipo = ${elementAlias}.codigo_equipo
      ORDER BY vi.fecha_verificacion DESC, vi.id_verificacion DESC
      LIMIT 1
    ),
    CASE
      WHEN COALESCE(${elementAlias}.verificado_ambiente, 0) = 1 THEN 'Verificado'
      ELSE 'No Verificado'
    END
  )`;
}

export function isEquipmentVerified(equipo) {
  const estadoActual = equipo?.estado_verificacion_actual ?? equipo?.status_verificacion;
  if (estadoActual != null) return estadoActual === EQUIPO_VERIFICADO;
  return Number(equipo?.verificado_ambiente) === 1;
}
