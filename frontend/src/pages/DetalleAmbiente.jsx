import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiCamera, FiX, FiStar, FiImage, FiPackage, FiCheckCircle, FiAlertCircle, FiTrendingDown,
  FiMapPin, FiUsers, FiInfo, FiEdit2, FiUser, FiCalendar, FiArrowLeft
} from 'react-icons/fi';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import { parseApiResponse, buildErrorMessage, handleError, getAuthHeaders } from '../utils/api';
import '../styles/pages/equipos.css';
import '../styles/pages/usuarios.css';
import '../styles/components/modals.css';
import '../styles/layout/sidebar.css';
import '../styles/pages/ambientes.css';
import { LoadingScreen } from './LoadingDemo';

export default function DetalleAmbiente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ambiente, setAmbiente] = useState(null);
  const [imagenes, setImagenes] = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInstructores, setLoadingInstructores] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showCambiarCuentadante, setShowCambiarCuentadante] = useState(false);
  const [instructorSeleccionado, setInstructorSeleccionado] = useState(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef(null);

  const isAdmin = currentUser?.nombre_rol === 'Administrador';

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) setCurrentUser(JSON.parse(userData));
    } catch {}
  }, []);

  const loadAmbiente = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ambientes/${id}`, { headers: getAuthHeaders() });
      const data = await parseApiResponse(res, 'No se pudo obtener el ambiente');
      setAmbiente(data);
      if (data.imagenes) {
        setImagenes(data.imagenes);
      } else {
        await fetchImagenes(id);
      }
      await fetchInstructoresAmbiente(id);
    } catch (err) {
      handleError(err, setToast, 'No se pudo obtener el ambiente');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAmbiente();
  }, [id]);

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

  const handleCambiarCuentadanteSecundario = async (idInstructor) => {
    if (!ambiente?.id_ambiente) {
      setToast({ message: 'No hay un ambiente seleccionado', type: 'error' });
      return;
    }
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id_ambiente: ambiente.id_ambiente, id_instructor: idInstructor })
      });
      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detalle || errorData.error || 'No tienes permiso para realizar esta acción.');
      }
      const data = await parseApiResponse(res, 'Error al cambiar cuentadante secundario');
      setToast({ message: data.message || 'Cuentadante secundario actualizado correctamente', type: 'success' });
      setShowCambiarCuentadante(false);
      setInstructorSeleccionado(null);
      await loadAmbiente();
    } catch (err) {
      handleError(err, setToast, 'Error al cambiar cuentadante secundario');
    } finally {
      setLoading(false);
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
    setUploadingImages(true);
    setToast(null);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('imagenes', file));
      const res = await fetch(`/api/ambientes/${id}/imagenes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await parseApiResponse(res, 'Error al subir imágenes');
      setToast({ message: data.message || 'Imágenes subidas correctamente', type: 'success' });
      await fetchImagenes(id);
    } catch (err) {
      handleError(err, setToast, 'No se pudieron subir las imágenes');
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (idImagen) => {
    if (!confirm('¿Está seguro de que desea eliminar esta imagen?')) return;
    try {
      const res = await fetch(`/api/ambientes/imagenes/${idImagen}`, { method: 'DELETE', headers: getAuthHeaders() });
      await parseApiResponse(res, 'No se pudo eliminar la imagen');
      setToast({ message: 'Imagen eliminada correctamente', type: 'success' });
      if (id) await fetchImagenes(id);
    } catch (err) {
      handleError(err, setToast, 'No se pudo eliminar la imagen');
    }
  };

  const handleMarkPrincipal = async (idImagen) => {
    try {
      const res = await fetch(`/api/ambientes/imagenes/${idImagen}/principal`, { method: 'PATCH', headers: getAuthHeaders() });
      await parseApiResponse(res, 'No se pudo marcar la imagen como principal');
      setToast({ message: 'Imagen marcada como principal', type: 'success' });
      if (id) await fetchImagenes(id);
    } catch (err) {
      handleError(err, setToast, 'No se pudo marcar la imagen como principal');
    }
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('/')) return path;
    return `/${path}`;
  };

  if (loading && !ambiente) {
    return (
      <div className="imple-page">
        <Header />
        <div className="dashboard-layout">
          <Sidebar />
          <main className="dashboard-main">
            <LoadingScreen message="Cargando ambiente" />
          </main>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (!ambiente) {
    return (
      <div className="imple-page">
        <Header />
        <div className="dashboard-layout">
          <Sidebar />
          <main className="dashboard-main">
            <p>Ambiente no encontrado.</p>
            <button type="button" className="btn btn-verde" onClick={() => navigate('/ambientes')}>
              <FiArrowLeft size={16} />
              Volver a Ambientes
            </button>
          </main>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="imple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <div className="users-toolbar" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => navigate('/ambientes')}
              title="Volver a Gestión de Ambientes"
            >
              <FiArrowLeft size={16} />
              Volver a Ambientes
            </button>
          </div>

          <div className="ambiente-detail-card ambientes-detail-card">
            <div className="ambiente-detail-header">
              <div>
                <h3 className="ambiente-detail-title">{ambiente.nombre_ambiente}</h3>
                <p className="ambiente-detail-subtitle">Código: {ambiente.codigo_ambiente}</p>
              </div>
              <button
                className="btn-close-detail"
                onClick={() => navigate('/ambientes')}
                title="Cerrar"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="ambiente-stats-grid">
              <div className="ambiente-stat-card stat-total">
                <div className="stat-icon"><FiPackage size={24} /></div>
                <div className="stat-content">
                  <div className="stat-value">{ambiente.total_equipos || 0}</div>
                  <div className="stat-label">Total Equipos</div>
                </div>
              </div>
              <div className="ambiente-stat-card stat-disponibles">
                <div className="stat-icon"><FiCheckCircle size={24} /></div>
                <div className="stat-content">
                  <div className="stat-value">{ambiente.equipos_disponibles || 0}</div>
                  <div className="stat-label">Equipos Disponibles</div>
                </div>
              </div>
              <div className="ambiente-stat-card stat-regular">
                <div className="stat-icon"><FiAlertCircle size={24} /></div>
                <div className="stat-content">
                  <div className="stat-value">{ambiente.equipos_en_uso || 0}</div>
                  <div className="stat-label">Equipos en Uso</div>
                </div>
              </div>
              <div className="ambiente-stat-card stat-danados">
                <div className="stat-icon"><FiTrendingDown size={24} /></div>
                <div className="stat-content">
                  <div className="stat-value">{ambiente.equipos_en_mantenimiento || 0}</div>
                  <div className="stat-label">En Mantenimiento</div>
                </div>
              </div>
            </div>

            <div className="ambiente-info-grid">
              <div className="ambiente-info-card">
                <div className="info-item">
                  <div className="info-label"><FiInfo size={16} /> Tipo</div>
                  <div className="info-value">{ambiente.tipo_ambiente}</div>
                </div>
                <div className="info-item">
                  <div className="info-label"><FiCheckCircle size={16} /> Estado</div>
                  <div className="info-value">
                    <span className={`badge ${
                      ambiente.estado_ambiente === 'Activo' ? 'badge-success'
                        : ambiente.estado_ambiente === 'En Mantenimiento' ? 'badge-warning' : 'badge-error'
                    }`}>
                      {ambiente.estado_ambiente}
                    </span>
                  </div>
                </div>
                {ambiente.capacidad_personas && (
                  <div className="info-item">
                    <div className="info-label"><FiUsers size={16} /> Capacidad</div>
                    <div className="info-value">{ambiente.capacidad_personas} personas</div>
                  </div>
                )}
              </div>
              <div className="ambiente-info-card">
                {ambiente.piso && (
                  <div className="info-item">
                    <div className="info-label"><FiMapPin size={16} /> Piso</div>
                    <div className="info-value">{ambiente.piso}</div>
                  </div>
                )}
                {ambiente.edificio && (
                  <div className="info-item">
                    <div className="info-label"><FiMapPin size={16} /> Edificio</div>
                    <div className="info-value">{ambiente.edificio}</div>
                  </div>
                )}
                {ambiente.descripcion && (
                  <div className="info-item ambientes-descripcion-item">
                    <div className="info-label"><FiInfo size={16} /> Descripción</div>
                    <div className="info-value ambientes-descripcion-value">{ambiente.descripcion}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="ambiente-responsables ambiente-uso-recurrente">
              <div className="ambiente-section-header">
                <div>
                  <h4 className="ambiente-section-title">
                    <FiUsers size={20} />
                    Instructores y cuentadantes que usan este ambiente de manera recurrente
                  </h4>
                  <p className="ambiente-section-subtitle">
                    Se muestran quienes usan este ambiente más de 2 veces consecutivas el mismo día de la semana (ej. varios martes seguidos)
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
              {ambiente.uso_consecutivo_instructores?.length > 0 ? (
                <div className="responsables-list">
                  {ambiente.uso_consecutivo_instructores.map((item, idx) => (
                    <div key={item.id_usuario ?? idx} className="responsable-item">
                      <div className="responsable-info">
                        <div className="responsable-header">
                          <strong>{item.nombre_usuario ?? item.nombre_instructor}</strong>
                          <span className="responsable-badge responsable-badge-recurrente">Uso recurrente</span>
                        </div>
                        <div className="responsable-meta">
                          <span className="responsable-rol"><FiUser size={14} /> {item.nombre_rol ?? 'Instructor'}</span>
                          {item.cedula && <span className="responsable-fecha">Cédula: {item.cedula}</span>}
                        </div>
                      </div>
                      {item.uso_recurrente && (
                        <div className="responsable-details">
                          <span className="responsable-clase responsable-uso-recurrente-detail">
                            <FiCalendar size={14} />
                            {item.uso_recurrente.cantidad_dias} veces consecutivas ({item.uso_recurrente.dia_semana})
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ambiente-no-images">
                  <FiUsers size={48} />
                  <p>No hay instructores ni cuentadantes que usen este ambiente de manera recurrente</p>
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

            <div className="ambiente-inventario-section">
              <h4 className="ambiente-section-title">Inventario del Ambiente</h4>
              {ambiente.equipos && ambiente.equipos.length > 0 ? (
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
                      {ambiente.equipos.map((equipo) => (
                        <tr key={equipo.codigo_equipo}>
                          <td>{equipo.codigo_equipo || '-'}</td>
                          <td>{equipo.tipo || '-'}</td>
                          <td>{equipo.modelo || '-'}</td>
                          <td>{equipo.placa || '-'}</td>
                          <td>{equipo.consecutivo || '-'}</td>
                          <td>
                            <span className={`badge ${
                              equipo.estado_operativo === 'Disponible' ? 'badge-success'
                                : equipo.estado_operativo === 'En Uso' ? 'badge-warning'
                                  : equipo.estado_operativo === 'En Mantenimiento' ? 'badge-error' : 'badge-secondary'
                            }`}>
                              {equipo.estado_operativo || '-'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              equipo.estado_fisico === 'Bueno' || equipo.estado_fisico === 'Nuevo' ? 'badge-success'
                                : equipo.estado_fisico === 'Regular' ? 'badge-warning' : 'badge-error'
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
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="ambiente-imagen-placeholder"><FiImage size={32} /></div>
                        {img.es_principal && (
                          <div className="ambiente-imagen-badge"><FiStar size={14} /> Principal</div>
                        )}
                        <div className="ambiente-imagen-overlay">
                          {!img.es_principal && (
                            <button className="ambiente-imagen-btn" onClick={() => handleMarkPrincipal(img.id_imagen_ambiente)} title="Marcar como principal">
                              <FiStar size={16} />
                            </button>
                          )}
                          <button className="ambiente-imagen-btn ambiente-imagen-btn-delete" onClick={() => handleDeleteImage(img.id_imagen_ambiente)} title="Eliminar imagen">
                            <FiX size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="ambiente-imagen-info">
                        <p className="ambiente-imagen-name" title={img.nombre_archivo}>{img.nombre_archivo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {showCambiarCuentadante && (
        <div className="modal-overlay" onClick={() => setShowCambiarCuentadante(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Gestionar Cuentadantes Secundarios</h3>
              <button className="modal-close" onClick={() => { setShowCambiarCuentadante(false); setInstructorSeleccionado(null); }}>
                <FiX size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Selecciona un instructor para designarlo como cuentadante secundario de este ambiente.
                Solo los instructores con ambientes asignados pueden ser cuentadantes secundarios.
              </p>
              {loadingInstructores ? (
                <div className="loading-state"><LoadingScreen message="Cargando instructores" /></div>
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
                        {instructor.es_cuentadante_secundario && <span className="badge badge-success">Cuentadante Secundario</span>}
                        {instructor.total_ambientes > 0 && <span className="instructor-ambientes-count">{instructor.total_ambientes} ambiente(s)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><p>No hay instructores disponibles para este ambiente</p></div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowCambiarCuentadante(false); setInstructorSeleccionado(null); }}>Cancelar</button>
              {instructorSeleccionado && (
                <button className="btn-primary" onClick={() => handleCambiarCuentadanteSecundario(instructorSeleccionado)} disabled={loading}>
                  {loading ? 'Procesando...' : 'Designar como Cuentadante Secundario'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
