
import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ImportarEquipos from '../components/ImportarEquipos'
import { FiPlus, FiUpload } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/equipos.css'
import '../styles/sidebar.css'

const ESTADOS_FISICOS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado']
const TIPOS = ['Computador de Escritorio', 'Portátil', 'Monitor', 'Mouse', 'Teclado', 'Impresora', 'Proyector', 'Router']

export default function Equipos() {
  const [activeTab, setActiveTab] = useState('registrar') // 'registrar' o 'importar'
  const [form, setForm] = useState({
    codigo_inventario: '',
    tipo: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    descripcion: '',
    fecha_adquisicion: '',
    costo: '',
    vida_util_meses: '',
    estado_fisico: 'Bueno',
    ambiente: '',
    incluye_mouse: false,
    incluye_teclado: false,
    incluye_monitor: false,
    incluye_torre: false,
    specs_completas: '',
  })

  const [errores, setErrores] = useState({})
  const [ambientes, setAmbientes] = useState([])
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    setAmbientes([])
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
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
    let errs = {}
    if (!form.codigo_inventario) errs.codigo_inventario = 'El código de inventario es obligatorio'
    if (!form.tipo) errs.tipo = 'El tipo es obligatorio'
    if (!form.marca) errs.marca = 'La marca es obligatoria'
    if (!form.modelo) errs.modelo = 'El modelo es obligatorio'
    if (!form.numero_serie) errs.numero_serie = 'El número de serie es obligatorio'
    if (!form.estado_fisico) errs.estado_fisico = 'El estado físico es obligatorio'
    if (!form.fecha_adquisicion) errs.fecha_adquisicion = 'La fecha de adquisición es obligatoria'
    if (!form.ambiente) errs.ambiente = 'El ambiente es obligatorio'

    setErrores(errs)
    setToast(null)
    if (Object.keys(errs).length > 0) return
    try {
      const token = localStorage.getItem('token')
      const resp = await fetch('/api/equipos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          codigo_inventario: form.codigo_inventario
        })
      })
      const data = await parseApiResponse(resp, 'No se pudo registrar el equipo')
      setToast({
        message: `Equipo registrado correctamente (ID interno: ${data.id})`,
        type: 'success'
      })
      setForm({
        codigo_inventario: '', tipo: '', marca: '', modelo: '', numero_serie: '', descripcion: '', fecha_adquisicion: '', costo: '', vida_util_meses: '', estado_fisico: 'Bueno', ambiente: '', incluye_mouse: false, incluye_teclado: false, incluye_monitor: false, incluye_torre: false, specs_completas: ''
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
          
          <div className="form-equipos form-modern">
            <div className="form-header">
              <div className="form-icon-wrapper form-icon-wrapper-green">
                <FiPlus size={28} color="#fff" />
              </div>
              <div className="form-header-content">
                <h2 className="form-header-title">Registro de Equipos</h2>
                <p className="form-header-subtitle">
                  Registra equipos individualmente o importa múltiples equipos desde Excel
                </p>
              </div>
            </div>

            {/* Pestañas */}
            <div className="form-tabs">
              <button
                onClick={() => setActiveTab('registrar')}
                className={`form-tab ${activeTab === 'registrar' ? 'active' : ''}`}
              >
                <FiPlus size={18} />
                Registrar Equipo
              </button>
              <button
                onClick={() => setActiveTab('importar')}
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
            <label>Código de Inventario *</label>
            <input name="codigo_inventario" value={form.codigo_inventario} onChange={handleChange} />
            {errores.codigo_inventario && <span className="error-text">{errores.codigo_inventario}</span>}
          </div>
          <div className="form-row">
            <label>Ambiente *</label>
            <input name="ambiente" value={form.ambiente} onChange={handleChange} placeholder="ID, código o nombre del ambiente" />
            {errores.ambiente && <span className="error-text">{errores.ambiente}</span>}
          </div>
          <div className="form-row">
            <label>Tipo *</label>
            <select name="tipo" value={form.tipo} onChange={handleChange}>
              <option value="">Seleccione...</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {errores.tipo && <span className="error-text">{errores.tipo}</span>}
          </div>
          <div className="form-row">
            <label>Marca *</label>
            <input name="marca" value={form.marca} onChange={handleChange} />
            {errores.marca && <span className="error-text">{errores.marca}</span>}
          </div>
          <div className="form-row">
            <label>Modelo *</label>
            <input name="modelo" value={form.modelo} onChange={handleChange} />
            {errores.modelo && <span className="error-text">{errores.modelo}</span>}
          </div>
          <div className="form-row">
            <label>Número de Serie *</label>
            <input name="numero_serie" value={form.numero_serie} onChange={handleChange} />
            {errores.numero_serie && <span className="error-text">{errores.numero_serie}</span>}
          </div>
          <div className="form-row">
            <label>Fecha de Adquisición *</label>
            <input type="date" name="fecha_adquisicion" value={form.fecha_adquisicion} onChange={handleChange} />
            {errores.fecha_adquisicion && <span className="error-text">{errores.fecha_adquisicion}</span>}
          </div>
          <div className="form-row">
            <label>Costo</label>
            <input type="number" name="costo" value={form.costo} onChange={handleChange} min="0" step="0.01" />
          </div>
          <div className="form-row">
            <label>Vida útil (meses)</label>
            <input type="number" name="vida_util_meses" value={form.vida_util_meses} onChange={handleChange} min="0" />
          </div>
          <div className="form-row">
            <label>Estado Físico *</label>
            <select name="estado_fisico" value={form.estado_fisico} onChange={handleChange}>
              {ESTADOS_FISICOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {errores.estado_fisico && <span className="error-text">{errores.estado_fisico}</span>}
          </div>
        </div>
        <div className="form-row">
          <label>Descripción</label>
          <textarea name="descripcion" value={form.descripcion} onChange={handleChange} />
        </div>
        <div className="form-row form-row-checkboxes">
          <label><input type="checkbox" name="incluye_mouse" checked={form.incluye_mouse} onChange={handleChange} /> Incluye Mouse</label>
          <label><input type="checkbox" name="incluye_teclado" checked={form.incluye_teclado} onChange={handleChange} /> Incluye Teclado</label>
          <label><input type="checkbox" name="incluye_monitor" checked={form.incluye_monitor} onChange={handleChange} /> Incluye Monitor</label>
          <label><input type="checkbox" name="incluye_torre" checked={form.incluye_torre} onChange={handleChange} /> Incluye Torre</label>
        </div>
        <div className="form-row">
          <label>Especificaciones completas</label>
          <textarea name="specs_completas" value={form.specs_completas} onChange={handleChange} />
        </div>
        <div className="form-row">
          <button type="submit" className="btn-verde">Registrar Equipo</button>
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
        </main>
      </div>
    </div>
  )
}