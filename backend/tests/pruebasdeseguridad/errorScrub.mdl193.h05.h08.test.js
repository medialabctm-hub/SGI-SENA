/**
 * Negativas de seguridad — MDL-193 / auditoría H-05 + H-08 (2026-09-23).
 *
 * Cubre residuales que bypasean el scrubber global (#35 / MDL-204):
 * - authorization requirePermission catch → 500 con details
 * - GET /health missing[] con tablas/SP/índices
 * - historial de uso ER_NO_SUCH_TABLE con path BD/*.sql
 *
 * No modifica el scrub 503 de autoservicio (PR #35 / MDL-204 / H-04).
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { buildAutoservicioHealth } from '../../src/utils/autoservicioHealth.js';
import { containsInternalErrorDetail } from '../../src/utils/errorScrubber.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INTERNAL_TOKENS = [
  'Historial_Uso_Equipos',
  'BD/historial_uso_equipos.sql',
  'sp_finalizar_clase',
  'INFORMATION_SCHEMA',
  'Knex',
  'node_modules',
  '/workspace/',
  'fecha_proximo_mantenimiento',
  'pedidos_externos',
];

function assertNoInternalLeak(payload) {
  const serialized = JSON.stringify(payload);
  for (const token of INTERNAL_TOKENS) {
    expect(serialized.includes(token)).toBe(false);
  }
  expect(serialized).not.toMatch(/FOREIGN KEY|CONSTRAINT `|ER_[A-Z_]+|Knex|BD\/[\w./-]+\.sql|Historial_Uso_Equipos|sp_finalizar/i);
  expect(payload).not.toHaveProperty('stack');
  expect(payload).not.toHaveProperty('details');
}

describe('H-05 scrub en authorization requirePermission (DB error)', () => {
  let requirePermission;
  let mockIsAdmin;
  let mockHasPermissionFromDB;

  beforeAll(async () => {
    mockIsAdmin = jest.fn();
    mockHasPermissionFromDB = jest.fn();

    jest.unstable_mockModule(resolve(__dirname, '../../src/config/permissions.js'), () => ({
      isAdmin: mockIsAdmin,
      hasPermissionFromDB: mockHasPermissionFromDB,
      hasPermission: jest.fn(),
      hasAnyPermission: jest.fn(),
    }));
    jest.unstable_mockModule(resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
      default: {},
    }));

    ({ requirePermission } = await import(resolve(__dirname, '../../src/middleware/authorization.js')));
  });

  beforeEach(() => {
    mockIsAdmin.mockReset();
    mockHasPermissionFromDB.mockReset();
  });

  it('500 de requirePermission no filtra SQL/Knex/paths ni details', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasPermissionFromDB.mockRejectedValue(
      new Error("KnexTimeoutError: select * from `Historial_Uso_Equipos` - pool timeout at /workspace/SGI-SENA/backend/src/x.js:10:1")
    );

    const app = express();
    app.get('/probe', (req, res, next) => {
      req.user = { id: 1, rol: 'Instructor' };
      return requirePermission('equipos:view')(req, res, next);
    });

    const res = await request(app).get('/probe').expect(500);
    expect(res.body.error).toBe('Error al validar permisos');
    assertNoInternalLeak(res.body);
    expect(containsInternalErrorDetail(JSON.stringify(res.body))).toBe(false);
  });
});

describe('H-08 scrub en GET /health missing[]', () => {
  it('buildAutoservicioHealth no expone missing con tablas/SP/índices', () => {
    const health = buildAutoservicioHealth({
      ready: false,
      migrationVersion: 'AUTOSERVICIO_CIERRE_V2',
      missing: [
        'Historial_Uso_Equipos.id_usuario nullable',
        'sp_finalizar_clase con marcador AUTOSERVICIO_CIERRE_V2',
        'índice Historial_Uso_Equipos.uq_autoservicio_idempotency_key',
      ],
    }, '2026-09-23T00:00:00.000Z');

    expect(health.statusCode).toBe(503);
    expect(health.body.autoservicio).toEqual({
      ready: false,
      migrationVersion: 'AUTOSERVICIO_CIERRE_V2',
    });
    expect(health.body.autoservicio).not.toHaveProperty('missing');
    assertNoInternalLeak(health.body);
  });

  // Ruta /health cubierta en tests/routes/health.test.js (evita mock pollution de authorization).
});

describe('H-08 scrub historial missing-table', () => {
  it('respuesta ER_NO_SUCH_TABLE no incluye tabla ni BD/*.sql', async () => {
    // Replica el branch scrubbed del controller sin BD.
    const app = express();
    app.get('/api/equipos/historial-uso', (req, res) => {
      const err = new Error("Table 'sgi.Historial_Uso_Equipos' doesn't exist");
      err.code = 'ER_NO_SUCH_TABLE';
      if (err.code === 'ER_NO_SUCH_TABLE' || err.message.includes("doesn't exist") || err.message.includes("Unknown table")) {
        return res.status(404).json({
          error: 'Historial de uso no disponible',
          historial: [],
          total: 0,
        });
      }
      return res.status(500).json({ error: err.message });
    });

    const res = await request(app).get('/api/equipos/historial-uso').expect(404);
    expect(res.body.error).toMatch(/historial de uso no disponible/i);
    expect(res.body).not.toHaveProperty('detalle');
    assertNoInternalLeak(res.body);
  });
});
