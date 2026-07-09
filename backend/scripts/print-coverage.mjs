/**
 * print-coverage.mjs
 *
 * Lee coverage/coverage-summary.json generado por Jest (reporter json-summary)
 * y muestra el porcentaje general (promedio de las 4 métricas).
 *
 * Uso: node scripts/print-coverage.mjs
 * (Se invoca automáticamente desde npm run test:coverage)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const summaryPath = join(__dirname, '..', 'coverage', 'coverage-summary.json');

try {
  const raw  = readFileSync(summaryPath, 'utf-8');
  const data = JSON.parse(raw);
  const t    = data.total;

  const stmts    = t.statements.pct;
  const branches = t.branches.pct;
  const funcs    = t.functions.pct;
  const lines    = t.lines.pct;
  const overall  = ((stmts + branches + funcs + lines) / 4).toFixed(2);

  const SEP = '='.repeat(62);

  console.log('\n' + SEP);
  console.log('  COBERTURA GENERAL DEL PROYECTO');
  console.log(SEP);
  console.log(`  Overall (promedio 4 metricas) : ${overall}%`);
  console.log('  -------------------------------------------');
  console.log(`  Statements                    : ${stmts}%   (${t.statements.covered}/${t.statements.total})`);
  console.log(`  Branches                      : ${branches}%   (${t.branches.covered}/${t.branches.total})`);
  console.log(`  Functions                     : ${funcs}%   (${t.functions.covered}/${t.functions.total})`);
  console.log(`  Lines                         : ${lines}%   (${t.lines.covered}/${t.lines.total})`);
  console.log(SEP + '\n');
} catch (err) {
  console.error(
    '\n[print-coverage] No se pudo leer coverage/coverage-summary.json.',
    '\nEjecuta primero: npm run test:coverage\n',
    err.message
  );
  process.exit(1);
}
