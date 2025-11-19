import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiPlus, FiAlertCircle } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
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
      console.error('Error al cargar estadísticas:', error)
      setToast({
        type: 'error',
        message: buildErrorMessage(error, 'Error al cargar estadísticas')
      })
    } finally {
      setLoading(false)
    }
  }, [statsLoaded, loading])

  // Cargar estadísticas después de un pequeño delay para mejorar rendimiento inicial
  useEffect(() => {
    const userRole = user?.nombre_rol || ''
    if (userRole === 'Administrador' && !statsLoaded) {
      const timer = setTimeout(() => {
        cargarEstadisticas()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [user, statsLoaded, cargarEstadisticas])

  const userRole = user?.nombre_rol || ''
  const isAdmin = userRole === 'Administrador'
  const isInstructor = userRole === 'Instructor'

  return (
    <div className="page dashboard-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          <div className="welcome-card">
            <h2>¡Bienvenido{userRole ? `, ${userRole}` : ''}{user ? ` ${user.nombre_usuario}` : ''}!</h2>
            <p>Sistema de Gestión de Equipos SENA</p>
          </div>

          {/* Accesos Rápidos Destacados */}
          <div className="quick-actions">
            <h3 className="section-title">Accesos Rápidos</h3>
            <div className="quick-actions-grid">
              {isAdmin && (
                <button
                  className="quick-action-card primary"
                  onClick={() => nav('/equipos')}
                >
                  <div className="quick-action-icon">
                    <FiPlus />
                  </div>
                  <div className="quick-action-content">
                    <h4>Registrar Equipo</h4>
                    <p>Agregar nuevo equipo al inventario</p>
                  </div>
                </button>
              )}
              {(isAdmin || isInstructor) && (
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

          {/* Estadísticas - Solo Administrador */}
          {isAdmin && (
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
                <div style={{ padding: '20px', textAlign: 'center' }}>Cargando estadísticas...</div>
              ) : stats ? (
                <div className="stats-row">
                  <div className="stat-box" style={{ background: '#e6f2ff' }}>
                    <div className="stat-value">{stats.equipos?.total || 0}</div>
                    <div className="stat-label">Total Equipos</div>
                  </div>
                  <div className="stat-box" style={{ background: '#e9f7ec' }}>
                    <div className="stat-value">{stats.usuarios?.activos || 0}</div>
                    <div className="stat-label">Usuarios Activos</div>
                  </div>
                  <div className="stat-box" style={{ background: 'var(--warning-200)' }}>
                    <div className="stat-value">{stats.novedades?.pendientes || 0}</div>
                    <div className="stat-label">Novedades Pendientes</div>
                  </div>
                  <div className="stat-box" style={{ background: '#fff3cd' }}>
                    <div className="stat-value">{stats.mantenimientos?.proximos30Dias || 0}</div>
                    <div className="stat-label">Mantenimientos Próximos</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
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
