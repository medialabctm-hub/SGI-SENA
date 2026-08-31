/**
 * Lock the equipment row that owns a usage/assignment claim.
 *
 * Every caller keeps the transaction open while it checks availability and
 * writes its responsibility or usage row. The row lock is deliberately
 * centralized so the different entry points cannot drift to different claim
 * semantics.
 *
 * Comportamiento garantizado (préstamo normal y autoservicio, MDL-76):
 * - `SELECT ... FOR UPDATE` sobre la fila de `Elementos` serializa cualquier
 *   solicitud concurrente por el mismo equipo: la segunda solicitud bloquea
 *   hasta que la primera confirme (commit) o revierta (rollback), momento en
 *   el que vuelve a leer el estado ya definitivo. Por eso dos solicitudes
 *   concurrentes nunca pueden reclamar el mismo equipo.
 * - Todos los flujos que reclaman un equipo abren su transacción con este
 *   módulo: préstamo normal (`asignarEquipo`, `registrarUsoEquipoExterno`) y
 *   autoservicio de aprendices sin cuenta (`iniciarUsoAutoservicio`), todos en
 *   `backend/src/controller/equiposController.js`. Cualquier error entre el
 *   claim y el commit revierte con `connection.rollback()` (ver los bloques
 *   catch de esas funciones), dejando equipo/ambiente/historial sin cambios.
 * - El cierre de una clase (que libera equipo, ambiente e historial de uso a
 *   la vez) usa un mecanismo distinto pero con la misma garantía atómica: el
 *   procedimiento `sp_finalizar_clase` (`backend/scripts/migrate-autoservicio-cierre-clase.sql`)
 *   envuelve sus UPDATE en `START TRANSACTION` / `COMMIT` con un
 *   `EXIT HANDLER FOR SQLEXCEPTION` que hace `ROLLBACK; RESIGNAL;`.
 * - Prueba de concurrencia real (single winner, cero estados parciales) en
 *   `backend/tests/integration/equipmentClaim.mysql.test.js`, ejecutable con
 *   `npm run test:mysql` (requiere MySQL 8, ver README de esa carpeta).
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
