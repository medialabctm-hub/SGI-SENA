import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
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
import '../styles/equipos.css'

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
      fetchHistorial()
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
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FiClock size={24} />
              Historial de Verificaciones de Inventario
            </h2>
            <button
              type="button"
              className="btn"
              onClick={fetchHistorial}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiRefreshCw size={16} />
              Actualizar
            </button>
          </div>

          {/* Filtros */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Código Equipo</label>
              <input
                type="text"
                value={filtros.codigo_equipo}
                onChange={e => setFiltros({ ...filtros, codigo_equipo: e.target.value })}
                placeholder="Buscar por código..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '2px solid var(--success-800)' }}
              />
            </div>
            {user?.nombre_rol === 'Administrador' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Ambiente</label>
                <select
                  value={filtros.id_ambiente}
                  onChange={e => setFiltros({ ...filtros, id_ambiente: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '2px solid var(--success-800)' }}
                >
                  <option value="">Todos</option>
                  {ambientes.map(amb => (
                    <option key={amb.id_ambiente} value={amb.id_ambiente}>
                      {amb.codigo_ambiente} - {amb.nombre_ambiente}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Fecha Desde</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '2px solid var(--success-800)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Fecha Hasta</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '2px solid var(--success-800)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Estado</label>
              <select
                value={filtros.estado_verificacion}
                onChange={e => setFiltros({ ...filtros, estado_verificacion: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '2px solid var(--success-800)' }}
              >
                <option value="">Todos</option>
                <option value="Verificado">Verificado</option>
                <option value="Con Novedad">Con Novedad</option>
                <option value="No Verificado">No Verificado</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setFiltros({ codigo_equipo: '', id_ambiente: '', fecha_desde: '', fecha_hasta: '', estado_verificacion: '' })}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <FiFilter size={16} />
                Limpiar
              </button>
            </div>
          </div>

          {/* Tabla de Historial */}
          {loading && verificaciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              Cargando historial...
            </div>
          ) : verificaciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <FiClock size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>No hay verificaciones registradas</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Usa los filtros para buscar verificaciones específicas</p>
            </div>
          ) : (
            <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
              <table className="consulta-table" style={{ width: '100%' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiClock size={14} />
                          {formatDateTime(verif.fecha_verificacion)}
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{verif.equipo_tipo}</strong>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            {verif.codigo_inventario || verif.codigo_equipo}
                          </div>
                          {verif.equipo_marca && verif.equipo_modelo && (
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                              {verif.equipo_marca} {verif.equipo_modelo}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{verif.instructor_nombre}</strong>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            CC: {verif.instructor_cedula}
                          </div>
                        </div>
                      </td>
                      <td>
                        {verif.nombre_ambiente ? (
                          <div>
                            <strong>{verif.nombre_ambiente}</strong>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
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
                              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                Ficha: {verif.codigo_ficha}
                              </div>
                            )}
                            <div style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                              <FiClock size={12} />
                              {formatDate(verif.fecha_clase)} {verif.hora_inicio} - {verif.hora_fin}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td>
                        {verif.jornada ? (
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: verif.jornada === 'Mañana' ? 'var(--warning-600)' : verif.jornada === 'Tarde' ? '#3b82f6' : '#8b5cf6',
                            background: verif.jornada === 'Mañana' ? '#fef3c7' : verif.jornada === 'Tarde' ? '#dbeafe' : '#ede9fe'
                          }}>
                            {verif.jornada}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{getEstadoBadge(verif.estado_verificacion)}</td>
                      <td>{verif.observaciones || '-'}</td>
                      <td>
                        <button
                          className="btn btn-view"
                          onClick={() => navigate(`/equipos/historial-verificaciones/${verif.codigo_equipo}`)}
                          style={{ fontSize: '0.85rem', padding: '6px 12px' }}
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

