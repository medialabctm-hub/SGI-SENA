/**
 * Custom Jest Reporter - Porcentaje General de Cobertura
 *
 * Calcula y muestra un único % global al finalizar la suite de tests.
 * Se registra en jest.config.js bajo la opción `reporters`.
 */

'use strict';

class OverallCoverageReporter {
  /* Se llama al terminar TODOS los tests */
  onRunComplete(_contexts, results) {
    if (!results.coverageMap) return; // Sin --coverage, nada que mostrar

    try {
      const summary = results.coverageMap.getCoverageSummary();
      const stmts    = summary.statements.pct;
      const branches = summary.branches.pct;
      const funcs    = summary.functions.pct;
      const lines    = summary.lines.pct;

      /* Promedio simple de las 4 métricas */
      const overall = ((stmts + branches + funcs + lines) / 4).toFixed(2);

      const sep = '='.repeat(62);
      const out = [
        '',
        sep,
        '  COBERTURA GENERAL DEL PROYECTO',
        sep,
        `  Overall (promedio 4 metricas) : ${overall}%`,
        `  Statements                    : ${stmts}%`,
        `  Branches                      : ${branches}%`,
        `  Functions                     : ${funcs}%`,
        `  Lines                         : ${lines}%`,
        sep,
        '',
      ].join('\n');

      process.stdout.write(out);
    } catch (_e) {
      // La cobertura no está disponible (p.ej. ejecución sin --coverage)
    }
  }
}

module.exports = OverallCoverageReporter;
