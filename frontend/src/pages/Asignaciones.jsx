import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { FiUserCheck, FiTrash2, FiPackage, FiUser, FiCalendar, FiShield } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function Asignaciones() {
  const [asignaciones, setAsignaciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, info: null })
  const [user, setUser] = useState(null)

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
    fetchAsignaciones()
  }, [])

  async function fetchAsignaciones() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/asignaciones', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo cargar las asignaciones')
      setAsignaciones(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar asignaciones'), type: 'error' })
      setAsignaciones([])
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getTipoResponsabilidadBadge(tipo) {
    const tipos = {
      'Principal': { color: '#3b82f6', bg: '#dbeafe' },
      'Secundario': { color: '#6b7280', bg: '#f3f4f6' }
    }
    const tipoInfo = tipos[tipo] || tipos['Principal']
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: tipoInfo.color,
        background: tipoInfo.bg,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <FiShield size={12} />
        {tipo}
      </span>
    )
  }

  function confirmDelete(id, info) {
    setDeleteConfirm({ 
      open: true, 
      id,
      info: info || 'esta asignación'
    })
  }

  async function handleDelete() {
    const id = deleteConfirm.id
    if (!id) return
    
    setDeleteConfirm({ open: false, id: null, info: null })
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/asignaciones/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo eliminar la asignación')
      setToast({ message: data.message || 'Asignación eliminada correctamente', type: 'success' })
      await fetchAsignaciones()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al eliminar la asignación'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = user?.nombre_rol === 'Administrador'
  const isInstructor = user?.nombre_rol === 'Instructor'

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <ConfirmModal
            open={deleteConfirm.open}
            title="Eliminar Asignación"
            message={`¿Estás seguro de que deseas eliminar ${deleteConfirm.info}? Esta acción no se puede deshacer.`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDelete}
            onCancel={() => setDeleteConfirm({ open: false, id: null, info: null })}
          />
          
          <div className="form-equipos form-modern" style={{ maxWidth: '1400px' }}>
          <div className="form-header">
            <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <FiUserCheck size={28} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Asignaciones de Equipos</h2>
              <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                {isAdmin ? 'Gestiona todas las asignaciones de equipos a usuarios' : 'Gestiona las asignaciones de equipos a aprendices'}
              </p>
            </div>
          </div>

          <div className="form-divider"></div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Cargando asignaciones...</p>
            </div>
          ) : asignaciones.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <FiUserCheck size={48} color="#9ca3af" />
              </div>
              <h3>No hay asignaciones activas</h3>
              <p>Las asignaciones de equipos aparecerán aquí</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="consulta-table" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Equipo</th>
                    <th>Usuario</th>
                    <th>Tipo Responsabilidad</th>
                    <th>Fecha Asignación</th>
                    <th>Días Asignado</th>
                    <th>Asignado Por</th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.map((asig) => (
                    <tr key={asig.id_responsable}>
                      <td>{asig.id_responsable}</td>
                      <td>
                        <div>
                          <strong>{asig.equipo_tipo} {asig.equipo_marca} {asig.equipo_modelo}</strong>
                          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                            Código: {asig.codigo_inventario || asig.codigo_equipo}
                            {asig.numero_serie && <span> | S/N: {asig.numero_serie}</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{asig.usuario_nombre}</strong>
                          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                            Cédula: {asig.usuario_cedula}
                            {asig.usuario_rol && (
                              <span style={{
                                marginLeft: '8px',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                fontWeight: 600
                              }}>
                                {asig.usuario_rol}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{getTipoResponsabilidadBadge(asig.tipo_responsabilidad)}</td>
                      <td>{formatDate(asig.fecha_asignacion)}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                          {asig.dias_asignado || 0} días
                        </span>
                      </td>
                      <td>{asig.asignado_por_nombre || 'Sistema'}</td>
                      <td style={{ maxWidth: '200px', fontSize: '0.9rem', color: '#666' }}>
                        {asig.observaciones || '-'}
                      </td>
                      <td>
                        <button
                          className="btn danger"
                          onClick={() => confirmDelete(
                            asig.id_responsable,
                            `la asignación del equipo "${asig.equipo_tipo} ${asig.equipo_marca} ${asig.equipo_modelo}" a "${asig.usuario_nombre}"`
                          )}
                          style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                          disabled={loading}
                        >
                          <FiTrash2 size={14} style={{ marginRight: '4px' }} />
                          Eliminar
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

