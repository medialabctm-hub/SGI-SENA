/**
 * Lock the equipment row that owns a usage/assignment claim.
 *
 * Every caller keeps the transaction open while it checks availability and
 * writes its responsibility or usage row. The row lock is deliberately
 * centralized so the different entry points cannot drift to different claim
 * semantics.
 */
const equipmentSelect = (selector) => {
  if (selector?.codigoEquipo !== undefined && selector?.codigoEquipo !== null) {
    return {
      sql: `SELECT codigo_equipo, placa, tipo, modelo, id_ambiente
            FROM Elementos
            WHERE codigo_equipo = ?
            LIMIT 1 FOR UPDATE`,
      params: [selector.codigoEquipo]
    };
  }

  if (selector?.placa) {
    return {
      sql: `SELECT codigo_equipo, placa, tipo, modelo, id_ambiente
            FROM Elementos
            WHERE placa = ?
            LIMIT 1 FOR UPDATE`,
      params: [selector.placa]
    };
  }

  throw new TypeError('Se requiere codigoEquipo o placa para reclamar un equipo');
};

/**
 * Lock the equipment row on a connection whose transaction is already open.
 * The caller owns the transaction lifecycle.
 */
export async function lockEquipmentRow(connection, selector) {
  const { sql, params } = equipmentSelect(selector);
  const [[equipment]] = await connection.execute(sql, params);
  return equipment || null;
}

/**
 * Begin the transaction that owns an equipment claim and lock its row.
 * The caller must commit/rollback and release the returned connection.
 */
export async function beginEquipmentClaim(pool, selector) {
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const equipment = await lockEquipmentRow(connection, selector);

    return {
      connection,
      equipment,
      transactionStarted
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original database error.
      }
    }
    connection.release();
    throw error;
  }
}
