import { config } from '../config/config.js';

/**
 * Nombre de la cookie httpOnly que transporta el JWT de sesión.
 * Único punto de verdad: authController, authMiddleware y socketService
 * deben importar esta constante en lugar de repetir el literal.
 */
export const SESSION_COOKIE_NAME = 'sgi_session';

const DURATION_UNITS_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Convierte formatos tipo "24h"/"7d" (los mismos que usa jsonwebtoken para
 * expiresIn) a milisegundos para maxAge de cookie. Si el formato no es
 * reconocido, cae al valor por defecto en lugar de emitir una cookie sin
 * expiración.
 */
export function parseDurationToMs(value, fallbackMs = DEFAULT_MAX_AGE_MS) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(String(value ?? '').trim());
  if (!match) return fallbackMs;
  const [, amount, unit] = match;
  return Number(amount) * DURATION_UNITS_MS[unit.toLowerCase()];
}

/**
 * Atributos de la cookie de sesión. Secure se activa solo en producción para
 * no romper el login en desarrollo local (http://localhost). SameSite=lax es
 * suficiente porque frontend y backend se sirven bajo el mismo origen (nginx
 * hace proxy de /api al backend, ver frontend/nginx-server.conf).
 */
export function buildSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: parseDurationToMs(config.jwt.expiresIn),
  };
}

/**
 * Extrae el token de sesión de una request Express.
 * Prioriza la cookie httpOnly (flujo web); si no hay cookie, cae al header
 * Authorization: Bearer (clientes no navegador, ej. login-placa/scripts).
 */
export function extractSessionToken(req) {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const authHeader = req.headers?.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

/**
 * Extrae el token de sesión del header Cookie crudo de un handshake de
 * socket.io (ahí no hay cookie-parser corriendo). Parser mínimo a propósito
 * para no sumar una dependencia nueva (el paquete "cookie" solo está
 * disponible de forma transitiva vía cookie-parser/express).
 */
export function extractTokenFromCookieHeader(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const target = `${SESSION_COOKIE_NAME}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(target)) continue;
    const value = trimmed.slice(target.length);
    try {
      return decodeURIComponent(value) || null;
    } catch {
      return value || null;
    }
  }
  return null;
}
