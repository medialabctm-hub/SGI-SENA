import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import CustomSelect from '../components/CustomSelect'
import { FiImage, FiSearch, FiCheck, FiDownload } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/pages/equipos.css'

export default function DocumentoEquipos() {
  const [user, setUser] = useState(null)
  const [toast, setToast] = useState(null)

  const [modo, setModo] = useState('ambiente')
  const [ambientes, setAmbientes] = useState([])
  const [idAmbiente, setIdAmbiente] = useState('')
  const [documentoCuentadante, setDocumentoCuentadante] = useState('')
  const [cuentadanteEncontrado, setCuentadanteEncontrado] = useState(null)
  const [buscandoCuentadante, setBuscandoCuentadante] = useState(false)
  const [generando, setGenerando] = useState(false)

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
    async function fetchAmbientes() {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/ambientes/activos', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await parseApiResponse(res)
        setAmbientes(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error al obtener ambientes:', err)
        setAmbientes([])
      }
    }

    fetchAmbientes()
  }, [])

  const isAdmin = user?.nombre_rol === 'Administrador'

  async function buscarCuentadante() {
    if (!documentoCuentadante.trim()) {
      setToast({ message: 'Ingresa un número de documento', type: 'error' })
      return
    }

    setBuscandoCuentadante(true)
    setCuentadanteEncontrado(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/equipos/cuentadantes/buscar/${encodeURIComponent(documentoCuentadante.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'Cuentadante no encontrado')
      setCuentadanteEncontrado(data.cuentadante)
      setToast({ message: 'Cuentadante encontrado correctamente', type: 'success' })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al buscar cuentadante'), type: 'error' })
      setCuentadanteEncontrado(null)
    } finally {
      setBuscandoCuentadante(false)
    }
  }

  async function generarDocumento() {
    setGenerando(true)
    setToast(null)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      params.append('modo', modo)

      if (modo === 'ambiente') {
        params.append('id_ambiente', idAmbiente)
      } else if (isAdmin) {
        params.append('id_cuentadante', cuentadanteEncontrado.id_usuario)
      }

      const res = await fetch(`/api/reportes/equipos/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al generar el documento de equipos')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Documento_Equipos_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setToast({ message: 'Documento generado y descargado correctamente', type: 'success' })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al generar el documento de equipos'), type: 'error' })
    } finally {
      setGenerando(false)
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
              <div className="form-icon-wrapper form-icon-wrapper-blue">
                <FiImage size={28} color="#fff" />
              </div>
              <div className="form-header-content">
                <h2 className="form-header-title">Documento de Equipos</h2>
                <p className="form-header-subtitle">
                  Genera un PDF con placa, nombre, descripción y fotos de los equipos, filtrado por cuentadante o por ambiente
                </p>
              </div>
            </div>

            <div className="form-divider"></div>

            <div className="form-section">
              <h3 className="form-section-title">Filtro</h3>

              <div className="form-group">
                <label>Filtrar por</label>
                <CustomSelect
                  name="modo_documento_equipos"
                  value={modo}
                  onChange={(e) => {
                    setModo(e.target.value)
                    setDocumentoCuentadante('')
                    setCuentadanteEncontrado(null)
                    setIdAmbiente('')
                  }}
                  options={[
                    { value: 'ambiente', label: 'Ambiente (salón)' },
                    { value: 'cuentadante', label: 'Cuentadante' }
                  ]}
                  placeholder="Selecciona un filtro"
                />
              </div>

              {modo === 'ambiente' ? (
                <div className="form-group">
                  <label>Ambiente</label>
                  <CustomSelect
                    name="id_ambiente_documento_equipos"
                    value={idAmbiente}
                    onChange={(e) => setIdAmbiente(e.target.value)}
                    options={ambientes.map(amb => ({
                      value: amb.id_ambiente.toString(),
                      label: `${amb.codigo_ambiente} - ${amb.nombre_ambiente}`
                    }))}
                    placeholder="Selecciona un ambiente"
                  />
                </div>
              ) : isAdmin ? (
                <div className="form-group">
                  <label>Documento del cuentadante</label>
                  <div className="search-equipo-wrapper">
                    <input
                      type="text"
                      value={documentoCuentadante}
                      onChange={(e) => setDocumentoCuentadante(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          buscarCuentadante()
                        }
                      }}
                      placeholder="Ingresa el número de documento del cuentadante"
                      className="search-equipo-input"
                    />
                    <button
                      type="button"
                      onClick={buscarCuentadante}
                      disabled={buscandoCuentadante || !documentoCuentadante.trim()}
                      className="btn-search-equipo"
                    >
                      {buscandoCuentadante ? 'Buscando...' : (
                        <>
                          <FiSearch size={16} />
                          Buscar
                        </>
                      )}
                    </button>
                  </div>

                  {cuentadanteEncontrado && (
                    <div className="equipo-found-card">
                      <div className="equipo-found-header">
                        <FiCheck size={20} color="#43a047" />
                        <span>Cuentadante encontrado</span>
                      </div>
                      <div className="equipo-found-info">
                        <div><strong>Nombre:</strong> {cuentadanteEncontrado.nombre_usuario}</div>
                        <div><strong>Documento:</strong> {cuentadanteEncontrado.cedula}</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="form-help-text">
                  Se generará el documento del inventario de equipos a tu cargo.
                </p>
              )}
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Información incluida en el PDF</h3>
              <ul>
                <li>Placa y nombre del equipo</li>
                <li>Descripción del equipo</li>
                <li>Fotos registradas del equipo (hasta 3 por equipo)</li>
              </ul>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={generarDocumento}
                className="btn-primary btn-modern"
                disabled={
                  generando ||
                  (modo === 'ambiente' && !idAmbiente) ||
                  (modo === 'cuentadante' && isAdmin && !cuentadanteEncontrado)
                }
              >
                {generando ? 'Generando...' : (
                  <>
                    <FiDownload size={16} />
                    Generar y Descargar PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
