import { useState } from 'react'
import { FiFile, FiDownload, FiAlertCircle } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/importarUsuarios.css'

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
      <p className="importar-usuarios-description">
        Sube un archivo Excel con los usuarios a importar. El archivo debe contener las columnas requeridas.
      </p>

      <div className="importar-usuarios-download-section">
        <button
          onClick={descargarPlantilla}
          className="importar-usuarios-download-btn"
        >
        <FiDownload size={14} />
        Descargar Plantilla (Excel)
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="importar-usuarios-file-section">
          <label className="importar-usuarios-file-label">
            Seleccionar archivo Excel
          </label>
          <div className={`importar-usuarios-file-dropzone ${archivo ? 'has-file' : ''}`}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="importar-usuarios-file-input"
              id="file-input-usuarios"
            />
            <label
              htmlFor="file-input-usuarios"
              className="importar-usuarios-file-label-inner"
            >
              <FiFile size={28} color="var(--success-800)" />
              {archivo ? (
                <span className="importar-usuarios-file-name">{archivo.name}</span>
              ) : (
                <span className="importar-usuarios-file-placeholder">Haz clic para seleccionar un archivo</span>
              )}
            </label>
          </div>
        </div>

        {error && (
          <div className="importar-usuarios-error">
            <FiAlertCircle size={20} />
            {error}
          </div>
        )}

        <div className="importar-usuarios-submit-section">
          <button
            type="submit"
            disabled={!archivo || loading}
            className="importar-usuarios-submit-btn"
          >
            {loading ? 'Importando...' : 'Importar Usuarios'}
            {loading && <div className="loading-spinner importar-usuarios-spinner"></div>}
          </button>
        </div>
      </form>

      {resultado && (
        <div className="importar-usuarios-resultados">
          <h4 className="importar-usuarios-resultados-title">Resultados de la Importación</h4>
          
          <div className="importar-usuarios-stats">
            <div className="importar-usuarios-stat">
              <div className="importar-usuarios-stat-value">{resultado.total}</div>
              <div className="importar-usuarios-stat-label">Total</div>
            </div>
            <div className="importar-usuarios-stat success">
              <div className="importar-usuarios-stat-value success">{resultado.exitosos}</div>
              <div className="importar-usuarios-stat-label success">Exitosos</div>
            </div>
            <div className="importar-usuarios-stat error">
              <div className="importar-usuarios-stat-value error">{resultado.fallidos}</div>
              <div className="importar-usuarios-stat-label error">Fallidos</div>
            </div>
          </div>

          {(resultado.correosEnviados > 0 || resultado.correosFallidos > 0) && (
            <div className="importar-usuarios-emails">
              <div className="importar-usuarios-emails-title">📧 Envío de Correos:</div>
              <div className="importar-usuarios-emails-list">
                {resultado.correosEnviados > 0 && (
                  <span className="importar-usuarios-emails-success">
                    ✓ {resultado.correosEnviados} correo(s) enviado(s) con contraseñas
                  </span>
                )}
                {resultado.correosFallidos > 0 && (
                  <span className="importar-usuarios-emails-error">
                    ✗ {resultado.correosFallidos} correo(s) no pudo(eron) enviarse
                  </span>
                )}
              </div>
            </div>
          )}

          {resultado.errores && resultado.errores.length > 0 && (
            <div className="importar-usuarios-errores">
              <h5 className="importar-usuarios-errores-title">Errores:</h5>
              <div className="importar-usuarios-errores-list">
                {resultado.errores.map((error, idx) => (
                  <div key={idx} className="importar-usuarios-error-item">
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

