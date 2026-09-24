/**
 * Sistema de logging para la aplicación
 */

import { redactSensitiveFields } from './errorScrubber.js';

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG',
};


const SENSITIVE_LOG_KEYS = new Set([
  'token',
  'nuevaContrasena',
  'contrasena',
  'contrasenaActual',
  'password',
  'passwordConfirmation',
  'currentPassword',
  'newPassword',
  'authorization',
  'Authorization',
]);

/**
 * Redacta campos sensibles en meta de logs / bodies de request (MDL-232).
 * Nunca registrar tokens de reset ni contraseñas en claro.
 */
export function redactSensitive(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_LOG_KEYS.has(key)) {
      out[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      out[key] = redactSensitive(val, depth + 1);
    } else {
      out[key] = val;
    }
  }
  return out;
}

class Logger {
  constructor() {
    this.level = this.getLogLevel();
  }

  getLogLevel() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    return LOG_LEVELS[envLevel] ?? LOG_LEVELS.INFO;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    // develop: redactSensitiveFields (errorScrubber); #48: redactSensitive (tokens/passwords)
    const safeMeta = redactSensitive(redactSensitiveFields(meta));
    const metaStr = Object.keys(safeMeta).length > 0 ? JSON.stringify(safeMeta) : '';

    return `[${timestamp}] [${levelName}] ${message} ${metaStr}`;
  }

  shouldLog(level) {
    return level <= this.level;
  }

  error(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this.formatMessage(LOG_LEVELS.ERROR, message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this.formatMessage(LOG_LEVELS.WARN, message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.info(this.formatMessage(LOG_LEVELS.INFO, message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.debug(this.formatMessage(LOG_LEVELS.DEBUG, message, meta));
    }
  }
}

export const logger = new Logger();

export default logger;

