import { describe, expect, it } from '@jest/globals';
import { buildAutoservicioHealth } from '../../src/utils/autoservicioHealth.js';

describe('healthcheck del servidor para autoservicio', () => {
  it('devuelve 503/not_ready con requisitos faltantes', () => {
    expect(buildAutoservicioHealth({
      ready: false,
      migrationVersion: 'AUTOSERVICIO_CIERRE_V2',
      missing: ['índice Historial_Uso_Equipos.uq_autoservicio_idempotency_key único sobre idempotency_key']
    }, '2026-08-20T00:00:00.000Z')).toEqual({
      statusCode: 503,
      body: {
        status: 'not_ready',
        timestamp: '2026-08-20T00:00:00.000Z',
        autoservicio: {
          ready: false,
          migrationVersion: 'AUTOSERVICIO_CIERRE_V2',
          missing: ['índice Historial_Uso_Equipos.uq_autoservicio_idempotency_key único sobre idempotency_key']
        }
      }
    });
  });

  it('devuelve 200/ok cuando la migración está lista', () => {
    expect(buildAutoservicioHealth({
      ready: true,
      migrationVersion: 'AUTOSERVICIO_CIERRE_V2',
      missing: []
    }, '2026-08-20T00:00:00.000Z')).toEqual({
      statusCode: 200,
      body: {
        status: 'ok',
        timestamp: '2026-08-20T00:00:00.000Z',
        autoservicio: {
          ready: true,
          migrationVersion: 'AUTOSERVICIO_CIERRE_V2',
          missing: []
        }
      }
    });
  });
});
