import React, { useEffect, useState, useRef } from 'react';
import { FiCamera, FiX, FiStar, FiImage } from 'react-icons/fi';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { parseApiResponse, buildErrorMessage, handleError } from '../utils/api';
import '../styles/equipos.css';
import '../styles/usuarios.css';
import '../styles/modal.css';
import '../styles/sidebar.css';
import '../styles/ambientes.css';

const TIPOS_AMBIENTE = ['Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega'];
const ESTADOS_AMBIENTE = ['Activo', 'Inactivo', 'En Mantenimiento'];

export default function Ambientes() {
  const [ambientes, setAmbientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewAmbiente, setViewAmbiente] = useState(null);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAmbiente, setEditingAmbiente] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [form, setForm] = useState({
    codigo_ambiente: '',
    nombre_ambiente: '',
    tipo_ambiente: 'Aula',
    capacidad_personas: '',
    piso: '',
    edificio: '',
    descripcion: '',
    estado_ambiente: 'Activo',
  });
  const [errores, setErrores] = useState({});
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [currentUser, setCurrentUser] = useState(null);
  const [filtros, setFiltros] = useState({
    estado: '',
    tipo: '',
    edificio: '',
  });
  const [imagenes, setImagenes] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef(null);

  // Obtener rol del usuario actual
  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      // Error silencioso
    }
  }, []);

  const isAdmin = currentUser?.nombre_rol === 'Administrador';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  };

  const fetchAmbientes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.estado) params.append('estado_ambiente', filtros.estado);
      if (filtros.tipo) params.append('tipo_ambiente', filtros.tipo);
      if (filtros.edificio) params.append('edificio', filtros.edificio);

      const url = `/api/ambientes${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      const data = await parseApiResponse(res, 'No se pudo obtener el listado de ambientes');
      setAmbientes(Array.isArray(data) ? data : []);
    } catch (err) {
      setAmbientes([]);
      setToast({
        message: buildErrorMessage(err, 'No se pudo obtener el listado de ambientes'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmbientes();
  }, [filtros]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errores[name]) {
      setErrores((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errs = {};
    if (!form.codigo_ambiente.trim()) errs.codigo_ambiente = 'El código es obligatorio';
    if (!form.nombre_ambiente.trim()) errs.nombre_ambiente = 'El nombre es obligatorio';
    if (!form.tipo_ambiente) errs.tipo_ambiente = 'El tipo es obligatorio';
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  // Prepare payload converting numeric empty strings to null or numbers
  const preparePayload = (src) => {
    const payload = { ...src };
    // Convert capacidad_personas: if empty string -> null, else number
    if (payload.capacidad_personas === '' || payload.capacidad_personas === null) {
      payload.capacidad_personas = null;
    } else {
      const n = Number(payload.capacidad_personas);
      payload.capacidad_personas = Number.isNaN(n) ? null : n;
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const url = editingAmbiente
        ? `/api/ambientes/${editingAmbiente.id_ambiente}`
        : '/api/ambientes';
      const method = editingAmbiente ? 'PUT' : 'POST';

      const payload = preparePayload(form);

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      await parseApiResponse(
        res,
        editingAmbiente ? 'No se pudo actualizar el ambiente' : 'No se pudo crear el ambiente'
      );

      setToast({
        message: editingAmbiente
          ? 'Ambiente actualizado correctamente'
          : 'Ambiente creado correctamente',
        type: 'success',
      });

      setShowForm(false);
      setEditingAmbiente(null);
      setForm({
        codigo_ambiente: '',
        nombre_ambiente: '',
        tipo_ambiente: 'Aula',
        capacidad_personas: '',
        piso: '',
        edificio: '',
        descripcion: '',
        estado_ambiente: 'Activo',
      });
      setErrores({});
      fetchAmbientes();
    } catch (err) {
      setToast({
        message: buildErrorMessage(
          err,
          editingAmbiente ? 'Error al actualizar ambiente' : 'Error al crear ambiente'
        ),
        type: 'error',
      });
    }
  };

  const handleEdit = (amb) => {
    // activate inline editing for the row instead of opening top form
    setEditingAmbiente(amb);
    setEditingRowId(amb.id_ambiente);
    setForm({
      codigo_ambiente: amb.codigo_ambiente || '',
      nombre_ambiente: amb.nombre_ambiente || '',
      tipo_ambiente: amb.tipo_ambiente || 'Aula',
      capacidad_personas: amb.capacidad_personas || '',
      piso: amb.piso || '',
      edificio: amb.edificio || '',
      descripcion: amb.descripcion || '',
      estado_ambiente: amb.estado_ambiente || 'Activo',
    });
    setShowForm(false);
    setViewAmbiente(null);
  };

  const handleCancelInline = () => {
    setEditingRowId(null);
    setEditingAmbiente(null);
    setErrores({});
    setForm({
      codigo_ambiente: '',
      nombre_ambiente: '',
      tipo_ambiente: 'Aula',
      capacidad_personas: '',
      piso: '',
      edificio: '',
      descripcion: '',
      estado_ambiente: 'Activo',
    });
  };

  const handleInlineSave = async () => {
    if (!validateForm()) return;
    try {
      const id = editingRowId || (editingAmbiente && editingAmbiente.id_ambiente);
      if (!id) return;
      const payload = preparePayload(form);
      const res = await fetch(`/api/ambientes/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      await parseApiResponse(res, 'No se pudo actualizar el ambiente');
      setToast({ message: 'Ambiente actualizado correctamente', type: 'success' });
      setEditingRowId(null);
      setEditingAmbiente(null);
      setForm({
        codigo_ambiente: '',
        nombre_ambiente: '',
        tipo_ambiente: 'Aula',
        capacidad_personas: '',
        piso: '',
        edificio: '',
        descripcion: '',
        estado_ambiente: 'Activo',
      });
      setErrores({});
      fetchAmbientes();
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar ambiente'), type: 'error' });
    }
  };

  const handleDelete = async () => {
    const id = confirm.id;
    setConfirm({ open: false, id: null });
    if (!id) return;

    try {
      const res = await fetch(`/api/ambientes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      await parseApiResponse(res, 'No se pudo eliminar el ambiente');
      setToast({ message: 'Ambiente eliminado correctamente', type: 'success' });
      fetchAmbientes();
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'Error al eliminar ambiente'),
        type: 'error',
      });
    }
  };

  const handleView = async (id) => {
    try {
      const res = await fetch(`/api/ambientes/${id}`, { headers: getAuthHeaders() });
      const data = await parseApiResponse(res, 'No se pudo obtener el ambiente');
      setViewAmbiente(data);
      setShowForm(false);
      // Cargar imágenes del ambiente
      if (data.imagenes) {
        setImagenes(data.imagenes);
      } else {
        await fetchImagenes(id);
      }
    } catch (err) {
      handleError(err, setToast, 'No se pudo obtener el ambiente');
    }
  };

  const fetchImagenes = async (idAmbiente) => {
    try {
      const res = await fetch(`/api/ambientes/${idAmbiente}/imagenes`, { headers: getAuthHeaders() });
      const data = await parseApiResponse(res, 'No se pudieron cargar las imágenes');
      setImagenes(data || []);
    } catch (err) {
      // Silencioso, solo log
      console.error('Error al cargar imágenes:', err);
      setImagenes([]);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      setToast({ message: 'Algunos archivos no son válidos. Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)', type: 'error' });
      return;
    }

    const largeFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (largeFiles.length > 0) {
      setToast({ message: 'Algunos archivos son demasiado grandes. Tamaño máximo: 5MB', type: 'error' });
      return;
    }

    if (!viewAmbiente?.id_ambiente) {
      setToast({ message: 'No hay un ambiente seleccionado', type: 'error' });
      return;
    }

    setUploadingImages(true);
    setToast(null);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('imagenes', file);
      });

      const res = await fetch(`/api/ambientes/${viewAmbiente.id_ambiente}/imagenes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const data = await parseApiResponse(res, 'Error al subir imágenes');
      setToast({ message: data.message || 'Imágenes subidas correctamente', type: 'success' });
      await fetchImagenes(viewAmbiente.id_ambiente);
    } catch (err) {
      handleError(err, setToast, 'No se pudieron subir las imágenes');
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteImage = async (idImagen) => {
    if (!confirm('¿Está seguro de que desea eliminar esta imagen?')) return;

    try {
      const res = await fetch(`/api/ambientes/imagenes/${idImagen}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      await parseApiResponse(res, 'No se pudo eliminar la imagen');
      setToast({ message: 'Imagen eliminada correctamente', type: 'success' });
      if (viewAmbiente?.id_ambiente) {
        await fetchImagenes(viewAmbiente.id_ambiente);
      }
    } catch (err) {
      handleError(err, setToast, 'No se pudo eliminar la imagen');
    }
  };

  const handleMarkPrincipal = async (idImagen) => {
    try {
      const res = await fetch(`/api/ambientes/imagenes/${idImagen}/principal`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      await parseApiResponse(res, 'No se pudo marcar la imagen como principal');
      setToast({ message: 'Imagen marcada como principal', type: 'success' });
      if (viewAmbiente?.id_ambiente) {
        await fetchImagenes(viewAmbiente.id_ambiente);
      }
    } catch (err) {
      handleError(err, setToast, 'No se pudo marcar la imagen como principal');
    }
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    if (path.startsWith('/')) {
      return path;
    }
    return `/${path}`;
  };

  const filteredAmbientes = ambientes.filter((amb) => {
    const searchTerm = query.toLowerCase();
    return (
      amb.codigo_ambiente?.toLowerCase().includes(searchTerm) ||
      amb.nombre_ambiente?.toLowerCase().includes(searchTerm) ||
      amb.edificio?.toLowerCase().includes(searchTerm) ||
      amb.piso?.toLowerCase().includes(searchTerm)
    );
  });

  return (
    <div className="page simple-page ambientes-page">
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
              <h2>Gestión de Ambientes</h2>
              <div className="users-toolbar-actions">
                <input
                  className="search-input"
                  placeholder="Buscar por código, nombre, edificio o piso..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {isAdmin && (
                  <button
                    className="btn-import-users"
                    onClick={() => {
                      setShowForm(true);
                      setEditingAmbiente(null);
                      setViewAmbiente(null);
                      setForm({
                        codigo_ambiente: '',
                        nombre_ambiente: '',
                        tipo_ambiente: 'Aula',
                        capacidad_personas: '',
                        piso: '',
                        edificio: '',
                        descripcion: '',
                        estado_ambiente: 'Activo',
                      });
                      setErrores({});
                    }}
                  >
                    + Nuevo Ambiente
                  </button>
                )}
              </div>
            </div>

            <div className="users-content" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                <select
                  className="filter-control"
                  value={filtros.estado}
                  onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                >
                  <option value="">Todos los estados</option>
                  {ESTADOS_AMBIENTE.map((est) => (
                    <option key={est} value={est}>
                      {est}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-control"
                  value={filtros.tipo}
                  onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
                >
                  <option value="">Todos los tipos</option>
                  {TIPOS_AMBIENTE.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
                <input
                  className="filter-control"
                  placeholder="Edificio (opcional)"
                  value={filtros.edificio}
                  onChange={(e) => setFiltros({ ...filtros, edificio: e.target.value })}
                />
              </div>
            </div>

          {/* Formulario */}
          {showForm && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3>{editingAmbiente ? 'Editar Ambiente' : 'Nuevo Ambiente'}</h3>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-row">
                    <label>Código Ambiente *</label>
                    <input
                      className="form-control"
                      name="codigo_ambiente"
                      value={form.codigo_ambiente}
                      onChange={handleChange}
                      disabled={!!editingAmbiente}
                    />
                    {errores.codigo_ambiente && (
                      <span className="error-text">{errores.codigo_ambiente}</span>
                    )}
                  </div>
                  <div className="form-row">
                    <label>Nombre Ambiente *</label>
                    <input
                      className="form-control"
                      name="nombre_ambiente"
                      value={form.nombre_ambiente}
                      onChange={handleChange}
                    />
                    {errores.nombre_ambiente && (
                      <span className="error-text">{errores.nombre_ambiente}</span>
                    )}
                  </div>
                  <div className="form-row">
                    <label>Tipo Ambiente *</label>
                    <select
                      className="form-control"
                      name="tipo_ambiente"
                      value={form.tipo_ambiente}
                      onChange={handleChange}
                    >
                      {TIPOS_AMBIENTE.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                    {errores.tipo_ambiente && (
                      <span className="error-text">{errores.tipo_ambiente}</span>
                    )}
                  </div>
                  <div className="form-row">
                    <label>Capacidad de Personas</label>
                    <input
                      className="form-control"
                      type="number"
                      name="capacidad_personas"
                      value={form.capacidad_personas}
                      onChange={handleChange}
                      min="1"
                    />
                  </div>
                  <div className="form-row">
                    <label>Piso</label>
                    <input
                      className="form-control"
                      name="piso"
                      value={form.piso}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-row">
                    <label>Edificio</label>
                    <input
                      className="form-control"
                      name="edificio"
                      value={form.edificio}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-row">
                    <label>Estado</label>
                    <select
                      className="form-control"
                      name="estado_ambiente"
                      value={form.estado_ambiente}
                      onChange={handleChange}
                    >
                      {ESTADOS_AMBIENTE.map((est) => (
                        <option key={est} value={est}>
                          {est}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                    <label>Descripción</label>
                    <textarea
                      className="form-control"
                      name="descripcion"
                      value={form.descripcion}
                      onChange={handleChange}
                      rows="3"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn-primary">
                    {editingAmbiente ? 'Actualizar' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowForm(false);
                      setEditingAmbiente(null);
                      setErrores({});
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Vista detallada */}
          {viewAmbiente && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Detalles del Ambiente: {viewAmbiente.nombre_ambiente}</h3>
                <button
                  className="btn-secondary"
                  onClick={() => setViewAmbiente(null)}
                >
                  Cerrar
                </button>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <p><strong>Código:</strong> {viewAmbiente.codigo_ambiente}</p>
                <p><strong>Tipo:</strong> {viewAmbiente.tipo_ambiente}</p>
                <p><strong>Estado:</strong> {viewAmbiente.estado_ambiente}</p>
                {viewAmbiente.capacidad_personas && (
                  <p><strong>Capacidad:</strong> {viewAmbiente.capacidad_personas} personas</p>
                )}
                {viewAmbiente.piso && <p><strong>Piso:</strong> {viewAmbiente.piso}</p>}
                {viewAmbiente.edificio && <p><strong>Edificio:</strong> {viewAmbiente.edificio}</p>}
                {viewAmbiente.descripcion && (
                  <p><strong>Descripción:</strong> {viewAmbiente.descripcion}</p>
                )}
                <p><strong>Total Equipos:</strong> {viewAmbiente.total_equipos || 0}</p>
                <p><strong>Equipos Disponibles:</strong> {viewAmbiente.equipos_disponibles || 0}</p>
                <p><strong>Equipos en Uso:</strong> {viewAmbiente.equipos_en_uso || 0}</p>
                {viewAmbiente.responsables_actuales && viewAmbiente.responsables_actuales.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <strong>Responsables Actuales:</strong>
                    <ul>
                      {viewAmbiente.responsables_actuales.map((resp) => (
                        <li key={resp.id_responsabilidad_ambiente}>
                          {resp.nombre_usuario} ({resp.nombre_rol}) - {resp.tipo_responsabilidad}
                          {resp.nombre_clase && ` - Clase: ${resp.nombre_clase}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Sección de imágenes */}
                <div style={{ marginTop: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <strong>Imágenes del Ambiente</strong>
                    <button
                      className="btn-primary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImages}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <FiCamera size={16} />
                      {uploadingImages ? 'Subiendo...' : 'Subir Imágenes'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      multiple
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                  
                  {imagenes.length === 0 ? (
                    <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No hay imágenes para este ambiente</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                      {imagenes.map((img) => (
                        <div key={img.id_imagen_ambiente} style={{ position: 'relative', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                          <img
                            src={getImageUrl(img.ruta_imagen)}
                            alt={img.descripcion || img.nombre_archivo}
                            style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div style={{ display: 'none', width: '100%', height: '150px', background: '#f3f4f6', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                            <FiImage size={32} />
                          </div>
                          {img.es_principal && (
                            <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#10b981', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FiStar size={14} />
                            </div>
                          )}
                          <div style={{ padding: '8px', background: 'white' }}>
                            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {img.nombre_archivo}
                            </p>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                              {!img.es_principal && (
                                <button
                                  className="btn"
                                  onClick={() => handleMarkPrincipal(img.id_imagen_ambiente)}
                                  style={{ fontSize: '11px', padding: '4px 8px' }}
                                  title="Marcar como principal"
                                >
                                  <FiStar size={12} />
                                </button>
                              )}
                              <button
                                className="btn"
                                onClick={() => handleDeleteImage(img.id_imagen_ambiente)}
                                style={{ fontSize: '11px', padding: '4px 8px', color: '#ef4444' }}
                                title="Eliminar imagen"
                              >
                                <FiX size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lista de ambientes */}
          {loading ? (
            <p>Cargando ambientes...</p>
          ) : filteredAmbientes.length === 0 ? (
            <p>No se encontraron ambientes</p>
          ) : (
            <div className="users-table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Edificio</th>
                    <th>Piso</th>
                    <th>Equipos</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAmbientes.map((amb) => (
                    <tr key={amb.id_ambiente}>
                      {editingRowId === amb.id_ambiente ? (
                        <>
                          <td>
                            <input className="cell-input" name="codigo_ambiente" value={form.codigo_ambiente} disabled />
                          </td>
                          <td>
                            <input className="cell-input" name="nombre_ambiente" value={form.nombre_ambiente} onChange={handleChange} />
                            {errores.nombre_ambiente && <div className="error-text">{errores.nombre_ambiente}</div>}
                          </td>
                          <td>
                            <select className="cell-input" name="tipo_ambiente" value={form.tipo_ambiente} onChange={handleChange}>
                              {TIPOS_AMBIENTE.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td>
                            <input className="cell-input" name="edificio" value={form.edificio} onChange={handleChange} />
                          </td>
                          <td>
                            <input className="cell-input" name="piso" value={form.piso} onChange={handleChange} />
                          </td>
                          <td>
                            <span className="equip-count">{amb.total_equipos || 0}</span>
                            {` `}
                            <small>({amb.equipos_disponibles || 0} disponibles)</small>
                          </td>
                          <td>
                            <select className="cell-input" name="estado_ambiente" value={form.estado_ambiente} onChange={handleChange}>
                              {ESTADOS_AMBIENTE.map((e) => <option key={e} value={e}>{e}</option>)}
                            </select>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button type="button" className="btn primary" onClick={handleInlineSave}>Guardar</button>
                              <button type="button" className="btn" onClick={handleCancelInline}>Cancelar</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{amb.codigo_ambiente}</td>
                          <td>{amb.nombre_ambiente}</td>
                          <td>{amb.tipo_ambiente}</td>
                          <td>{amb.edificio || '-'}</td>
                          <td>{amb.piso || '-'}</td>
                          <td>
                            <span className="equip-count">{amb.total_equipos || 0}</span>
                            {` `}
                            <small>({amb.equipos_disponibles || 0} disponibles)</small>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                amb.estado_ambiente === 'Activo'
                                  ? 'badge-success'
                                  : amb.estado_ambiente === 'En Mantenimiento'
                                  ? 'badge-warning'
                                  : 'badge-error'
                              }`}
                            >
                              {amb.estado_ambiente}
                            </span>
                          </td>
                          <td>
                            <div className="users-actions">
                              <button className="btn btn-view" onClick={() => handleView(amb.id_ambiente)}>Ver</button>
                              {isAdmin && (
                                <>
                                  <button className="btn btn-edit" onClick={() => handleEdit(amb)}>Editar</button>
                                  <button className="btn btn-delete" onClick={() => setConfirm({ open: true, id: amb.id_ambiente })}>Eliminar</button>
                                </>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          </div>

          <ConfirmModal
            open={confirm.open}
            title="Eliminar Ambiente"
            message="¿Está seguro de que desea eliminar este ambiente? Esta acción no se puede deshacer."
            onConfirm={handleDelete}
            onCancel={() => setConfirm({ open: false, id: null })}
          />
        </main>
      </div>
    </div>
  );
}

