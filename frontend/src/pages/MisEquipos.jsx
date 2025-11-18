import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiPackage, FiInbox } from 'react-icons/fi'
import '../styles/equipos.css'

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
            <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #845ef7 0%, #7048e8 100%)' }}>
              <FiPackage size={28} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Mis Equipos Asignados</h2>
              <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                Equipos que tienes bajo tu responsabilidad actualmente
              </p>
            </div>
          </div>

          <div className="form-divider"></div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Cargando equipos...</p>
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
            <div style={{ overflowX: 'auto' }}>
              <table className="consulta-table" style={{ width: '100%' }}>
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
                      <td>{eq.numero_serie}</td>
                      <td>
                        <span 
                          className="badge" 
                          style={{ 
                            background: 
                              eq.estado_fisico === 'Nuevo' ? '#28a745' :
                              eq.estado_fisico === 'Bueno' ? '#17a2b8' :
                              eq.estado_fisico === 'Regular' ? '#ffc107' :
                              eq.estado_fisico === 'Malo' ? '#fd7e14' :
                              eq.estado_fisico === 'Dañado' ? '#dc3545' : '#6c757d',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          {eq.estado_fisico}
                        </span>
                      </td>
                      <td>
                        {eq.nombre_ambiente || 'Sin ambiente'}
                        {eq.codigo_ambiente && (
                          <div style={{ fontSize: 12, color: '#666' }}>
                            ({eq.codigo_ambiente})
                          </div>
                        )}
                      </td>
                      <td>
                        <span 
                          style={{ 
                            color: eq.tipo_responsabilidad === 'Principal' ? '#007bff' : '#6c757d',
                            fontWeight: eq.tipo_responsabilidad === 'Principal' ? 600 : 400
                          }}
                        >
                          {eq.tipo_responsabilidad}
                        </span>
                      </td>
                      <td>
                        {eq.fecha_asignacion 
                          ? new Date(eq.fecha_asignacion).toLocaleDateString('es-CO') 
                          : '-'}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#007bff' }}>
                          {eq.dias_asignado || 0}
                        </span>
                      </td>
                      <td>{eq.asignado_por_nombre || 'Sistema'}</td>
                      <td style={{ maxWidth: 200, fontSize: 13, color: '#666' }}>
                        {eq.observaciones || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: 24 }}>
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

