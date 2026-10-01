import { describe, expect, it, vi } from 'vitest'
import { fetchPrestamosReport } from '../utils/prestamosReport'

describe('exportación de préstamos', () => {
  it('recorre todas las páginas conservando filtros', async () => {
    const getPage = vi.fn(page => Promise.resolve({
      sesiones: [{ id_historial: page }],
      pagination: { page, totalPages: 2 },
    }))
    const rows = await fetchPrestamosReport(getPage)
    expect(rows.map(row => row.id_historial)).toEqual([1, 2])
    expect(getPage).toHaveBeenCalledTimes(2)
  })

  it('detecta páginas incompletas y evita producir un PDF parcial', async () => {
    await expect(fetchPrestamosReport(async () => ({ sesiones: [], pagination: { page: 1, totalPages: 2 } }))).rejects.toThrow()
  })
})
