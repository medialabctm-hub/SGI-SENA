import { describe, expect, it } from '@jest/globals';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const startScriptPath = path.resolve(__dirname, '../../../start.sh');

describe('MDL-134: contrato de puertos de start.sh', () => {
  it('preserva PORT y separa los defaults público, nginx e interno', async () => {
    const script = await readFile(startScriptPath, 'utf8');

    expect(script).toContain('NGINX_PORT=${NGINX_PORT:-${PORT:-80}}');
    expect(script).toContain('BACKEND_PORT=${BACKEND_PORT:-3000}');
    expect(script).toContain('export NGINX_PORT BACKEND_PORT');
    expect(script).not.toMatch(/^\s*export\s+PORT\s*=/m);
  });

  it('reescribe listen y api_backend desde sus variables en cada ejecución', async () => {
    const script = await readFile(startScriptPath, 'utf8');

    expect(script).toContain(
      's|^[[:space:]]*listen[[:space:]]+[0-9]+;|    listen $NGINX_PORT;|'
    );
    expect(script).toContain(
      's|^[[:space:]]*set[[:space:]]+[^[:space:]]*api_backend[[:space:]]+.*;|    set \\$api_backend http://127.0.0.1:$BACKEND_PORT;|'
    );
  });
});
