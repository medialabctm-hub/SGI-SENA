import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { 
  FiClock, 
  FiUser, 
  FiPackage, 
  FiArrowLeft,
  FiFilter,
  FiPlay,
  FiStopCircle
} from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function HistorialUsoEquipo() {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [equipo, setEquipo] = useState(null)
  const [historial, setHistorial] = useState([])
  const [toast, setToast] = useState(null)
  const [filtros, setFiltros] = useState({
    fecha_desde: '',
    fecha_hasta: ''
  })

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [])

  useEffect(() => {
    if (codigo) {
      fetchHistorial()
    }
  }, [codigo, filtros])

  async function fetchHistorial() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde)
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta)
      params.append('limit', '100')

      const res = await fetch(`/api/equipos/${codigo}/uso/historial?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener el historial de uso')
      setEquipo(data.equipo)
      setHistorial(data.historial || [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo obtener el historial de uso'), type: 'error' })
      setHistorial([])
    } finally {
      setLoading(false)
    }
  }

  function getEstadoBadge(estado) {
    const estados = {
      'En Uso': { color: 'var(--primary-700)', bg: '#dbeafe', icon: <FiPlay size={16} /> },
      'Finalizado': { color: 'var(--success-800)', bg: '#d1fae5', icon: <FiStopCircle size={16} /> }
    }
    const estadoInfo = estados[estado] || estados['Finalizado']
    return (
      <span style={{
        padding: '6px 12px',
        borderRadius: '12px',
        fontSize: '0.9rem',
        fontWeight: 600,
        color: estadoInfo.color,
        background: estadoInfo.bg,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        {estadoInfo.icon}
        {estado}
      </span>
    )
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatDuration(minutos) {
    if (!minutos && minutos !== 0) return '-'
    const horas = Math.floor(minutos / 60)
    const mins = minutos % 60
    if (horas > 0) {
      return `${horas}h ${mins}m`
    }
    return `${mins}m`
  }

  if (!user) return null

  return (
    <div className="page">
      <Header user={user} />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        <div className="users-panel">
          <div className="users-toolbar">
            <div>
              <button
                type="button"
                className="btn"
                onClick={() => navigate('/equipos/uso/historial')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}
              >
                <FiArrowLeft size={16} />
                Volver
              </button>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FiClock size={24} />
                Historial de Uso
              </h2>
              {equipo && (
                <p style={{ margin: '8px 0 0 0', border: '1px solid var(--success-700)', fontSize: '0.9rem' }}>
                  Equipo: {equipo.codigo_inventario || equipo.codigo_equipo} - {equipo.tipo} {equipo.modelo}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn-act"
              onClick={fetchHistorial}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiClock size={16} />
              Actualizar
            </button>
          </div>

          {/* Filtros */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Fecha Desde</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--success-700)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Fecha Hasta</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--success-700)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setFiltros({ fecha_desde: '', fecha_hasta: '' })}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <FiFilter size={16} />
                Limpiar
              </button>
            </div>
          </div>

          {/* Tabla de Historial */}
          {loading && historial.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              Cargando historial...
            </div>
          ) : historial.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <FiClock size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>No hay registros de uso para este equipo</p>
            </div>
          ) : (
            <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
              <table className="consulta-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Fecha Inicio</th>
                    <th>Fecha Fin</th>
                    <th>Duración</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(registro => (
                    <tr key={registro.id_historial}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiPlay size={14} style={{ color: 'var(--primary-600)' }} />
                          {formatDateTime(registro.fecha_hora_inicio)}
                        </div>
                      </td>
                      <td>
                        {registro.fecha_hora_fin ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FiStopCircle size={14} style={{ color: 'var(--success-600)' }} />
                            {formatDateTime(registro.fecha_hora_fin)}
                          </div>
                        ) : (
                          <span style={{ color: '#6b7280', fontStyle: 'italic' }}>En curso...</span>
                        )}
                      </td>
                      <td>
                        {registro.duracion_minutos !== null && registro.duracion_minutos !== undefined ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FiClock size={14} />
                            {formatDuration(registro.duracion_minutos)}
                          </div>
                        ) : registro.estado === 'En Uso' ? (
                          <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Calculando...</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <div>
                          <strong>{registro.nombre_usuario}</strong>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            CC: {registro.usuario_cedula}
                          </div>
                          {registro.usuario_correo && (
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                              {registro.usuario_correo}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{getEstadoBadge(registro.estado)}</td>
                      <td>{registro.observaciones || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </main>
      </div>
    </div>
  )
}

