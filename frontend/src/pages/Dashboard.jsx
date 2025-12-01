import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiPlus, FiAlertCircle, FiPackage, FiCheckCircle, FiTrendingDown, FiDollarSign } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage, handleError } from '../utils/api'
import '../styles/dashboard.css'

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

  return (
    <div className="page dashboard-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">¡Bienvenido{userRole ? `, ${userRole}` : ''}{user ? ` ${user.nombre_usuario}` : ''}!</h2>
            </div>
            <div className="card-body">
              <p style={{margin: 0, color: 'var(--muted)'}}>Sistema de Gestión de Inventario SENA</p>
            </div>
          </div>

          {/* Accesos Rápidos Destacados */}
          <div className="card" style={{marginTop: '24px'}}>
            <div className="card-header">
              <h3 className="card-title">Accesos Rápidos</h3>
            </div>
            <div className="card-body">
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px'}}>
                {(isAdmin || isCuentadante) && (
                  <button
                    className="card"
                    onClick={() => nav('/equipos')}
                    style={{textAlign: 'left', cursor: 'pointer', border: '2px solid var(--success-800)'}}
                  >
                    <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                      <div style={{width: '48px', height: '48px', borderRadius: '12px', background: 'var(--success-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                        <FiPlus size={24} />
                      </div>
                      <div>
                        <h4 style={{margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: 'var(--neutral-900)'}}>Registrar Equipo</h4>
                        <p style={{margin: 0, fontSize: '14px', color: 'var(--muted)'}}>Agregar nuevo equipo al inventario</p>
                      </div>
                    </div>
                  </button>
                )}
                {(isAdmin || isInstructor || isCuentadante) && (
                  <button
                    className="card"
                    onClick={() => nav('/novedades/crear')}
                    style={{textAlign: 'left', cursor: 'pointer', border: '2px solid var(--success-800)'}}
                  >
                    <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                      <div style={{width: '48px', height: '48px', borderRadius: '12px', background: 'var(--success-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'}}>
                        <FiAlertCircle size={24} />
                      </div>
                      <div>
                        <h4 style={{margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: 'var(--neutral-900)'}}>Registrar Novedad</h4>
                        <p style={{margin: 0, fontSize: '14px', color: 'var(--muted)'}}>Reportar una incidencia o problema</p>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Estadísticas - Administrador, Instructor y Cuentadante */}
          {shouldShowStats && (
            <div className="card" style={{marginTop: '24px'}}>
              <div className="card-header">
                <h3 className="card-title">Estadísticas Rápidas</h3>
                {!statsLoaded && !loading && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={cargarEstadisticas}
                  >
                    Cargar estadísticas
                  </button>
                )}
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Cargando estadísticas...</p>
                  </div>
                ) : stats ? (
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

                  {/* Equipos en Estado Regular */}
                  <div className="stat-card stat-card-yellow">
                    <div className="stat-icon-wrapper">
                      <FiAlertCircle size={36} />
                    </div>
                    <div className="stat-value-large">
                      {stats.equipos_regulares || 0}
                    </div>
                    <div className="stat-label-small">Equipos en Estado Regular</div>
                  </div>

                  {/* Equipos Dañados */}
                  <div className="stat-card stat-card-red">
                    <div className="stat-icon-wrapper">
                      <FiTrendingDown size={36} />
                    </div>
                    <div className="stat-value-large">
                      {stats.equipos_danados || 0}
                    </div>
                    <div className="stat-label-small">Equipos Dañados</div>
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
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                            useGrouping: true
                          }).format(stats.valor_total_inventario)
                        : '$ 0,00'}
                    </div>
                    <div className="stat-label-small">Valor Total Inventario</div>
                  </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    {!statsLoaded && (
                      <button
                        className="btn btn-primary btn-md"
                        onClick={cargarEstadisticas}
                      >
                        Cargar estadísticas
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Información adicional para usuarios */}
          <div className="card" style={{marginTop: '24px'}}>
            <div className="card-body">
              <p style={{margin: 0, color: 'var(--muted)', fontSize: '14px'}}>
                Utiliza el menú lateral para acceder a todas las funcionalidades del sistema.
                Las acciones más frecuentes están disponibles en los accesos rápidos.
              </p>
            </div>
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
