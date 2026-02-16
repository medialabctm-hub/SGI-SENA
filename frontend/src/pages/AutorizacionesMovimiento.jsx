import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import CustomSelect from '../components/CustomSelect'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import {
  FiSend,
  FiMapPin,
  FiPackage,
  FiUserCheck,
  FiSearch,
  FiX,
  FiRefreshCw,
  FiClipboard,
  FiClock,
  FiCheck
} from 'react-icons/fi'
import '../styles/pages/equipos.css'
import '../styles/pages/historiales.css'
import '../styles/components/modals.css'

const TAB_PENDIENTES = 'pendientes'
const TAB_HISTORIAL = 'historial'

export default function AutorizacionesMovimiento() {
  const location = useLocation()
  const sectionGestionRef = useRef(null)

  const [user, setUser] = useState(null)
  const [loadingSolicitud, setLoadingSolicitud] = useState(false)
  const [loadingGestion, setLoadingGestion] = useState(false)
  const [toast, setToast] = useState(null)

  // Sección solicitar
  const [equiposVerificados, setEquiposVerificados] = useState([])
  const [ambientes, setAmbientes] = useState([])
  const [autorizadores, setAutorizadores] = useState([])
  const [busquedaPlaca, setBusquedaPlaca] = useState('')
  const [mostrarResultadosPlaca, setMostrarResultadosPlaca] = useState(false)
  const [errores, setErrores] = useState({})
  const [form, setForm] = useState({
    codigo_equipo: '',
    id_ambiente_destino: '',
    motivo: '',
    id_autorizador: ''
  })

  // Sección gestionar (pendientes / historial)
  const [tab, setTab] = useState(TAB_PENDIENTES)
  const [solicitudes, setSolicitudes] = useState([])
  const [historial, setHistorial] = useState([])
  const [filtroHistorial, setFiltroHistorial] = useState('')
  const [rechazarModal, setRechazarModal] = useState({ open: false, id: null, observacion: '' })

  const userRole = user?.nombre_rol || ''
  const puedeGestionar = userRole === 'Administrador' || userRole === 'Cuentadante'
  const puedeSolicitar = ['Administrador', 'Instructor', 'Cuentadante'].includes(userRole)

  // Pestaña principal: solicitar | gestionar (como en Novedades)
  const [tabPrincipal, setTabPrincipal] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#pendientes') return 'gestionar'
    return 'solicitar'
  })
  useEffect(() => {
    if (location.hash === '#pendientes' && puedeGestionar) setTabPrincipal('gestionar')
  }, [location.hash, puedeGestionar])

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) setUser(JSON.parse(userData))
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Scroll a sección gestión si viene hash #pendientes
  useEffect(() => {
    if (location.hash === '#pendientes' && sectionGestionRef.current) {
      sectionGestionRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.hash, user])

  // Cargar datos para formulario de solicitud
  useEffect(() => {
    if (!user || !puedeSolicitar) return
    const token = localStorage.getItem('token')
    Promise.all([
      fetch('/api/equipos?limit=5000', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => d.equipos || d || []).catch(() => []),
      fetch('/api/ambientes/activos', { headers: { Authorization: `Bearer ${token}` } }).then(r => parseApiResponse(r, 'Ambientes')).then(d => (Array.isArray(d) ? d : [])).catch(() => []),
      fetch('/api/auth/users', { headers: { Authorization: `Bearer ${token}` } }).then(r => parseApiResponse(r, 'Usuarios')).then(d => (Array.isArray(d) ? d : [])).catch(() => [])
    ]).then(([equipos, ambs, users]) => {
      setEquiposVerificados((equipos || []).filter(e => e.status_verificacion === 'Verificado'))
      setAmbientes(ambs || [])
      setAutorizadores((users || []).filter(u => u.nombre_rol === 'Administrador' || u.nombre_rol === 'Cuentadante'))
    }).catch(() => setToast({ message: 'Error al cargar datos', type: 'error' }))
  }, [user, puedeSolicitar])

  const equiposPorPlaca = useMemo(() => {
    const t = (busquedaPlaca || '').trim().toLowerCase()
    if (!t) return []
    return equiposVerificados.filter(eq => {
      const placa = (eq.placa || eq.codigo_inventario || '').toString().toLowerCase()
      const codigoInv = (eq.codigo_inventario || '').toString().toLowerCase()
      const consecutivo = (eq.consecutivo || '').toString().toLowerCase()
      return placa.includes(t) || codigoInv.includes(t) || consecutivo.includes(t)
    })
  }, [equiposVerificados, busquedaPlaca])

  const equipoSeleccionado = useMemo(() => {
    if (!form.codigo_equipo) return null
    return equiposVerificados.find(e => String(e.codigo_equipo) === String(form.codigo_equipo)) || null
  }, [form.codigo_equipo, equiposVerificados])

  function seleccionarEquipo(eq) {
    setForm(prev => ({ ...prev, codigo_equipo: String(eq.codigo_equipo) }))
    setBusquedaPlaca('')
    setMostrarResultadosPlaca(false)
    setErrores(prev => ({ ...prev, codigo_equipo: '' }))
  }

  function limpiarEquipo() {
    setForm(prev => ({ ...prev, codigo_equipo: '' }))
    setBusquedaPlaca('')
    setMostrarResultadosPlaca(false)
  }

  async function handleSubmitSolicitud(e) {
    e.preventDefault()
    const nuevoErrores = {}
    if (!form.codigo_equipo) nuevoErrores.codigo_equipo = 'Seleccione un equipo (busque por placa).'
    if (!form.id_ambiente_destino) nuevoErrores.id_ambiente_destino = 'Seleccione el ambiente destino.'
    if (!form.motivo?.trim()) nuevoErrores.motivo = 'El motivo es obligatorio.'
    if (!form.id_autorizador) nuevoErrores.id_autorizador = 'Seleccione a quién solicitar la autorización.'
    setErrores(nuevoErrores)
    if (Object.keys(nuevoErrores).length > 0) {
      setToast({ message: 'Complete todos los campos obligatorios marcados.', type: 'error' })
      return
    }
    setLoadingSolicitud(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/autorizacion-movimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          codigo_equipo: Number(form.codigo_equipo),
          id_ambiente_destino: Number(form.id_ambiente_destino),
          motivo: form.motivo.trim(),
          id_autorizador: Number(form.id_autorizador)
        })
      })
      const data = await parseApiResponse(res, 'No se pudo crear la solicitud')
      setToast({ message: data?.message || 'Solicitud creada. El autorizador deberá aprobarla o rechazarla.', type: 'success' })
      setForm({ codigo_equipo: '', id_ambiente_destino: '', motivo: '', id_autorizador: '' })
      setBusquedaPlaca('')
      setErrores({})
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo crear la solicitud'), type: 'error' })
    } finally {
      setLoadingSolicitud(false)
    }
  }

  async function fetchPendientes() {
    setLoadingGestion(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/autorizacion-movimiento/pendientes', { headers: { Authorization: `Bearer ${token}` } })
      const data = await parseApiResponse(res, 'No se pudieron cargar las solicitudes')
      setSolicitudes(data.solicitudes || [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar'), type: 'error' })
      setSolicitudes([])
    } finally {
      setLoadingGestion(false)
    }
  }

  async function fetchHistorial() {
    setLoadingGestion(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const params = filtroHistorial ? `?estado=${filtroHistorial}` : ''
      const res = await fetch(`/api/equipos/autorizacion-movimiento/historial${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await parseApiResponse(res, 'No se pudo cargar el historial')
      setHistorial(data.solicitudes || [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar historial'), type: 'error' })
      setHistorial([])
    } finally {
      setLoadingGestion(false)
    }
  }

  useEffect(() => {
    if (user && puedeGestionar && tab === TAB_PENDIENTES) fetchPendientes()
  }, [user, puedeGestionar, tab])

  useEffect(() => {
    if (user && puedeGestionar && tab === TAB_HISTORIAL) fetchHistorial()
  }, [user, puedeGestionar, tab, filtroHistorial])

  async function handleAprobar(id) {
    setLoadingGestion(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/autorizacion-movimiento/${id}/aprobar`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
      await parseApiResponse(res, 'No se pudo aprobar')
      setToast({ message: 'Solicitud aprobada. El solicitante puede ejecutar el movimiento.', type: 'success' })
      fetchPendientes()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo aprobar'), type: 'error' })
    } finally {
      setLoadingGestion(false)
    }
  }

  async function handleRechazar() {
    const id = rechazarModal.id
    if (!id) return
    setLoadingGestion(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/autorizacion-movimiento/${id}/rechazar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ observacion_rechazo: rechazarModal.observacion || null })
      })
      await parseApiResponse(res, 'No se pudo rechazar')
      setToast({ message: 'Solicitud rechazada', type: 'success' })
      setRechazarModal({ open: false, id: null, observacion: '' })
      fetchPendientes()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo rechazar'), type: 'error' })
    } finally {
      setLoadingGestion(false)
    }
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  function handleRefreshGestion() {
    if (tab === TAB_PENDIENTES) fetchPendientes()
    else fetchHistorial()
  }

  if (!user) return null

  const mostrarTabs = puedeSolicitar && puedeGestionar

  return (
    <div className="page simple-page">
      <Header user={user} />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <div className="form-equipos form-modern autorizaciones-form-container">
            <div className="form-header">
              <div className="form-icon-wrapper autorizaciones-icon-wrapper">
                <FiClipboard size={28} color="#fff" />
              </div>
              <div className="form-header-content autorizaciones-header-content">
                <h2 className="autorizaciones-title">Autorizaciones de movimiento</h2>
                <p className="autorizaciones-subtitle">
                  Solicite autorización para mover un equipo verificado a otro ambiente, o gestione las solicitudes pendientes (Administrador/Cuentadante).
                </p>
              </div>
            </div>

            {mostrarTabs && (
              <>
                <div className="autorizaciones-tabs">
                  <button
                    type="button"
                    className={`autorizaciones-tab ${tabPrincipal === 'solicitar' ? 'active' : ''}`}
                    onClick={() => setTabPrincipal('solicitar')}
                  >
                    <FiSend size={18} />
                    Solicitar autorización
                  </button>
                  <button
                    type="button"
                    className={`autorizaciones-tab ${tabPrincipal === 'gestionar' ? 'active' : ''}`}
                    onClick={() => setTabPrincipal('gestionar')}
                  >
                    <FiClipboard size={18} />
                    Pendientes e historial
                    {solicitudes.length > 0 && <span className="solicitudes-tab-badge">{solicitudes.length}</span>}
                  </button>
                </div>
                <div className="form-divider form-divider-no-margin" />
              </>
            )}

            {/* Contenido por pestaña: Solicitar */}
            {(tabPrincipal === 'solicitar' || !puedeGestionar) && puedeSolicitar && (
              <div id="solicitar">
                <form onSubmit={handleSubmitSolicitud} className="solicitud-autorizacion-form" noValidate>
                  <div className="form-section">
                    <h3 className="form-section-title">
                      <FiPackage size={18} className="autorizaciones-icon-inline" />
                      Equipo a mover
                    </h3>
                    <div className="form-group">
                      <label htmlFor="busqueda-placa">Buscar por placa o código <span className="required">*</span></label>
                      {equipoSeleccionado ? (
                        <div className="solicitud-equipo-seleccionado">
                          <span>{equipoSeleccionado.placa || equipoSeleccionado.codigo_inventario || equipoSeleccionado.codigo_equipo} — {equipoSeleccionado.tipo} {equipoSeleccionado.modelo || ''} ({equipoSeleccionado.nombre_ambiente || ''})</span>
                          <button type="button" className="solicitud-equipo-limpiar" onClick={limpiarEquipo} title="Cambiar equipo"><FiX size={18} /></button>
                        </div>
                      ) : (
                        <>
                          <input
                            id="busqueda-placa"
                            type="text"
                            className={`cell-input ${errores.codigo_equipo ? 'input-error' : ''}`}
                            placeholder="Escriba la placa o código del equipo"
                            value={busquedaPlaca}
                            onChange={e => { setBusquedaPlaca(e.target.value); setMostrarResultadosPlaca(true); setErrores(prev => ({ ...prev, codigo_equipo: '' })) }}
                            onFocus={() => setMostrarResultadosPlaca(true)}
                            onBlur={() => setTimeout(() => setMostrarResultadosPlaca(false), 200)}
                          />
                          {mostrarResultadosPlaca && busquedaPlaca.trim().length >= 1 && (
                            <ul className="solicitud-resultados-placa">
                              {equiposPorPlaca.length === 0 ? (
                                <li className="solicitud-resultado-vacio">No hay equipos verificados con esa placa o código.</li>
                              ) : (
                                equiposPorPlaca.slice(0, 10).map(eq => (
                                  <li key={eq.codigo_equipo}>
                                    <button type="button" className="solicitud-resultado-btn" onClick={() => seleccionarEquipo(eq)}>
                                      <FiSearch size={14} /> {eq.placa || eq.codigo_inventario || eq.codigo_equipo} — {eq.tipo} {eq.modelo || ''} ({eq.nombre_ambiente || ''})
                                    </button>
                                  </li>
                                ))
                              )}
                            </ul>
                          )}
                          {errores.codigo_equipo && <span className="form-error">{errores.codigo_equipo}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="form-section">
                    <h3 className="form-section-title">
                      <FiMapPin size={18} className="autorizaciones-icon-inline" />
                      Destino y motivo
                    </h3>
                    <div className="form-group">
                      <label>Ambiente destino <span className="required">*</span></label>
                      <CustomSelect
                        name="id_ambiente_destino"
                        value={form.id_ambiente_destino}
                        onChange={e => { setForm({ ...form, id_ambiente_destino: e.target.value }); setErrores(prev => ({ ...prev, id_ambiente_destino: '' })) }}
                        options={[{ value: '', label: 'Seleccionar ambiente' }, ...ambientes.map(a => ({ value: String(a.id_ambiente), label: `${a.codigo_ambiente} - ${a.nombre_ambiente}` }))]}
                        placeholder="Seleccionar ambiente"
                        error={errores.id_ambiente_destino}
                      />
                    </div>
                    <div className="form-group">
                      <label>Motivo <span className="required">*</span></label>
                      <textarea
                        value={form.motivo}
                        onChange={e => { setForm({ ...form, motivo: e.target.value }); setErrores(prev => ({ ...prev, motivo: '' })) }}
                        placeholder="Indique el motivo por el cual se debe mover el equipo"
                        rows={4}
                        className={`cell-textarea ${errores.motivo ? 'input-error' : ''}`}
                      />
                      {errores.motivo && <span className="form-error">{errores.motivo}</span>}
                    </div>
                  </div>
                  <div className="form-section">
                    <h3 className="form-section-title">
                      <FiUserCheck size={18} className="autorizaciones-icon-inline" />
                      Autorizador
                    </h3>
                    <div className="form-group">
                      <label>Solicitar autorización a <span className="required">*</span></label>
                      <CustomSelect
                        name="id_autorizador"
                        value={form.id_autorizador}
                        onChange={e => { setForm({ ...form, id_autorizador: e.target.value }); setErrores(prev => ({ ...prev, id_autorizador: '' })) }}
                        options={[{ value: '', label: 'Seleccionar autorizador' }, ...autorizadores.map(u => ({ value: String(u.id_usuario), label: `${u.nombre_usuario} (${u.nombre_rol})` }))]}
                        placeholder="Seleccionar autorizador"
                        error={errores.id_autorizador}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-verde" disabled={loadingSolicitud}>
                    {loadingSolicitud ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                </form>
              </div>
            )}

            {/* Contenido por pestaña: Pendientes e historial */}
            {(tabPrincipal === 'gestionar' || !puedeSolicitar) && puedeGestionar && (
              <div id="pendientes" ref={sectionGestionRef}>
                <div className="solicitudes-autorizacion-tabs">
                  <button
                    type="button"
                    className={`solicitudes-autorizacion-tab ${tab === TAB_PENDIENTES ? 'active' : ''}`}
                    onClick={() => setTab(TAB_PENDIENTES)}
                  >
                    <FiClipboard size={18} /> Pendientes {solicitudes.length > 0 && <span className="solicitudes-tab-badge">{solicitudes.length}</span>}
                  </button>
                  <button
                    type="button"
                    className={`solicitudes-autorizacion-tab ${tab === TAB_HISTORIAL ? 'active' : ''}`}
                    onClick={() => setTab(TAB_HISTORIAL)}
                  >
                    <FiClock size={18} /> Historial (aprobadas/rechazadas)
                  </button>
                  <button type="button" className="btn-act historial-verificaciones-refresh-btn" onClick={handleRefreshGestion} disabled={loadingGestion}>
                    <FiRefreshCw size={16} /> Actualizar
                  </button>
                </div>

                {tab === TAB_PENDIENTES && (
                  <>
                    <p className="autorizaciones-gestion-desc">
                      Solicitudes en las que usted fue designado como autorizador. Aprobando o rechazando, el solicitante podrá ejecutar el movimiento o será notificado del rechazo.
                    </p>
                    {loadingGestion && solicitudes.length === 0 ? (
                      <div className="loading-state">
                        <div className="loading-spinner" />
                        <p>Cargando...</p>
                      </div>
                    ) : solicitudes.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon-wrapper">
                          <FiClipboard size={48} color="#9ca3af" />
                        </div>
                        <h3>No hay solicitudes pendientes</h3>
                        <p>Las solicitudes en las que sea autorizador aparecerán aquí</p>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table className="consulta-table historial-verificaciones-table">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Equipo</th>
                              <th>Origen → Destino</th>
                              <th>Motivo</th>
                              <th>Solicitante</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {solicitudes.map(s => (
                              <tr key={s.id_solicitud}>
                                <td>{formatDateTime(s.fecha_solicitud)}</td>
                                <td>{s.codigo_inventario || s.codigo_equipo} - {s.tipo} {s.modelo || ''}</td>
                                <td>{s.ambiente_origen} → {s.ambiente_destino}</td>
                                <td>{s.motivo}</td>
                                <td>{s.solicitante_nombre}</td>
                                <td>
                                  <button type="button" className="btn btn-verde" onClick={() => handleAprobar(s.id_solicitud)} disabled={loadingGestion}>Aprobar</button>
                                  <button type="button" className="btn btn-delete" onClick={() => setRechazarModal({ open: true, id: s.id_solicitud, observacion: '' })} disabled={loadingGestion}>Rechazar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {tab === TAB_HISTORIAL && (
                  <>
                    <div className="solicitudes-historial-filtro">
                      <label>Estado:</label>
                      <CustomSelect
                        value={filtroHistorial}
                        onChange={e => setFiltroHistorial(e.target.value)}
                        options={[
                          { value: '', label: 'Todas (aprobadas y rechazadas)' },
                          { value: 'Aprobada', label: 'Aprobadas' },
                          { value: 'Rechazada', label: 'Rechazadas' }
                        ]}
                        className="solicitudes-historial-select"
                      />
                    </div>
                    {loadingGestion && historial.length === 0 ? (
                      <div className="loading-state">
                        <div className="loading-spinner" />
                        <p>Cargando...</p>
                      </div>
                    ) : historial.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon-wrapper">
                          <FiClock size={48} color="#9ca3af" />
                        </div>
                        <h3>No hay registros en el historial</h3>
                        <p>Las autorizaciones resueltas aparecerán aquí</p>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table className="consulta-table historial-verificaciones-table">
                          <thead>
                            <tr>
                              <th>Fecha solicitud</th>
                              <th>Fecha resolución</th>
                              <th>Equipo</th>
                              <th>Origen → Destino</th>
                              <th>Solicitante</th>
                              <th>Estado</th>
                              <th>Motivo rechazo</th>
                              <th>¿Usada?</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historial.map(s => (
                              <tr key={s.id_solicitud}>
                                <td>{formatDateTime(s.fecha_solicitud)}</td>
                                <td>{formatDateTime(s.fecha_resolucion)}</td>
                                <td>{s.codigo_inventario || s.codigo_equipo} - {s.tipo} {s.modelo || ''}</td>
                                <td>{s.ambiente_origen} → {s.ambiente_destino}</td>
                                <td>{s.solicitante_nombre}</td>
                                <td>
                                  {s.estado === 'Aprobada' ? (
                                    <span className="solicitudes-estado-badge aprobada"><FiCheck size={14} /> Aprobada</span>
                                  ) : (
                                    <span className="solicitudes-estado-badge rechazada"><FiX size={14} /> Rechazada</span>
                                  )}
                                </td>
                                <td>{s.observacion_rechazo || '-'}</td>
                                <td>{s.fecha_uso ? formatDateTime(s.fecha_uso) : 'No'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {rechazarModal.open && (
        <div className="confirm-modal-overlay" onClick={() => !loadingGestion && setRechazarModal({ open: false, id: null, observacion: '' })}>
          <div className="confirm-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <h3 className="confirm-modal-title">Rechazar solicitud</h3>
              <p className="confirm-modal-message">Indique el motivo del rechazo (opcional).</p>
              <textarea
                placeholder="Motivo del rechazo (opcional)"
                value={rechazarModal.observacion}
                onChange={e => setRechazarModal(prev => ({ ...prev, observacion: e.target.value }))}
                rows={3}
                className="cell-textarea"
                style={{ marginTop: 8, width: '100%' }}
              />
            </div>
            <div className="confirm-modal-footer">
              <button type="button" className="confirm-modal-btn confirm-modal-btn-secondary" onClick={() => setRechazarModal({ open: false, id: null, observacion: '' })} disabled={loadingGestion}>Cancelar</button>
              <button type="button" className="confirm-modal-btn confirm-modal-btn-primary danger" onClick={handleRechazar} disabled={loadingGestion}>{loadingGestion ? 'Procesando...' : 'Rechazar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
