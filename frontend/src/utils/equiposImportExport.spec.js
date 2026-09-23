import { describe, it, expect } from 'vitest'
import {
  EQUIPOS_PLANTILLA_COLUMNS,
  EQUIPOS_EXPORT_PAGE_SIZE,
  buildEquipoExportRow,
  buildEquiposExportAoa,
  fetchAllEquiposForExport,
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

describe('fetchAllEquiposForExport', () => {
  it('caps pageSize at EQUIPOS_EXPORT_PAGE_SIZE (100)', async () => {
    const calls = []
    const fetchFn = async (params) => {
      calls.push(params)
      return {
        equipos: [{ placa: '1' }],
        pagination: { page: 1, limit: 100, total: 1, hasNext: false },
      }
    }
    await fetchAllEquiposForExport(fetchFn, {}, { pageSize: 500 })
    expect(calls[0].limit).toBe(EQUIPOS_EXPORT_PAGE_SIZE)
  })

  it('loops pages until hasNext is false', async () => {
    const pages = {
      1: {
        equipos: Array.from({ length: 100 }, (_, i) => ({ placa: `p${i}` })),
        pagination: { page: 1, limit: 100, total: 250, hasNext: true },
      },
      2: {
        equipos: Array.from({ length: 100 }, (_, i) => ({ placa: `p${100 + i}` })),
        pagination: { page: 2, limit: 100, total: 250, hasNext: true },
      },
      3: {
        equipos: Array.from({ length: 50 }, (_, i) => ({ placa: `p${200 + i}` })),
        pagination: { page: 3, limit: 100, total: 250, hasNext: false },
      },
    }
    const calls = []
    const fetchFn = async (params) => {
      calls.push(params)
      return pages[params.page]
    }
    const all = await fetchAllEquiposForExport(fetchFn, { vista_inventario: 'todos' })
    expect(calls).toHaveLength(3)
    expect(calls.every((c) => c.limit === 100)).toBe(true)
    expect(calls[0]).toMatchObject({ page: 1, vista_inventario: 'todos' })
    expect(all).toHaveLength(250)
    expect(all[0].placa).toBe('p0')
    expect(all[249].placa).toBe('p249')
  })

  it('trims to pagination.total when hasNext stays true (gate: row count === total)', async () => {
    let page = 0
    const fetchFn = async () => {
      page += 1
      return {
        equipos: Array.from({ length: 100 }, (_, i) => ({ placa: `${page}-${i}` })),
        pagination: { page, limit: 100, total: 150, hasNext: true },
      }
    }
    const all = await fetchAllEquiposForExport(fetchFn)
    expect(page).toBe(2)
    expect(all).toHaveLength(150)
  })

  it('never requests limit above 100 (gate: no uncapped dump)', async () => {
    const limits = []
    const fetchFn = async (params) => {
      limits.push(params.limit)
      return {
        equipos: [{ placa: 'a' }],
        pagination: { page: 1, limit: params.limit, total: 1, hasNext: false },
      }
    }
    await fetchAllEquiposForExport(fetchFn, {}, { pageSize: 9999 })
    await fetchAllEquiposForExport(fetchFn)
    expect(limits.every((l) => l <= 100)).toBe(true)
    expect(Math.max(...limits)).toBe(100)
  })

  it('passes only list filters + page/limit (gate: same scope path as list UI)', async () => {
    const calls = []
    const fetchFn = async (params) => {
      calls.push(params)
      return {
        equipos: [{ placa: 'owned' }],
        pagination: { page: 1, limit: 100, total: 1, hasNext: false },
      }
    }
    await fetchAllEquiposForExport(fetchFn, {
      vista_inventario: 'ambientes',
      search: 'mic',
    })
    expect(Object.keys(calls[0]).sort()).toEqual(
      ['limit', 'page', 'search', 'vista_inventario'].sort()
    )
    expect(calls[0]).not.toHaveProperty('bypass_scope')
    expect(calls[0]).not.toHaveProperty('include_all')
  })

  it('forwards search filter in baseParams', async () => {
    const calls = []
    const fetchFn = async (params) => {
      calls.push(params)
      return { equipos: [], pagination: { hasNext: false, total: 0 } }
    }
    await fetchAllEquiposForExport(fetchFn, { search: 'laptop' })
    expect(calls[0].search).toBe('laptop')
  })

  it('handles missing pagination by stopping on short page', async () => {
    const calls = []
    const fetchFn = async (params) => {
      calls.push(params)
      if (params.page === 1) {
        return { equipos: Array.from({ length: 100 }, (_, i) => ({ placa: String(i) })) }
      }
      return { equipos: Array.from({ length: 12 }, (_, i) => ({ placa: `x${i}` })) }
    }
    const all = await fetchAllEquiposForExport(fetchFn)
    expect(calls).toHaveLength(2)
    expect(all).toHaveLength(112)
  })
})
