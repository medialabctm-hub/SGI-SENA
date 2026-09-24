import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validatePassword } from './passwordPolicy.js';
import { validarContraseña } from './validaciones.js';

const casesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../shared/password-policy-cases.json'
);
const cases = JSON.parse(readFileSync(casesPath, 'utf8'));

describe('passwordPolicy (MDL-232) — tabla compartida FE/BE', () => {
  it.each(cases.map((c) => [c.id, c.password, c.valid]))(
    'caso %s → valid=%s',
    (_id, password, expectedValid) => {
      expect(validatePassword(password).valid).toBe(expectedValid);
    }
  );

  it('acepta especiales (){}<>" que validarCaracteresEspeciales rechazaría', () => {
    expect(validatePassword('Abcdef1()').valid).toBe(true);
    expect(validatePassword('Abcdef1{}').valid).toBe(true);
    expect(validatePassword('Abcdef1<>').valid).toBe(true);
    expect(validatePassword('Abcdef1"').valid).toBe(true);
  });
});

describe('validarContraseña (registro) alineada a la política', () => {
  it('acepta contraseña con (){}<>" (no pasa por validarCaracteresEspeciales)', () => {
    expect(validarContraseña('Abcdef1()')).toBeNull();
    expect(validarContraseña('Abcdef1<>')).toBeNull();
  });

  it('rechaza sin complejidad o fuera de 8–128', () => {
    expect(validarContraseña('corto1*')).not.toBeNull();
    expect(validarContraseña('Abcdefg1')).not.toBeNull();
  });
});

describe('validarContraseña — espacios como especial (sin trim)', () => {
  it('acepta espacio, ñ, leading y trailing space', () => {
    expect(validarContraseña('Abcdef1 ')).toBeNull();
    expect(validarContraseña('Abcdef1ñ')).toBeNull();
    expect(validarContraseña(' Abcd12!')).toBeNull();
    expect(validarContraseña('Abcd12! ')).toBeNull();
  });

  it('no recorta: leading space sigue siendo parte del valor validado', () => {
    const withLead = ' Abcd12!';
    expect(validatePassword(withLead).valid).toBe(true);
    // Si alguien hiciera trim, el valor cambiaría (8 → 7) y fallaría el mínimo.
    expect(withLead.length).toBe(8);
    expect(withLead.trim().length).toBe(7);
    expect(validatePassword(withLead.trim()).valid).toBe(false);
  });
});
