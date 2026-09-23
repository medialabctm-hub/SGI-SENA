import { describe, it, expect } from 'vitest'
import {
  EQUIPOS_PLANTILLA_COLUMNS,
  buildEquipoExportRow,
  buildEquiposExportAoa,
  toSecureEquipoImageUrl,
} from './equiposImportExport'
import { sanitizeExcelRow } from './excelSecurity'

describe('equiposImportExport FE (MDL-210)', () => {
  it('headers match plantilla', () => {
    const aoa = buildEquiposExportAoa([{ placa: '1' }])
    expect(aoa[0]).toEqual([...EQUIPOS_PLANTILLA_COLUMNS])
  })

  it('no title row — first row is headers', () => {
    const aoa = buildEquiposExportAoa([
      { codigo_inventario: 'P1', tipo: 't', nombre_categoria: 'c' },
    ])
    expect(aoa[0][0]).toBe('placa')
    expect(aoa[1][0]).toBe('P1')
    expect(aoa.length).toBe(2)
  })

  it('includes placa, categoria and secure foto URL', () => {
    const row = buildEquipoExportRow({
      codigo_inventario: 'P2',
      nombre_categoria: 'Audio',
      ruta_imagen: '/uploads/equipos/pic.jpg',
    })
    expect(row.placa).toBe('P2')
    expect(row.categoria).toBe('Audio')
    expect(row.url_imagen).toBe('/api/equipos/imagenes/archivo/pic.jpg')
    expect(row.url_imagen).not.toContain('/uploads/')
  })

  it('sanitizes formula injection in AOA', () => {
    const aoa = buildEquiposExportAoa(
      [{ placa: '=1+1', tipo: 'ok' }],
      sanitizeExcelRow
    )
    expect(String(aoa[1][0]).trimStart().startsWith("'")).toBe(true)
  })

  it('toSecureEquipoImageUrl never returns public uploads', () => {
    expect(toSecureEquipoImageUrl('/uploads/equipos/a.png')).not.toMatch(/^\/uploads\//)
  })
})
