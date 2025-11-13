import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Card from '../components/Card'
import Toast from '../components/Toast'
import { FiPlus, FiSearch, FiUsers, FiSettings, FiFileText, FiAlertCircle, FiPackage, FiTool, FiUserCheck } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
        
        // Solo cargar estadísticas si es administrador
        if (parsedUser?.nombre_rol === 'Administrador') {
          cargarEstadisticas()
        } else {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
      setLoading(false)
    }
  }, [])

  async function cargarEstadisticas() {
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
      console.log('[DEBUG Frontend] Datos recibidos:', data)
      console.log('[DEBUG Frontend] Stats:', data.stats)
      console.log('[DEBUG Frontend] Mantenimientos:', data.stats?.mantenimientos)
      setStats(data.stats)
    } catch (error) {
      console.error('Error al cargar estadísticas:', error)
      setToast({
        type: 'error',
        message: buildErrorMessage(error, 'Error al cargar estadísticas')
      })
    } finally {
      setLoading(false)
    }
  }

  const userRole = user?.nombre_rol || ''
  const isAdmin = userRole === 'Administrador'
  const isInstructor = userRole === 'Instructor'
  const isAprendiz = userRole === 'Aprendiz'

  return (
    <div className="page dashboard-page">
      <Header />

      <main className="container">
        <div className="welcome-card">
          <h2>¡Bienvenido{userRole ? `, ${userRole}` : ''}{user ? ` ${user.nombre_usuario}` : ''}!</h2>
          <p>Sistema de Gestión de Equipos SENA</p>
          {userRole && <p style={{ fontSize: '14px', marginTop: '8px', opacity: 0.9 }}>Rol: {userRole}</p>}
        </div>

        <div className="cards-grid">
          {/* Registrar Equipo - Solo Administrador */}
          {isAdmin && (
          <Card title="Registrar Equipo" subtitle="Agregar nuevo equipo" icon={<FiPlus />} to="/equipos" />
          )}
          
          {/* Consultar Equipo - Todos los roles */}
          <Card title="Consultar Equipo" subtitle="Buscar equipos" icon={<FiSearch />} to="/equipos/consultar" />
          
          {/* Mis Equipos Asignados - Todos los roles */}
          <Card title="Mis Equipos" subtitle="Equipos asignados a mí" icon={<FiPackage />} to="/mis-equipos" />
          
          {/* Asignar Equipo - Admin e Instructor */}
          {(isAdmin || isInstructor) && (
            <Card title="Asignar Equipo" subtitle="Asignar a usuario" icon={<FiUsers />} to="/equipos/asignar" />
          )}
          
          {/* Ver Asignaciones - Admin e Instructor */}
          {(isAdmin || isInstructor) && (
            <Card title="Ver Asignaciones" subtitle="Gestionar asignaciones" icon={<FiUserCheck />} to="/asignaciones" />
          )}
          
          {/* Personal Registrado - Solo Admin e Instructor */}
          {(isAdmin || isInstructor) && (
          <Card title="Personal Registrado" subtitle="Ver usuarios" icon={<FiUsers />} to="/usuarios" />
          )}
          
          {/* Ver Novedades - Admin e Instructor */}
          {(isAdmin || isInstructor) && (
            <Card title="Ver Novedades" subtitle="Listar incidencias" icon={<FiAlertCircle />} to="/novedades" />
          )}
          
          {/* Crear Novedad - Admin e Instructor */}
          {(isAdmin || isInstructor) && (
            <Card title="Registrar Novedad" subtitle="Reportar incidencias" icon={<FiAlertCircle />} to="/novedades/crear" />
          )}
          
          {/* Ver Reportes - Admin e Instructor */}
          {(isAdmin || isInstructor) && (
            <Card title="Ver Reportes" subtitle="Listar informes" icon={<FiFileText />} to="/reportes" />
          )}
          
          {/* Crear Reporte - Admin e Instructor */}
          {(isAdmin || isInstructor) && (
            <Card title="Crear Reporte" subtitle="Generar informe" icon={<FiFileText />} to="/reportes/crear" />
          )}
          
          {/* Ver Mantenimientos - Todos los roles */}
          <Card title="Mantenimientos" subtitle="Historial de mantenimientos" icon={<FiTool />} to="/mantenimientos" />
          
          {/* Configuración - Todos los roles */}
          <Card title="Configuración" subtitle="Ajustes del sistema" icon={<FiSettings />} to="/config" />
        </div>

        {/* Estadísticas - Solo Administrador */}
        {isAdmin && (
        <div className="stats-card">
          <h3>Estadísticas Rápidas</h3>
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
                No se pudieron cargar las estadísticas
              </div>
            )}
          </div>
        )}
        
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </main>
    </div>
  )
}
