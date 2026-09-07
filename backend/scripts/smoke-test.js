/**
 * Smoke test: comprueba que GET /health confirme readiness de autoservicio.
 * El servidor debe estar ya corriendo. Uso: npm run test:smoke
 */

const port = process.env.BACKEND_PORT || process.env.PORT || 3000;
const url = `http://localhost:${port}/health`;

async function run() {
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));

    if (res.status === 200 && data.status === 'ok' && data.autoservicio?.ready === true) {
      console.log('Health check passed: autoservicio ready');
      process.exit(0);
    }

    if (res.status === 503 && data.status === 'not_ready' && data.autoservicio?.ready === false) {
      console.error('Health check blocked: autoservicio not ready');
      process.exit(1);
    }

    console.error(`Health check failed: status ${res.status}`);
    process.exit(1);
  } catch (err) {
    console.error('Health check error:', err.message);
    process.exit(1);
  }
}

run();
