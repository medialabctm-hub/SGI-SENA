import React, { useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiSearch, FiUser, FiPackage, FiDollarSign, FiTrendingUp, FiTrendingDown, FiAlertCircle, FiCheckCircle } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function BuscarCuentadante() {
  const [documento, setDocumento] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [cuentadante, setCuentadante] = useState(null)
  const [inventario, setInventario] = useState([])
  const [estadisticas, setEstadisticas] = useState(null)
  const [user, setUser] = useState(null)

  React.useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!documento.trim()) {
      setToast({ message: 'Ingresa un número de documento', type: 'error' })
      return
    }

    setLoading(true)
    setToast(null)
    setCuentadante(null)
    setInventario([])
    setEstadisticas(null)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/cuentadantes/buscar/${encodeURIComponent(documento.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await parseApiResponse(res, 'Error al buscar cuentadante')

      setCuentadante(data.cuentadante)
      setInventario(data.inventario || [])
      setEstadisticas(data.estadisticas)

      if (data.inventario && data.inventario.length === 0) {
        setToast({ message: 'Cuentadante encontrado pero no tiene equipos asignados', type: 'info' })
      } else {
        setToast({ message: 'Cuentadante encontrado correctamente', type: 'success' })
      }
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al buscar cuentadante'), type: 'error' })
      setCuentadante(null)
      setInventario([])
      setEstadisticas(null)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (value) => {
    if (!value) return '$0'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
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
              <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                <FiUser size={28} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Buscar Cuentadante</h2>
                <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                  Busca un cuentadante por su número de documento para ver su información e inventario completo
                </p>
              </div>
            </div>

            <div className="form-divider"></div>

            <form onSubmit={handleSearch} style={{ marginBottom: '2rem' }}>
              <div className="form-section">
                <h3 className="form-section-title">
                  <FiSearch size={18} style={{ marginRight: 8 }} />
                  Búsqueda
                </h3>
                <div className="form-group">
                  <label>Número de Documento *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                      placeholder="Ingresa el número de documento del cuentadante"
                      style={{ flex: 1 }}
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      className="btn-primary btn-modern"
                      disabled={loading || !documento.trim()}
                    >
                      {loading ? 'Buscando...' : (
                        <>
                          <FiSearch size={16} style={{ marginRight: '0.5rem' }} />
                          Buscar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {cuentadante && (
              <>
                {/* Información del Cuentadante */}
                <div className="form-section" style={{ marginBottom: '2rem' }}>
                  <h3 className="form-section-title">
                    <FiUser size={18} style={{ marginRight: 8 }} />
                    Información del Cuentadante
                  </h3>
                  <div style={{
                    padding: '1.5rem',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                      <div>
                        <strong style={{ color: '#666', fontSize: '0.9rem' }}>Nombre:</strong>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem' }}>
                          {cuentadante.nombre_usuario}
                        </div>
                      </div>
                      <div>
                        <strong style={{ color: '#666', fontSize: '0.9rem' }}>Cédula:</strong>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem' }}>
                          {cuentadante.cedula}
                        </div>
                      </div>
                      <div>
                        <strong style={{ color: '#666', fontSize: '0.9rem' }}>Correo:</strong>
                        <div style={{ fontSize: '1.1rem', marginTop: '0.25rem' }}>
                          {cuentadante.correo || '-'}
                        </div>
                      </div>
                      <div>
                        <strong style={{ color: '#666', fontSize: '0.9rem' }}>Teléfono:</strong>
                        <div style={{ fontSize: '1.1rem', marginTop: '0.25rem' }}>
                          {cuentadante.telefono || '-'}
                        </div>
                      </div>
                      <div>
                        <strong style={{ color: '#666', fontSize: '0.9rem' }}>Estado:</strong>
                        <div style={{ marginTop: '0.25rem' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: cuentadante.estado === 'Activo' ? '#d1fae5' : '#fee2e2',
                            color: cuentadante.estado === 'Activo' ? '#059669' : '#dc2626'
                          }}>
                            {cuentadante.estado}
                          </span>
                        </div>
                      </div>
                      <div>
                        <strong style={{ color: '#666', fontSize: '0.9rem' }}>Fecha de Registro:</strong>
                        <div style={{ fontSize: '1rem', marginTop: '0.25rem' }}>
                          {formatDate(cuentadante.fecha_creacion)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estadísticas */}
                {estadisticas && (
                  <div className="form-section" style={{ marginBottom: '2rem' }}>
                    <h3 className="form-section-title">
                      <FiTrendingUp size={18} style={{ marginRight: 8 }} />
                      Estadísticas del Inventario
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <div style={{
                        padding: '1.5rem',
                        background: '#eff6ff',
                        borderRadius: '8px',
                        border: '1px solid #3b82f6',
                        textAlign: 'center'
                      }}>
                        <FiPackage size={32} color="#3b82f6" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e40af' }}>
                          {estadisticas.total_equipos || 0}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>Total Equipos</div>
                      </div>
                      <div style={{
                        padding: '1.5rem',
                        background: '#f0fdf4',
                        borderRadius: '8px',
                        border: '1px solid #10b981',
                        textAlign: 'center'
                      }}>
                        <FiCheckCircle size={32} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#059669' }}>
                          {estadisticas.equipos_buenos || 0}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>Equipos en Buen Estado</div>
                      </div>
                      <div style={{
                        padding: '1.5rem',
                        background: '#fef3c7',
                        borderRadius: '8px',
                        border: '1px solid #f59e0b',
                        textAlign: 'center'
                      }}>
                        <FiAlertCircle size={32} color="#f59e0b" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#d97706' }}>
                          {estadisticas.equipos_regulares || 0}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>Equipos en Estado Regular</div>
                      </div>
                      <div style={{
                        padding: '1.5rem',
                        background: '#fee2e2',
                        borderRadius: '8px',
                        border: '1px solid #ef4444',
                        textAlign: 'center'
                      }}>
                        <FiTrendingDown size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>
                          {estadisticas.equipos_danados || 0}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>Equipos Dañados</div>
                      </div>
                      <div style={{
                        padding: '1.5rem',
                        background: '#f3f4f6',
                        borderRadius: '8px',
                        border: '1px solid #6b7280',
                        textAlign: 'center'
                      }}>
                        <FiDollarSign size={32} color="#6b7280" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#374151' }}>
                          {formatCurrency(estadisticas.valor_total_inventario || 0)}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>Valor Total Inventario</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inventario */}
                <div className="form-section">
                  <h3 className="form-section-title">
                    <FiPackage size={18} style={{ marginRight: 8 }} />
                    Inventario ({inventario.length} equipos)
                  </h3>
                  {inventario.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon-wrapper">
                        <FiPackage size={48} color="#9ca3af" />
                      </div>
                      <h3>No hay equipos asignados</h3>
                      <p>Este cuentadante no tiene equipos en su inventario</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="consulta-table" style={{ marginTop: '1rem' }}>
                        <thead>
                          <tr>
                            <th>Código Inventario</th>
                            <th>Tipo</th>
                            <th>Marca</th>
                            <th>Modelo</th>
                            <th>Ambiente</th>
                            <th>Estado Físico</th>
                            <th>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventario.map((equipo) => (
                            <tr key={equipo.codigo_equipo}>
                              <td><strong>{equipo.codigo_inventario}</strong></td>
                              <td>{equipo.tipo}</td>
                              <td>{equipo.marca || '-'}</td>
                              <td>{equipo.modelo}</td>
                              <td>{equipo.nombre_ambiente || '-'}</td>
                              <td>
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  background: equipo.estado_fisico === 'Bueno' ? '#d1fae5' : 
                                             equipo.estado_fisico === 'Regular' ? '#fef3c7' : '#fee2e2',
                                  color: equipo.estado_fisico === 'Bueno' ? '#059669' : 
                                         equipo.estado_fisico === 'Regular' ? '#d97706' : '#dc2626'
                                }}>
                                  {equipo.estado_fisico}
                                </span>
                              </td>
                              <td>{formatCurrency(equipo.costo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

