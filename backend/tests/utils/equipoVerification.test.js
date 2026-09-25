import { describe, expect, it } from '@jest/globals';
import {
  currentEquipmentVerificationStatusSql,
  isEquipmentVerified,
} from '../../src/utils/equipoVerification.js';

describe('equipoVerification', () => {
  it('usa el historial más reciente y conserva la bandera como respaldo legado', () => {
    const sql = currentEquipmentVerificationStatusSql();

    expect(sql).toMatch(/FROM Verificaciones_Inventario/i);
    expect(sql).toMatch(/ORDER BY vi\.fecha_verificacion DESC, vi\.id_verificacion DESC/i);
    expect(sql).toMatch(/verificado_ambiente/i);
  });

  it('prioriza el estado manual actual sobre verificado_ambiente', () => {
    expect(isEquipmentVerified({
      estado_verificacion_actual: 'Verificado',
      verificado_ambiente: 0,
    })).toBe(true);
    expect(isEquipmentVerified({
      estado_verificacion_actual: 'Con Novedad',
      verificado_ambiente: 1,
    })).toBe(false);
  });

  it('usa verificado_ambiente únicamente cuando no hay estado histórico', () => {
    expect(isEquipmentVerified({ verificado_ambiente: 1 })).toBe(true);
    expect(isEquipmentVerified({ verificado_ambiente: 0 })).toBe(false);
  });
});
