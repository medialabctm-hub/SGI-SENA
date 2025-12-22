import { useState } from 'react'
import { FiFile, FiDownload, FiAlertCircle } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import '../styles/importarUsuarios.css'

export default function ImportarAprendices({ onImportComplete }) {
  const [archivo, setArchivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) {
      return
    }

    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]

    if (!allowed.includes(file.type)) {
      setError('Selecciona un archivo Excel (.xlsx o .xls)')
      setArchivo(null)
      return
    }

    setArchivo(file)
    setResultado(null)
    setError(null)
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
      const res = await fetch('/api/import/aprendices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      const data = await parseApiResponse(res, 'Error al importar aprendices')
      setResultado(data.resultados)
      setArchivo(null)
      const input = document.getElementById('file-input-aprendices')
      if (input) {
        input.value = ''
      }

      if (typeof onImportComplete === 'function') {
        onImportComplete(data.resultados)
      }
    } catch (err) {
      setError(buildErrorMessage(err, 'No se pudo procesar el archivo'))
    } finally {
      setLoading(false)
    }
  }

  const descargarPlantilla = () => {
    const headers = ['Ficha', 'Nombre', 'Documento', 'Jornada']
    const data = [
      headers,
      ['2478901', 'Juan Pérez', '1090123456', 'Mañana']
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = headers.map(() => ({ wch: 20 }))
    XLSX.utils.book_append_sheet(wb, ws, 'Aprendices')
    XLSX.writeFile(wb, 'plantilla_aprendices.xlsx')
  }

  return (
    <div>
      <p className="importar-usuarios-description">
        Carga un archivo Excel con la ficha, nombre completo, documento y jornada de cada aprendiz. Usa los valores
        «Mañana», «Tarde» o «Noche» para la columna Jornada.
      </p>

      <div className="importar-usuarios-download-section">
        <button onClick={descargarPlantilla} className="importar-usuarios-download-btn">
          <FiDownload size={14} />
          Descargar plantilla (Excel)
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="importar-usuarios-file-section">
          <label className="importar-usuarios-file-label">Seleccionar archivo Excel</label>
          <div className={`importar-usuarios-file-dropzone ${archivo ? 'has-file' : ''}`}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="importar-usuarios-file-input"
              id="file-input-aprendices"
            />
            <label htmlFor="file-input-aprendices" className="importar-usuarios-file-label-inner">
              <FiFile size={28} style={{ color: 'var(--success-800)' }} />
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
          <button type="submit" disabled={!archivo || loading} className="importar-usuarios-submit-btn">
            {loading ? 'Importando...' : 'Importar Aprendices'}
            {loading && <div className="loading-spinner importar-usuarios-spinner"></div>}
          </button>
        </div>
      </form>

      {resultado && (
        <div className="importar-usuarios-resultados">
          <h4 className="importar-usuarios-resultados-title">Resumen de la importación</h4>

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

          {resultado.errores && resultado.errores.length > 0 && (
            <div className="importar-usuarios-errores">
              <h5 className="importar-usuarios-errores-title">Errores</h5>
              <div className="importar-usuarios-errores-list">
                {resultado.errores.map((item, idx) => (
                  <div key={idx} className="importar-usuarios-error-item">
                    <strong>Fila {item.fila}</strong> ({item.documento || 'N/A'}): {item.error}
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
