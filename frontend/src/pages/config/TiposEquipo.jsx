import React, { useState, useEffect } from 'react'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage, getAuthHeaders } from '../../utils/api'
import '../../styles/pages/tiposEquipo.css'

export default function TiposEquipo() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    nombre_categoria: '',
    descripcion: '',
    es_componente: false
  })
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchCategorias()
  }, [])

  async function fetchCategorias() {
    setLoading(true)
    try {
      const res = await fetch('/api/equipos/categorias', {
        headers: getAuthHeaders()
      })
      const data = await parseApiResponse(res, 'No se pudieron cargar las categorías')
      setCategorias(data || [])
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'Error al cargar las categorías'),
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      nombre_categoria: '',
      descripcion: '',
      es_componente: false
    })
    setEditingId(null)
    setShowForm(false)
  }

  function handleEdit(categoria) {
    setForm({
      nombre_categoria: categoria.nombre_categoria,
      descripcion: categoria.descripcion || '',
      es_componente: categoria.es_componente === 1 || categoria.es_componente === true
    })
    setEditingId(categoria.id_categoria)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    if (!form.nombre_categoria.trim()) {
      setToast({
        message: 'El nombre de la categoría es obligatorio',
        type: 'error'
      })
      return
    }

    setSaving(true)
    try {
      const url = editingId
        ? `/api/equipos/categorias/${editingId}`
        : '/api/equipos/categorias'
      
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nombre_categoria: form.nombre_categoria.trim(),
          descripcion: form.descripcion.trim() || null,
          es_componente: form.es_componente
        })
      })

      await parseApiResponse(res, editingId ? 'No se pudo actualizar la categoría' : 'No se pudo crear la categoría')
      
      setToast({
        message: editingId ? 'Categoría actualizada correctamente' : 'Categoría creada correctamente',
        type: 'success'
      })
      
      resetForm()
      fetchCategorias()
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, editingId ? 'Error al actualizar la categoría' : 'Error al crear la categoría'),
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id, nombre) {
    if (!window.confirm(`¿Está seguro de eliminar la categoría "${nombre}"?\n\nEsta acción no se puede deshacer.`)) {
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/equipos/categorias/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      await parseApiResponse(res, 'No se pudo eliminar la categoría')
      
      setToast({
        message: 'Categoría eliminada correctamente',
        type: 'success'
      })
      
      fetchCategorias()
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'Error al eliminar la categoría'),
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const filteredCategorias = categorias.filter(cat =>
    cat.nombre_categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cat.descripcion && cat.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="form-equipos tipos-equipo-container">
        <div className="tipos-equipo-loading">
          <div className="loading-spinner"></div>
          <p>Cargando categorías...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="form-equipos tipos-equipo-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="tipos-equipo-header">
        <div>
          <h3 className="tipos-equipo-title">Tipos de Equipos</h3>
          <p className="tipos-equipo-description">
            Gestiona las categorías disponibles para clasificar los equipos del inventario
          </p>
        </div>
        <button
          className="btn-verde"
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          disabled={saving}
        >
          + Agregar Tipo
        </button>
      </div>

      {showForm && (
        <div className="tipos-equipo-form-card">
          <div className="tipos-equipo-form-header">
            <h4>{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</h4>
            <button
              className="tipos-equipo-close-btn"
              onClick={resetForm}
              type="button"
            >
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Nombre de la categoría <span className="required">*</span>
              </label>
              <input
                type="text"
                value={form.nombre_categoria}
                onChange={(e) => setForm({ ...form, nombre_categoria: e.target.value })}
                placeholder="Ej: PORTATIL, MONITOR, etc."
                maxLength={50}
                required
                disabled={saving}
              />
              <small>Máximo 50 caracteres. Este será el valor que aparecerá en el campo "Tipo"</small>
            </div>

            <div className="form-row">
              <label>Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Descripción opcional de la categoría"
                maxLength={200}
                rows={3}
                disabled={saving}
              />
              <small>Máximo 200 caracteres</small>
            </div>

            <div className="form-row">
              <label className="tipos-equipo-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.es_componente}
                  onChange={(e) => setForm({ ...form, es_componente: e.target.checked })}
                  disabled={saving}
                />
                <span>Es componente (no es un equipo completo)</span>
              </label>
            </div>

            <div className="tipos-equipo-form-actions">
              <button
                type="submit"
                className="btn-verde"
                disabled={saving || !form.nombre_categoria.trim()}
              >
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={resetForm}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="tipos-equipo-search">
        <input
          type="text"
          placeholder="Buscar categorías..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="tipos-equipo-search-input"
        />
      </div>

      <div className="tipos-equipo-list">
        {filteredCategorias.length === 0 ? (
          <div className="tipos-equipo-empty">
            <p>{searchTerm ? 'No se encontraron categorías con ese criterio' : 'No hay categorías registradas'}</p>
            {!searchTerm && (
              <button
                className="btn-verde"
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                }}
              >
                Crear primera categoría
              </button>
            )}
          </div>
        ) : (
          <div className="tipos-equipo-table-wrapper">
            <table className="tipos-equipo-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategorias.map((categoria) => (
                  <tr key={categoria.id_categoria}>
                    <td className="tipos-equipo-name">{categoria.nombre_categoria}</td>
                    <td className="tipos-equipo-desc">
                      {categoria.descripcion || <span className="text-muted">Sin descripción</span>}
                    </td>
                    <td>
                      <span className={`tipos-equipo-badge ${categoria.es_componente ? 'componente' : 'equipo'}`}>
                        {categoria.es_componente ? 'Componente' : 'Equipo Completo'}
                      </span>
                    </td>
                    <td className="tipos-equipo-actions">
                      <button
                        className="tipos-equipo-btn-edit"
                        onClick={() => handleEdit(categoria)}
                        title="Editar"
                        disabled={saving}
                      >
                        Editar
                      </button>
                      <button
                        className="tipos-equipo-btn-delete"
                        onClick={() => handleDelete(categoria.id_categoria, categoria.nombre_categoria)}
                        title="Eliminar"
                        disabled={saving}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

