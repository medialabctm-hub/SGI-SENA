import { useState, useEffect } from 'react'
import { FiUpload, FiFile, FiDownload, FiUser, FiSave, FiAlertCircle } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { parseApiResponse, buildErrorMessage } from '../utils/api'

export default function ImportarEquipos({ onImportComplete }) {
  const [archivo, setArchivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [cuentadantePrincipal, setCuentadantePrincipal] = useState('')
  const [cuentadanteActual, setCuentadanteActual] = useState(null)
  const [loadingCuentadante, setLoadingCuentadante] = useState(false)
  const [savingCuentadante, setSavingCuentadante] = useState(false)
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
    if (user?.nombre_rol === 'Administrador') {
      fetchCuentadantePrincipal()
    }
  }, [user])

  const fetchCuentadantePrincipal = async () => {
    try {
      setLoadingCuentadante(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/cuentadante-principal', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'Error al obtener cuentadante principal')
      setCuentadanteActual(data.cuentadante_principal || '')
      // Mostrar la cédula si está disponible, sino el nombre
      setCuentadantePrincipal(data.cuentadante_cedula || data.cuentadante_principal || '')
    } catch (err) {
      console.error('Error al obtener cuentadante principal:', err)
    } finally {
      setLoadingCuentadante(false)
    }
  }

  const handleSaveCuentadante = async () => {
    if (!cuentadantePrincipal.trim()) {
      setError('La cédula del cuentadante es obligatoria')
      return
    }

    try {
      setSavingCuentadante(true)
      setError(null)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/cuentadante-principal', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ cedula: cuentadantePrincipal.trim() })
      })
      const data = await parseApiResponse(res, 'Error al actualizar cuentadante principal')
      setCuentadanteActual(data.cuentadante_principal || '')
      setCuentadantePrincipal(data.cuentadante_cedula || cuentadantePrincipal.trim())
      setError(null)
      // Mostrar mensaje de éxito
      alert(`Cuentadante principal "${data.cuentadante_principal}" actualizado correctamente para ${data.equipos_actualizados} equipo(s)`)
    } catch (err) {
      setError(buildErrorMessage(err, 'Error al guardar el cuentadante principal'))
    } finally {
      setSavingCuentadante(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validar que sea un archivo Excel
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ]
      if (!validTypes.includes(file.type)) {
        setError('Por favor selecciona un archivo Excel (.xlsx o .xls)')
        setArchivo(null)
        return
      }
      setArchivo(file)
      setError(null)
      setResultado(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!archivo) {
      setError('Por favor selecciona un archivo')
      return
    }

    setLoading(true)
    setError(null)
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('archivo', archivo)

      const token = localStorage.getItem('token')
      const res = await fetch('/api/import/equipos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      const data = await parseApiResponse(res, 'Error al importar equipos')
      setResultado(data.resultados)
      
      if (onImportComplete) {
        onImportComplete(data.resultados)
      }
    } catch (err) {
      setError(buildErrorMessage(err, 'Error al importar el archivo'))
    } finally {
      setLoading(false)
    }
  }

  const descargarPlantilla = () => {
    // Crear plantilla Excel básica con los nuevos campos
    const plantilla = {
      'R Centro': [],
      'Modelo': [],
      'Consecutivo': [],
      'Descripcion': [],
      'Descripción Actual': [],
      'Tipo': [],
      'Placa': [],
      'Atributos': [],
      'Fecha Adquisición': [],
      'Valor Ingreso': [],
      'Ambiente': [],
      'Estado Físico': []
    }

    // Crear workbook y worksheet
    const wb = XLSX.utils.book_new()
    
    // Convertir objeto a array de arrays para Excel
    const headers = Object.keys(plantilla)
    const data = [headers] // Primera fila: encabezados
    
    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet(data)
    
    // Establecer ancho de columnas
    const colWidths = headers.map(() => ({ wch: 20 }))
    ws['!cols'] = colWidths
    
    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos')
    
    // Generar archivo Excel
    XLSX.writeFile(wb, 'plantilla_equipos.xlsx')
  }

  return (
    <div style={{
      padding: '1.5rem 0'
    }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#1a2a3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiUpload size={24} />
          Importación Masiva de Equipos
        </h3>
        <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Sube un archivo Excel con los equipos a importar. El archivo debe contener las columnas requeridas.
        </p>
      </div>


      <button
        onClick={descargarPlantilla}
        style={{
          padding: '0.5rem 1rem',
          background: '#e3f2fd',
          color: '#1976d2',
          border: '1px solid #1976d2',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}
      >
        <FiDownload size={16} />
        Descargar Plantilla (Excel)
      </button>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#1a2a3a' }}>
            Seleccionar archivo Excel
          </label>
          <div style={{
            border: '2px dashed #b2dfdb',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center',
            background: archivo ? '#e8f5e9' : '#f5f5f5',
            transition: 'all 0.2s'
          }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="file-input-equipos"
            />
            <label
              htmlFor="file-input-equipos"
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FiFile size={32} color="#40c057" />
              {archivo ? (
                <span style={{ color: '#40c057', fontWeight: 600 }}>{archivo.name}</span>
              ) : (
                <span style={{ color: '#666' }}>Haz clic para seleccionar un archivo</span>
              )}
            </label>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            color: '#dc2626',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <FiAlertCircle size={20} />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!archivo || loading}
          style={{
            padding: '0.75rem 1.5rem',
            background: loading || !archivo ? '#ccc' : '#40c057',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: loading || !archivo ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            margin: '0 auto'
          }}
        >
          {loading ? 'Importando...' : 'Importar Equipos'}
          {loading && <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>}
        </button>
      </form>

      {/* Sección de Cuentadante Principal - Solo para Administradores */}
      {user?.nombre_rol === 'Administrador' && (
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: '#fff3cd',
          borderRadius: '8px',
          border: '1px solid #ffc107'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1a2a3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiUser size={20} />
            Cuentadante Principal del Inventario
          </h4>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
            El cuentadante principal es la persona responsable permanente de todo el inventario. 
            Debe ingresarse después de importar los equipos. Ingrese la <strong>cédula</strong> del cuentadante.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <input
              type="text"
              value={cuentadantePrincipal}
              onChange={(e) => setCuentadantePrincipal(e.target.value)}
              placeholder="Cédula del cuentadante principal"
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '0.95rem'
              }}
              disabled={loadingCuentadante || savingCuentadante}
            />
            <button
              onClick={handleSaveCuentadante}
              disabled={!cuentadantePrincipal.trim() || savingCuentadante || loadingCuentadante}
              style={{
                padding: '0.75rem 1.5rem',
                background: savingCuentadante || !cuentadantePrincipal.trim() ? '#ccc' : '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: savingCuentadante || !cuentadantePrincipal.trim() ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FiSave size={16} />
              {savingCuentadante ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          {cuentadanteActual && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
              Cuentadante actual: <strong>{cuentadanteActual}</strong>
            </p>
          )}
        </div>
      )}

      {resultado && (
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1a2a3a' }}>Resultados de la Importación</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#fff', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1a2a3a' }}>{resultado.total}</div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>Total</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#d1fae5', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>{resultado.exitosos}</div>
              <div style={{ color: '#059669', fontSize: '0.9rem' }}>Exitosos</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#fee2e2', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{resultado.fallidos}</div>
              <div style={{ color: '#dc2626', fontSize: '0.9rem' }}>Fallidos</div>
            </div>
          </div>

          {resultado.errores && resultado.errores.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#1a2a3a' }}>Errores:</h5>
              <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#fff', borderRadius: '6px', padding: '0.5rem' }}>
                {resultado.errores.map((error, idx) => (
                  <div key={idx} style={{
                    padding: '0.5rem',
                    marginBottom: '0.25rem',
                    background: '#fee2e2',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}>
                    <strong>Fila {error.fila}</strong> ({error.codigo || error.cedula || 'N/A'}): {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

