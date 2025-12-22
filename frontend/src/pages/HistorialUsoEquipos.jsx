import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { 
  FiClock, 
  FiUser, 
  FiPackage, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiX,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiPlay,
  FiStopCircle
} from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/historialUsoEquipos.css'

export default function HistorialUsoEquipos() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [historial, setHistorial] = useState([])
  const [toast, setToast] = useState(null)
  const [filtros, setFiltros] = useState({
    codigo_equipo: '',
    id_usuario: '',
    fecha_desde: '',
    fecha_hasta: '',
    estado: ''
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
    if (user) {
      fetchHistorial()
    }
  }, [user, filtros])

  async function fetchHistorial() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (filtros.codigo_equipo) params.append('codigo_equipo', filtros.codigo_equipo)
      if (filtros.id_usuario && (user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor')) {
        params.append('id_usuario', filtros.id_usuario)
      }
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde)
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta)
      if (filtros.estado) params.append('estado', filtros.estado)
      params.append('limit', '100')

      const res = await fetch(`/api/equipos/uso/historial?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener el historial de uso')
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
    const estadoClass = estado === 'En Uso' ? 'historial-uso-estado-badge-en-uso' : 'historial-uso-estado-badge-finalizado'
    return (
      <span className={`historial-uso-estado-badge ${estadoClass}`}>
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
            <h2 className="historial-uso-equipos-header">
              <FiClock size={24} />
              Historial de Uso de Equipos
            </h2>
            <button
              type="button"
              className="btn-act historial-uso-equipos-refresh-btn"
              onClick={fetchHistorial}
              disabled={loading}
            >
              <FiRefreshCw size={16} />
              Actualizar
            </button>
          </div>

          {/* Filtros */}
          <div className="historial-uso-equipos-filters">
            <div>
              <label className="historial-uso-equipos-filter-label">Placa</label>
              <input
                type="text"
                value={filtros.codigo_equipo}
                onChange={e => setFiltros({ ...filtros, codigo_equipo: e.target.value })}
                placeholder="Buscar por código..."
                className="historial-uso-equipos-filter-input"
              />
            </div>
            {(user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
              <div>
                <label className="historial-uso-equipos-filter-label">Usuario</label>
                <input
                  type="text"
                  value={filtros.id_usuario}
                  onChange={e => setFiltros({ ...filtros, id_usuario: e.target.value })}
                  placeholder="ID de usuario..."
                  className="historial-uso-equipos-filter-input"
                />
              </div>
            )}
            <div>
              <label className="historial-uso-equipos-filter-label">Fecha Desde</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                className="historial-uso-equipos-filter-input"
              />
            </div>
            <div>
              <label className="historial-uso-equipos-filter-label">Fecha Hasta</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                className="historial-uso-equipos-filter-input"
              />
            </div>
            <div>
              <label className="historial-uso-equipos-filter-label">Estado</label>
              <select
                value={filtros.estado}
                onChange={e => setFiltros({ ...filtros, estado: e.target.value })}
                className="historial-uso-equipos-filter-input"
              >
                <option value="">Todos</option>
                <option value="En Uso">En Uso</option>
                <option value="Finalizado">Finalizado</option>
              </select>
            </div>
            <div className="historial-uso-equipos-filter-actions">
              <button
                type="button"
                className="btn historial-uso-equipos-filter-btn"
                onClick={() => setFiltros({ codigo_equipo: '', id_usuario: '', fecha_desde: '', fecha_hasta: '', estado: '' })}
              >
                <FiFilter size={16} />
                Limpiar
              </button>
            </div>
          </div>

          {/* Tabla de Historial */}
          {loading && historial.length === 0 ? (
            <div className="historial-uso-equipos-loading">
              Cargando historial...
            </div>
          ) : historial.length === 0 ? (
            <div className="historial-uso-equipos-empty">
              <FiClock size={48} className="historial-uso-equipos-empty-icon" />
              <p>No hay registros de uso</p>
              <p className="historial-uso-equipos-empty-text">Usa los filtros para buscar registros específicos</p>
            </div>
          ) : (
            <div className="historial-uso-equipos-table-wrapper">
              <table className="consulta-table historial-uso-equipos-table">
                <thead>
                  <tr>
                    <th>Fecha Inicio</th>
                    <th>Fecha Fin</th>
                    <th>Duración</th>
                    <th>Equipo</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(registro => (
                    <tr key={registro.id_historial}>
                      <td>
                        <div className="historial-uso-equipos-date-cell">
                          <FiPlay size={14} className="historial-uso-equipos-date-icon-play" />
                          {formatDateTime(registro.fecha_hora_inicio)}
                        </div>
                      </td>
                      <td>
                        {registro.fecha_hora_fin ? (
                          <div className="historial-uso-equipos-date-cell">
                            <FiStopCircle size={14} className="historial-uso-equipos-date-icon-stop" />
                            {formatDateTime(registro.fecha_hora_fin)}
                          </div>
                        ) : (
                          <span className="historial-uso-equipos-date-placeholder">En curso...</span>
                        )}
                      </td>
                      <td>
                        {registro.duracion_minutos !== null && registro.duracion_minutos !== undefined ? (
                          <div className="historial-uso-equipos-duration-cell">
                            <FiClock size={14} />
                            {formatDuration(registro.duracion_minutos)}
                          </div>
                        ) : registro.estado === 'En Uso' ? (
                          <span className="historial-uso-equipos-duration-placeholder">Calculando...</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <div>
                          <strong>{registro.equipo_tipo}</strong>
                          <div className="historial-uso-equipos-equipo-info">
                            {registro.codigo_inventario || registro.codigo_equipo}
                          </div>
                          {registro.equipo_modelo && (
                            <div className="historial-uso-equipos-equipo-info">
                              {registro.equipo_modelo}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{registro.nombre_usuario}</strong>
                          <div className="historial-uso-equipos-usuario-info">
                            CC: {registro.usuario_cedula}
                          </div>
                          {registro.usuario_correo && (
                            <div className="historial-uso-equipos-usuario-info">
                              {registro.usuario_correo}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{getEstadoBadge(registro.estado)}</td>
                      <td>{registro.observaciones || '-'}</td>
                      <td>
                        <button
                          className="btn btn-view historial-uso-equipos-action-btn"
                          onClick={() => navigate(`/equipos/${registro.codigo_equipo}/uso/historial`)}
                          title="Ver historial completo del equipo"
                        >
                          <FiSearch size={14} />
                          Ver Equipo
                        </button>
                      </td>
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

