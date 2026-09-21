import { describe, it, expect } from '@jest/globals';
import { getTrustProxyHops } from '../../src/config/trustProxy.js';

describe('getTrustProxyHops', () => {
  it('respeta TRUST_PROXY_HOPS numérico válido', () => {
    expect(getTrustProxyHops({ TRUST_PROXY_HOPS: '2' })).toBe(2);
    expect(getTrustProxyHops({ TRUST_PROXY_HOPS: '0' })).toBe(0);
    expect(getTrustProxyHops({ TRUST_PROXY_HOPS: '1', RAILWAY_ENVIRONMENT: 'production' })).toBe(1);
  });

  it('rechaza TRUST_PROXY_HOPS inválido', () => {
    expect(() => getTrustProxyHops({ TRUST_PROXY_HOPS: 'true' })).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => getTrustProxyHops({ TRUST_PROXY_HOPS: '-1' })).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => getTrustProxyHops({ TRUST_PROXY_HOPS: '6' })).toThrow(/TRUST_PROXY_HOPS/);
  });

  it('default es 1 hop (nginx ya entrega una sola IP de cliente)', () => {
    expect(getTrustProxyHops({})).toBe(1);
    expect(getTrustProxyHops({ NODE_ENV: 'test' })).toBe(1);
    // Railway no cambia el default: Node solo ve nginx + XFF single-IP.
    expect(getTrustProxyHops({ RAILWAY_ENVIRONMENT: 'production' })).toBe(1);
    expect(getTrustProxyHops({ RAILWAY_PROJECT_ID: 'proj_x' })).toBe(1);
    expect(getTrustProxyHops({ RAILWAY_SERVICE_ID: 'svc_x' })).toBe(1);
  });
});
