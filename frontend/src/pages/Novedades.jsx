import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Toast from '../components/Toast'
import { FiAlertCircle, FiEye, FiCheckCircle, FiXCircle, FiEdit } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

export default function Novedades() {
  const [novedades, setNovedades] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedNovedad, setSelectedNovedad] = useState(null)
  const [editandoEstado, setEditandoEstado] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [observacionesResolucion, setObservacionesResolucion] = useState('')
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
  }, [])

  useEffect(() => {
    fetchNovedades()
  }, [])

  async function fetchNovedades() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/novedades', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo cargar las novedades')
      setNovedades(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar novedades'), type: 'error' })
      setNovedades([])
    } finally {
      setLoading(false)
    }
  }

  function getEstadoBadge(estado) {
    const estados = {
      'Pendiente': { color: '#f59e0b', bg: '#fef3c7', icon: <FiAlertCircle size={14} /> },
      'En Proceso': { color: '#3b82f6', bg: '#dbeafe', icon: <FiAlertCircle size={14} /> },
      'Resuelto': { color: '#10b981', bg: '#d1fae5', icon: <FiCheckCircle size={14} /> },
      'No Resuelto': { color: '#ef4444', bg: '#fee2e2', icon: <FiXCircle size={14} /> }
    }
    const estadoInfo = estados[estado] || estados['Pendiente']
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: estadoInfo.color,
        background: estadoInfo.bg
      }}>
        {estadoInfo.icon}
        {estado || 'Pendiente'}
      </span>
    )
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

  function abrirEditarEstado(novedad) {
    setNuevoEstado(novedad.estado_resolucion || 'Pendiente')
    setObservacionesResolucion(novedad.observaciones_resolucion || '')
    setEditandoEstado(true)
  }

  function cancelarEditarEstado() {
    setEditandoEstado(false)
    setNuevoEstado('')
    setObservacionesResolucion('')
  }

  async function guardarEstado() {
    if (!selectedNovedad || !nuevoEstado) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/novedades/${selectedNovedad.id_novedad}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          estado_resolucion: nuevoEstado,
          observaciones_resolucion: observacionesResolucion || null
        })
      })

      const data = await parseApiResponse(res, 'No se pudo actualizar el estado')
      setToast({ message: data.message || 'Estado actualizado correctamente', type: 'success' })
      
      // Actualizar la novedad en la lista
      setNovedades(prev => prev.map(n => 
        n.id_novedad === selectedNovedad.id_novedad 
          ? { ...n, estado_resolucion: nuevoEstado, observaciones_resolucion: observacionesResolucion || null }
          : n
      ))
      
      // Actualizar la novedad seleccionada
      setSelectedNovedad(prev => ({ ...prev, estado_resolucion: nuevoEstado, observaciones_resolucion: observacionesResolucion || null }))
      cancelarEditarEstado()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar el estado'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page simple-page">
      <Header />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <main className="container">
        <div className="form-equipos form-modern" style={{ maxWidth: '1200px' }}>
          <div className="form-header">
            <div className="form-icon-wrapper" style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)' }}>
              <FiAlertCircle size={28} color="#fff" />
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a2a3a' }}>Novedades</h2>
                <p style={{ color: '#666', marginTop: 8, fontSize: '15px' }}>
                  Registro de incidencias y problemas con equipos
                </p>
              </div>
              <a href="/novedades/crear" className="btn-primary btn-modern" style={{ textDecoration: 'none' }}>
                Nueva Novedad
              </a>
            </div>
          </div>

          <div className="form-divider"></div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Cargando novedades...</p>
            </div>
          ) : novedades.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <FiAlertCircle size={48} color="#9ca3af" />
              </div>
              <h3>No hay novedades registradas</h3>
              <p>Las novedades reportadas aparecerán aquí</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="consulta-table" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Equipo</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Reportado por</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {novedades.map((novedad) => (
                    <tr key={novedad.id_novedad}>
                      <td>{novedad.id_novedad}</td>
                      <td>
                        <div>
                          <strong>{novedad.equipo_tipo} {novedad.equipo_marca} {novedad.equipo_modelo}</strong>
                          {novedad.numero_serie && <div style={{ fontSize: '0.85rem', color: '#666' }}>S/N: {novedad.numero_serie}</div>}
                        </div>
                      </td>
                      <td>{novedad.tipo_novedad}</td>
                      <td style={{ maxWidth: '300px' }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={novedad.descripcion}>
                          {novedad.descripcion}
                        </div>
                      </td>
                      <td>{novedad.reportado_por_nombre}</td>
                      <td>{formatDate(novedad.fecha_novedad)}</td>
                      <td>{getEstadoBadge(novedad.estado_resolucion)}</td>
                      <td>
                        <button
                          className="btn"
                          onClick={() => setSelectedNovedad(novedad)}
                          style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                        >
                          <FiEye size={14} style={{ marginRight: '4px' }} />
                          Ver
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

      {selectedNovedad && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setSelectedNovedad(null)}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#1a2a3a' }}>Detalle de Novedad</h3>
              <button
                onClick={() => setSelectedNovedad(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <strong>ID:</strong> {selectedNovedad.id_novedad}
              </div>
              <div>
                <strong>Equipo:</strong> {selectedNovedad.equipo_tipo} {selectedNovedad.equipo_marca} {selectedNovedad.equipo_modelo}
                {selectedNovedad.numero_serie && <span> (S/N: {selectedNovedad.numero_serie})</span>}
              </div>
              <div>
                <strong>Tipo de Novedad:</strong> {selectedNovedad.tipo_novedad}
              </div>
              <div>
                <strong>Descripción:</strong>
                <div style={{ marginTop: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                  {selectedNovedad.descripcion}
                </div>
              </div>
              <div>
                <strong>Reportado por:</strong> {selectedNovedad.reportado_por_nombre}
              </div>
              <div>
                <strong>Fecha de reporte:</strong> {formatDate(selectedNovedad.fecha_novedad)}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>Estado:</strong>
                  {!editandoEstado && (user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                    <button
                      onClick={() => abrirEditarEstado(selectedNovedad)}
                      className="btn"
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      <FiEdit size={14} style={{ marginRight: '4px' }} />
                      Cambiar Estado
                    </button>
                  )}
                </div>
                {editandoEstado ? (
                  <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
                    <select
                      value={nuevoEstado}
                      onChange={(e) => setNuevoEstado(e.target.value)}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1.5px solid #b2dfdb',
                        fontSize: '0.95rem'
                      }}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Resuelto">Resuelto</option>
                      <option value="No Resuelto">No Resuelto</option>
                    </select>
                    <textarea
                      value={observacionesResolucion}
                      onChange={(e) => setObservacionesResolucion(e.target.value)}
                      placeholder="Observaciones de resolución (opcional)..."
                      rows={3}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1.5px solid #b2dfdb',
                        fontSize: '0.95rem',
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={guardarEstado}
                        className="btn-primary btn-modern"
                        disabled={loading}
                        style={{ flex: 1 }}
                      >
                        {loading ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={cancelarEditarEstado}
                        className="btn-secondary btn-modern"
                        disabled={loading}
                        style={{ flex: 1 }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  getEstadoBadge(selectedNovedad.estado_resolucion)
                )}
              </div>
              {selectedNovedad.fecha_resolucion && (
                <div>
                  <strong>Fecha de resolución:</strong> {formatDate(selectedNovedad.fecha_resolucion)}
                </div>
              )}
              {selectedNovedad.resuelto_por_nombre && (
                <div>
                  <strong>Resuelto por:</strong> {selectedNovedad.resuelto_por_nombre}
                </div>
              )}
              {selectedNovedad.observaciones_resolucion && (
                <div>
                  <strong>Observaciones de resolución:</strong>
                  <div style={{ marginTop: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                    {selectedNovedad.observaciones_resolucion}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

