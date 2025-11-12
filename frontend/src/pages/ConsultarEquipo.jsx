import React, { useState } from 'react'
import Header from '../components/Header'

export default function ConsultarEquipo() {
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [equipo, setEquipo] = useState(null)

  async function handleBuscar(e) {
    e.preventDefault()
    setError('')
    setEquipo(null)
    if (!codigo) { setError('Ingrese el código del equipo'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigo)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'No se pudo consultar el equipo')
        setEquipo(null)
      } else {
        setEquipo(data)
      }
    } catch {
      setError('Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page simple-page">
      <Header />
      <main className="container" style={{ maxWidth: 880, margin: '0 auto' }}>
        <h2 style={{textAlign: 'center', marginTop: '1.5rem'}}>Consultar Equipo</h2>
        <form onSubmit={handleBuscar} style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <input
            type="number"
            placeholder="Código de inventario"
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e6e6e6' }}
          />
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
        {error && <div style={{ color: '#dc3545', marginTop: 12 }}>{error}</div>}

        {equipo && (
          <div className="stats-card" style={{ marginTop: 18 }}>
            <h3>Resultado</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 12 }}>
              <div><b>Código:</b> {equipo.codigo_equipo}</div>
              <div><b>Tipo:</b> {equipo.tipo}</div>
              <div><b>Marca:</b> {equipo.marca || '-'}</div>
              <div><b>Modelo:</b> {equipo.modelo || '-'}</div>
              <div><b>Número de Serie:</b> {equipo.numero_serie || '-'}</div>
              <div><b>Estado Físico:</b> {equipo.estado_fisico}</div>
              <div><b>Fecha de Adquisición:</b> {equipo.fecha_adquisicion || '-'}</div>
              <div><b>Costo:</b> {equipo.costo ?? '-'}</div>
              <div><b>Ambiente:</b> {equipo.nombre_ambiente ? `${equipo.nombre_ambiente} (${equipo.codigo_ambiente})` : '-'}</div>
              <div><b>Incluye:</b> {[equipo.incluye_mouse && 'Mouse', equipo.incluye_teclado && 'Teclado', equipo.incluye_monitor && 'Monitor', equipo.incluye_torre && 'Torre'].filter(Boolean).join(', ') || 'N/A'}</div>
              <div style={{ gridColumn: '1 / -1' }}><b>Descripción:</b> {equipo.descripcion || '-'}</div>
              <div style={{ gridColumn: '1 / -1' }}><b>Especificaciones:</b> {equipo.specs_completas || '-'}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
