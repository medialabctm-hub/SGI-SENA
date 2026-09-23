/**
 * Health público de autoservicio (MDL-193 / H-08).
 * Expone solo ready + migrationVersion; missing[] queda en logs / ops.
 */
export function buildAutoservicioHealth(autoservicio, timestamp = new Date().toISOString()) {
  return {
    statusCode: autoservicio.ready ? 200 : 503,
    body: {
      status: autoservicio.ready ? 'ok' : 'not_ready',
      timestamp,
      autoservicio: {
        ready: Boolean(autoservicio?.ready),
        migrationVersion: autoservicio?.migrationVersion ?? null,
      },
    },
  };
}
