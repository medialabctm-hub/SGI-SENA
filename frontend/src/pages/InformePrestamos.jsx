import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import { fetchPrestamosReport } from '../utils/prestamosReport'
import '../styles/pages/equipos.css'
import '../styles/informePrestamos.css'

const formatDate = value => {
  if (!value) return 'En uso'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function writePdf(rows, filters) {
  const doc = new jsPDF()
  let y = 20
  const line = text => {
    const lines = doc.splitTextToSize(String(text), 175)
    if (y + lines.length * 6 > 275) { doc.addPage(); y = 20 }
    doc.text(lines, 18, y)
    y += lines.length * 6 + 2
  }
  doc.setFontSize(16)
  line('Informe de prestamos de equipos - SGI SENA')
  doc.setFontSize(10)
  line(`Generado: ${formatDate(new Date())} | Sesiones: ${rows.length}`)
  line(`Filtros: ${filters.fecha_desde || 'inicio'} a ${filters.fecha_hasta || 'hoy'}; ${filters.estado || 'todos los estados'}; placa ${filters.placa || 'todas'}`)
  line('Ambiente indicado: ubicacion actual del equipo; no necesariamente la ubicacion durante el prestamo.')
  rows.forEach(row => {
    y += 2
    line(`#${row.id_historial} | ${row.codigo_inventario || row.codigo_equipo} | ${row.equipo_tipo || ''} ${row.equipo_modelo || ''}`)
    line(`Usuario: ${row.usuario_nombre || 'No identificado'} | Responsable: ${row.cuentadante_nombre || 'No registrado'}`)
    line(`Ambiente actual: ${row.ambiente_actual || 'Sin ambiente'} | Estado: ${row.estado}`)
    line(`Inicio: ${formatDate(row.fecha_hora_inicio)} | Fin: ${row.fecha_hora_fin ? formatDate(row.fecha_hora_fin) : 'En uso'} | Duracion: ${Number.isFinite(Number(row.duracion_minutos)) && Number(row.duracion_minutos) >= 0 ? `${row.duracion_minutos} min` : 'No disponible'}`)
  })
  doc.save(`prestamos_sgi_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export default function InformePrestamos() {
  const navigate = useNavigate()
  const [user] = useState(() => { try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null } })
  const [draft, setDraft] = useState({ fecha_desde: '', fecha_hasta: '', estado: '', placa: '', ambiente: '', documento_cuentadante: '' })
  const [filters, setFilters] = useState(draft)
  const [ambientes, setAmbientes] = useState([])
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetch('/api/ambientes/activos', { credentials: 'include' })
      .then(response => parseApiResponse(response, 'No se pudieron cargar ambientes'))
      .then(data => setAmbientes(Array.isArray(data) ? data : []))
      .catch(() => setAmbientes([]))
  }, [])

  const getPage = async (pageNumber, appliedFilters = filters) => {
    const params = new URLSearchParams({ page: String(pageNumber), limit: '100' })
    Object.entries(appliedFilters).forEach(([key, value]) => { if (value) params.set(key, value) })
    const response = await fetch(`/api/equipos/uso/informe?${params}`, { credentials: 'include' })
    return parseApiResponse(response, 'No se pudo cargar el informe de préstamos')
  }

  useEffect(() => {
    if (!['Administrador', 'Cuentadante'].includes(user?.nombre_rol)) return
    let cancelled = false
    setLoading(true)
    getPage(page).then(data => {
      if (!cancelled) { setRows(data.sesiones || []); setPagination(data.pagination || { page, total: 0, totalPages: 0 }) }
    }).catch(error => {
      if (!cancelled) { setRows([]); setToast({ message: buildErrorMessage(error, 'No se pudo cargar el informe'), type: 'error' }) }
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, filters, user?.nombre_rol])

  async function exportPdf() {
    setExporting(true)
    try {
      const allRows = await fetchPrestamosReport(number => getPage(number))
      if (!allRows.length) { setToast({ message: 'No hay préstamos con estos filtros', type: 'warning' }); return }
      writePdf(allRows, filters)
    } catch (error) {
      setToast({ message: buildErrorMessage(error, 'No se pudo generar el documento'), type: 'error' })
    } finally { setExporting(false) }
  }

  return <div className="page simple-page">
    <Header />
    <div className="dashboard-layout"><Sidebar user={user} /><main className="dashboard-main">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <section className="form-equipos form-modern informe-prestamos">
        <button type="button" className="btn" onClick={() => navigate('/equipos/prestados')}>Volver a equipos prestados</button>
        <h1>Informe de préstamos</h1>
        <p>Incluye sesiones en uso y finalizadas. El ambiente mostrado es la ubicación actual, no una reconstrucción histórica.</p>
        {!['Administrador', 'Cuentadante'].includes(user?.nombre_rol) ? <p>No tiene acceso a este informe.</p> : <>
          <form className="informe-prestamos-filtros" onSubmit={event => { event.preventDefault(); setPage(1); setFilters({ ...draft }) }}>
            <label>Desde<input type="date" value={draft.fecha_desde} onChange={event => setDraft({ ...draft, fecha_desde: event.target.value })} /></label>
            <label>Hasta<input type="date" value={draft.fecha_hasta} onChange={event => setDraft({ ...draft, fecha_hasta: event.target.value })} /></label>
            <label>Placa<input value={draft.placa} maxLength={80} onChange={event => setDraft({ ...draft, placa: event.target.value })} /></label>
            <label>Ambiente actual<select value={draft.ambiente} onChange={event => setDraft({ ...draft, ambiente: event.target.value })}><option value="">Todos</option>{ambientes.map(amb => <option key={amb.id_ambiente} value={amb.id_ambiente}>{amb.nombre_ambiente}</option>)}</select></label>
            <label>Estado<select value={draft.estado} onChange={event => setDraft({ ...draft, estado: event.target.value })}><option value="">Todos</option><option value="En Uso">En uso</option><option value="Finalizado">Finalizado</option></select></label>
            {user?.nombre_rol === 'Administrador' && <label>Documento del cuentadante<input inputMode="numeric" value={draft.documento_cuentadante} onChange={event => setDraft({ ...draft, documento_cuentadante: event.target.value })} /></label>}
            <button type="submit" className="btn btn-verde">Aplicar filtros</button>
          </form>
          <div className="informe-prestamos-toolbar"><span>{loading ? 'Cargando…' : `${pagination.total} sesiones`}</span><button type="button" className="btn btn-verde" disabled={loading || exporting || pagination.total === 0} onClick={exportPdf}>{exporting ? 'Generando…' : 'Descargar PDF completo'}</button></div>
          <div className="informe-prestamos-table"><table className="users-table"><thead><tr><th>Referencia</th><th>Equipo</th><th>Usuario</th><th>Responsable</th><th>Ambiente actual</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead><tbody>{rows.map(row => <tr key={row.id_historial}><td>#{row.id_historial}</td><td>{row.codigo_inventario || row.codigo_equipo}</td><td>{row.usuario_nombre}</td><td>{row.cuentadante_nombre || '—'}</td><td>{row.ambiente_actual || '—'}</td><td>{formatDate(row.fecha_hora_inicio)}</td><td>{row.fecha_hora_fin ? formatDate(row.fecha_hora_fin) : 'En uso'}</td><td>{row.estado}</td></tr>)}</tbody></table></div>
          {!loading && rows.length === 0 && <p>No hay sesiones para estos filtros.</p>}
          {pagination.totalPages > 1 && <nav className="informe-prestamos-pages" aria-label="Páginas del informe"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>{page} / {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></nav>}
        </>}
      </section>
    </main></div>
  </div>
}
