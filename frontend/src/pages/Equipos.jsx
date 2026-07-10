import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ImportarEquipos from '../components/ImportarEquipos'
import CustomSelect from '../components/CustomSelect'
import { FiPlus, FiUpload, FiSearch, FiCheckCircle } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage, handleError } from '../utils/api'
import { useSocket } from '../contexts/SocketContext'
import '../styles/pages/equipos.css'

const ESTADOS_FISICOS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado']

export default function Equipos() {
  const [activeTab, setActiveTab] = useState('registrar') // 'registrar' o 'importar'
  const [form, setForm] = useState({
    modelo: '',
    consecutivo: '',
    categoria: '',
    descripcion: '',
    tipo: '4',
    placa: '',
    atributos: '',
    fecha_adquisicion: '',
    valor_ingreso: '',
    ambiente: '',
    estado_fisico: 'Bueno',
    comentarios: '',
    r_centro: '00000',
    id_cuentadante: '',
  })

  const [errores, setErrores] = useState({})
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  const [ambientes, setAmbientes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tieneDuplicadosPendientes, setTieneDuplicadosPendientes] = useState(false)
  const [cedulaCuentadante, setCedulaCuentadante] = useState('')
  const [cuentadanteEncontrado, setCuentadanteEncontrado] = useState(null)
  const [buscandoCuentadante, setBuscandoCuentadante] = useState(false)

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

  // Cargar ambientes disponibles
  useEffect(() => {
    async function cargarAmbientes() {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/ambientes/activos', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await parseApiResponse(res, 'No se pudieron cargar los ambientes')
        setAmbientes(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error al cargar ambientes:', err)
        setAmbientes([])
      }
    }
    cargarAmbientes()
  }, [])

  // Cargar categorías de equipos disponibles
  useEffect(() => {
    async function cargarCategorias() {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/equipos/categorias', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await parseApiResponse(res, 'No se pudieron cargar las categorías')
        // Extraer solo los nombres de las categorías
        const nombresCategorias = Array.isArray(data) 
          ? data.map(cat => cat.nombre_categoria)
          : []
        setCategorias(nombresCategorias)
      } catch (err) {
        console.error('Error al cargar categorías:', err)
        setCategorias([])
      }
    }
    cargarCategorias()
  }, [])

  // Suscribirse a actualizaciones en tiempo real de equipos
  const { subscribe } = useSocket()
  useEffect(() => {
    if (!subscribe) return
    
    const unsubscribeEquipoCreated = subscribe('equipo:created', () => {
      // Recargar categorías cuando se cree un equipo (puede haber nuevas categorías)
      const token = localStorage.getItem('token')
      fetch('/api/equipos/categorias', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => parseApiResponse(res))
        .then(data => {
          const nombresCategorias = Array.isArray(data) 
            ? data.map(cat => cat.nombre_categoria)
            : []
          setCategorias(nombresCategorias)
        })
        .catch(err => console.error('Error al recargar categorías:', err))
    })
    
    const unsubscribeEquipoUpdated = subscribe('equipo:updated', () => {
      // Si hay una lista de equipos visible, podría recargarse aquí
      // Por ahora solo actualizamos categorías
    })
    
    const unsubscribeEquipoDeleted = subscribe('equipo:deleted', () => {
      // Recargar categorías cuando se elimine un equipo
      const token = localStorage.getItem('token')
      fetch('/api/equipos/categorias', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => parseApiResponse(res))
        .then(data => {
          const nombresCategorias = Array.isArray(data) 
            ? data.map(cat => cat.nombre_categoria)
            : []
          setCategorias(nombresCategorias)
        })
        .catch(err => console.error('Error al recargar categorías:', err))
    })
    
    return () => {
      unsubscribeEquipoCreated()
      unsubscribeEquipoUpdated()
      unsubscribeEquipoDeleted()
    }
  }, [subscribe])

  // Buscar cuentadante por cédula
  const buscarCuentadante = async () => {
    if (!cedulaCuentadante.trim()) {
      setErrores(prev => ({ ...prev, cuentadante: 'Ingresa la cédula del cuentadante' }))
      return
    }

    try {
      setBuscandoCuentadante(true)
      setErrores(prev => {
        const { cuentadante, ...rest } = prev
        return rest
      })
      setCuentadanteEncontrado(null)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/auth/user/cedula/${encodeURIComponent(cedulaCuentadante.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await parseApiResponse(res, 'Error al buscar cuentadante')
        
        // Verificar que sea un Cuentadante
        if (data.nombre_rol !== 'Cuentadante') {
          setErrores(prev => ({ ...prev, cuentadante: 'El usuario encontrado no tiene el rol de Cuentadante' }))
          setCuentadanteEncontrado(null)
          setForm(prev => ({ ...prev, id_cuentadante: '' }))
          return
        }
        
        setCuentadanteEncontrado(data)
        setForm(prev => ({ ...prev, id_cuentadante: data.id_usuario.toString() }))
      } else {
        const errorData = await res.json().catch(() => ({}))
        setErrores(prev => ({ ...prev, cuentadante: errorData.error || 'No se encontró un cuentadante con esa cédula' }))
        setCuentadanteEncontrado(null)
        setForm(prev => ({ ...prev, id_cuentadante: '' }))
      }
    } catch (err) {
      handleError(err, (errObj) => setErrores(prev => ({ ...prev, cuentadante: typeof errObj === 'string' ? errObj : errObj?.message ?? 'Error al buscar el cuentadante' })), 'Error al buscar el cuentadante')
      setCuentadanteEncontrado(null)
      setForm(prev => ({ ...prev, id_cuentadante: '' }))
    } finally {
      setBuscandoCuentadante(false)
    }
  }

  // Cambio de pestaña respetando el bloqueo por duplicados
  const handleChangeTab = (tab) => {
    if (tieneDuplicadosPendientes && activeTab === 'importar' && tab !== 'importar') {
      setToast({
        message: 'Debes aprobar o rechazar todos los equipos con placa duplicada antes de salir de esta sección.',
        type: 'error'
      })
      return
    }
    setActiveTab(tab)
  }

  // Handler para cambios en el formulario
  const handleChange = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  // Handler para submit
  const handleSubmit = async e => {
    e.preventDefault()
    const errs = {}
    if (!form.modelo) errs.modelo = 'El modelo es obligatorio'
    if (!form.consecutivo) errs.consecutivo = 'El consecutivo es obligatorio'
    if (!form.placa) errs.placa = 'La placa es obligatoria'
    if (!form.tipo) errs.tipo = 'El tipo es obligatorio'
    if (!form.categoria) errs.categoria = 'La categoría es obligatoria'
    if (!form.estado_fisico) errs.estado_fisico = 'El estado físico es obligatorio'
    if (!form.fecha_adquisicion) errs.fecha_adquisicion = 'La fecha de adquisición es obligatoria'
    if (!form.ambiente) errs.ambiente = 'El ambiente es obligatorio'
    if (user?.nombre_rol === 'Administrador') {
      if (!form.id_cuentadante || !cuentadanteEncontrado) {
        errs.cuentadante = 'Debes buscar y seleccionar un cuentadante'
      }
    }

    setErrores(errs)
    setToast(null)
    if (Object.keys(errs).length > 0) return
    try {
      const token = localStorage.getItem('token')
      // Mapear campos del formulario a los campos que espera el backend
      // tipo: valor fijo "4" (readonly) - se guarda en columna tipo
      // categoria: nombre de la categoría seleccionada - se usa para buscar id_categoria
      // descripcion: texto libre - se guarda en columna descripcion
      const payload = {
        tipo: form.tipo, // Valor fijo "4"
        categoria: form.categoria, // Nombre de la categoría para buscar id_categoria
        descripcion: form.descripcion || null, // Descripción libre del equipo
        modelo: form.modelo,
        consecutivo: form.consecutivo,
        fecha_adquisicion: form.fecha_adquisicion,
        valor_ingreso: form.valor_ingreso || null,
        estado_fisico: form.estado_fisico,
        ambiente: form.ambiente,
        atributos: form.atributos || null,
        placa: form.placa,
        comentarios: form.comentarios || null,
        r_centro: '00000',
        id_cuentadante: form.id_cuentadante || null
      }
      const resp = await fetch('/api/equipos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      const data = await parseApiResponse(resp, 'No se pudo registrar el elemento del inventario')
      setToast({
        message: `Elemento del inventario registrado correctamente`,
        type: 'success'
      })
      setForm({
        modelo: '', consecutivo: '', categoria: '', descripcion: '', tipo: '4', placa: '', atributos: '', fecha_adquisicion: '', valor_ingreso: '', ambiente: '', estado_fisico: 'Bueno', comentarios: '', r_centro: '00000', id_cuentadante: ''
      })
      setCedulaCuentadante('')
      setCuentadanteEncontrado(null)
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'Error al registrar elemento del inventario'),
        type: 'error'
      })
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
              <div className="form-icon-wrapper form-icon-wrapper-green">
                <FiPlus size={28} color="#fff" />
              </div>
              <div className="form-header-content">
                <h2 className="form-header-title">Registro de Inventario</h2>
                <p className="form-header-subtitle">
                  Registra elementos del inventario individualmente o importa múltiples elementos desde Excel
                </p>
              </div>
            </div>

            {/* Pestañas */}
            <div className="form-tabs">
              <button
                onClick={() => handleChangeTab('registrar')}
                className={`form-tab ${activeTab === 'registrar' ? 'active' : ''}`}
              >
                <FiPlus size={18} />
                Registrar Inventario
              </button>
              <button
                onClick={() => handleChangeTab('importar')}
                className={`form-tab ${activeTab === 'importar' ? 'active' : ''}`}
              >
                <FiUpload size={18} />
                Importar Inventario
              </button>
            </div>

            <div className="form-divider form-divider-no-margin"></div>

            {activeTab === 'registrar' ? (
              <form className="form-equipos" onSubmit={handleSubmit}>
                <div className="form-grid">
                  {/* Información Básica del Equipo */}
                  <div className="form-row">
                    <label>Tipo *</label>
                    <input name="tipo" value={form.tipo} readOnly disabled className="form-input-disabled" />
                  </div>
                  <div className="form-row">
                    <label>Categoría *</label>
                    <CustomSelect
                      name="categoria"
                      value={form.categoria}
                      onChange={handleChange}
                      options={categorias}
                      placeholder="Seleccionar categoría"
                      required
                      error={errores.categoria}
                      helpText={categorias.length === 0 ? 'No hay categorías disponibles. Contacta al administrador.' : ''}
                    />
                  </div>
                  <div className="form-row">
                    <label>Modelo *</label>
                    <input name="modelo" value={form.modelo} onChange={handleChange} />
                    {errores.modelo && <span className="error-text">{errores.modelo}</span>}
                  </div>
                  <div className="form-row">
                    <label>Consecutivo *</label>
                    <input name="consecutivo" value={form.consecutivo} onChange={handleChange} />
                    {errores.consecutivo && <span className="error-text">{errores.consecutivo}</span>}
                  </div>
                  <div className="form-row">
                    <label>Placa *</label>
                    <input name="placa" value={form.placa} onChange={handleChange} />
                    {errores.placa && <span className="error-text">{errores.placa}</span>}
                  </div>

                  {/* Ubicación y Estado */}
                  <div className="form-row">
                    <label>Centro</label>
                    <input name="r_centro" value="00000" readOnly disabled className="form-input-disabled" />
                  </div>
                  <div className="form-row">
                    <label>Ambiente *</label>
                    <CustomSelect
                      name="ambiente"
                      value={form.ambiente}
                      onChange={handleChange}
                      options={[
                        { value: '', label: 'Seleccionar ambiente' },
                        ...ambientes.map(amb => ({
                          value: amb.id_ambiente.toString(),
                          label: `${amb.codigo_ambiente} - ${amb.nombre_ambiente}`
                        }))
                      ]}
                      placeholder="Seleccionar ambiente"
                    />
                    {errores.ambiente && <span className="error-text">{errores.ambiente}</span>}
                  </div>
                  <div className="form-row">
                    <label>Estado Físico *</label>
                    <CustomSelect
                      name="estado_fisico"
                      value={form.estado_fisico}
                      onChange={handleChange}
                      options={ESTADOS_FISICOS}
                      placeholder="Seleccionar estado físico"
                      error={errores.estado_fisico}
                    />
                    {errores.estado_fisico && <span className="error-text">{errores.estado_fisico}</span>}
                  </div>

                  {/* Información Financiera */}
                  <div className="form-row">
                    <label>Fecha Adquisición *</label>
                    <input type="date" name="fecha_adquisicion" value={form.fecha_adquisicion} onChange={handleChange} />
                    {errores.fecha_adquisicion && <span className="error-text">{errores.fecha_adquisicion}</span>}
                  </div>
                  <div className="form-row">
                    <label>Valor Ingreso</label>
                    <input type="number" name="valor_ingreso" value={form.valor_ingreso} onChange={handleChange} min="0" step="0.01" />
                  </div>

                  {/* Información Adicional */}
                  <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                    <label>Descripción</label>
                    <textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows="3" placeholder="Descripción libre del equipo (opcional)" />
                  </div>
                  <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                    <label>Atributos</label>
                    <textarea name="atributos" value={form.atributos} onChange={handleChange} rows="3" />
                  </div>
                  <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                    <label>Comentarios</label>
                    <textarea name="comentarios" value={form.comentarios} onChange={handleChange} rows="3" />
                  </div>

                  {/* Cuentadante - Solo para Administradores */}
                  {user?.nombre_rol === 'Administrador' && (
                    <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                      <label>Cuentadante *</label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1', minWidth: '250px' }}>
                          <input
                            type="text"
                            className={`form-input ${cuentadanteEncontrado ? 'form-input-success' : ''} ${errores.cuentadante ? 'form-input-error' : ''}`}
                            value={cedulaCuentadante}
                            onChange={(e) => {
                              setCedulaCuentadante(e.target.value)
                              setCuentadanteEncontrado(null)
                              setForm(prev => ({ ...prev, id_cuentadante: '' }))
                              if (errores.cuentadante) {
                                setErrores(prev => {
                                  const { cuentadante, ...rest } = prev
                                  return rest
                                })
                              }
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                buscarCuentadante()
                              }
                            }}
                            placeholder="Ingrese la cédula del cuentadante"
                            style={{ width: '100%' }}
                          />
                          {errores.cuentadante && <span className="error-text">{errores.cuentadante}</span>}
                        </div>
                        <button
                          type="button"
                          className="btn btn-verde"
                          onClick={buscarCuentadante}
                          disabled={!cedulaCuentadante.trim() || buscandoCuentadante}
                          style={{ whiteSpace: 'nowrap', padding: '0.75rem 1.5rem', minHeight: '44px' }}
                        >
                          {buscandoCuentadante ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="loading-spinner" style={{ width: '14px', height: '14px' }}></div>
                              Buscando...
                            </span>
                          ) : (
                            <>
                              <FiSearch size={16} style={{ marginRight: '6px' }} />
                              Buscar
                            </>
                          )}
                        </button>
                      </div>
                      {cuentadanteEncontrado && (
                        <div style={{ 
                          marginTop: '12px', 
                          padding: '12px 16px', 
                          backgroundColor: '#f0f9f0', 
                          borderRadius: '8px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '10px',
                          border: '1px solid #22c55e'
                        }}>
                          <FiCheckCircle size={20} color="#22c55e" />
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: '#15803d', display: 'block', marginBottom: '4px' }}>
                              {cuentadanteEncontrado.nombre_usuario}
                            </strong>
                            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                              Documento: {cuentadanteEncontrado.cedula}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="form-row" style={{ gridColumn: '1 / -1', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--neutral-200)' }}>
                  <button type="submit" className="btn-verde" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
                    Registrar Inventario
                  </button>
                </div>
              </form>
            ) : (
              <ImportarEquipos 
                onImportComplete={(resultados) => {
                  setToast({
                    message: `Importación completada: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`,
                    type: resultados.fallidos === 0 ? 'success' : 'warning'
                  })
                }}
                onEstadoDuplicadosChange={(hayDuplicados) => {
                  setTieneDuplicadosPendientes(hayDuplicados)
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}



