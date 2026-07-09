import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  FiFilter,
  FiRefreshCw,
  FiSearch
} from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/pages/equipos.css'
import '../styles/pages/historiales.css'

export default function HistorialVerificacionesGeneral() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verificaciones, setVerificaciones] = useState([])
  const [toast, setToast] = useState(null)
  const [filtros, setFiltros] = useState({
    codigo_equipo: '',
    id_ambiente: '',
    fecha_desde: '',
    fecha_hasta: '',
    estado_verificacion: ''
  })
  const [ambientes, setAmbientes] = useState([])

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
      // fetchHistorial() // DESACTIVADO - Módulo de Historial de Verificaciones desactivado
      fetchAmbientes()
    }
  }, [user, filtros])

  async function fetchHistorial() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (filtros.codigo_equipo) params.append('codigo_equipo', filtros.codigo_equipo)
      if (filtros.id_ambiente) params.append('id_ambiente', filtros.id_ambiente)
      if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde)
      if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta)
      if (filtros.estado_verificacion) params.append('estado_verificacion', filtros.estado_verificacion)

      const res = await fetch(`/api/equipos/verificacion/historial?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener el historial')
      setVerificaciones(data.verificaciones || [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo obtener el historial'), type: 'error' })
      setVerificaciones([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchAmbientes() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/ambientes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res)
      setAmbientes(data || [])
    } catch (err) {
      console.error('Error al obtener ambientes:', err)
    }
  }

  function getEstadoBadge(estado) {
    const estados = {
      'Verificado': { color: 'var(--success-800)', bg: '#d1fae5', icon: <FiCheckCircle size={16} /> },
      'Con Novedad': { color: 'var(--error-700)', bg: '#fee2e2', icon: <FiAlertCircle size={16} /> },
      'No Verificado': { color: '#6b7280', bg: '#f3f4f6', icon: <FiX size={16} /> }
    }
    const estadoInfo = estados[estado] || estados['No Verificado']
    const estadoClass = estado === 'Verificado' ? 'historial-verificaciones-general-estado-badge-verificado' :
                        estado === 'Con Novedad' ? 'historial-verificaciones-general-estado-badge-con-novedad' :
                        'historial-verificaciones-general-estado-badge-no-verificado'
    return (
      <span className={`historial-verificaciones-general-estado-badge ${estadoClass}`}>
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
            <h2 className="historial-verificaciones-general-header">
              <FiClock size={24} />
              Historial de Verificaciones de Inventario
            </h2>
            {/* <button
              type="button"
              className="btn-act historial-verificaciones-general-refresh-btn"
              onClick={fetchHistorial}
              disabled={loading}
            >
              <FiRefreshCw size={16} />
              Actualizar
            </button> */}
          </div>

          {/* Filtros */}
          <div className="historial-verificaciones-general-filters">
            <div>
              <label className="historial-verificaciones-general-filter-label">Placa</label>
              <input
                type="text"
                value={filtros.codigo_equipo}
                onChange={e => setFiltros({ ...filtros, codigo_equipo: e.target.value })}
                placeholder="Buscar por código..."
                className="historial-verificaciones-general-filter-input"
              />
            </div>
            {user?.nombre_rol === 'Administrador' && (
              <div>
                <label className="historial-verificaciones-general-filter-label">Ambiente</label>
                <CustomSelect
                  name="id_ambiente"
                  value={filtros.id_ambiente}
                  onChange={e => setFiltros({ ...filtros, id_ambiente: e.target.value })}
                  options={[
                    { value: '', label: 'Todos' },
                    ...ambientes.map(amb => ({
                      value: amb.id_ambiente.toString(),
                      label: `${amb.codigo_ambiente} - ${amb.nombre_ambiente}`
                    }))
                  ]}
                  placeholder="Todos"
                  className="historial-verificaciones-general-filter-input"
                />
              </div>
            )}
            <div>
              <label className="historial-verificaciones-general-filter-label">Fecha Desde</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                className="historial-verificaciones-general-filter-input"
              />
            </div>
            <div>
              <label className="historial-verificaciones-general-filter-label">Fecha Hasta</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                className="historial-verificaciones-general-filter-input"
              />
            </div>
            <div>
              <label className="historial-verificaciones-general-filter-label">Estado</label>
              <CustomSelect
                name="estado_verificacion"
                value={filtros.estado_verificacion}
                onChange={e => setFiltros({ ...filtros, estado_verificacion: e.target.value })}
                options={['', 'Verificado', 'Con Novedad', 'No Verificado']}
                placeholder="Todos"
                className="historial-verificaciones-general-filter-input"
              />
            </div>
            <div className="historial-verificaciones-general-filter-actions">
              <button
                type="button"
                className="btn historial-verificaciones-general-filter-btn"
                onClick={() => setFiltros({ codigo_equipo: '', id_ambiente: '', fecha_desde: '', fecha_hasta: '', estado_verificacion: '' })}
              >
                <FiFilter size={16} />
                Limpiar
              </button>
            </div>
          </div>

          {/* Tabla de Historial */}
          {loading && verificaciones.length === 0 ? (
            <div className="historial-verificaciones-general-loading">
              Cargando historial...
            </div>
          ) : verificaciones.length === 0 ? (
            <div className="historial-verificaciones-general-empty">
              <FiClock size={48} className="historial-verificaciones-general-empty-icon" />
              <p>No hay verificaciones registradas</p>
              <p className="historial-verificaciones-general-empty-text">Usa los filtros para buscar verificaciones específicas</p>
            </div>
          ) : (
            <div className="historial-verificaciones-general-table-wrapper">
              <table className="consulta-table historial-verificaciones-general-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Equipo</th>
                    <th>Instructor</th>
                    <th>Ambiente</th>
                    <th>Clase/Horario</th>
                    <th>Jornada</th>
                    <th>Estado</th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {verificaciones.map(verif => (
                    <tr key={verif.id_verificacion}>
                      <td>
                        <div className="historial-verificaciones-general-date-cell">
                          <FiClock size={14} />
                          {formatDateTime(verif.fecha_verificacion)}
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{verif.equipo_tipo}</strong>
                          <div className="historial-verificaciones-general-equipo-info">
                            {verif.codigo_inventario || verif.codigo_equipo}
                          </div>
                          {verif.equipo_marca && verif.equipo_modelo && (
                            <div className="historial-verificaciones-general-equipo-info">
                              {verif.equipo_marca} {verif.equipo_modelo}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{verif.instructor_nombre}</strong>
                          <div className="historial-verificaciones-general-instructor-info">
                            CC: {verif.instructor_cedula}
                          </div>
                        </div>
                      </td>
                      <td>
                        {verif.nombre_ambiente ? (
                          <div>
                            <strong>{verif.nombre_ambiente}</strong>
                            <div className="historial-verificaciones-general-ambiente-info">
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
                              <div className="historial-verificaciones-general-clase-info">
                                Ficha: {verif.codigo_ficha}
                              </div>
                            )}
                            <div className="historial-verificaciones-general-clase-time">
                              <FiClock size={12} />
                              {formatDate(verif.fecha_clase)} {verif.hora_inicio} - {verif.hora_fin}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td>
                        {verif.jornada ? (
                          <span className={`historial-verificaciones-general-jornada-badge ${
                            verif.jornada === 'Mañana' ? 'historial-verificaciones-general-jornada-manana' :
                            verif.jornada === 'Tarde' ? 'historial-verificaciones-general-jornada-tarde' :
                            'historial-verificaciones-general-jornada-noche'
                          }`}>
                            {verif.jornada}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{getEstadoBadge(verif.estado_verificacion)}</td>
                      <td>{verif.observaciones || '-'}</td>
                      <td>
                        <button
                          className="btn btn-view historial-verificaciones-general-action-btn"
                          onClick={() => navigate(`/equipos/historial-verificaciones/${verif.codigo_equipo}`)}
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

