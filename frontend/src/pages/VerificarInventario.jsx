import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { FiCheckCircle, FiXCircle, FiAlertCircle, FiPackage, FiMapPin, FiRefreshCw } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import { useNavigate } from 'react-router-dom'
import '../styles/equipos.css'
import '../styles/verificacion.css'

export default function VerificarInventario() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [ambientes, setAmbientes] = useState([])
  const [equipos, setEquipos] = useState([])
  const [verificaciones, setVerificaciones] = useState({}) // { codigo_equipo: { estado, observaciones } }
  const [toast, setToast] = useState(null)
  const [selectedEquipo, setSelectedEquipo] = useState(null)
  const [showNovedadModal, setShowNovedadModal] = useState(false)
  const [novedadForm, setNovedadForm] = useState({ tipo_novedad: 'Mal Funcionamiento', descripcion: '' })
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const userObj = JSON.parse(userData)
        setUser(userObj)
        if (userObj.nombre_rol !== 'Instructor') {
          setToast({ message: 'Solo los instructores pueden acceder a esta funcionalidad', type: 'error' })
          setTimeout(() => navigate('/dashboard'), 2000)
        }
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [navigate])

  useEffect(() => {
    if (user?.nombre_rol === 'Instructor') {
      fetchEquiposAmbientes()
    }
  }, [user])

  async function fetchEquiposAmbientes() {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      
      // Primero sincronizar responsabilidades para asegurar que las clases activas estén actualizadas
      try {
        await fetch('/api/clases/sincronizar-responsabilidades', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch (syncErr) {
        // No mostrar error si falla la sincronización, solo continuar
        console.debug('Sincronización automática:', syncErr.message)
      }
      
      // Luego obtener los ambientes
      const res = await fetch('/api/equipos/verificacion/ambientes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener los equipos de los ambientes')
      setAmbientes(data.ambientes || [])
      setEquipos(data.equipos || [])
      
      // Inicializar verificaciones con estado por defecto
      const verificacionesIniciales = {}
      data.equipos?.forEach(eq => {
        verificacionesIniciales[eq.codigo_equipo] = {
          estado: 'No Verificado',
          observaciones: ''
        }
      })
      setVerificaciones(verificacionesIniciales)
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo obtener los equipos'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleVerificar(codigoEquipo, estado, observaciones = '') {
    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/verificacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          codigo_equipo: codigoEquipo,
          estado_verificacion: estado,
          observaciones
        })
      })
      const data = await parseApiResponse(res, 'No se pudo registrar la verificación')
      
      // Actualizar estado local
      setVerificaciones(prev => ({
        ...prev,
        [codigoEquipo]: { estado, observaciones }
      }))
      
      setToast({ message: data.message || 'Verificación registrada correctamente', type: 'success' })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo registrar la verificación'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function handleReportarNovedad(equipo) {
    setSelectedEquipo(equipo)
    setNovedadForm({ tipo_novedad: 'Mal Funcionamiento', descripcion: '' })
    setShowNovedadModal(true)
  }

  async function handleSubmitNovedad(e) {
    e.preventDefault()
    if (!selectedEquipo || !selectedEquipo.codigo_equipo) {
      setToast({ message: 'Error: No se ha seleccionado un equipo', type: 'error' })
      return
    }
    if (!novedadForm.descripcion.trim()) {
      setToast({ message: 'La descripción de la novedad es obligatoria', type: 'error' })
      return
    }

    setLoading(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/novedades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          codigo_equipo: selectedEquipo.codigo_equipo,
          tipo_novedad: novedadForm.tipo_novedad,
          descripcion: novedadForm.descripcion.trim()
        })
      })
      await parseApiResponse(res, 'No se pudo reportar la novedad')
      
      // Marcar como verificado con novedad
      await handleVerificar(selectedEquipo.codigo_equipo, 'Con Novedad', novedadForm.descripcion.trim())
      
      setShowNovedadModal(false)
      setSelectedEquipo(null)
      setNovedadForm({ tipo_novedad: 'Mal Funcionamiento', descripcion: '' })
      setToast({ message: 'Novedad reportada y verificación registrada correctamente', type: 'success' })
    } catch (err) {
      console.error('Error al reportar novedad:', err)
      setToast({ message: buildErrorMessage(err, 'No se pudo reportar la novedad'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function getEquiposPorAmbiente(idAmbiente) {
    return equipos.filter(eq => eq.id_ambiente === idAmbiente)
  }

  function getJornadaActual() {
    const hora = new Date().getHours()
    if (hora >= 6 && hora < 12) return 'Mañana'
    if (hora >= 12 && hora < 18) return 'Tarde'
    return 'Noche'
  }

  function getJornadaBadge(jornada) {
    const jornadas = {
      'Mañana': { color: '#f59e0b', bg: '#fef3c7' },
      'Tarde': { color: '#3b82f6', bg: '#dbeafe' },
      'Noche': { color: '#8b5cf6', bg: '#ede9fe' }
    }
    const jornadaInfo = jornadas[jornada] || jornadas['Mañana']
    return (
      <span style={{
        padding: '6px 12px',
        borderRadius: '12px',
        fontSize: '0.9rem',
        fontWeight: 600,
        color: jornadaInfo.color,
        background: jornadaInfo.bg,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        {jornada}
      </span>
    )
  }

  function getEstadoBadge(estado) {
    const estados = {
      'Verificado': { color: '#10b981', bg: '#d1fae5', icon: <FiCheckCircle /> },
      'Con Novedad': { color: '#ef4444', bg: '#fee2e2', icon: <FiAlertCircle /> },
      'No Verificado': { color: '#6b7280', bg: '#f3f4f6', icon: <FiXCircle /> }
    }
    const estadoInfo = estados[estado] || estados['No Verificado']
    return (
      <span style={{
        padding: '6px 12px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: estadoInfo.color,
        background: estadoInfo.bg,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        {estadoInfo.icon}
        {estado}
      </span>
    )
  }

  function formatDate(dateString) {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  if (user?.nombre_rol !== 'Instructor') {
    return null
  }

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          
          {showNovedadModal && (
            <div 
              className="confirm-modal-overlay" 
              onClick={() => {
                if (!loading) {
                  setShowNovedadModal(false)
                  setSelectedEquipo(null)
                }
              }}
            >
              <div 
                className="confirm-modal-sheet" 
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '600px' }}
              >
                <div className="confirm-modal-header">
                  <div className="confirm-modal-title-wrapper">
                    <div className="confirm-modal-icon info">
                      <FiAlertCircle size={20} color="#3b82f6" />
                    </div>
                    <h3 className="confirm-modal-title">
                      Reportar Novedad
                    </h3>
                  </div>
                  {selectedEquipo && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
                      Equipo: {selectedEquipo.codigo_inventario || selectedEquipo.codigo_equipo} - {selectedEquipo.tipo} {selectedEquipo.marca} {selectedEquipo.modelo}
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleSubmitNovedad} style={{ padding: '1rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                      Tipo de Novedad
                    </label>
                    <select
                      value={novedadForm.tipo_novedad}
                      onChange={e => setNovedadForm({ ...novedadForm, tipo_novedad: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '2px solid var(--neutral-300)',
                        fontSize: '0.95rem'
                      }}
                      disabled={loading}
                    >
                      <option value="Mal Funcionamiento">Mal Funcionamiento</option>
                      <option value="Daño Físico">Daño Físico</option>
                      <option value="Falta de Componente">Falta de Componente</option>
                      <option value="Robo">Robo</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                      Descripción *
                    </label>
                    <textarea
                      value={novedadForm.descripcion}
                      onChange={e => setNovedadForm({ ...novedadForm, descripcion: e.target.value })}
                      placeholder="Describe la novedad encontrada..."
                      required
                      rows={4}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '2px solid var(--neutral-300)',
                        fontSize: '0.95rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div className="confirm-modal-footer" style={{ marginTop: '1.5rem' }}>
                    <button
                      type="button"
                      className="confirm-modal-btn confirm-modal-btn-secondary"
                      onClick={() => {
                        setShowNovedadModal(false)
                        setSelectedEquipo(null)
                      }}
                      disabled={loading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="confirm-modal-btn confirm-modal-btn-primary info"
                      disabled={loading}
                    >
                      {loading ? 'Reportando...' : 'Reportar Novedad'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="users-panel">
            <div className="users-toolbar">
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FiPackage size={24} />
                  Verificación de Inventario
                </h2>
                <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Jornada actual: {getJornadaBadge(getJornadaActual())}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-verde"
                onClick={fetchEquiposAmbientes}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiRefreshCw size={16} />
                Actualizar
              </button>
            </div>

            {loading && ambientes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                <p>Cargando equipos...</p>
              </div>
            ) : ambientes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrapper">
                  <FiMapPin size={48} color="#9ca3af" />
                </div>
                <h3>No tienes ambientes asignados</h3>
                <p>No hay ambientes bajo tu responsabilidad en este momento</p>
              </div>
            ) : (
              <div style={{ marginTop: '1.5rem' }}>
                {ambientes.map(ambiente => {
                  const equiposAmbiente = getEquiposPorAmbiente(ambiente.id_ambiente)
                  if (equiposAmbiente.length === 0) return null

                  return (
                    <div key={ambiente.id_ambiente} className="verificacion-ambiente-card">
                      <div className="verificacion-ambiente-header">
                        <div>
                          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiMapPin size={20} />
                            {ambiente.nombre_ambiente}
                          </h3>
                          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Código: {ambiente.codigo_ambiente} | {equiposAmbiente.length} equipo(s)
                            {ambiente.jornada && (
                              <>
                                | Jornada: {getJornadaBadge(ambiente.jornada)}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <table className="consulta-table" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th>Código Inventario</th>
                              <th>Tipo</th>
                              <th>Marca / Modelo</th>
                              <th>N° Serie</th>
                              <th>Estado Físico</th>
                              <th>Última Verificación</th>
                              <th>Estado Actual</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {equiposAmbiente.map(equipo => {
                              const verificacion = verificaciones[equipo.codigo_equipo] || { estado: 'No Verificado', observaciones: '' }
                              return (
                                <tr key={equipo.codigo_equipo}>
                                  <td><strong>{equipo.codigo_inventario || equipo.codigo_equipo}</strong></td>
                                  <td>{equipo.tipo}</td>
                                  <td>{equipo.marca} {equipo.modelo}</td>
                                  <td>{equipo.numero_serie || '-'}</td>
                                  <td>
                                    <span style={{
                                      padding: '4px 10px',
                                      borderRadius: '12px',
                                      fontSize: '0.85rem',
                                      fontWeight: 600,
                                      color: equipo.estado_fisico === 'Bueno' || equipo.estado_fisico === 'Nuevo' ? '#10b981' : '#ef4444',
                                      background: equipo.estado_fisico === 'Bueno' || equipo.estado_fisico === 'Nuevo' ? '#d1fae5' : '#fee2e2',
                                      display: 'inline-block'
                                    }}>
                                      {equipo.estado_fisico}
                                    </span>
                                  </td>
                                  <td>{equipo.ultima_verificacion ? formatDate(equipo.ultima_verificacion) : 'Nunca'}</td>
                                  <td>{getEstadoBadge(verificacion.estado)}</td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                      <button
                                        className="btn btn-verde"
                                        onClick={() => handleVerificar(equipo.codigo_equipo, 'Verificado')}
                                        disabled={loading}
                                        style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                        title="Marcar como verificado"
                                      >
                                        <FiCheckCircle size={14} />
                                        Verificado
                                      </button>
                                      <button
                                        className="btn"
                                        onClick={() => handleReportarNovedad(equipo)}
                                        disabled={loading}
                                        style={{ fontSize: '0.85rem', padding: '6px 12px', background: '#fee2e2', color: '#ef4444', border: '2px solid #ef4444' }}
                                        title="Reportar novedad"
                                      >
                                        <FiAlertCircle size={14} />
                                        Novedad
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

