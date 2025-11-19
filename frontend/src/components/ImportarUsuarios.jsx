import { useState } from 'react'
import { FiFile, FiDownload, FiAlertCircle } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { parseApiResponse, buildErrorMessage } from '../utils/api'

export default function ImportarUsuarios({ onImportComplete }) {
  const [archivo, setArchivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
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
      const res = await fetch('/api/import/usuarios', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      const data = await parseApiResponse(res, 'Error al importar usuarios')
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
    const plantilla = {
      'nombre_usuario': [],
      'cedula': [],
      'telefono': [],
      'correo': [],
      'area': [],
      'rol': [],
      'estado': []
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
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios')
    
    // Generar archivo Excel
    XLSX.writeFile(wb, 'plantilla_usuarios.xlsx')
  }

  return (
    <div>
      <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Sube un archivo Excel con los usuarios a importar. El archivo debe contener las columnas requeridas.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={descargarPlantilla}
          style={{
            padding: '0.5rem 1rem',
            background: '#e3f2fd',
            color: '#1976d2',
            border: '1px solid #1976d2',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 500
          }}
        >
        <FiDownload size={14} />
        Descargar Plantilla (Excel)
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#1a2a3a', fontSize: '0.9rem' }}>
            Seleccionar archivo Excel
          </label>
          <div style={{
            border: '2px dashed #b2dfdb',
            borderRadius: '8px',
            padding: '1rem',
            textAlign: 'center',
            background: archivo ? '#e8f5e9' : '#f5f5f5',
            transition: 'all 0.2s'
          }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="file-input-usuarios"
            />
            <label
              htmlFor="file-input-usuarios"
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FiFile size={28} color="#40c057" />
              {archivo ? (
                <span style={{ color: '#40c057', fontWeight: 600, fontSize: '0.9rem' }}>{archivo.name}</span>
              ) : (
                <span style={{ color: '#666', fontSize: '0.9rem' }}>Haz clic para seleccionar un archivo</span>
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

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
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
              fontSize: '0.95rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {loading ? 'Importando...' : 'Importar Usuarios'}
            {loading && <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>}
          </button>
        </div>
      </form>

      {resultado && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1a2a3a', fontWeight: 600 }}>Resultados de la Importación</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ textAlign: 'center', padding: '0.75rem', background: '#fff', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a2a3a' }}>{resultado.total}</div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>Total</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0.75rem', background: '#d1fae5', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{resultado.exitosos}</div>
              <div style={{ color: '#059669', fontSize: '0.85rem' }}>Exitosos</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0.75rem', background: '#fee2e2', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{resultado.fallidos}</div>
              <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>Fallidos</div>
            </div>
          </div>

          {(resultado.correosEnviados > 0 || resultado.correosFallidos > 0) && (
            <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#e0f2fe', borderRadius: '6px', border: '1px solid #0ea5e9' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.5rem' }}>📧 Envío de Correos:</div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                {resultado.correosEnviados > 0 && (
                  <span style={{ color: '#059669' }}>
                    ✓ {resultado.correosEnviados} correo(s) enviado(s) con contraseñas
                  </span>
                )}
                {resultado.correosFallidos > 0 && (
                  <span style={{ color: '#dc2626' }}>
                    ✗ {resultado.correosFallidos} correo(s) no pudo(eron) enviarse
                  </span>
                )}
              </div>
            </div>
          )}

          {resultado.errores && resultado.errores.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#1a2a3a', fontWeight: 600 }}>Errores:</h5>
              <div style={{ maxHeight: '150px', overflowY: 'auto', background: '#fff', borderRadius: '6px', padding: '0.5rem' }}>
                {resultado.errores.map((error, idx) => (
                  <div key={idx} style={{
                    padding: '0.5rem',
                    marginBottom: '0.25rem',
                    background: '#fee2e2',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    lineHeight: '1.4'
                  }}>
                    <strong>Fila {error.fila}</strong> ({error.cedula || 'N/A'}): {error.error}
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

