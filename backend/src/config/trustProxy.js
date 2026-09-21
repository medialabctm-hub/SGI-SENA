/**
 * Hop count for Express `trust proxy` behind the SGI-SENA edge topology.
 *
 * Production / Railway (single container):
 *   Client → Railway edge → nginx (:$PORT) → Node (127.0.0.1:$BACKEND_PORT)
 *
 * nginx (see frontend/nginx-main.conf + nginx-server.conf) sets a **single**
 * client IP toward Node via `$sgi_client_ip` (Railway’s overwritten
 * `X-Real-IP`, or `$remote_addr` when that header is absent). It does **not**
 * append a multi-hop `X-Forwarded-For` chain. From Node’s point of view there
 * is therefore only **one** reverse-proxy hop: nginx on loopback. Express must
 * use `trust proxy = 1` so `req.ip` is that sanitized client address.
 *
 * Using 2 hops with the current single-IP header is unsafe: an extra leftmost
 * XFF entry (if it ever reached Node) would be treated as the client and
 * bypass per-IP rate limits. Prefer fixing nginx (already done) over raising
 * the hop count.
 *
 * Override anytime with TRUST_PROXY_HOPS. Never use `true` (trust-all /
 * leftmost XFF — spoofable and rejected by express-rate-limit’s
 * permissive-trust check).
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

  // Railway and local share the same Node←nginx contract after $sgi_client_ip.
  return 1;
}
