/** Pide todas las páginas; falla cerrado antes de crear un documento incompleto. */
export async function fetchPrestamosReport(getPage) {
  const rows = []
  for (let page = 1; page <= 10000; page += 1) {
    const data = await getPage(page)
    const totalPages = Number(data?.pagination?.totalPages)
    if (!Array.isArray(data?.sesiones) || !Number.isSafeInteger(totalPages) || totalPages < 0 || totalPages > 10000) {
      throw new Error('La respuesta del informe no contiene una paginación válida')
    }
    if (totalPages === 0) return []
    if (data.sesiones.length === 0) throw new Error('Falta una página del informe; no se generó un PDF parcial')
    rows.push(...data.sesiones)
    if (page >= totalPages) return rows
  }
  throw new Error('El informe excede el límite de páginas. Acote los filtros.')
}
