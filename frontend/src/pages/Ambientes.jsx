import React, { useEffect, useState, useRef } from 'react';
import { FiCamera, FiX, FiStar, FiImage, FiPackage, FiCheckCircle, FiAlertCircle, FiTrendingDown, FiDollarSign, FiMapPin, FiUsers, FiInfo, FiEdit2, FiClock, FiCalendar, FiUser } from 'react-icons/fi';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import CustomSelect from '../components/CustomSelect';
import { parseApiResponse, buildErrorMessage, handleError, getAuthHeaders } from '../utils/api';
import '../styles/equipos.css';
import '../styles/usuarios.css';
import '../styles/modal.css';
import '../styles/sidebar.css';
import '../styles/ambientes.css';

const TIPOS_AMBIENTE = ['Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega'];
const ESTADOS_AMBIENTE = ['Activo', 'Inactivo', 'En Mantenimiento'];

const INITIAL_FORM = {
  codigo_ambiente: '',
  nombre_ambiente: '',
  tipo_ambiente: 'Aula',
  capacidad_personas: '',
  piso: '',
  edificio: '',
  descripcion: '',
  estado_ambiente: 'Activo',
};

export default function Ambientes() {
  const [ambientes, setAmbientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewAmbiente, setViewAmbiente] = useState(null);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAmbiente, setEditingAmbiente] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errores, setErrores] = useState({});
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [currentUser, setCurrentUser] = useState(null);
  const [filtros, setFiltros] = useState({
    estado: '',
    tipo: '',
  });
  const [imagenes, setImagenes] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef(null);
  const [instructores, setInstructores] = useState([]);
  const [loadingInstructores, setLoadingInstructores] = useState(false);
  const [showCambiarCuentadante, setShowCambiarCuentadante] = useState(false);
  const [instructorSeleccionado, setInstructorSeleccionado] = useState(null);

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch {
    }
  }, []);

  const isAdmin = currentUser?.nombre_rol === 'Administrador';

  const fetchAmbientes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.estado) params.append('estado_ambiente', filtros.estado);
      if (filtros.tipo) params.append('tipo_ambiente', filtros.tipo);

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

  const preparePayload = (src) => {
    const payload = { ...src };
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
      setForm(INITIAL_FORM);
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
    setEditingAmbiente(amb);
    setEditingRowId(amb.id_ambiente);
    setForm({
      ...INITIAL_FORM,
      codigo_ambiente: amb.codigo_ambiente || '',
      nombre_ambiente: amb.nombre_ambiente || '',
      tipo_ambiente: amb.tipo_ambiente || INITIAL_FORM.tipo_ambiente,
      capacidad_personas: amb.capacidad_personas || '',
      piso: amb.piso || '',
      edificio: amb.edificio || '',
      descripcion: amb.descripcion || '',
      estado_ambiente: amb.estado_ambiente || INITIAL_FORM.estado_ambiente,
    });
    setShowForm(false);
    setViewAmbiente(null);
  };

  const handleCancelInline = () => {
    setEditingRowId(null);
    setEditingAmbiente(null);
    setErrores({});
    setForm(INITIAL_FORM);
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
      setForm(INITIAL_FORM);
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
      if (data.imagenes) {
        setImagenes(data.imagenes);
      } else {
        await fetchImagenes(id);
      }
      // Cargar instructores del ambiente
      await fetchInstructoresAmbiente(id);
    } catch (err) {
      handleError(err, setToast, 'No se pudo obtener el ambiente');
    }
  };

  const fetchInstructoresAmbiente = async (idAmbiente) => {
    try {
      setLoadingInstructores(true);
      const res = await fetch(`/api/ambientes/${idAmbiente}/instructores`, { headers: getAuthHeaders() });
      const data = await parseApiResponse(res, 'No se pudieron cargar los instructores');
      setInstructores(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error al cargar instructores:', err);
      setInstructores([]);
    } finally {
      setLoadingInstructores(false);
    }
  };

  const handleCambiarCuentadanteSecundario = async (idInstructor) => {
    if (!viewAmbiente?.id_ambiente) {
      setToast({ message: 'No hay un ambiente seleccionado', type: 'error' });
      return;
    }

    // Validar permisos en frontend (solo cuentadante principal o Administrador)
    if (!isAdmin && currentUser?.nombre_rol !== 'Cuentadante') {
      setToast({ 
        message: 'No tienes permiso para realizar esta acción. Solo el cuentadante principal o un Administrador pueden cambiar cuentadantes secundarios.', 
        type: 'error' 
      });
      return;
    }

    try {
      setLoading(true);
      setToast(null);
      const res = await fetch('/api/ambientes/cambiar-cuentadante-secundario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          id_ambiente: viewAmbiente.id_ambiente,
          id_instructor: idInstructor
        })
      });

      // Manejar código 403 específicamente
      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detalle || errorData.error || 'No tienes permiso para realizar esta acción. Solo el cuentadante principal o un Administrador pueden cambiar cuentadantes secundarios.')
      }

      const data = await parseApiResponse(res, 'Error al cambiar cuentadante secundario');
      setToast({ 
        message: data.message || 'Cuentadante secundario actualizado correctamente', 
        type: 'success' 
      });
      setShowCambiarCuentadante(false);
      setInstructorSeleccionado(null);
      // Recargar datos del ambiente e instructores
      await handleView(viewAmbiente.id_ambiente);
      await fetchInstructoresAmbiente(viewAmbiente.id_ambiente);
    } catch (err) {
      handleError(err, setToast, 'Error al cambiar cuentadante secundario');
    } finally {
      setLoading(false);
    }
  };

  const fetchImagenes = async (idAmbiente) => {
    try {
      const res = await fetch(`/api/ambientes/${idAmbiente}/imagenes`, { headers: getAuthHeaders() });
      const data = await parseApiResponse(res, 'No se pudieron cargar las imágenes');
      setImagenes(data || []);
    } catch (err) {
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
                      setForm(INITIAL_FORM);
                      setErrores({});
                    }}
                  >
                    + Nuevo Ambiente
                  </button>
                )}
              </div>
            </div>

            <div className="users-content ambientes-content">
              <div className="ambientes-filters-row">
                <CustomSelect
                  name="estado"
                  className="filter-control"
                  value={filtros.estado}
                  onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                  options={['', ...ESTADOS_AMBIENTE]}
                  placeholder="Todos los estados"
                />
                <CustomSelect
                  name="tipo"
                  className="filter-control"
                  value={filtros.tipo}
                  onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
                  options={['', ...TIPOS_AMBIENTE]}
                  placeholder="Todos los tipos"
                />
              </div>
            </div>

            {showForm && (
    <div className="card ambiente-form-card ambientes-form-card">
        <h3>{editingAmbiente ? 'Editar Ambiente' : 'Nuevo Ambiente'}</h3>
        <form onSubmit={handleSubmit}>
            {/* INICIO: Estructura del formulario mejorada */}
            <div className="form-grid-columns">
                {/* Columna 1 */}
                <div className="form-group-column">
                    <div className="form-row">
                        <label>Código Ambiente *</label>
                        <input
                            className="form-control"
                            name="codigo_ambiente"
                            value={form.codigo_ambiente}
                            onChange={handleChange}
                            disabled={!!editingAmbiente}
                            aria-required="true"
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
                            aria-required="true"
                        />
                        {errores.nombre_ambiente && (
                            <span className="error-text">{errores.nombre_ambiente}</span>
                        )}
                    </div>

                    <div className="form-row">
                        <label>Tipo Ambiente *</label>
                        <CustomSelect
                            name="tipo_ambiente"
                            className="form-control"
                            value={form.tipo_ambiente}
                            onChange={handleChange}
                            options={TIPOS_AMBIENTE}
                            placeholder="Seleccionar tipo"
                            required
                        />
                        {errores.tipo_ambiente && (
                            <span className="error-text">{errores.tipo_ambiente}</span>
                        )}
                    </div>
                </div>

                {/* Columna 2 */}
                <div className="form-group-column">
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
                        <label>Estado</label>
                        <CustomSelect
                            name="estado_ambiente"
                            className="form-control"
                            value={form.estado_ambiente}
                            onChange={handleChange}
                            options={ESTADOS_AMBIENTE}
                            placeholder="Seleccionar estado"
                        />
                    </div>
                </div>
            </div>

            {/* Fila de Descripción a ancho completo */}
            <div className="form-row form-full-width">
                <label>Descripción</label>
                <textarea
                    className="form-control"
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    rows="3"
                />
            </div>
                <div className="ambientes-form-actions">
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

          {viewAmbiente && (
            <div className="ambiente-detail-card ambientes-detail-card">
              <div className="ambiente-detail-header">
                <div>
                  <h3 className="ambiente-detail-title">{viewAmbiente.nombre_ambiente}</h3>
                  <p className="ambiente-detail-subtitle">Código: {viewAmbiente.codigo_ambiente}</p>
                </div>
                <button
                  className="btn-close-detail"
                  onClick={() => setViewAmbiente(null)}
                  title="Cerrar"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="ambiente-stats-grid">
                <div className="ambiente-stat-card stat-total">
                  <div className="stat-icon">
                    <FiPackage size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{viewAmbiente.total_equipos || 0}</div>
                    <div className="stat-label">Total Equipos</div>
                  </div>
                </div>
                <div className="ambiente-stat-card stat-disponibles">
                  <div className="stat-icon">
                    <FiCheckCircle size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{viewAmbiente.equipos_disponibles || 0}</div>
                    <div className="stat-label">Equipos Disponibles</div>
                  </div>
                </div>
                <div className="ambiente-stat-card stat-regular">
                  <div className="stat-icon">
                    <FiAlertCircle size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{viewAmbiente.equipos_en_uso || 0}</div>
                    <div className="stat-label">Equipos en Uso</div>
                  </div>
                </div>
                <div className="ambiente-stat-card stat-danados">
                  <div className="stat-icon">
                    <FiTrendingDown size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{viewAmbiente.equipos_en_mantenimiento || 0}</div>
                    <div className="stat-label">En Mantenimiento</div>
                  </div>
                </div>
              </div>

              <div className="ambiente-info-grid">
                <div className="ambiente-info-card">
                  <div className="info-item">
                    <div className="info-label">
                      <FiInfo size={16} />
                      Tipo
                    </div>
                    <div className="info-value">{viewAmbiente.tipo_ambiente}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <FiCheckCircle size={16} />
                      Estado
                    </div>
                    <div className="info-value">
                      <span className={`badge ${
                        viewAmbiente.estado_ambiente === 'Activo'
                          ? 'badge-success'
                          : viewAmbiente.estado_ambiente === 'En Mantenimiento'
                          ? 'badge-warning'
                          : 'badge-error'
                      }`}>
                        {viewAmbiente.estado_ambiente}
                      </span>
                    </div>
                  </div>
                  {viewAmbiente.capacidad_personas && (
                    <div className="info-item">
                      <div className="info-label">
                        <FiUsers size={16} />
                        Capacidad
                      </div>
                      <div className="info-value">{viewAmbiente.capacidad_personas} personas</div>
                    </div>
                  )}
                </div>
                <div className="ambiente-info-card">
                  {viewAmbiente.piso && (
                    <div className="info-item">
                      <div className="info-label">
                        <FiMapPin size={16} />
                        Piso
                      </div>
                      <div className="info-value">{viewAmbiente.piso}</div>
                    </div>
                  )}
                  {viewAmbiente.edificio && (
                    <div className="info-item">
                      <div className="info-label">
                        <FiMapPin size={16} />
                        Edificio
                      </div>
                      <div className="info-value">{viewAmbiente.edificio}</div>
                    </div>
                  )}
                  {viewAmbiente.descripcion && (
                    <div className="info-item ambientes-descripcion-item">
                      <div className="info-label">
                        <FiInfo size={16} />
                        Descripción
                      </div>
                      <div className="info-value ambientes-descripcion-value">{viewAmbiente.descripcion}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección de Instructores usando el nuevo endpoint */}
              {viewAmbiente && (
                <div className="ambiente-responsables">
                  <div className="ambiente-section-header">
                    <div>
                      <h4 className="ambiente-section-title">
                        <FiUsers size={20} />
                        Instructores y Responsables Asignados
                      </h4>
                      <p className="ambiente-section-subtitle">
                        Lista de instructores y cuentadantes secundarios asignados a este ambiente
                      </p>
                    </div>
                    {isAdmin && instructores.length > 0 && (
                      <button
                        className="btn btn-verde btn-sm"
                        onClick={() => setShowCambiarCuentadante(true)}
                        title="Cambiar cuentadante secundario"
                      >
                        <FiEdit2 size={14} />
                        Gestionar Cuentadantes
                      </button>
                    )}
                  </div>
                  
                  {loadingInstructores ? (
                    <div className="loading-state">
                      <p>Cargando instructores...</p>
                    </div>
                  ) : instructores.length > 0 ? (
                    <div className="responsables-list">
                      {instructores.map((instructor) => {
                        const idInstructor = instructor.id_usuario || instructor.id_instructor
                        const nombreInstructor = instructor.nombre_usuario || instructor.nombre_instructor
                        const esCuentadante = instructor.es_cuentadante_secundario === true || instructor.rol === 'SECUNDARIO'
                        const puedeCambiar = isAdmin || currentUser?.nombre_rol === 'Cuentadante'
                        
                        return (
                          <div key={idInstructor} className="responsable-item">
                            <div className="responsable-info">
                              <div className="responsable-header">
                                <strong>{nombreInstructor}</strong>
                                {esCuentadante ? (
                                  <span className="responsable-badge responsable-badge-secundario">
                                    Cuentadante Secundario
                                  </span>
                                ) : (
                                  <span className="responsable-badge responsable-badge-principal">
                                    Instructor
                                  </span>
                                )}
                              </div>
                              <div className="responsable-meta">
                                <span className="responsable-rol">
                                  <FiUser size={14} />
                                  {instructor.nombre_rol || 'Instructor'}
                                </span>
                                {instructor.cedula && (
                                  <span className="responsable-fecha">
                                    Cédula: {instructor.cedula}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="responsable-details">
                              {instructor.total_ambientes > 0 && (
                                <span className="responsable-clase">
                                  <FiMapPin size={14} />
                                  {instructor.total_ambientes} ambiente(s) asignado(s)
                                </span>
                              )}
                              {puedeCambiar && !esCuentadante && (
                                <button
                                  className="btn btn-sm btn-verde"
                                  onClick={() => handleCambiarCuentadanteSecundario(idInstructor)}
                                  disabled={loading}
                                  title="Cambiar a cuentadante secundario"
                                >
                                  <FiEdit2 size={12} />
                                  Hacer Cuentadante
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="ambiente-no-images">
                      <FiUsers size={48} />
                      <p>No hay instructores asignados a este ambiente</p>
                    </div>
                  )}
                  
                  {isAdmin && (
                    <div className="ambiente-responsables-note">
                      <FiInfo size={16} />
                      <span>
                        Los instructores con ambientes asignados pueden ser designados como cuentadantes secundarios. 
                        Solo el cuentadante principal o un Administrador puede realizar este cambio.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="ambiente-inventario-section">
                <h4 className="ambiente-section-title">Inventario del Ambiente</h4>
                {viewAmbiente.equipos && viewAmbiente.equipos.length > 0 ? (
                  <div className="users-table-wrapper ambientes-table-wrapper">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Tipo</th>
                          <th>Modelo</th>
                          <th>Placa</th>
                          <th>Consecutivo</th>
                          <th>Estado Operativo</th>
                          <th>Estado Físico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewAmbiente.equipos.map((equipo) => (
                          <tr key={equipo.codigo_equipo}>
                            <td>{equipo.codigo_equipo || '-'}</td>
                            <td>{equipo.tipo || '-'}</td>
                            <td>{equipo.modelo || '-'}</td>
                            <td>{equipo.placa || '-'}</td>
                            <td>{equipo.consecutivo || '-'}</td>
                            <td>
                              <span className={`badge ${
                                equipo.estado_operativo === 'Disponible'
                                  ? 'badge-success'
                                  : equipo.estado_operativo === 'En Uso'
                                  ? 'badge-warning'
                                  : equipo.estado_operativo === 'En Mantenimiento'
                                  ? 'badge-error'
                                  : 'badge-secondary'
                              }`}>
                                {equipo.estado_operativo || '-'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${
                                equipo.estado_fisico === 'Bueno' || equipo.estado_fisico === 'Nuevo'
                                  ? 'badge-success'
                                  : equipo.estado_fisico === 'Regular'
                                  ? 'badge-warning'
                                  : 'badge-error'
                              }`}>
                                {equipo.estado_fisico || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ambiente-no-images ambientes-no-images">
                    <FiPackage size={48} />
                    <p>No hay elementos registrados en este ambiente</p>
                  </div>
                )}
              </div>
                
              <div className="ambiente-imagenes-section">
                <div className="ambiente-imagenes-header">
                  <h4 className="ambiente-section-title">Imágenes del Ambiente</h4>
                  <button
                    className="btn-upload-images"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImages}
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
                    className="ambientes-file-input-hidden"
                  />
                </div>
                
                {imagenes.length === 0 ? (
                  <div className="ambiente-no-images">
                    <FiImage size={48} />
                    <p>No hay imágenes para este ambiente</p>
                  </div>
                ) : (
                  <div className="ambiente-imagenes-grid">
                    {imagenes.map((img) => (
                      <div key={img.id_imagen_ambiente} className="ambiente-imagen-card">
                        <div className="ambiente-imagen-container">
                          <img
                            src={getImageUrl(img.ruta_imagen)}
                            alt={img.descripcion || img.nombre_archivo}
                            className="ambiente-imagen"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="ambiente-imagen-placeholder">
                            <FiImage size={32} />
                          </div>
                          {img.es_principal && (
                            <div className="ambiente-imagen-badge">
                              <FiStar size={14} />
                              Principal
                            </div>
                          )}
                          <div className="ambiente-imagen-overlay">
                            {!img.es_principal && (
                              <button
                                className="ambiente-imagen-btn"
                                onClick={() => handleMarkPrincipal(img.id_imagen_ambiente)}
                                title="Marcar como principal"
                              >
                                <FiStar size={16} />
                              </button>
                            )}
                            <button
                              className="ambiente-imagen-btn ambiente-imagen-btn-delete"
                              onClick={() => handleDeleteImage(img.id_imagen_ambiente)}
                              title="Eliminar imagen"
                            >
                              <FiX size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="ambiente-imagen-info">
                          <p className="ambiente-imagen-name" title={img.nombre_archivo}>
                            {img.nombre_archivo}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

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
                            <input className="cell-input-edit" name="codigo_ambiente" value={form.codigo_ambiente} disabled />
                          </td>
                          <td>
                            <input className="cell-input-edit" name="nombre_ambiente" value={form.nombre_ambiente} onChange={handleChange} />
                            {errores.nombre_ambiente && <div className="error-text-inline">{errores.nombre_ambiente}</div>}
                          </td>
                          <td>
                            <CustomSelect
                              name="tipo_ambiente"
                              className="cell-select-edit"
                              value={form.tipo_ambiente}
                              onChange={handleChange}
                              options={TIPOS_AMBIENTE}
                              placeholder="Tipo"
                            />
                          </td>
                          <td>
                            <input className="cell-input-edit" name="edificio" value={form.edificio} onChange={handleChange} placeholder="Edificio" />
                          </td>
                          <td>
                            <input className="cell-input-edit" name="piso" value={form.piso} onChange={handleChange} placeholder="Piso" />
                          </td>
                          <td>
                            <span className="equip-count">{amb.total_equipos || 0}</span>
                          </td>
                          <td>
                            <CustomSelect
                              name="estado_ambiente"
                              className="cell-select-edit"
                              value={form.estado_ambiente}
                              onChange={handleChange}
                              options={ESTADOS_AMBIENTE}
                              placeholder="Estado"
                            />
                          </td>
                          <td>
                            <div className="row-actions-edit">
                              <button type="button" className="btn-save-inline" onClick={handleInlineSave}>
                                <FiEdit2 size={14} />
                                Guardar
                              </button>
                              <button type="button" className="btn-cancel-inline" onClick={handleCancelInline}>
                                <FiX size={14} />
                                Cancelar
                              </button>
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

          {/* Modal para cambiar cuentadante secundario */}
          {showCambiarCuentadante && viewAmbiente && (
            <div className="modal-overlay" onClick={() => setShowCambiarCuentadante(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Gestionar Cuentadantes Secundarios</h3>
                  <button
                    className="modal-close"
                    onClick={() => {
                      setShowCambiarCuentadante(false);
                      setInstructorSeleccionado(null);
                    }}
                  >
                    <FiX size={20} />
                  </button>
                </div>
                <div className="modal-body">
                  <p className="modal-description">
                    Selecciona un instructor para designarlo como cuentadante secundario de este ambiente.
                    Solo los instructores con ambientes asignados pueden ser cuentadantes secundarios.
                  </p>
                  {loadingInstructores ? (
                    <div className="loading-state">
                      <p>Cargando instructores...</p>
                    </div>
                  ) : instructores.length > 0 ? (
                    <div className="instructores-select-list">
                      {instructores.map((instructor) => (
                        <div
                          key={instructor.id_usuario || instructor.id_instructor}
                          className={`instructor-select-item ${instructorSeleccionado === (instructor.id_usuario || instructor.id_instructor) ? 'selected' : ''} ${instructor.es_cuentadante_secundario ? 'is-cuentadante' : ''}`}
                          onClick={() => setInstructorSeleccionado(instructor.id_usuario || instructor.id_instructor)}
                        >
                          <div className="instructor-select-info">
                            <strong>{instructor.nombre_usuario || instructor.nombre_instructor}</strong>
                            {instructor.es_cuentadante_secundario && (
                              <span className="badge badge-success">Cuentadante Secundario</span>
                            )}
                            {instructor.total_ambientes > 0 && (
                              <span className="instructor-ambientes-count">
                                {instructor.total_ambientes} ambiente(s)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No hay instructores disponibles para este ambiente</p>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setShowCambiarCuentadante(false);
                      setInstructorSeleccionado(null);
                    }}
                  >
                    Cancelar
                  </button>
                  {instructorSeleccionado && (
                    <button
                      className="btn-primary"
                      onClick={() => handleCambiarCuentadanteSecundario(instructorSeleccionado)}
                      disabled={loading}
                    >
                      {loading ? 'Procesando...' : 'Designar como Cuentadante Secundario'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

