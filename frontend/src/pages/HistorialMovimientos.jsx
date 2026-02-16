import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { FiArrowLeft, FiMapPin, FiRefreshCw, FiUser, FiUserCheck } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/pages/equipos.css'
import '../styles/pages/historiales.css'

export default function HistorialMovimientos() {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [equipo, setEquipo] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [toast, setToast] = useState(null)

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
    if (codigo) {
      fetchMovimientos()
    }
  }, [codigo])

  async function fetchMovimientos() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigo)}/historial-movimientos`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener el historial de movimientos')
      setEquipo(data.equipo)
      setMovimientos(data.movimientos || [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo obtener el historial'), type: 'error' })
      setMovimientos([])
    } finally {
      setLoading(false)
    }
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
              <div>
                <button
                  type="button"
                  className="btn historial-verificaciones-back-btn"
                  onClick={() => navigate('/equipos/consultar')}
                >
                  <FiArrowLeft size={16} />
                  Volver
                </button>
                <h2 className="historial-verificaciones-header">
                  <FiMapPin size={24} />
                  Historial de movimientos de ambiente
                </h2>
                {equipo && (
                  <p className="historial-verificaciones-subtitle">
                    Equipo: {equipo.codigo_inventario || equipo.codigo_equipo} - {equipo.tipo} {equipo.modelo || ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn-act historial-verificaciones-refresh-btn"
                onClick={fetchMovimientos}
                disabled={loading}
              >
                <FiRefreshCw size={16} />
                Actualizar
              </button>
            </div>

            {loading && movimientos.length === 0 ? (
              <div className="historial-verificaciones-loading">
                Cargando historial...
              </div>
            ) : movimientos.length === 0 ? (
              <div className="historial-verificaciones-empty">
                <FiMapPin size={48} className="historial-verificaciones-empty-icon" />
                <p>No hay movimientos de ambiente registrados para este equipo</p>
              </div>
            ) : (
              <div className="historial-verificaciones-table-wrapper">
                <table className="consulta-table historial-verificaciones-table">
                  <thead>
                    <tr>
                      <th>Fecha y Hora</th>
                      <th>Ambiente anterior</th>
                      <th>Ambiente nuevo</th>
                      <th>Registrado por</th>
                      <th>Autorizado por</th>
                      <th>Motivo autorización</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(mov => (
                      <tr key={mov.id_historial}>
                        <td>
                          <div className="historial-verificaciones-date-cell">
                            {formatDateTime(mov.fecha_evento)}
                          </div>
                        </td>
                        <td>{mov.ambiente_anterior || '-'}</td>
                        <td>{mov.ambiente_nuevo || '-'}</td>
                        <td>
                          {mov.registrado_por_nombre ? (
                            <span title="Quien realizó el cambio">
                              <FiUser size={14} /> {mov.registrado_por_nombre}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          {mov.autorizado_por_nombre ? (
                            <span className="historial-movimientos-autorizado" title="Quien autorizó (equipo verificado)">
                              <FiUserCheck size={14} /> {mov.autorizado_por_nombre}
                            </span>
                          ) : '-'}
                        </td>
                        <td>{mov.motivo_autorizacion || '-'}</td>
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
