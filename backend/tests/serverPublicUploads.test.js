import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverSource = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf8');
const appSource = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');

describe('server public upload mounts', () => {
  it('does not expose the whole uploads directory from the runtime entrypoint', () => {
    expect(serverSource).not.toMatch(/app\.use\(\s*['"]\/uploads['"]\s*,\s*express\.static/);
    expect(serverSource).toMatch(/createApp/);
    expect(appSource).toMatch(/['"]\/uploads\/ambientes['"]/);
    expect(appSource).toMatch(/['"]\/uploads\/perfiles['"]/);
    expect(appSource).not.toMatch(/app\.use\(\s*['"]\/uploads['"]\s*,\s*express\.static/);
  });
});
