import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiDownload, FiUpload, FiEdit3, FiTrash2 } from 'react-icons/fi'
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
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedAprendiz, setSelectedAprendiz] = useState(null)
  const [editForm, setEditForm] = useState({ nombre: '', documento: '', ficha: '', jornada: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

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

  const openEditModal = (aprendiz) => {
    setSelectedAprendiz(aprendiz)
    setEditForm({
      nombre: aprendiz.nombre || '',
      documento: aprendiz.documento || '',
      ficha: aprendiz.ficha || '',
      jornada: aprendiz.jornada || ''
    })
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setSelectedAprendiz(null)
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditSubmit = async (event) => {
    event.preventDefault()
    if (!selectedAprendiz) {
      return
    }
    setSavingEdit(true)
    try {
      const payload = {
        ...editForm,
        ficha: editForm.ficha?.trim() || null,
        nombre: editForm.nombre?.trim(),
        documento: editForm.documento?.trim(),
        jornada: editForm.jornada || null
      }
      const res = await fetch(`/api/aprendices/${selectedAprendiz.id_aprendiz}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      })
      await parseApiResponse(res, 'No se pudo actualizar el aprendiz')
      setToast({ message: 'Aprendiz actualizado correctamente', type: 'success' })
      closeEditModal()
      fetchAprendices()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo actualizar el aprendiz'), type: 'error' })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (aprendiz) => {
    if (!canImport) {
      return
    }
    const confirmed = window.confirm(`¿Seguro que deseas eliminar a ${aprendiz.nombre}?`)
    if (!confirmed) {
      return
    }
    setDeletingId(aprendiz.id_aprendiz)
    try {
      const res = await fetch(`/api/aprendices/${aprendiz.id_aprendiz}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      await parseApiResponse(res, 'No se pudo eliminar el aprendiz')
      setToast({ message: 'Aprendiz eliminado correctamente', type: 'success' })
      fetchAprendices()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo eliminar el aprendiz'), type: 'error' })
    } finally {
      setDeletingId(null)
    }
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
                <p className="users-toolbar-description">
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
                        {canImport && <th>Acciones</th>}
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
                          {canImport && (
                            <td>
                              <div className="users-actions users-actions-compact">
                                <button
                                  className="btn btn-edit"
                                  onClick={() => openEditModal(aprendiz)}
                                >
                                  <FiEdit3 size={16} />
                                  Editar
                                </button>
                                <button
                                  className="btn btn-delete"
                                  disabled={deletingId === aprendiz.id_aprendiz}
                                  onClick={() => handleDelete(aprendiz)}
                                >
                                  <FiTrash2 size={16} />
                                  {deletingId === aprendiz.id_aprendiz ? 'Eliminando...' : 'Eliminar'}
                                </button>
                              </div>
                            </td>
                          )}
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

      {showEditModal && selectedAprendiz && (
        <div className="modal-overlay">
          <div className="modal-sheet form-modal">
            <div className="modal-header">
              <h3>Editar Aprendiz</h3>
              <button className="btn" onClick={closeEditModal}>
                Cerrar
              </button>
            </div>
            <form className="modal-form" onSubmit={handleEditSubmit}>
              <label>
                Nombre completo
                <input
                  type="text"
                  name="nombre"
                  value={editForm.nombre}
                  onChange={handleEditChange}
                  required
                />
              </label>
              <label>
                Documento
                <input
                  type="text"
                  name="documento"
                  value={editForm.documento}
                  onChange={handleEditChange}
                  required
                />
              </label>
              <label>
                Ficha (opcional)
                <input
                  type="text"
                  name="ficha"
                  value={editForm.ficha}
                  onChange={handleEditChange}
                />
              </label>
              <label>
                Jornada
                <select name="jornada" value={editForm.jornada} onChange={handleEditChange}>
                  <option value="">Sin definir</option>
                  <option value="Mañana">Mañana</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Noche">Noche</option>
                </select>
              </label>
              <div className="modal-form-actions">
                <button type="button" className="btn" onClick={closeEditModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-verde" disabled={savingEdit}>
                  {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
