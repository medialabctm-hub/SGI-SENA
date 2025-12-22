import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ImportarEquipos from '../components/ImportarEquipos'
import { FiPlus, FiUpload } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'

const ESTADOS_FISICOS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado']

export default function Equipos() {
  const [activeTab, setActiveTab] = useState('registrar') // 'registrar' o 'importar'
  const [form, setForm] = useState({
    modelo: '',
    consecutivo: '',
    descripcion: '',
    tipo: '',
    placa: '',
    atributos: '',
    fecha_adquisicion: '',
    valor_ingreso: '',
    ambiente: '',
    estado_fisico: 'Bueno',
    comentarios: '',
    r_centro: '00000',
  })

  const [errores, setErrores] = useState({})
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  const [ambientes, setAmbientes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tieneDuplicadosPendientes, setTieneDuplicadosPendientes] = useState(false)

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
    if (!form.tipo) errs.tipo = 'El tipo es obligatorio'
    if (!form.estado_fisico) errs.estado_fisico = 'El estado físico es obligatorio'
    if (!form.fecha_adquisicion) errs.fecha_adquisicion = 'La fecha de adquisición es obligatoria'
    if (!form.ambiente) errs.ambiente = 'El ambiente es obligatorio'

    setErrores(errs)
    setToast(null)
    if (Object.keys(errs).length > 0) return
    try {
      const token = localStorage.getItem('token')
      // Mapear campos del formulario a los campos que espera el backend
      const payload = {
        tipo: form.tipo,
        modelo: form.modelo,
        consecutivo: form.consecutivo,
        descripcion: form.descripcion || null,
        fecha_adquisicion: form.fecha_adquisicion,
        costo: form.valor_ingreso || null,
        estado_fisico: form.estado_fisico,
        ambiente: form.ambiente,
        specs_completas: form.atributos || null,
        placa: form.placa || null,
        atributos: form.atributos || null,
        valor_ingreso: form.valor_ingreso || null,
        comentarios: form.comentarios || null,
        r_centro: '00000'
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
        modelo: '', consecutivo: '', descripcion: '', tipo: '', placa: '', atributos: '', fecha_adquisicion: '', valor_ingreso: '', ambiente: '', estado_fisico: 'Bueno', comentarios: '', r_centro: '00000'
      })
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
                Importar Equipos
              </button>
            </div>

            <div className="form-divider form-divider-no-margin"></div>

            {activeTab === 'registrar' ? (
              <form className="form-equipos" onSubmit={handleSubmit}>
        <div className="form-grid">
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
            <label>Centro</label>
            <input name="r_centro" value="00000" readOnly disabled className="form-input-disabled" />
          </div>
          <div className="form-row">
            <label>Descripción</label>
            <textarea name="descripcion" value={form.descripcion} onChange={handleChange} />
          </div>
          <div className="form-row">
            <label>Tipo *</label>
            <select name="tipo" value={form.tipo} onChange={handleChange}>
              <option value="">Seleccionar tipo</option>
              {categorias.map(tipo => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
            {errores.tipo && <span className="error-text">{errores.tipo}</span>}
            {categorias.length === 0 && (
              <small className="form-help-text">
                No hay categorías disponibles. Contacta al administrador.
              </small>
            )}
          </div>
          <div className="form-row">
            <label>Placa</label>
            <input name="placa" value={form.placa} onChange={handleChange} />
          </div>
          <div className="form-row">
            <label>Atributos</label>
            <textarea name="atributos" value={form.atributos} onChange={handleChange} />
          </div>
          <div className="form-row">
            <label>Fecha Adquisición *</label>
            <input type="date" name="fecha_adquisicion" value={form.fecha_adquisicion} onChange={handleChange} />
            {errores.fecha_adquisicion && <span className="error-text">{errores.fecha_adquisicion}</span>}
          </div>
          <div className="form-row">
            <label>Valor Ingreso</label>
            <input type="number" name="valor_ingreso" value={form.valor_ingreso} onChange={handleChange} min="0" step="0.01" />
          </div>
          <div className="form-row">
            <label>Ambiente *</label>
            <select name="ambiente" value={form.ambiente} onChange={handleChange}>
              <option value="">Seleccionar ambiente</option>
              {ambientes.map(amb => (
                <option key={amb.id_ambiente} value={amb.id_ambiente}>
                  {amb.codigo_ambiente} - {amb.nombre_ambiente}
                </option>
              ))}
            </select>
            {errores.ambiente && <span className="error-text">{errores.ambiente}</span>}
          </div>
          <div className="form-row">
            <label>Estado Físico *</label>
            <select name="estado_fisico" value={form.estado_fisico} onChange={handleChange}>
              {ESTADOS_FISICOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {errores.estado_fisico && <span className="error-text">{errores.estado_fisico}</span>}
          </div>
          <div className="form-row">
            <label>Comentarios</label>
            <textarea name="comentarios" value={form.comentarios} onChange={handleChange} rows="3" />
          </div>
        </div>
        <div className="form-row">
          <button type="submit" className="btn-verde">Registrar Inventario</button>
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



