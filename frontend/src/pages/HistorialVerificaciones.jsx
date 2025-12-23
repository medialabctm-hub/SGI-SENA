import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import CustomSelect from '../components/CustomSelect'
import { 
  FiClock, 
  FiUser, 
  FiMapPin, 
  FiPackage, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiX,
  FiArrowLeft,
  FiCalendar,
  FiFilter
} from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/historialVerificaciones.css'

export default function HistorialVerificaciones() {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [equipo, setEquipo] = useState(null)
  const [historial, setHistorial] = useState([])
  const [toast, setToast] = useState(null)
  const [filtros, setFiltros] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    estado_verificacion: ''
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
      if (filtros.estado_verificacion) params.append('estado_verificacion', filtros.estado_verificacion)

      const res = await fetch(`/api/equipos/${codigo}/historial-verificaciones?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener el historial')
      setEquipo(data.equipo)
      setHistorial(data.historial || [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo obtener el historial'), type: 'error' })
      setHistorial([])
    } finally {
      setLoading(false)
    }
  }

  function getEstadoBadge(estado) {
    const estados = {
      'Verificado': { color: 'var(--success-800)', bg: '#d1fae5', icon: <FiCheckCircle size={16} /> },
      'Con Novedad': { color: 'var(--error-700)', bg: '#fee2e2', icon: <FiAlertCircle size={16} /> },
      'No Verificado': { color: '#6b7280', bg: '#f3f4f6', icon: <FiX size={16} /> }
    }
    const estadoInfo = estados[estado] || estados['No Verificado']
    const estadoClass = estado === 'Verificado' ? 'historial-verificaciones-estado-badge-verificado' :
                        estado === 'Con Novedad' ? 'historial-verificaciones-estado-badge-con-novedad' :
                        'historial-verificaciones-estado-badge-no-verificado'
    return (
      <span className={`historial-verificaciones-estado-badge ${estadoClass}`}>
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

  function formatDate(dateStr) {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })
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
                className="btn historial-verificaciones-back-btn"
                onClick={() => navigate('/equipos/consultar')}
              >
                <FiArrowLeft size={16} />
                Volver
              </button>
              <h2 className="historial-verificaciones-header">
                <FiClock size={24} />
                Historial de Verificaciones
              </h2>
              {equipo && (
                <p className="historial-verificaciones-subtitle">
                  Equipo: {equipo.codigo_inventario || equipo.codigo_equipo} - {equipo.tipo} {equipo.marca} {equipo.modelo}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn-act historial-verificaciones-refresh-btn"
              onClick={fetchHistorial}
              disabled={loading}
            >
              <FiClock size={16} />
              Actualizar
            </button>
          </div>

          {/* Filtros */}
          <div className="historial-verificaciones-filter-section">
            <div>
              <label className="historial-verificaciones-filter-label">Fecha Desde</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                className="historial-verificaciones-filter-input"
              />
            </div>
            <div>
              <label className="historial-verificaciones-filter-label">Fecha Hasta</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                className="historial-verificaciones-filter-input"
              />
            </div>
            <div>
              <label className="historial-verificaciones-filter-label">Estado</label>
              <CustomSelect
                name="estado_verificacion"
                value={filtros.estado_verificacion}
                onChange={e => setFiltros({ ...filtros, estado_verificacion: e.target.value })}
                options={['', 'Verificado', 'Con Novedad', 'No Verificado']}
                placeholder="Todos"
                className="historial-verificaciones-filter-input"
              />
            </div>
            <div className="historial-verificaciones-filter-actions">
              <button
                type="button"
                className="btn historial-verificaciones-filter-btn"
                onClick={() => setFiltros({ fecha_desde: '', fecha_hasta: '', estado_verificacion: '' })}
              >
                <FiFilter size={16} />
                Limpiar
              </button>
            </div>
          </div>

          {/* Tabla de Historial */}
          {loading && historial.length === 0 ? (
            <div className="historial-verificaciones-loading">
              Cargando historial...
            </div>
          ) : historial.length === 0 ? (
            <div className="historial-verificaciones-empty">
              <FiClock size={48} className="historial-verificaciones-empty-icon" />
              <p>No hay verificaciones registradas para este equipo</p>
            </div>
          ) : (
            <div className="historial-verificaciones-table-wrapper">
              <table className="consulta-table historial-verificaciones-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Instructor</th>
                    <th>Ambiente</th>
                    <th>Clase/Horario</th>
                    <th>Jornada</th>
                    <th>Estado</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(verif => (
                    <tr key={verif.id_verificacion}>
                      <td>
                        <div className="historial-verificaciones-date-cell">
                          <FiClock size={14} />
                          {formatDateTime(verif.fecha_verificacion)}
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{verif.instructor_nombre}</strong>
                          <div className="historial-verificaciones-instructor-info">
                            CC: {verif.instructor_cedula}
                          </div>
                        </div>
                      </td>
                      <td>
                        {verif.nombre_ambiente ? (
                          <div>
                            <strong>{verif.nombre_ambiente}</strong>
                            <div className="historial-verificaciones-ambiente-info">
                              {verif.codigo_ambiente}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td>
                        {verif.id_clase ? (
                          <div>
                            <div><strong>{verif.nombre_clase || 'Clase'}</strong></div>
                            {verif.codigo_ficha && (
                              <div className="historial-verificaciones-clase-info">
                                Ficha: {verif.codigo_ficha}
                              </div>
                            )}
                            <div className="historial-verificaciones-clase-time">
                              <FiCalendar size={12} />
                              {formatDate(verif.fecha_clase)} {verif.hora_inicio} - {verif.hora_fin}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td>
                        {verif.jornada ? (
                          <span className={`historial-verificaciones-jornada-badge ${
                            verif.jornada === 'Mañana' ? 'historial-verificaciones-jornada-manana' :
                            verif.jornada === 'Tarde' ? 'historial-verificaciones-jornada-tarde' :
                            'historial-verificaciones-jornada-noche'
                          }`}>
                            {verif.jornada}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{getEstadoBadge(verif.estado_verificacion)}</td>
                      <td>{verif.observaciones || '-'}</td>
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

