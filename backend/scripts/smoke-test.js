/**
 * Smoke test: comprueba que GET /health responda 200.
 * El servidor debe estar ya corriendo. Uso: npm run test:smoke
 */

const port = process.env.BACKEND_PORT || process.env.PORT || 3000;
const url = `http://localhost:${port}/health`;

async function run() {
  try {
    const res = await fetch(url);
    if (res.status === 200) {
      const data = await res.json().catch(() => ({}));
      if (data.status === 'ok') {
        console.log('Health check passed');
        process.exit(0);
      }
    }
    console.error(`Health check failed: status ${res.status}`);
    process.exit(1);
  } catch (err) {
    console.error('Health check error:', err.message);
    process.exit(1);
  }
}

run();
