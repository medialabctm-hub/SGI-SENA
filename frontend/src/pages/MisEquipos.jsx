import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiPackage, FiInbox } from 'react-icons/fi'
import { useSocket } from '../contexts/SocketContext'
import '../styles/pages/equipos.css'
import '../styles/misEquipos.css'
import { LoadingScreen } from './LoadingDemo'

export default function MisEquipos() {
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchMisEquipos()
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [])

  // Suscribirse a actualizaciones en tiempo real de equipos y asignaciones
  const { subscribe } = useSocket()
  useEffect(() => {
    if (!subscribe) return
    
    const unsubscribeEquipo = subscribe('equipo:updated', () => {
      fetchMisEquipos()
    })
    
    const unsubscribeEquipoDeleted = subscribe('equipo:deleted', () => {
      fetchMisEquipos()
    })
    
    const unsubscribeAsignacionCreated = subscribe('asignacion:created', () => {
      fetchMisEquipos()
    })
    
    const unsubscribeAsignacionDeleted = subscribe('asignacion:deleted', () => {
      fetchMisEquipos()
    })
    
    return () => {
      unsubscribeEquipo()
      unsubscribeEquipoDeleted()
      unsubscribeAsignacionCreated()
      unsubscribeAsignacionDeleted()
    }
  }, [subscribe])

  async function fetchMisEquipos() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/mis-equipos/asignados', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setEquipos(data)
      } else {
        const error = await res.json()
        setToast({ 
          message: error.error || 'Error al cargar equipos asignados', 
          type: 'error' 
        })
      }
    } catch (err) {
      setToast({ message: 'Error de conexión con el servidor', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="form-equipos form-modern">
          <div className="form-header">
            <div className="form-icon-wrapper mis-equipos-header-icon">
              <FiPackage size={28} color="#fff" />
            </div>
            <div>
              <h2 className="mis-equipos-title">Mis Equipos Asignados</h2>
              <p className="mis-equipos-subtitle">
                Equipos que tienes bajo tu responsabilidad actualmente
              </p>
            </div>
          </div>

          <div className="form-divider"></div>

          {loading ? (
            <div className="loading-state">
              <LoadingScreen message="Cargando equipos" />
            </div>
          ) : equipos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <FiInbox size={48} color="#adb5bd" />
              </div>
              <h3>No tienes equipos asignados</h3>
              <p>Actualmente no hay equipos bajo tu responsabilidad</p>
            </div>
          ) : (
            <div className="mis-equipos-table-wrapper">
              <table className="consulta-table mis-equipos-table">
                <thead>
                  <tr>
                    <th>Código Inventario</th>
                    <th>Tipo</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>N° Serie</th>
                    <th>Estado</th>
                    <th>Ambiente</th>
                    <th>Responsabilidad</th>
                    <th>Fecha Asignación</th>
                    <th>Días Asignado</th>
                    <th>Asignado Por</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {equipos.map(eq => (
                    <tr key={eq.codigo_equipo}>
                      <td>{eq.codigo_inventario}</td>
                      <td>{eq.tipo}</td>
                      <td>{eq.marca}</td>
                      <td>{eq.modelo}</td>
                      <td>{eq.consecutivo}</td>
                      <td>
                        <span className={`badge ${
                          eq.estado_fisico === 'Nuevo' ? 'badge-success' :
                          eq.estado_fisico === 'Bueno' ? 'badge-info' :
                          eq.estado_fisico === 'Regular' ? 'badge-warning' :
                          eq.estado_fisico === 'Malo' ? 'badge-warning' :
                          eq.estado_fisico === 'Dañado' ? 'badge-error' :
                          'badge-info'
                        }`}>
                          {eq.estado_fisico}
                        </span>
                      </td>
                      <td>
                        {eq.nombre_ambiente || 'Sin ambiente'}
                        {eq.codigo_ambiente && (
                          <div className="mis-equipos-info-text">
                            ({eq.codigo_ambiente})
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={eq.tipo_responsabilidad === 'Principal' ? 'mis-equipos-responsabilidad-badge' : 'mis-equipos-responsabilidad-secundario'}>
                          {eq.tipo_responsabilidad}
                        </span>
                      </td>
                      <td>
                        {eq.fecha_asignacion 
                          ? new Date(eq.fecha_asignacion).toLocaleDateString('es-CO') 
                          : '-'}
                      </td>
                      <td>
                        <span className="mis-equipos-responsabilidad-badge">
                          {eq.dias_asignado || 0}
                        </span>
                      </td>
                      <td>{eq.asignado_por_nombre || 'Sistema'}</td>
                      <td className="mis-equipos-observaciones">
                        {eq.observaciones || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-actions mis-equipos-actions">
            <button 
              className="btn-secondary btn-modern"
              onClick={() => window.history.back()}
            >
              Volver
            </button>
          </div>
        </div>
        </main>
      </div>
    </div>
  )
}

