/**
 * Verifica que las variables de entorno requeridas estén definidas.
 * No arranca el servidor. Uso: node scripts/check-env.js o npm run check-env
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath, override: false });

const dbVars = [
  { key: 'DB_HOST', alt: 'MYSQLHOST' },
  { key: 'DB_USER', alt: 'MYSQLUSER' },
  { key: 'DB_PASSWORD', alt: 'MYSQLPASSWORD' },
  { key: 'DB_NAME', alt: 'MYSQLDATABASE' },
  { key: 'DB_PORT', alt: 'MYSQLPORT' },
];

const appVars = [
  'JWT_SECRET',
  'COOKIE_SECRET',
  'CORS_ORIGIN',
  'FRONTEND_URL',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
];

function get(name, alt) {
  const v = process.env[name] || (alt && process.env[alt]);
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

const missing = [];

dbVars.forEach(({ key, alt }) => {
  if (!get(key, alt)) missing.push(alt ? `${key} o ${alt}` : key);
});
appVars.forEach((key) => {
  if (!get(key)) missing.push(key);
});

if (missing.length > 0) {
  console.error('Faltan variables de entorno requeridas:', missing.join(', '));
  process.exit(1);
}

console.log('Variables de entorno requeridas: OK');
process.exit(0);
