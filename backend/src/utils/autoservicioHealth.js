export function buildAutoservicioHealth(autoservicio, timestamp = new Date().toISOString()) {
  return {
    statusCode: autoservicio.ready ? 200 : 503,
    body: {
      status: autoservicio.ready ? 'ok' : 'not_ready',
      timestamp,
      autoservicio
    }
  };
}
