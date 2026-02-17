import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ImageViewer from '../components/ImageViewer';
import CustomSelect from '../components/CustomSelect';
import { parseApiResponse, buildErrorMessage } from '../utils/api';
import { FiArrowLeft, FiUpload, FiTrash2, FiStar, FiImage, FiX, FiInfo, FiPackage, FiMapPin, FiCalendar, FiDollarSign, FiUsers, FiUser, FiEdit2, FiUserPlus } from 'react-icons/fi';
import '../styles/pages/equipos.css';
import '../styles/detalleEquipo.css';
import '../styles/pages/ambientes.css';
import { LoadingScreen } from './LoadingDemo';

export default function DetalleEquipo() {
  const { codigoEquipo } = useParams();
  const navigate = useNavigate();
  const [equipo, setEquipo] = useState(null);
  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, idImagen: null });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadData, setUploadData] = useState({ tipo_imagen: 'Detalle', descripcion: '', es_principal: false });
  const [user, setUser] = useState(null);
  const [imagenPrincipal, setImagenPrincipal] = useState(null);
  const [viewerImageIndex, setViewerImageIndex] = useState(null);
  const [editAsignacionModal, setEditAsignacionModal] = useState({ open: false, asignacion: null });
  const [deleteAsignacionConfirm, setDeleteAsignacionConfirm] = useState({ open: false, id: null });
  const [deletingAsignacion, setDeletingAsignacion] = useState(false);
  const [editAsignacionData, setEditAsignacionData] = useState({
    ficha: '',
    nombre_externo: '',
    documento_externo: '',
    dias_semana: [],
    hora_inicio: '',
    hora_fin: '',
    observaciones: ''
  });
  const [showRegistrarUsoModal, setShowRegistrarUsoModal] = useState(false);
  const [registrarUsoDocumento, setRegistrarUsoDocumento] = useState('');
  const [registrarUsoObservaciones, setRegistrarUsoObservaciones] = useState('');
  const [registrarUsoDiasSemana, setRegistrarUsoDiasSemana] = useState([]);
  const [registrarUsoHoraInicio, setRegistrarUsoHoraInicio] = useState('');
  const [registrarUsoHoraFin, setRegistrarUsoHoraFin] = useState('');
  const [registrarUsoLoading, setRegistrarUsoLoading] = useState(false);

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
    }
    fetchEquipo();
    fetchImagenes();
  }, [codigoEquipo]);

  async function fetchEquipo() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigoEquipo)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4fca1e6c-7d65-41f5-87f3-c0784e21a846', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'DetalleEquipo.jsx:fetchEquipo', message: 'GET equipo response', data: { codigoEquipo, status: res.status, ok: res.ok }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
      // #endregion
      const data = await parseApiResponse(res, 'No se pudo cargar el equipo');
      setEquipo(data);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4fca1e6c-7d65-41f5-87f3-c0784e21a846', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'DetalleEquipo.jsx:fetchEquipo catch', message: 'GET equipo failed', data: { codigoEquipo, errStatus: err?.status }, timestamp: Date.now(), hypothesisId: 'H3' }) }).catch(() => {});
      // #endregion
      setToast({ message: buildErrorMessage(err, 'No se pudo cargar el equipo'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchImagenes() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigoEquipo)}/imagenes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiResponse(res, 'No se pudieron cargar las imágenes');
      setImagenes(data.imagenes || []);
      const principal = (data.imagenes || []).find(img => img.es_principal);
      setImagenPrincipal(principal || (data.imagenes && data.imagenes[0]) || null);
    } catch (err) {
      console.error('Error al cargar imágenes:', err);
      setImagenes([]);
    }
  }

  function handleOpenEditAsignacion(responsable) {
    setEditAsignacionData({
      ficha: responsable.ficha || '',
      nombre_externo: responsable.nombre_externo || responsable.nombre_usuario || '',
      documento_externo: responsable.documento_externo || responsable.cedula || '',
      dias_semana: Array.isArray(responsable.dias_semana) ? responsable.dias_semana : [],
      hora_inicio: responsable.hora_inicio ? responsable.hora_inicio.substring(0, 5) : '',
      hora_fin: responsable.hora_fin ? responsable.hora_fin.substring(0, 5) : '',
      observaciones: responsable.observaciones || ''
    });
    setEditAsignacionModal({ open: true, asignacion: responsable });
  }

  async function handleUpdateAsignacion() {
    try {
      const token = localStorage.getItem('token');
      const { id_responsable } = editAsignacionModal.asignacion;
      
      const payload = {
        ficha: editAsignacionData.ficha || null,
        nombre_externo: editAsignacionData.nombre_externo || null,
        documento_externo: editAsignacionData.documento_externo || null,
        dias_semana: editAsignacionData.dias_semana.length > 0 ? editAsignacionData.dias_semana : null,
        hora_inicio: editAsignacionData.hora_inicio || null,
        hora_fin: editAsignacionData.hora_fin || null,
        observaciones: editAsignacionData.observaciones || null
      };

      const res = await fetch(`/api/equipos/asignaciones/${id_responsable}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await parseApiResponse(res, 'No se pudo actualizar la asignación');
      
      setToast({ message: data.message || 'Asignación actualizada correctamente', type: 'success' });
      setEditAsignacionModal({ open: false, asignacion: null });
      fetchEquipo(); // Recargar datos del equipo
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar la asignación'), type: 'error' });
    }
  }

  async function handleRegistrarUsoAprendiz() {
    const doc = (registrarUsoDocumento || '').trim();
    if (!doc) {
      setToast({ message: 'Ingresa el documento del aprendiz', type: 'error' });
      return;
    }
    setRegistrarUsoLoading(true);
    setToast(null);
    try {
      const token = localStorage.getItem('token');
      const usuario = {
        documento: doc,
        ficha: null,
      };
      if (registrarUsoDiasSemana.length > 0) usuario.dias_semana = registrarUsoDiasSemana;
      if ((registrarUsoHoraInicio || '').trim() && (registrarUsoHoraFin || '').trim()) {
        usuario.hora_inicio = registrarUsoHoraInicio.trim();
        usuario.hora_fin = registrarUsoHoraFin.trim();
      }
      const payload = { placa: equipo.placa ?? equipo.codigo_inventario, usuarios: [usuario] };
      const res = await fetch('/api/equipos/uso/registro-externo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await parseApiResponse(res, 'No se pudo registrar el uso');
      const resultados = data?.data?.usuarios || data?.usuarios || [];
      const errores = data?.data?.errores || data?.errores || [];
      if (errores.length > 0 && resultados.length === 0) {
        const primerError = errores[0];
        setToast({ message: primerError.error || 'Error al registrar el uso', type: 'error' });
        return;
      }
      setToast({ message: data.message || 'Uso registrado correctamente', type: 'success' });
      setShowRegistrarUsoModal(false);
      setRegistrarUsoDocumento('');
      setRegistrarUsoObservaciones('');
      setRegistrarUsoDiasSemana([]);
      setRegistrarUsoHoraInicio('');
      setRegistrarUsoHoraFin('');
      try {
        await fetchEquipo();
      } catch (_) {
        // No mostrar error para no tapar el toast de éxito
      }
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al registrar uso'), type: 'error' });
    } finally {
      setRegistrarUsoLoading(false);
    }
  }

  async function handleDeleteAsignacion() {
    if (deletingAsignacion) return; // Prevent multiple clicks
    
    setDeletingAsignacion(true);
    const asignacionId = deleteAsignacionConfirm.id;
    // Close modal immediately to prevent double-clicks
    setDeleteAsignacionConfirm({ open: false, id: null });
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/equipos/asignaciones/${asignacionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await parseApiResponse(res, 'No se pudo eliminar la asignación');
      
      setToast({ message: data.message || 'Asignación eliminada correctamente', type: 'success' });
      fetchEquipo(); // Recargar datos del equipo
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al eliminar la asignación'), type: 'error' });
    } finally {
      setDeletingAsignacion(false);
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      return validTypes.includes(file.type);
    });

    if (validFiles.length !== files.length) {
      setToast({ message: 'Algunos archivos no son imágenes válidas', type: 'error' });
    }

    if (validFiles.length > 10) {
      setToast({ message: 'Máximo 10 imágenes a la vez', type: 'error' });
      setSelectedFiles(validFiles.slice(0, 10));
    } else {
      setSelectedFiles(validFiles);
    }
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      setToast({ message: 'Selecciona al menos una imagen', type: 'error' });
      return;
    }

    setUploading(true);
    setToast(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();

      selectedFiles.forEach((file) => {
        formData.append('imagenes', file);
      });

      formData.append('tipo_imagen', uploadData.tipo_imagen);
      if (uploadData.descripcion) {
        formData.append('descripcion', uploadData.descripcion);
      }
      formData.append('es_principal', uploadData.es_principal ? 'true' : 'false');

      const res = await fetch(`/api/equipos/${encodeURIComponent(codigoEquipo)}/imagenes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await parseApiResponse(res, 'No se pudieron subir las imágenes');
      setToast({ message: data.message || 'Imágenes subidas correctamente', type: 'success' });
      setShowUploadModal(false);
      setSelectedFiles([]);
      setUploadData({ tipo_imagen: 'Detalle', descripcion: '', es_principal: false });
      await fetchImagenes();
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al subir las imágenes'), type: 'error' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImagen() {
    const idImagen = deleteConfirm.idImagen;
    if (!idImagen) return;

    setDeleteConfirm({ open: false, idImagen: null });
    setLoading(true);
    setToast(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/equipos/imagenes/${idImagen}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await parseApiResponse(res, 'No se pudo eliminar la imagen');
      setToast({ message: 'Imagen eliminada correctamente', type: 'success' });
      await fetchImagenes();
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo eliminar la imagen'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleMarcarPrincipal(idImagen) {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/equipos/imagenes/${idImagen}/principal`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      await parseApiResponse(res, 'No se pudo marcar la imagen como principal');
      setToast({ message: 'Imagen marcada como principal', type: 'success' });
      await fetchImagenes();
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al marcar imagen como principal'), type: 'error' });
    }
  }

  function formatCurrency(value) {
    if (!value && value !== 0) return '-';
    try {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return '-';
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(numValue);
    } catch {
      return String(value || '-');
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return String(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(dateString || '-');
    }
  }

  function openImageViewer(index) {
    setViewerImageIndex(index);
  }

  function closeImageViewer() {
    setViewerImageIndex(null);
  }

  // Preparar imágenes para el ImageViewer
  const viewerImages = imagenes.map(img => ({
    url: img.ruta_imagen,
    titulo: img.tipo_imagen,
    descripcion: img.descripcion,
    es_principal: img.es_principal
  }));

  function getEstadoBadge(estado) {
    const estados = {
      Bueno: { color: 'var(--success-800)', bg: 'var(--success-50)', className: 'detalle-equipo-estado-badge-bueno' },
      Regular: { color: 'var(--warning-600)', bg: 'var(--warning-100)', className: 'detalle-equipo-estado-badge-regular' },
      Malo: { color: 'var(--error-700)', bg: 'var(--error-100)', className: 'detalle-equipo-estado-badge-malo' },
      Nuevo: { color: 'var(--info-600)', bg: 'var(--info-50)', className: 'detalle-equipo-estado-badge-nuevo' },
      Dañado: { color: 'var(--error-700)', bg: 'var(--error-100)', className: 'detalle-equipo-estado-badge-danado' },
    };
    const estadoInfo = estados[estado] || { color: 'var(--neutral-600)', bg: 'var(--neutral-100)', className: 'detalle-equipo-estado-badge-default' };
    return (
      <span className={`detalle-equipo-estado-badge ${estadoInfo.className || 'detalle-equipo-estado-badge-default'}`}>
        {estado || '-'}
      </span>
    );
  }

  if (loading && !equipo) {
    return (
      <div className="page simple-page">
        <Header />
        <div className="dashboard-layout">
          <Sidebar user={user} />
          <main className="dashboard-main">
            <LoadingScreen message="Cargando equipo" />
          </main>
        </div>
      </div>
    );
  }

  if (!equipo) {
    return (
      <div className="page simple-page">
        <Header />
        <div className="dashboard-layout">
          <Sidebar user={user} />
          <main className="dashboard-main">
            <div className="detalle-equipo-not-found">
              <p>Equipo no encontrado</p>
              <button className="btn btn-secondary" onClick={() => navigate('/equipos/consultar')}>
                Volver
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <ConfirmModal
            open={deleteConfirm.open}
            title="Eliminar Imagen"
            message="¿Estás seguro de que deseas eliminar esta imagen? Esta acción no se puede deshacer."
            confirmText="Eliminar"
            cancelText="Cancelar"
            type="danger"
            onConfirm={handleDeleteImagen}
            onCancel={() => setDeleteConfirm({ open: false, idImagen: null })}
          />

          {/* ImageViewer para ver imágenes en tamaño original */}
          {viewerImageIndex !== null && (
            <ImageViewer
              images={viewerImages}
              currentIndex={viewerImageIndex}
              onClose={closeImageViewer}
              onImageChange={setViewerImageIndex}
            />
          )}

          {/* Modal de subida de imágenes - Mejorado */}
          {showUploadModal && (
            <div
              className="detalle-equipo-modal-overlay"
              onClick={() => !uploading && setShowUploadModal(false)}
            >
              <div
                className="detalle-equipo-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="detalle-equipo-modal-header">
                  <div>
                    <h3>Subir Imágenes</h3>
                    <p>Selecciona una o múltiples imágenes para el equipo</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploading}
                    className="detalle-equipo-modal-close"
                  >
                    <FiX />
                  </button>
                </div>

                <div className="detalle-equipo-modal-section">
                  <label className="detalle-equipo-modal-label">
                    Seleccionar imágenes (máximo 10):
                  </label>
                  <div
                    className="detalle-equipo-modal-file-input-wrapper"
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!uploading) e.currentTarget.style.borderColor = 'var(--success-800)';
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = '#d1d5db';
                      if (!uploading) {
                        const files = Array.from(e.dataTransfer.files);
                        const validFiles = files.filter(file => file.type.startsWith('image/'));
                        if (validFiles.length > 10) {
                          setToast({ message: 'Máximo 10 imágenes', type: 'error' });
                          setSelectedFiles(validFiles.slice(0, 10));
                        } else {
                          setSelectedFiles(validFiles);
                        }
                      }
                    }}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      className="detalle-equipo-modal-file-input"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="detalle-equipo-modal-file-selected">
                        <div className="detalle-equipo-modal-file-selected-title">
                          ✓ {selectedFiles.length} archivo(s) seleccionado(s)
                        </div>
                        <div className="detalle-equipo-modal-file-list">
                          {selectedFiles.map((f, i) => (
                            <div key={i}>• {f.name}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="detalle-equipo-modal-section">
                  <label className="detalle-equipo-modal-label">
                    Tipo de imagen:
                  </label>
                  <CustomSelect
                    name="tipo_imagen"
                    value={uploadData.tipo_imagen}
                    onChange={(e) => setUploadData({ ...uploadData, tipo_imagen: e.target.value })}
                    options={['Principal', 'Lateral', 'Detalle', 'Serie', 'Daño']}
                    placeholder="Seleccionar tipo de imagen"
                    disabled={uploading}
                    className="detalle-equipo-modal-select"
                  />
                </div>

                <div className="detalle-equipo-modal-section">
                  <label className="detalle-equipo-modal-label">
                    Descripción (opcional):
                  </label>
                  <textarea
                    value={uploadData.descripcion}
                    onChange={(e) => setUploadData({ ...uploadData, descripcion: e.target.value })}
                    disabled={uploading}
                    className="detalle-equipo-modal-textarea"
                    placeholder="Describe la imagen (ej: Vista frontal del equipo, número de serie visible, etc.)"
                  />
                </div>

                <div className="detalle-equipo-modal-checkbox-wrapper">
                  <label className="detalle-equipo-modal-checkbox-label">
                    <input
                      type="checkbox"
                      checked={uploadData.es_principal}
                      onChange={(e) => setUploadData({ ...uploadData, es_principal: e.target.checked })}
                      disabled={uploading}
                      className="detalle-equipo-modal-checkbox"
                    />
                    <span className="detalle-equipo-modal-checkbox-text">
                      <FiStar size={18} className="detalle-equipo-star-icon" />
                      Marcar como imagen principal
                    </span>
                  </label>
                  <p className="detalle-equipo-modal-checkbox-description">
                    La imagen principal se mostrará destacada en la vista del equipo
                  </p>
                </div>

                <div className="detalle-equipo-modal-actions">
                  <button
                    type="button"
                    className="btn detalle-equipo-modal-btn"
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn detalle-equipo-modal-btn-primary"
                    onClick={handleUpload}
                    disabled={uploading || selectedFiles.length === 0}
                  >
                    <FiUpload size={18} />
                    {uploading ? 'Subiendo...' : 'Subir Imágenes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Registrar uso por aprendiz */}
          {showRegistrarUsoModal && (
            <div
              className="detalle-equipo-modal-overlay"
              onClick={() => {
                if (!registrarUsoLoading) {
                  setShowRegistrarUsoModal(false);
                  setRegistrarUsoDiasSemana([]);
                  setRegistrarUsoHoraInicio('');
                  setRegistrarUsoHoraFin('');
                }
              }}
            >
              <div className="detalle-equipo-modal" onClick={(e) => e.stopPropagation()}>
                <div className="detalle-equipo-modal-header">
                  <div>
                    <h3>Registrar uso por aprendiz</h3>
                    <p>Registra que un aprendiz está usando este equipo (documento de identidad)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegistrarUsoModal(false);
                      setRegistrarUsoDiasSemana([]);
                      setRegistrarUsoHoraInicio('');
                      setRegistrarUsoHoraFin('');
                    }}
                    disabled={registrarUsoLoading}
                    className="detalle-equipo-modal-close"
                  >
                    <FiX />
                  </button>
                </div>
                <div className="detalle-equipo-modal-section">
                  <label className="detalle-equipo-modal-label">Documento del aprendiz *</label>
                  <input
                    type="text"
                    value={registrarUsoDocumento}
                    onChange={(e) => setRegistrarUsoDocumento(e.target.value)}
                    disabled={registrarUsoLoading}
                    className="detalle-equipo-modal-input"
                    placeholder="Cédula o documento de identidad"
                  />
                </div>
                <div className="detalle-equipo-modal-section">
                  <label className="detalle-equipo-modal-label">Horario de uso (opcional)</label>
                  <div className="detalle-equipo-edit-modal-dias-grid">
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dia => (
                      <label key={dia} className="detalle-equipo-edit-modal-dia-label">
                        <input
                          type="checkbox"
                          checked={registrarUsoDiasSemana.includes(dia)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRegistrarUsoDiasSemana([...registrarUsoDiasSemana, dia]);
                            } else {
                              setRegistrarUsoDiasSemana(registrarUsoDiasSemana.filter(d => d !== dia));
                            }
                          }}
                          disabled={registrarUsoLoading}
                          className="detalle-equipo-edit-modal-dia-checkbox"
                        />
                        <span className="detalle-equipo-edit-modal-dia-text">{dia}</span>
                      </label>
                    ))}
                  </div>
                  <div className="detalle-equipo-edit-modal-horario-grid" style={{ marginTop: '10px' }}>
                    <div>
                      <label className="detalle-equipo-modal-label">Hora inicio</label>
                      <input
                        type="time"
                        value={registrarUsoHoraInicio}
                        onChange={(e) => setRegistrarUsoHoraInicio(e.target.value)}
                        disabled={registrarUsoLoading}
                        className="detalle-equipo-modal-input"
                      />
                    </div>
                    <div>
                      <label className="detalle-equipo-modal-label">Hora fin</label>
                      <input
                        type="time"
                        value={registrarUsoHoraFin}
                        onChange={(e) => setRegistrarUsoHoraFin(e.target.value)}
                        disabled={registrarUsoLoading}
                        className="detalle-equipo-modal-input"
                      />
                    </div>
                  </div>
                </div>
                <div className="detalle-equipo-modal-section">
                  <label className="detalle-equipo-modal-label">Observaciones (opcional)</label>
                  <textarea
                    value={registrarUsoObservaciones}
                    onChange={(e) => setRegistrarUsoObservaciones(e.target.value)}
                    disabled={registrarUsoLoading}
                    className="detalle-equipo-modal-textarea"
                    placeholder="Notas sobre el uso"
                    rows={2}
                  />
                </div>
                <div className="detalle-equipo-modal-actions">
                  <button
                    type="button"
                    className="btn detalle-equipo-modal-btn"
                    onClick={() => {
                      setShowRegistrarUsoModal(false);
                      setRegistrarUsoDiasSemana([]);
                      setRegistrarUsoHoraInicio('');
                      setRegistrarUsoHoraFin('');
                    }}
                    disabled={registrarUsoLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn detalle-equipo-modal-btn-primary"
                    onClick={handleRegistrarUsoAprendiz}
                    disabled={registrarUsoLoading || !(registrarUsoDocumento || '').trim()}
                  >
                    {registrarUsoLoading ? 'Registrando...' : 'Registrar uso'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="users-panel detalle-equipo-panel">
            {/* Header mejorado */}
            <div className="detalle-equipo-header-container">
              <div className="detalle-equipo-header-left">
                <button 
                  className="btn btn-secondary detalle-equipo-back-button"
                  onClick={() => navigate('/equipos/consultar')}
                >
                  <FiArrowLeft size={18} />
                  Volver
                </button>
                <div className="detalle-equipo-title-section">
                  <h2>
                    {equipo.modelo || equipo.tipo || `Equipo #${equipo.codigo_equipo}`}
                  </h2>
                  <p>
                    {equipo.codigo_inventario || `ID: ${equipo.codigo_equipo}`}
                  </p>
                </div>
              </div>
              <div className="detalle-equipo-header-actions">
              {(user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                <button 
                  className="btn btn-verde detalle-equipo-upload-button"
                  onClick={() => setShowUploadModal(true)}
                >
                  <FiUpload size={18} />
                  Cargar Imágenes
                </button>
              )}
              {(user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor' || user?.nombre_rol === 'Cuentadante') && (
                <button 
                  type="button"
                  className="btn btn-secondary detalle-equipo-upload-button"
                  onClick={() => setShowRegistrarUsoModal(true)}
                >
                  <FiUserPlus size={18} />
                  Registrar uso por aprendiz
                </button>
              )}
            </div>
            </div>

            <div className="detalle-equipo-info-grid">
              {/* Información del Equipo - Mejorado */}
              <div className="detalle-equipo-info-card">
                <div className="detalle-equipo-card-header">
                  <FiInfo size={20} color="var(--success-800)" />
                  <h3 className="detalle-equipo-card-title">Información General</h3>
                </div>
                <div className="detalle-equipo-info-inner-grid">
                  <div className="detalle-equipo-info-item-with-icon">
                    <FiPackage size={18} color="var(--success-800)" />
                    <div className="detalle-equipo-info-item-content">
                      <div className="detalle-equipo-info-label">CÓDIGO DE INVENTARIO</div>
                      <div className="detalle-equipo-info-value-large">{equipo.codigo_inventario || '-'}</div>
                    </div>
                  </div>
                  
                  <div className="detalle-equipo-info-item-grid">
                    <div className="detalle-equipo-info-item-small">
                      <div className="detalle-equipo-info-label">TIPO</div>
                      <div className="detalle-equipo-info-value">{equipo.tipo || '-'}</div>
                    </div>
                    <div className="detalle-equipo-info-item-small">
                      <div className="detalle-equipo-info-label">MODELO</div>
                      <div className="detalle-equipo-info-value">{equipo.modelo || '-'}</div>
                    </div>
                  </div>

                  <div className="detalle-equipo-info-item-grid">
                    <div className="detalle-equipo-info-item-small">
                      <div className="detalle-equipo-info-label">CONSECUTIVO</div>
                      <div className="detalle-equipo-info-value">{equipo.consecutivo || '-'}</div>
                    </div>
                  </div>

                  <div className="detalle-equipo-info-card">
                    <div className="detalle-equipo-info-label">ESTADO FÍSICO</div>
                    {getEstadoBadge(equipo.estado_fisico)}
                  </div>

                  <div className="detalle-equipo-info-item-grid">
                    <div className="detalle-equipo-info-item-with-icon">
                      <FiCalendar size={18} color="var(--success-800)" />
                      <div className="detalle-equipo-info-item-content">
                        <div className="detalle-equipo-info-label">FECHA ADQUISICIÓN</div>
                        <div className="detalle-equipo-info-value">{formatDate(equipo.fecha_adquisicion)}</div>
                      </div>
                    </div>
                    <div className="detalle-equipo-info-item-with-icon">
                      <FiDollarSign size={18} color="var(--success-800)" />
                      <div className="detalle-equipo-info-item-content">
                        <div className="detalle-equipo-info-label">COSTO</div>
                        <div className="detalle-equipo-info-value-bold">{formatCurrency(equipo.costo)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="detalle-equipo-info-item-grid detalle-equipo-info-fila-tres">
                    <div className="detalle-equipo-info-item-with-icon detalle-equipo-info-item-cell">
                      <FiMapPin size={18} color="var(--success-800)" />
                      <div className="detalle-equipo-info-item-content">
                        <div className="detalle-equipo-info-label">AMBIENTE</div>
                        <div className="detalle-equipo-info-value">
                          {equipo.nombre_ambiente || '-'} {equipo.codigo_ambiente && `(${equipo.codigo_ambiente})`}
                        </div>
                      </div>
                    </div>
                    <div className="detalle-equipo-info-item-with-icon detalle-equipo-info-item-cell">
                      <FiUser size={18} color="var(--success-800)" />
                      <div className="detalle-equipo-info-item-content">
                        <div className="detalle-equipo-info-label">CUENTADANTE</div>
                        <div className="detalle-equipo-info-value">
                          {equipo.cuentadante_principal || '-'}
                        </div>
                      </div>
                    </div>
                    <div className="detalle-equipo-info-item-with-icon detalle-equipo-info-item-cell">
                      <FiUser size={18} color="var(--success-800)" />
                      <div className="detalle-equipo-info-item-content">
                        <div className="detalle-equipo-info-label">DOC. CUENTADANTE</div>
                        <div className="detalle-equipo-info-value">
                          {equipo.cuentadante_cedula || '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {equipo.descripcion && (
                    <div className="detalle-equipo-info-card">
                      <div className="detalle-equipo-info-label">DESCRIPCIÓN</div>
                      <div className="detalle-equipo-info-item-text">{equipo.descripcion}</div>
                    </div>
                  )}
                  
                  {equipo.specs_completas && (
                    <div className="detalle-equipo-info-card">
                      <div className="detalle-equipo-info-label">ESPECIFICACIONES</div>
                      <div className="detalle-equipo-info-item-text-specs">{equipo.specs_completas}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Imagen Principal - Mejorado */}
              <div className="detalle-equipo-image-card">
                <div className="detalle-equipo-image-card-header">
                  <FiImage size={20} color="var(--success-800)" />
                  <h3 className="detalle-equipo-image-card-title">Imagen Principal</h3>
                </div>
                {imagenPrincipal ? (
                  <div>
                    <div className="detalle-equipo-image-wrapper">
                      <img
                        src={imagenPrincipal.ruta_imagen}
                        alt={imagenPrincipal.descripcion || 'Imagen del equipo'}
                        onError={(e) => {
                          console.error('Error al cargar imagen:', imagenPrincipal.ruta_imagen);
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="detalle-equipo-image-info-box">
                      {imagenPrincipal.descripcion && (
                        <div className="detalle-equipo-image-info-description">
                          {imagenPrincipal.descripcion}
                        </div>
                      )}
                      <div className="detalle-equipo-image-info-meta">
                        <span><strong>Tipo:</strong> {imagenPrincipal.tipo_imagen}</span>
                        <span><strong>Subida:</strong> {formatDate(imagenPrincipal.fecha_subida)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="detalle-equipo-image-empty">
                    <div className="detalle-equipo-image-empty-content">
                      <FiImage size={64} className="detalle-equipo-image-empty-icon" />
                      <div className="detalle-equipo-image-empty-title">No hay imagen principal</div>
                      <div className="detalle-equipo-image-empty-subtitle">Sube una imagen para verla aquí</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Galería de Imágenes - Mejorada */}
            <div className="detalle-equipo-gallery-section">
              <div className="detalle-equipo-gallery-section-header">
                <FiImage size={20} className="detalle-equipo-gallery-section-icon" />
                <h3 className="detalle-equipo-gallery-section-title">
                  Galería de Imágenes
                  <span className="detalle-equipo-gallery-section-count">
                    ({imagenes.length})
                  </span>
                </h3>
              </div>
              {imagenes.length > 0 ? (
                <div className="detalle-equipo-gallery-thumbnails">
                  {imagenes.map((imagen, index) => (
                    <div
                      key={imagen.id_imagen_equipo}
                      className={`detalle-equipo-gallery-thumbnail ${imagen.es_principal ? 'principal' : ''}`}
                      onClick={() => openImageViewer(index)}
                    >
                      <div className="detalle-equipo-gallery-thumbnail-image">
                        <img
                          src={imagen.ruta_imagen}
                          alt={imagen.descripcion || 'Imagen del equipo'}
                          onError={(e) => {
                            console.error('Error al cargar imagen:', imagen.ruta_imagen);
                            e.target.style.display = 'none';
                            const placeholder = e.target.nextElementSibling;
                            if (placeholder) {
                              placeholder.style.display = 'flex';
                            }
                          }}
                        />
                        <div className="detalle-equipo-gallery-thumbnail-placeholder">
                          <FiImage size={24} />
                        </div>
                        {imagen.es_principal && (
                          <div className="detalle-equipo-gallery-thumbnail-badge">
                            <FiStar size={12} />
                            Principal
                          </div>
                        )}
                        {(user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                          <div className="detalle-equipo-gallery-thumbnail-overlay">
                            {!imagen.es_principal && (
                              <button
                                className="detalle-equipo-gallery-thumbnail-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarcarPrincipal(imagen.id_imagen_equipo);
                                }}
                                title="Marcar como principal"
                              >
                                <FiStar size={14} />
                              </button>
                            )}
                            <button
                              className="detalle-equipo-gallery-thumbnail-btn detalle-equipo-gallery-thumbnail-btn-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ open: true, idImagen: imagen.id_imagen_equipo });
                              }}
                              title="Eliminar imagen"
                            >
                              <FiX size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="detalle-equipo-gallery-thumbnail-info">
                        <p className="detalle-equipo-gallery-thumbnail-type" title={imagen.tipo_imagen}>
                          {imagen.tipo_imagen}
                        </p>
                        {imagen.descripcion && (
                          <p className="detalle-equipo-gallery-thumbnail-desc" title={imagen.descripcion}>
                            {imagen.descripcion}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="detalle-equipo-gallery-empty-state">
                  <FiImage size={64} className="detalle-equipo-gallery-empty-icon" />
                  <div className="detalle-equipo-gallery-empty-title">
                    No hay imágenes disponibles
                  </div>
                  <div className="detalle-equipo-gallery-empty-subtitle">
                    Sube imágenes para verlas en la galería
                  </div>
                  {(user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                    <button
                      className="btn btn-verde detalle-equipo-gallery-empty-button"
                      onClick={() => setShowUploadModal(true)}
                    >
                      <FiUpload size={18} />
                      Subir Primera Imagen
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sección de Usuarios Asignados */}
            {equipo.responsables && equipo.responsables.length > 0 && (
              <div className="detalle-equipo-responsables-section">
                <div className="detalle-equipo-responsables-header">
                  <FiUsers size={20} color="var(--success-800)" />
                  <h3 className="detalle-equipo-responsables-title">
                    Usuarios Asignados
                    <span className="detalle-equipo-responsables-count">
                      ({equipo.responsables.length})
                    </span>
                  </h3>
                </div>
                <div className="detalle-equipo-responsables-grid">
                  {equipo.responsables.map((responsable) => {
                    const displayName = responsable.nombre_aprendiz || responsable.nombre_usuario || responsable.nombre_externo || 'Usuario sin nombre';
                    const displayDocumento = responsable.documento_aprendiz || responsable.cedula || responsable.documento_externo || '-';
                    const displayFicha = responsable.ficha_aprendiz || responsable.ficha;
                    const displayJornada = responsable.jornada_aprendiz;
                    const esAprendizImportado = responsable.origen === 'aprendiz' || (!responsable.id_usuario && !!responsable.documento_aprendiz);

                    return (
                    <div
                      key={responsable.id_responsable}
                      className="detalle-equipo-responsable-card"
                    >
                      <div className="detalle-equipo-responsable-avatar">
                        <FiUser size={24} />
                      </div>
                      <div className="detalle-equipo-responsable-content">
                        <div className="detalle-equipo-responsable-header-row">
                          <div className="detalle-equipo-responsable-name-row">
                            <strong className="detalle-equipo-responsable-name">
                              {displayName}
                            </strong>
                            {esAprendizImportado && (
                              <span className="detalle-equipo-responsable-badge-aprendiz">
                                Aprendiz
                              </span>
                            )}
                            {responsable.nombre_rol && (
                              <span className="detalle-equipo-responsable-badge-rol">
                                {responsable.nombre_rol}
                              </span>
                            )}
                          </div>
                          <div className="detalle-equipo-responsable-actions">
                            <button
                              onClick={() => handleOpenEditAsignacion(responsable)}
                              className="detalle-equipo-responsable-action-btn-edit"
                              title="Editar asignación"
                            >
                              <FiEdit2 size={14} />
                              Editar
                            </button>
                            <button
                              onClick={() => setDeleteAsignacionConfirm({ open: true, id: responsable.id_responsable })}
                              className="detalle-equipo-responsable-action-btn-delete-inline"
                              title="Eliminar asignación"
                            >
                              <FiTrash2 size={14} />
                              Eliminar
                            </button>
                          </div>
                        </div>
                        <div className="detalle-equipo-responsable-info-grid">
                          <div className="detalle-equipo-responsable-info-item">
                            <strong>Documento:</strong> {displayDocumento}
                          </div>
                          {displayFicha && (
                            <div className="detalle-equipo-responsable-info-item">
                              <strong>Ficha:</strong> {displayFicha}
                            </div>
                          )}
                          {displayJornada && (
                            <div className="detalle-equipo-responsable-info-item">
                              <strong>Jornada:</strong> {displayJornada}
                            </div>
                          )}
                          <div className="detalle-equipo-responsable-info-item">
                            <strong>Asignado hace:</strong> {responsable.dias_asignado || 0} días
                          </div>
                          <div className="detalle-equipo-responsable-info-item">
                            <strong>Fecha asignación:</strong> {formatDate(responsable.fecha_asignacion)}
                          </div>
                        </div>
                        <div className="detalle-equipo-responsable-horario-box">
                          <div className="detalle-equipo-responsable-horario-title">
                            Horario de Uso:
                          </div>
                          <div className="detalle-equipo-responsable-horario-grid">
                            <div>
                              <strong>Días:</strong>{' '}
                              {responsable.dias_semana && Array.isArray(responsable.dias_semana) && responsable.dias_semana.length > 0
                                ? responsable.dias_semana.join(', ')
                                : '-'}
                            </div>
                            <div>
                              <strong>Horario:</strong>{' '}
                              {responsable.hora_inicio && responsable.hora_fin
                                ? `${responsable.hora_inicio.substring(0, 5)} - ${responsable.hora_fin.substring(0, 5)}`
                                : responsable.hora_inicio
                                  ? `Desde ${responsable.hora_inicio.substring(0, 5)}`
                                  : responsable.hora_fin
                                    ? `Hasta ${responsable.hora_fin.substring(0, 5)}`
                                    : '-'}
                            </div>
                          </div>
                        </div>
                        {responsable.observaciones && (
                          <div className="detalle-equipo-responsable-observaciones-box">
                            <strong>Observaciones:</strong> {responsable.observaciones}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal de confirmación para eliminar asignación */}
      <ConfirmModal
        open={deleteAsignacionConfirm.open}
        onClose={() => !deletingAsignacion && setDeleteAsignacionConfirm({ open: false, id: null })}
        onCancel={() => !deletingAsignacion && setDeleteAsignacionConfirm({ open: false, id: null })}
        onConfirm={handleDeleteAsignacion}
        title="Eliminar Asignación"
        message="¿Estás seguro de que deseas eliminar esta asignación? Esta acción no se puede deshacer."
        loading={deletingAsignacion}
      />

      {/* Modal de edición de asignación */}
      {editAsignacionModal.open && (
        <div className="detalle-equipo-edit-modal-overlay">
          <div className="detalle-equipo-edit-modal">
            <div className="detalle-equipo-edit-modal-header">
              <h2 className="detalle-equipo-edit-modal-title">Editar Asignación</h2>
              <button
                onClick={() => setEditAsignacionModal({ open: false, asignacion: null })}
                className="detalle-equipo-edit-modal-close"
              >
                <FiX />
              </button>
            </div>

            <div className="detalle-equipo-edit-modal-form">
              <div>
                <label className="detalle-equipo-edit-modal-label">
                  Ficha
                </label>
                <input
                  type="text"
                  value={editAsignacionData.ficha}
                  onChange={(e) => setEditAsignacionData({ ...editAsignacionData, ficha: e.target.value })}
                  className="detalle-equipo-edit-modal-input"
                  placeholder="Número de ficha"
                />
              </div>

              <div>
                <label className="detalle-equipo-edit-modal-label">
                  Nombre
                </label>
                <input
                  type="text"
                  value={editAsignacionData.nombre_externo}
                  onChange={(e) => setEditAsignacionData({ ...editAsignacionData, nombre_externo: e.target.value })}
                  className="detalle-equipo-edit-modal-input"
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label className="detalle-equipo-edit-modal-label">
                  Documento
                </label>
                <input
                  type="text"
                  value={editAsignacionData.documento_externo}
                  onChange={(e) => setEditAsignacionData({ ...editAsignacionData, documento_externo: e.target.value })}
                  className="detalle-equipo-edit-modal-input"
                  placeholder="Documento de identificación"
                />
              </div>

              <div>
                <label className="detalle-equipo-edit-modal-label">
                  Días de la semana
                </label>
                <div className="detalle-equipo-edit-modal-dias-grid">
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dia => (
                    <label key={dia} className="detalle-equipo-edit-modal-dia-label">
                      <input
                        type="checkbox"
                        checked={editAsignacionData.dias_semana.includes(dia)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditAsignacionData({ ...editAsignacionData, dias_semana: [...editAsignacionData.dias_semana, dia] });
                          } else {
                            setEditAsignacionData({ ...editAsignacionData, dias_semana: editAsignacionData.dias_semana.filter(d => d !== dia) });
                          }
                        }}
                        className="detalle-equipo-edit-modal-dia-checkbox"
                      />
                      <span className="detalle-equipo-edit-modal-dia-text">{dia}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="detalle-equipo-edit-modal-horario-grid">
                <div>
                  <label className="detalle-equipo-edit-modal-label">
                    Hora inicio
                  </label>
                  <input
                    type="time"
                    value={editAsignacionData.hora_inicio}
                    onChange={(e) => setEditAsignacionData({ ...editAsignacionData, hora_inicio: e.target.value })}
                    className="detalle-equipo-edit-modal-input"
                  />
                </div>
                <div>
                  <label className="detalle-equipo-edit-modal-label">
                    Hora fin
                  </label>
                  <input
                    type="time"
                    value={editAsignacionData.hora_fin}
                    onChange={(e) => setEditAsignacionData({ ...editAsignacionData, hora_fin: e.target.value })}
                    className="detalle-equipo-edit-modal-input"
                  />
                </div>
              </div>

              <div>
                <label className="detalle-equipo-edit-modal-label">
                  Observaciones
                </label>
                <textarea
                  value={editAsignacionData.observaciones}
                  onChange={(e) => setEditAsignacionData({ ...editAsignacionData, observaciones: e.target.value })}
                  className="detalle-equipo-edit-modal-textarea"
                  placeholder="Observaciones adicionales"
                />
              </div>
            </div>

            <div className="detalle-equipo-edit-modal-actions">
              <button
                onClick={() => setEditAsignacionModal({ open: false, asignacion: null })}
                className="detalle-equipo-edit-modal-btn"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateAsignacion}
                className="detalle-equipo-edit-modal-btn detalle-equipo-edit-modal-btn-primary"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

