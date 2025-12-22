import React, { useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiSearch, FiUser, FiPackage, FiDollarSign, FiTrendingUp, FiTrendingDown, FiAlertCircle, FiCheckCircle } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/buscarCuentadante.css'

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
              <div className="form-icon-wrapper buscar-cuentadante-header-icon">
                <FiUser size={28} color="#fff" />
              </div>
              <div className="buscar-cuentadante-header-content">
                <h2 className="buscar-cuentadante-title">Buscar Cuentadante</h2>
                <p className="buscar-cuentadante-subtitle">
                  Busca un cuentadante por su número de documento para ver su información e inventario completo
                </p>
              </div>
            </div>

            <div className="form-divider"></div>

            <form onSubmit={handleSearch} className="buscar-cuentadante-form">
              <div className="form-section">
                <h3 className="form-section-title">
                  <FiSearch size={18} className="buscar-cuentadante-section-icon" />
                  Búsqueda
                </h3>
                <div className="form-group">
                  <label>Número de Documento *</label>
                  <div className="buscar-cuentadante-search-row">
                    <input
                      type="text"
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                      placeholder="Ingresa el número de documento del cuentadante"
                      className="form-input buscar-cuentadante-search-input"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      className="btn-primary btn-modern"
                      disabled={loading || !documento.trim()}
                    >
                      {loading ? 'Buscando...' : (
                        <>
                          <FiSearch size={16} className="icon-inline" />
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
                <div className="form-section buscar-cuentadante-section">
                  <h3 className="form-section-title">
                    <FiUser size={18} className="buscar-cuentadante-section-icon" />
                    Información del Cuentadante
                  </h3>
                  <div className="buscar-cuentadante-info-card">
                    <div className="buscar-cuentadante-info-grid">
                      <div>
                        <strong className="buscar-cuentadante-info-label">Nombre:</strong>
                        <div className="buscar-cuentadante-info-value">
                          {cuentadante.nombre_usuario}
                        </div>
                      </div>
                      <div>
                        <strong className="buscar-cuentadante-info-label">Documento:</strong>
                        <div className="buscar-cuentadante-info-value">
                          {cuentadante.cedula}
                        </div>
                      </div>
                      <div>
                        <strong className="buscar-cuentadante-info-label">Correo:</strong>
                        <div className="buscar-cuentadante-info-value-normal">
                          {cuentadante.correo || '-'}
                        </div>
                      </div>
                      <div>
                        <strong className="buscar-cuentadante-info-label">Teléfono:</strong>
                        <div className="buscar-cuentadante-info-value-normal">
                          {cuentadante.telefono || '-'}
                        </div>
                      </div>
                      <div>
                        <strong className="buscar-cuentadante-info-label">Estado:</strong>
                        <div className="buscar-cuentadante-info-margin">
                          <span className={`badge ${cuentadante.estado === 'Activo' ? 'badge-success' : 'badge-error'}`}>
                            {cuentadante.estado}
                          </span>
                        </div>
                      </div>
                      <div>
                        <strong className="buscar-cuentadante-info-label">Fecha de Registro:</strong>
                        <div className="buscar-cuentadante-info-value-normal buscar-cuentadante-info-value-large">
                          {formatDate(cuentadante.fecha_creacion)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estadísticas */}
                {estadisticas && (
                  <div className="form-section buscar-cuentadante-section">
                    <h3 className="form-section-title">
                      <FiTrendingUp size={18} className="buscar-cuentadante-section-icon" />
                      Estadísticas del Inventario
                    </h3>
                    <div className="buscar-cuentadante-estadisticas-card">
                      <div className="buscar-cuentadante-estadisticas-grid">
                        <div className="buscar-cuentadante-stat-card">
                          <FiPackage size={32} color="var(--info-600)" className="buscar-cuentadante-stat-icon-margin" />
                          <div className="buscar-cuentadante-stat-value buscar-cuentadante-stat-value-total">
                            {estadisticas.total_equipos || 0}
                          </div>
                          <div className="buscar-cuentadante-stat-label">Total Equipos</div>
                        </div>
                        <div className="buscar-cuentadante-stat-card buscar-cuentadante-stat-card-success">
                          <FiCheckCircle size={32} color="var(--success-800)" className="buscar-cuentadante-stat-icon-margin" />
                          <div className="buscar-cuentadante-stat-value buscar-cuentadante-stat-value-valor">
                            {estadisticas.equipos_buenos || 0}
                          </div>
                          <div className="buscar-cuentadante-stat-label">Equipos en Buen Estado</div>
                        </div>
                        <div className="buscar-cuentadante-stat-card buscar-cuentadante-stat-card-warning">
                          <FiAlertCircle size={32} color="var(--warning-600)" className="buscar-cuentadante-stat-icon-margin" />
                          <div className="buscar-cuentadante-stat-value buscar-cuentadante-stat-value-warning">
                            {estadisticas.equipos_regulares || 0}
                          </div>
                          <div className="buscar-cuentadante-stat-label">Equipos en Estado Regular</div>
                        </div>
                        <div className="buscar-cuentadante-stat-card buscar-cuentadante-stat-card-error">
                          <FiTrendingDown size={32} color="var(--error-700)" className="buscar-cuentadante-stat-icon-margin" />
                          <div className="buscar-cuentadante-stat-value buscar-cuentadante-stat-value-error">
                            {estadisticas.equipos_danados || 0}
                          </div>
                          <div className="buscar-cuentadante-stat-label">Equipos Dañados</div>
                        </div>
                        <div className="buscar-cuentadante-stat-card buscar-cuentadante-stat-card-neutral">
                          <FiDollarSign size={32} color="var(--neutral-600)" className="buscar-cuentadante-stat-icon-margin" />
                          <div className="buscar-cuentadante-stat-value buscar-cuentadante-stat-value-large">
                            {formatCurrency(estadisticas.valor_total_inventario || 0)}
                          </div>
                          <div className="buscar-cuentadante-stat-label">Valor Total Inventario</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inventario */}
                <div className="form-section">
                  <h3 className="form-section-title">
                    <FiPackage size={18} className="buscar-cuentadante-section-icon" />
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
                    <div className="buscar-cuentadante-table-wrapper">
                      <table className="consulta-table buscar-cuentadante-table">
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
                                <span className={`buscar-cuentadante-badge-estado ${
                                  equipo.estado_fisico === 'Bueno' ? 'badge-success' :
                                  equipo.estado_fisico === 'Regular' ? 'badge-warning' :
                                  'badge-error'
                                }`}>
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

