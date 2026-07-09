import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiPlus, FiAlertCircle, FiPackage, FiCheckCircle, FiDollarSign, FiTrendingUp, FiUsers, FiCalendar, FiTool, FiBarChart2 } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage, handleError } from '../utils/api'
import { useSocket } from '../contexts/SocketContext'
import '../styles/layout/dashboard.css'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [statsLoaded, setStatsLoaded] = useState(false)
  const [toast, setToast] = useState(null)
  const nav = useNavigate()

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [])

  // Calcular roles y permisos
  const userRole = user?.nombre_rol || ''
  const isAdmin = userRole === 'Administrador'
  const isInstructor = userRole === 'Instructor'
  const isCuentadante = userRole === 'Cuentadante'
  const shouldShowStats = isAdmin || isInstructor || isCuentadante

  // Lazy loading de estadísticas - solo cuando el usuario hace scroll o después de un delay
  const cargarEstadisticas = useCallback(async () => {
    if (statsLoaded || loading) return

    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        return
      }

      const response = await fetch('/api/estadisticas', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await parseApiResponse(response, 'Error al cargar estadísticas')
      setStats(data.stats)
      setStatsLoaded(true)
    } catch (error) {
      handleError(error, setToast, 'No se pudieron cargar las estadísticas');
    } finally {
      setLoading(false)
    }
  }, [statsLoaded, loading])

  // Cargar estadísticas después de un pequeño delay para mejorar rendimiento inicial
  useEffect(() => {
    if (shouldShowStats && !statsLoaded) {
      const timer = setTimeout(() => {
        cargarEstadisticas()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [user, statsLoaded, cargarEstadisticas, shouldShowStats])

  // Suscribirse a actualizaciones en tiempo real que afectan estadísticas
  const { subscribe } = useSocket()
  useEffect(() => {
    if (!subscribe || !shouldShowStats) return
    
    // Recargar estadísticas cuando haya cambios relevantes
    const unsubscribeEquipo = subscribe('equipo:created', () => {
      if (statsLoaded) {
        setStatsLoaded(false) // Forzar recarga
        cargarEstadisticas()
      }
    })
    
    const unsubscribeEquipoUpdated = subscribe('equipo:updated', () => {
      if (statsLoaded) {
        setStatsLoaded(false)
        cargarEstadisticas()
      }
    })
    
    const unsubscribeEquipoDeleted = subscribe('equipo:deleted', () => {
      if (statsLoaded) {
        setStatsLoaded(false)
        cargarEstadisticas()
      }
    })
    
    const unsubscribeNovedad = subscribe('novedad:created', () => {
      if (statsLoaded) {
        setStatsLoaded(false)
        cargarEstadisticas()
      }
    })
    
    const unsubscribeMantenimiento = subscribe('mantenimiento:created', () => {
      if (statsLoaded) {
        setStatsLoaded(false)
        cargarEstadisticas()
      }
    })
    
    return () => {
      unsubscribeEquipo()
      unsubscribeEquipoUpdated()
      unsubscribeEquipoDeleted()
      unsubscribeNovedad()
      unsubscribeMantenimiento()
    }
  }, [subscribe, shouldShowStats, statsLoaded, cargarEstadisticas])

  return (
    <div className="page dashboard-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          <div className="welcome-card">
            <h2>¡Bienvenido{userRole ? `, ${userRole}` : ''}{user ? ` ${user.nombre_usuario}` : ''}!</h2>
          </div>

          {/* Accesos Rápidos Destacados */}
          <div className="quick-actions">
            <h3 className="section-title">Accesos Rápidos</h3>
            <div className="quick-actions-grid">
              {(isAdmin || isCuentadante) && (
                <button
                  className="quick-action-card primary"
                  onClick={() => nav('/equipos')}
                >
                  <div className="quick-action-icon">
                    <FiPlus />
                  </div>
                  <div className="quick-action-content">
                    <h4>Registrar Inventario</h4>
                    <p>Agregar nuevo elemento al inventario</p>
                  </div>
                </button>
              )}
              {(isAdmin || isInstructor || isCuentadante) && (
                <button
                  className="quick-action-card secondary"
                  onClick={() => nav('/novedades/crear')}
                >
                  <div className="quick-action-icon">
                    <FiAlertCircle />
                  </div>
                  <div className="quick-action-content">
                    <h4>Registrar Novedad</h4>
                    <p>Reportar una incidencia o problema</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Estadísticas - Administrador, Instructor y Cuentadante */}
          {shouldShowStats && (
            <div className="stats-card">
              <div className="stats-header">
                <h3>Estadísticas Rápidas</h3>
                {!statsLoaded && !loading && (
                  <button
                    className="load-stats-btn"
                    onClick={cargarEstadisticas}
                  >
                    Cargar estadísticas
                  </button>
                )}
              </div>
              {loading ? (
                <div className="stats-loading">
                  <div className="loading-spinner"></div>
                  <p>Cargando estadísticas...</p>
                </div>
              ) : stats ? (
                <>
                  {/* Estadísticas Principales */}
                  <div className="stats-grid">
                    {/* Total Equipos */}
                    <div className="stat-card stat-card-blue">
                      <div className="stat-icon-wrapper">
                        <FiPackage size={36} />
                      </div>
                      <div className="stat-value-large">
                        {stats.total_equipos || 0}
                      </div>
                      <div className="stat-label-small">Total Equipos</div>
                    </div>

                    {/* Equipos en Buen Estado */}
                    <div className="stat-card stat-card-green">
                      <div className="stat-icon-wrapper">
                        <FiCheckCircle size={36} />
                      </div>
                      <div className="stat-value-large">
                        {stats.equipos_buenos || 0}
                      </div>
                      <div className="stat-label-small">Equipos en Buen Estado</div>
                    </div>

                    {/* Equipos con Novedades */}
                    <div className="stat-card stat-card-yellow">
                      <div className="stat-icon-wrapper">
                        <FiAlertCircle size={36} />
                      </div>
                      <div className="stat-value-large">
                        {stats.equipos_con_novedades || (stats.equipos_regulares || 0) + (stats.equipos_danados || 0)}
                      </div>
                      <div className="stat-label-small">Equipos con Novedades</div>
                    </div>

                    {/* Valor Total Inventario */}
                    <div className="stat-card stat-card-gray">
                      <div className="stat-icon-wrapper">
                        <FiDollarSign size={36} />
                      </div>
                      <div className="stat-value-large stat-value-currency">
                        {stats.valor_total_inventario 
                          ? new Intl.NumberFormat('es-CO', { 
                              style: 'currency', 
                              currency: 'COP',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                              useGrouping: true
                            }).format(stats.valor_total_inventario)
                          : '$ 0'}
                      </div>
                      <div className="stat-label-small">Valor Total Inventario</div>
                    </div>

                    {/* Novedades Pendientes */}
                    {isAdmin && stats.novedades_pendientes !== undefined && (
                      <div className="stat-card stat-card-red">
                        <div className="stat-icon-wrapper">
                          <FiAlertCircle size={36} />
                        </div>
                        <div className="stat-value-large">
                          {stats.novedades_pendientes || 0}
                        </div>
                        <div className="stat-label-small">Novedades Pendientes</div>
                      </div>
                    )}

                    {/* Mantenimientos Próximos */}
                    {isAdmin && stats.mantenimientos_proximos !== undefined && (
                      <div className="stat-card stat-card-yellow">
                        <div className="stat-icon-wrapper">
                          <FiTool size={36} />
                        </div>
                        <div className="stat-value-large">
                          {stats.mantenimientos_proximos || 0}
                        </div>
                        <div className="stat-label-small">Mantenimientos Próximos</div>
                      </div>
                    )}
                  </div>

                  {/* Estadísticas Adicionales (Solo Admin) */}
                  {isAdmin && (
                    <>
                      {/* Top Categorías */}
                      <div className="stats-section">
                        <h4 className="stats-section-title">
                          <FiBarChart2 /> Categorías con más elementos
                        </h4>
                        {stats.por_categoria && stats.por_categoria.length > 0 ? (
                          <div className="stats-list">
                            {stats.por_categoria.slice(0, 5).map((cat, idx) => (
                              <div key={idx} className="stats-list-item">
                                <span className="stats-list-label">{cat.nombre_categoria}</span>
                                <span className="stats-list-value">{cat.cantidad} equipos</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0' }}>No hay datos de categorías disponibles</p>
                        )}
                      </div>

                      {/* Top Ambientes */}
                      <div className="stats-section">
                        <h4 className="stats-section-title">
                          <FiPackage /> Ambientes con Más Equipos
                        </h4>
                        {stats.por_ambiente && stats.por_ambiente.length > 0 ? (
                          <div className="stats-list">
                            {stats.por_ambiente.slice(0, 5).map((amb, idx) => (
                              <div key={idx} className="stats-list-item">
                                <span className="stats-list-label">{amb.codigo_ambiente} - {amb.nombre_ambiente}</span>
                                <span className="stats-list-value">{amb.cantidad_equipos} equipos</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0' }}>No hay datos de ambientes disponibles</p>
                        )}
                      </div>

                      {/* Alertas */}
                      <div className="stats-alerts">
                        <h4 className="stats-section-title">
                          <FiAlertCircle /> Alertas y Pendientes
                        </h4>
                        <div className="alerts-list">
                          {stats.equipos_sin_cuentadante > 0 ? (
                            <div className="alert-item alert-warning">
                              <span>{stats.equipos_sin_cuentadante} equipos sin cuentadante asignado</span>
                            </div>
                          ) : (
                            <div className="alert-item" style={{ background: '#f0fdf4', borderColor: '#10b981', color: '#065f46' }}>
                              <span>✓ Todos los equipos tienen cuentadante asignado</span>
                            </div>
                          )}
                          {stats.novedades_pendientes > 0 ? (
                            <div className="alert-item alert-danger">
                              <span>{stats.novedades_pendientes} novedades pendientes de resolución</span>
                            </div>
                          ) : (
                            <div className="alert-item" style={{ background: '#f0fdf4', borderColor: '#10b981', color: '#065f46' }}>
                              <span>✓ No hay novedades pendientes</span>
                            </div>
                          )}
                          {stats.mantenimientos_proximos > 0 ? (
                            <div className="alert-item alert-info">
                              <span>{stats.mantenimientos_proximos} mantenimientos programados en los próximos 30 días</span>
                            </div>
                          ) : (
                            <div className="alert-item" style={{ background: '#f0fdf4', borderColor: '#10b981', color: '#065f46' }}>
                              <span>✓ No hay mantenimientos programados próximamente</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="stats-empty">
                  {!statsLoaded && (
                    <button
                      className="load-stats-btn"
                      onClick={cargarEstadisticas}
                    >
                      Cargar estadísticas
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Información adicional para usuarios */}
          <div className="dashboard-info">
            <p className="info-text">
              Utiliza el menú lateral para acceder a todas las funcionalidades del sistema.
              Las acciones más frecuentes están disponibles en los accesos rápidos.
            </p>
          </div>
        </main>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
