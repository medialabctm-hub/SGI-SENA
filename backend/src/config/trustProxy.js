/**
 * Hop count for Express `trust proxy` behind the SGI-SENA edge topology.
 *
 * Production / Railway (single container):
 *   Client → Railway edge → nginx (:$PORT) → Node (127.0.0.1:$BACKEND_PORT)
 *
 * Express treats `req.socket.remoteAddress` as the nearest peer and walks
 * `X-Forwarded-For` right-to-left. With the in-container nginx hop plus
 * Railway's edge, Node must trust **2** proxies so `req.ip` is the client
 * (not Railway's edge IP, and not 127.0.0.1).
 *
 * Local docker without Railway edge is typically Client → nginx → Node (1 hop).
 * Override anytime with TRUST_PROXY_HOPS. Never use `true` (trust-all / leftmost
 * XFF — spoofable and rejected by express-rate-limit's permissive-trust check).
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {number}
 */
export function getTrustProxyHops(env = process.env) {
  const raw = env.TRUST_PROXY_HOPS;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 5) {
      throw new Error(
        `TRUST_PROXY_HOPS debe ser un entero entre 0 y 5 (recibido: ${JSON.stringify(raw)})`,
      );
    }
    return n;
  }

  // Railway injects RAILWAY_* into the service environment.
  if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID) {
    return 2;
  }

  // Local / test: one reverse-proxy hop (nginx) or direct; matches prior default.
  return 1;
}
