/**
 * Se ejecuta antes de todo (setupFiles de Jest).
 * Define variables de entorno de prueba para que config.js no lance al cargar.
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_USER = process.env.DB_USER || 'test';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test';
process.env.DB_NAME = process.env.DB_NAME || 'test';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test-cookie-secret';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.BREVO_API_KEY = process.env.BREVO_API_KEY || 'test-brevo-key';
process.env.BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'test@test.com';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-webhook-secret';
