
import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import '../styles/equipos.css'

const ESTADOS_FISICOS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado']
const TIPOS = ['Computador de Escritorio', 'Portátil', 'Monitor', 'Mouse', 'Teclado', 'Impresora', 'Proyector', 'Router']

export default function Equipos() {
  const [form, setForm] = useState({
    codigo_equipo: '',
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
  const [mensaje, setMensaje] = useState('')
  const [ambientes, setAmbientes] = useState([])
  const [codigoEquipo, setCodigoEquipo] = useState(null)

  useEffect(() => {
    setAmbientes([])
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
    if (!form.codigo_equipo) errs.codigo_equipo = 'El código de inventario es obligatorio'
    if (!form.tipo) errs.tipo = 'El tipo es obligatorio'
    if (!form.marca) errs.marca = 'La marca es obligatoria'
    if (!form.modelo) errs.modelo = 'El modelo es obligatorio'
    if (!form.numero_serie) errs.numero_serie = 'El número de serie es obligatorio'
    if (!form.estado_fisico) errs.estado_fisico = 'El estado físico es obligatorio'
    if (!form.fecha_adquisicion) errs.fecha_adquisicion = 'La fecha de adquisición es obligatoria'
    if (!form.ambiente) errs.ambiente = 'El ambiente es obligatorio'

    setErrores(errs)
    setMensaje('')
    setCodigoEquipo(null)
    if (Object.keys(errs).length > 0) return
    try {
      const resp = await fetch('/api/equipos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await resp.json()
      if (resp.ok) {
        setMensaje('Equipo registrado correctamente')
        setCodigoEquipo(data.id)
        setForm({
          codigo_equipo: '', tipo: '', marca: '', modelo: '', numero_serie: '', descripcion: '', fecha_adquisicion: '', costo: '', vida_util_meses: '', estado_fisico: 'Bueno', ambiente: '', incluye_mouse: false, incluye_teclado: false, incluye_monitor: false, incluye_torre: false, specs_completas: ''
        })

      } else {
        setMensaje(data.error || 'Error al registrar equipo')
      }
    } catch (err) {
      setMensaje('Error de conexión con el servidor')
    }
  }

  return (
    <div className="page simple-page">
      <Header className="equipos-header" />
      <h2 style={{textAlign: 'center', marginTop: '1.5rem'}}>Registrar Equipo</h2>
      <form className="form-equipos" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-row">
            <label>Código de Inventario *</label>
            <input name="codigo_equipo" value={form.codigo_equipo} onChange={handleChange} />
            {errores.codigo_equipo && <span className="error-text">{errores.codigo_equipo}</span>}
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
        {mensaje && <div className="success-text">{mensaje}</div>}
        {codigoEquipo && (
          <div className="success-text">Código del equipo: <b>{codigoEquipo}</b></div>
        )}
      </form>
    </div>
  )
}