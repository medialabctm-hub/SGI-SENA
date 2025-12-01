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
    r_centro: '',
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
  })

  const [errores, setErrores] = useState({})
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  const [ambientes, setAmbientes] = useState([])

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
    if (!form.r_centro) errs.r_centro = 'R Centro es obligatorio'
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
        // Nuevos campos
        r_centro: form.r_centro,
        placa: form.placa || null,
        atributos: form.atributos || null,
        valor_ingreso: form.valor_ingreso || null
      }
      const resp = await fetch('/api/equipos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      const data = await parseApiResponse(resp, 'No se pudo registrar el equipo')
      setToast({
        message: `Equipo registrado correctamente (ID interno: ${data.id})`,
        type: 'success'
      })
      setForm({
        r_centro: '', modelo: '', consecutivo: '', descripcion: '', tipo: '', placa: '', atributos: '', fecha_adquisicion: '', valor_ingreso: '', ambiente: '', estado_fisico: 'Bueno'
      })
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'Error al registrar equipo'),
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
          
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--success-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiPlus size={24} color="#fff" />
                </div>
                <div>
                  <h2 className="card-title">Registro de Equipos</h2>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '14px' }}>
                    Registra equipos individualmente o importa múltiples equipos desde Excel
                  </p>
                </div>
              </div>
            </div>

            <div className="card-body">
              {/* Pestañas */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid var(--neutral-200)', paddingBottom: '0' }}>
                <button
                  onClick={() => setActiveTab('registrar')}
                  className={`btn btn-ghost ${activeTab === 'registrar' ? '' : ''}`}
                  style={{ 
                    borderBottom: activeTab === 'registrar' ? '3px solid var(--success-800)' : '3px solid transparent',
                    borderRadius: '0',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px',
                    color: activeTab === 'registrar' ? 'var(--success-800)' : 'var(--neutral-600)',
                    fontWeight: activeTab === 'registrar' ? '600' : '400'
                  }}
                >
                  <FiPlus size={18} />
                  Registrar Equipo
                </button>
                <button
                  onClick={() => setActiveTab('importar')}
                  className={`btn btn-ghost ${activeTab === 'importar' ? '' : ''}`}
                  style={{ 
                    borderBottom: activeTab === 'importar' ? '3px solid var(--success-800)' : '3px solid transparent',
                    borderRadius: '0',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px',
                    color: activeTab === 'importar' ? 'var(--success-800)' : 'var(--neutral-600)',
                    fontWeight: activeTab === 'importar' ? '600' : '400'
                  }}
                >
                  <FiUpload size={18} />
                  Importar Equipos
                </button>
              </div>

              {activeTab === 'registrar' ? (
                <form className="form" onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">R Centro *</label>
                      <input 
                        type="text"
                        name="r_centro" 
                        className="form-input"
                        value={form.r_centro} 
                        onChange={handleChange} 
                      />
                      {errores.r_centro && <div className="form-error">{errores.r_centro}</div>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Modelo *</label>
                      <input 
                        type="text"
                        name="modelo" 
                        className="form-input"
                        value={form.modelo} 
                        onChange={handleChange} 
                      />
                      {errores.modelo && <div className="form-error">{errores.modelo}</div>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Consecutivo *</label>
                      <input 
                        type="text"
                        name="consecutivo" 
                        className="form-input"
                        value={form.consecutivo} 
                        onChange={handleChange} 
                      />
                      {errores.consecutivo && <div className="form-error">{errores.consecutivo}</div>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Descripción</label>
                      <textarea 
                        name="descripcion" 
                        className="form-textarea"
                        value={form.descripcion} 
                        onChange={handleChange} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipo *</label>
                      <input 
                        type="text"
                        name="tipo" 
                        className="form-input"
                        value={form.tipo} 
                        onChange={handleChange} 
                        placeholder="Ej: Computador de Escritorio, Portátil, Monitor..." 
                      />
                      {errores.tipo && <div className="form-error">{errores.tipo}</div>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Placa</label>
                      <input 
                        type="text"
                        name="placa" 
                        className="form-input"
                        value={form.placa} 
                        onChange={handleChange} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Atributos</label>
                      <textarea 
                        name="atributos" 
                        className="form-textarea"
                        value={form.atributos} 
                        onChange={handleChange} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fecha Adquisición *</label>
                      <input 
                        type="date"
                        name="fecha_adquisicion" 
                        className="form-input"
                        value={form.fecha_adquisicion} 
                        onChange={handleChange} 
                      />
                      {errores.fecha_adquisicion && <div className="form-error">{errores.fecha_adquisicion}</div>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valor Ingreso</label>
                      <input 
                        type="number"
                        name="valor_ingreso" 
                        className="form-input"
                        value={form.valor_ingreso} 
                        onChange={handleChange} 
                        min="0" 
                        step="0.01" 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ambiente *</label>
                      <select 
                        name="ambiente" 
                        className="form-select"
                        value={form.ambiente} 
                        onChange={handleChange}
                      >
                        <option value="">Seleccionar ambiente</option>
                        {ambientes.map(amb => (
                          <option key={amb.id_ambiente} value={amb.id_ambiente}>
                            {amb.codigo_ambiente} - {amb.nombre_ambiente}
                          </option>
                        ))}
                      </select>
                      {errores.ambiente && <div className="form-error">{errores.ambiente}</div>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Estado Físico *</label>
                      <select 
                        name="estado_fisico" 
                        className="form-select"
                        value={form.estado_fisico} 
                        onChange={handleChange}
                      >
                        {ESTADOS_FISICOS.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                      {errores.estado_fisico && <div className="form-error">{errores.estado_fisico}</div>}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary btn-md btn-full-width">Registrar Equipo</button>
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
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}



