import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiDownload, FiUpload } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ImportarAprendices from '../components/ImportarAprendices'
import { parseApiResponse, buildErrorMessage, getAuthHeaders } from '../utils/api'
import '../styles/usuarios.css'

export default function Aprendices() {
  const [currentUser, setCurrentUser] = useState(null)
  const [aprendices, setAprendices] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [query, setQuery] = useState('')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user')
      if (stored) {
        setCurrentUser(JSON.parse(stored))
      }
    } catch (err) {
      console.warn('No se pudo leer el usuario de la sesión', err)
    }
  }, [])

  const canView = ['Administrador', 'Instructor'].includes(currentUser?.nombre_rol || '')
  const canImport = currentUser?.nombre_rol === 'Administrador'

  const fetchAprendices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/aprendices', {
        headers: getAuthHeaders()
      })
      const data = await parseApiResponse(res, 'No se pudo obtener la lista de aprendices')
      setAprendices(Array.isArray(data.aprendices) ? data.aprendices : [])
    } catch (err) {
      setAprendices([])
      setToast({
        message: buildErrorMessage(err, 'No se pudo obtener la lista de aprendices'),
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canView) {
      fetchAprendices()
    }
  }, [canView, fetchAprendices])

  const filteredAprendices = useMemo(() => {
    if (!query.trim()) {
      return aprendices
    }
    const q = query.toLowerCase()
    return aprendices.filter((item) => {
      return (
        item.nombre?.toLowerCase().includes(q) ||
        item.documento?.toLowerCase().includes(q) ||
        item.ficha?.toLowerCase().includes(q) ||
        item.jornada?.toLowerCase().includes(q)
      )
    })
  }, [aprendices, query])

  const formatDate = (value) => {
    if (!value) return '-'
    const fecha = new Date(value)
    if (Number.isNaN(fecha.getTime())) {
      return value
    }
    return fecha.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleExportExcel = () => {
    if (aprendices.length === 0) {
      setToast({ message: 'No hay aprendices para exportar', type: 'info' })
      return
    }

    const headers = ['Nombre', 'Documento', 'Ficha', 'Jornada', 'Registrado']
    const rows = aprendices.map((item) => [
      item.nombre || '-',
      item.documento || '-',
      item.ficha || '-',
      item.jornada || '-',
      formatDate(item.fecha_creacion)
    ])

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map(() => ({ wch: 20 }))

    XLSX.utils.book_append_sheet(wb, ws, 'Aprendices')
    XLSX.writeFile(wb, `aprendices_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={currentUser} />
        <main className="dashboard-main">
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}

          <div className="users-panel">
            <div className="users-toolbar">
              <div>
                <h2>Aprendices</h2>
                <p style={{ margin: '0.25rem 0 0', color: '#4b5563', maxWidth: '620px' }}>
                  Registra las fichas, documentos y jornadas para llevar el control académico de cada aprendiz.
                </p>
              </div>
              {canView && (
                <div className="users-toolbar-actions">
                  <input
                    className="search-input"
                    placeholder="Buscar por nombre, Documento, ficha o jornada..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button className="btn-import-users" onClick={handleExportExcel}>
                    <FiDownload size={16} />
                    Exportar a Excel
                  </button>
                  {canImport && (
                    <button className="btn-import-users" onClick={() => setShowImport(true)}>
                      <FiUpload size={16} />
                      Importar Aprendices
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="users-content">
              {!canView ? (
                <div className="users-empty">
                  <div>
                    <strong>No tienes permiso para ver aprendices</strong>
                    <div className="users-empty-message">
                      Solo administradores o instructores pueden acceder a esta sección.
                    </div>
                  </div>
                </div>
              ) : loading ? (
                <div className="users-empty">
                  <div>
                    <strong>Cargando aprendices...</strong>
                  </div>
                </div>
              ) : filteredAprendices.length === 0 ? (
                <div className="users-empty">
                  <div>
                    <strong>No hay aprendices registrados</strong>
                    <div className="users-empty-message">
                      Importa un archivo Excel o ajusta el filtro de búsqueda.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="users-table-wrapper">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Documento</th>
                        <th>Ficha</th>
                        <th>Jornada</th>
                        <th>Registrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAprendices.map((aprendiz) => (
                        <tr key={aprendiz.id_aprendiz}>
                          <td>{aprendiz.nombre}</td>
                          <td>{aprendiz.documento}</td>
                          <td>{aprendiz.ficha || '-'}</td>
                          <td>{aprendiz.jornada || '-'}</td>
                          <td>{formatDate(aprendiz.fecha_creacion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {showImport && (
        <div className="modal-overlay">
          <div className="modal-sheet form-modal-large">
            <div className="modal-header">
              <h3>Importar Aprendices</h3>
              <button className="btn" onClick={() => setShowImport(false)}>
                Cerrar
              </button>
            </div>
            <ImportarAprendices
              onImportComplete={(resultados) => {
                const type = resultados.fallidos === 0 ? 'success' : 'warning'
                setToast({
                  message: `Importación completada: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`,
                  type
                })
                if (resultados.exitosos > 0) {
                  fetchAprendices()
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
