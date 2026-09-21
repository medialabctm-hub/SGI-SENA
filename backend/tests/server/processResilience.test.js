import { describe, it, expect } from '@jest/globals';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, '../../server.js');
const railwayPath = path.resolve(__dirname, '../../../railway.toml');
const dockerfilePath = path.resolve(__dirname, '../../../Dockerfile');

describe('MDL-190 H-02 — resiliencia de proceso y Railway', () => {
  it('server.js registra unhandledRejection y uncaughtException y sale con código != 0', async () => {
    const source = await readFile(serverPath, 'utf8');
    expect(source).toMatch(/process\.on\(\s*['"]unhandledRejection['"]/);
    expect(source).toMatch(/process\.on\(\s*['"]uncaughtException['"]/);
    expect(source).toMatch(/process\.exit\(1\)/);
  });

  it('railway.toml declara restart ON_FAILURE', async () => {
    const toml = await readFile(railwayPath, 'utf8');
    expect(toml).toMatch(/restartPolicyType\s*=\s*["']ON_FAILURE["']/);
    expect(toml).toMatch(/restartPolicyMaxRetries/);
  });

  it('Dockerfile conserva HEALTHCHECK sobre /health sin pisar PORT', async () => {
    const docker = await readFile(dockerfilePath, 'utf8');
    expect(docker).toMatch(/HEALTHCHECK/);
    expect(docker).toMatch(/\/health/);
    // No debe forzar PORT= en la imagen principal (contrato MDL-134)
    expect(docker).not.toMatch(/^\s*ENV\s+PORT=/m);
  });
});
