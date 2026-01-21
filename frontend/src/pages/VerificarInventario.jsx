import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import CustomSelect from '../components/CustomSelect'
import { FiCheckCircle, FiXCircle, FiAlertCircle, FiPackage, FiMapPin, FiRefreshCw } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import { useNavigate } from 'react-router-dom'
import '../styles/equipos.css'
import '../styles/verificacion.css'
import '../styles/verificarInventario.css'

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
      
      // SISTEMA 100% MANUAL: No hay sincronización automática
      // Los estados se determinan únicamente por estado_responsabilidad = 'Activa'
      // No se necesita sincronizar antes de obtener los ambientes
      // La sincronización solo envía alertas informativas, no cambia estados
      
      // Luego obtener los ambientes
      const res = await fetch('/api/equipos/verificacion/ambientes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'No se pudo obtener los equipos de los ambientes')
      setAmbientes(data.ambientes || [])
      setEquipos(data.equipos || [])
      
      // Inicializar verificaciones con el estado real desde el backend
      const verificacionesIniciales = {}
      data.equipos?.forEach(eq => {
        verificacionesIniciales[eq.codigo_equipo] = {
          estado: eq.estado_verificacion_actual || 'No Verificado',
          observaciones: eq.observaciones_verificacion || ''
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
    const descripcionTrimmed = novedadForm.descripcion.trim()
    if (!descripcionTrimmed) {
      setToast({ message: 'La descripción de la novedad es obligatoria', type: 'error' })
      return
    }
    if (descripcionTrimmed.length < 10) {
      setToast({ message: 'La descripción debe tener al menos 10 caracteres', type: 'error' })
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
          descripcion: descripcionTrimmed
        })
      })
      await parseApiResponse(res, 'No se pudo reportar la novedad')
      
      // Marcar como verificado con novedad
      await handleVerificar(selectedEquipo.codigo_equipo, 'Con Novedad', descripcionTrimmed)
      
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
    const jornadaClass = jornada?.toLowerCase().replace('á', 'a').replace('é', 'e') || 'mañana'
    return (
      <span className={`jornada-badge ${jornadaClass}`}>
        {jornada}
      </span>
    )
  }

  function getEstadoBadge(estado) {
    const estados = {
      'Verificado': { class: 'verificado', icon: <FiCheckCircle /> },
      'Con Novedad': { class: 'con-novedad', icon: <FiAlertCircle /> },
      'No Verificado': { class: 'pendiente', icon: <FiXCircle /> }
    }
    const estadoInfo = estados[estado] || estados['No Verificado']
    return (
      <span className={`verificacion-badge ${estadoInfo.class}`}>
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
                className="confirm-modal-sheet novedad-modal-container" 
                onClick={(e) => e.stopPropagation()}
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
                    <div className="novedad-modal-info">
                      Equipo: {selectedEquipo.codigo_inventario || selectedEquipo.codigo_equipo} - {selectedEquipo.tipo} {selectedEquipo.marca} {selectedEquipo.modelo}
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleSubmitNovedad} className="novedad-form">
                  <div className="novedad-form-row">
                    <label className="novedad-form-label">
                      Tipo de Novedad
                    </label>
                    <CustomSelect
                      name="tipo_novedad"
                      className="novedad-form-select form-select"
                      value={novedadForm.tipo_novedad}
                      onChange={e => setNovedadForm({ ...novedadForm, tipo_novedad: e.target.value })}
                      options={['Mal Funcionamiento', 'Daño Físico', 'Falta de Componente', 'Robo', 'Otro']}
                      placeholder="Seleccionar tipo de novedad"
                      disabled={loading}
                    />
                  </div>
                  <div className="novedad-form-row">
                    <label className="novedad-form-label form-label-required">
                      Descripción
                    </label>
                    <textarea
                      className={`novedad-form-textarea form-textarea ${novedadForm.descripcion.trim().length > 0 && novedadForm.descripcion.trim().length < 10 ? 'error' : ''}`}
                      value={novedadForm.descripcion}
                      onChange={e => setNovedadForm({ ...novedadForm, descripcion: e.target.value })}
                      placeholder="Describe la novedad encontrada..."
                      required
                      rows={4}
                      disabled={loading}
                    />
                    <div className={`novedad-char-count ${novedadForm.descripcion.trim().length > 0 && novedadForm.descripcion.trim().length < 10 ? 'error' : ''}`}>
                      {novedadForm.descripcion.trim().length > 0 && novedadForm.descripcion.trim().length < 10 
                        ? `Mínimo 10 caracteres (${novedadForm.descripcion.trim().length}/10)`
                        : `Mínimo 10 caracteres (${novedadForm.descripcion.trim().length} caracteres)`}
                    </div>
                  </div>
                  <div className="confirm-modal-footer novedad-form-footer">
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
                <h2 className="verificar-inventario-header">
                  <FiPackage size={24} />
                  Verificación de Inventario
                </h2>
                <p className="verificar-inventario-subtitle">
                  Jornada actual: {getJornadaBadge(getJornadaActual())}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary verificar-inventario-actions"
                onClick={fetchEquiposAmbientes}
                disabled={loading}
              >
                <FiRefreshCw size={16} />
                Actualizar
              </button>
            </div>

            {loading && ambientes.length === 0 ? (
              <div className="verificar-inventario-loading">
                <div className="loading-spinner verificar-inventario-loading-spinner"></div>
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
              <div className="verificar-inventario-content">
                {ambientes.map(ambiente => {
                  const equiposAmbiente = getEquiposPorAmbiente(ambiente.id_ambiente)
                  if (equiposAmbiente.length === 0) return null

                  return (
                    <div key={ambiente.id_ambiente} className="verificacion-ambiente-card">
                      <div className="verificacion-ambiente-header">
                        <div>
                          <h3 className="verificar-inventario-ambiente-header">
                            <FiMapPin size={20} />
                            {ambiente.nombre_ambiente}
                          </h3>
                          <p className="verificar-inventario-ambiente-subtitle">
                            Código: {ambiente.codigo_ambiente} | {equiposAmbiente.length} equipo(s)
                            {ambiente.jornada && (
                              <>
                                | Jornada: {getJornadaBadge(ambiente.jornada)}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="verificar-inventario-table-wrapper">
                        <table className="consulta-table verificar-inventario-table">
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
                                  <td>{equipo.consecutivo || '-'}</td>
                                  <td>
                                    <span className={`verificar-inventario-estado-badge ${
                                      equipo.estado_fisico === 'Bueno' || equipo.estado_fisico === 'Nuevo' ? 'verificacion-badge-verificado' :
                                      'verificacion-badge-no-verificado'
                                    }`}>
                                      {equipo.estado_fisico}
                                    </span>
                                  </td>
                                  <td>{equipo.ultima_verificacion ? formatDate(equipo.ultima_verificacion) : 'Nunca'}</td>
                                  <td>{getEstadoBadge(verificacion.estado)}</td>
                                  <td>
                                    <div className="verificar-inventario-actions">
                                      <button
                                        className="btn btn-verde verificar-inventario-action-btn"
                                        onClick={() => handleVerificar(equipo.codigo_equipo, 'Verificado')}
                                        disabled={loading}
                                        title="Marcar como verificado"
                                      >
                                        <FiCheckCircle size={14} />
                                        Verificado
                                      </button>
                                      <button
                                        className="btn verificar-inventario-action-btn-novedad"
                                        onClick={() => handleReportarNovedad(equipo)}
                                        disabled={loading}
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

