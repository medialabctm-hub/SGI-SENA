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
import '../styles/historialUsoEquipo.css'

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
    const estadoClass = estado === 'En Uso' ? 'historial-uso-equipo-estado-badge-en-uso' : 'historial-uso-equipo-estado-badge-finalizado'
    return (
      <span className={`historial-uso-equipo-estado-badge ${estadoClass}`}>
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
                className="btn historial-uso-equipo-back-btn"
                onClick={() => navigate('/equipos/uso/historial')}
              >
                <FiArrowLeft size={16} />
                Volver
              </button>
              <h2 className="historial-uso-equipo-title">
                <FiClock size={24} />
                Historial de Uso
              </h2>
              {equipo && (
                <p className="historial-uso-equipo-subtitle">
                  Equipo: {equipo.codigo_inventario || equipo.codigo_equipo} - {equipo.tipo} {equipo.modelo}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn-act historial-uso-equipo-refresh-btn"
              onClick={fetchHistorial}
              disabled={loading}
            >
              <FiClock size={16} />
              Actualizar
            </button>
          </div>

          {/* Filtros */}
          <div className="historial-uso-equipo-filters">
            <div>
              <label className="historial-uso-equipo-filter-label">Fecha Desde</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                className="historial-uso-equipo-filter-input"
              />
            </div>
            <div>
              <label className="historial-uso-equipo-filter-label">Fecha Hasta</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                className="historial-uso-equipo-filter-input"
              />
            </div>
            <div className="historial-uso-equipo-filter-actions">
              <button
                type="button"
                className="btn historial-uso-equipo-filter-btn"
                onClick={() => setFiltros({ fecha_desde: '', fecha_hasta: '' })}
              >
                <FiFilter size={16} />
                Limpiar
              </button>
            </div>
          </div>

          {/* Tabla de Historial */}
          {loading && historial.length === 0 ? (
            <div className="historial-uso-equipo-loading">
              Cargando historial...
            </div>
          ) : historial.length === 0 ? (
            <div className="historial-uso-equipo-empty">
              <FiClock size={48} className="historial-uso-equipo-empty-icon" />
              <p>No hay registros de uso para este equipo</p>
            </div>
          ) : (
            <div className="historial-uso-equipo-table-wrapper">
              <table className="consulta-table historial-uso-equipo-table">
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
                        <div className="historial-uso-equipo-date-cell">
                          <FiPlay size={14} className="historial-uso-equipo-date-icon-play" />
                          {formatDateTime(registro.fecha_hora_inicio)}
                        </div>
                      </td>
                      <td>
                        {registro.fecha_hora_fin ? (
                          <div className="historial-uso-equipo-date-cell">
                            <FiStopCircle size={14} className="historial-uso-equipo-date-icon-stop" />
                            {formatDateTime(registro.fecha_hora_fin)}
                          </div>
                        ) : (
                          <span className="historial-uso-equipo-date-placeholder">En curso...</span>
                        )}
                      </td>
                      <td>
                        {registro.duracion_minutos !== null && registro.duracion_minutos !== undefined ? (
                          <div className="historial-uso-equipo-duration-cell">
                            <FiClock size={14} />
                            {formatDuration(registro.duracion_minutos)}
                          </div>
                        ) : registro.estado === 'En Uso' ? (
                          <span className="historial-uso-equipo-duration-placeholder">Calculando...</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <div>
                          <strong>{registro.nombre_usuario}</strong>
                          <div className="historial-uso-equipo-usuario-info">
                            CC: {registro.usuario_cedula}
                          </div>
                          {registro.usuario_correo && (
                            <div className="historial-uso-equipo-usuario-info">
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

