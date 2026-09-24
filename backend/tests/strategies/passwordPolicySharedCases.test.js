/**
 * MDL-232: misma tabla de casos (shared/password-policy-cases.json)
 * contra PasswordValidationStrategy para que FE y BE no deriven.
 */
import { describe, it, expect } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PasswordValidationStrategy } from '../../src/strategies/ValidationStrategy.js';

function loadCases() {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), '../../../shared/password-policy-cases.json'),
    resolve(process.cwd(), '../shared/password-policy-cases.json'),
    resolve(process.cwd(), 'shared/password-policy-cases.json'),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) {
    throw new Error(`No se encontró password-policy-cases.json. Probados: ${candidates.join(', ')}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const cases = loadCases();

describe('PasswordValidationStrategy — tabla compartida FE/BE (MDL-232)', () => {
  const strategy = new PasswordValidationStrategy();

  it.each(cases.map((c) => [c.id, c.password, c.valid]))(
    'caso %s → valid=%s',
    (_id, password, expectedValid) => {
      expect(strategy.validate(password).valid).toBe(expectedValid);
    }
  );
});
