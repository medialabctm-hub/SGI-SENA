import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { parseApiResponse, buildErrorMessage } from '../utils/api';
import { FiArrowLeft, FiUpload, FiTrash2, FiStar, FiImage, FiX, FiInfo, FiPackage, FiMapPin, FiCalendar, FiDollarSign, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import '../styles/equipos.css';
import '../styles/detalleEquipo.css';
import '../styles/ambientes.css';

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
  const [lightboxImage, setLightboxImage] = useState(null);

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

  // Ocultar header y sidebar cuando el lightbox esté abierto
  useEffect(() => {
    if (lightboxImage) {
      document.body.classList.add('lightbox-open');
      const header = document.querySelector('.app-header-wrapper');
      const sidebar = document.querySelector('.app-sidebar');
      if (header) header.style.display = 'none';
      if (sidebar) sidebar.style.display = 'none';
    } else {
      document.body.classList.remove('lightbox-open');
      const header = document.querySelector('.app-header-wrapper');
      const sidebar = document.querySelector('.app-sidebar');
      if (header) header.style.display = '';
      if (sidebar) sidebar.style.display = '';
    }
    return () => {
      document.body.classList.remove('lightbox-open');
      const header = document.querySelector('.app-header-wrapper');
      const sidebar = document.querySelector('.app-sidebar');
      if (header) header.style.display = '';
      if (sidebar) sidebar.style.display = '';
    };
  }, [lightboxImage]);

  async function fetchEquipo() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigoEquipo)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseApiResponse(res, 'No se pudo cargar el equipo');
      setEquipo(data);
    } catch (err) {
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
      console.log('Imágenes cargadas:', data);
      setImagenes(data.imagenes || []);
      const principal = (data.imagenes || []).find(img => img.es_principal);
      setImagenPrincipal(principal || (data.imagenes && data.imagenes[0]) || null);
    } catch (err) {
      console.error('Error al cargar imágenes:', err);
      setImagenes([]);
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

  const openLightbox = useCallback((imagen) => {
    setLightboxImage(imagen);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxImage(null);
  }, []);

  const navigateLightbox = useCallback((direction) => {
    if (!lightboxImage || imagenes.length === 0) return;
    const currentIndex = imagenes.findIndex(img => img.id_imagen_equipo === lightboxImage.id_imagen_equipo);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % imagenes.length;
    } else {
      newIndex = (currentIndex - 1 + imagenes.length) % imagenes.length;
    }
    setLightboxImage(imagenes[newIndex]);
  }, [lightboxImage, imagenes]);

  useEffect(() => {
    function handleKeyPress(e) {
      if (!lightboxImage) return;
      if (e.key === 'Escape') {
        setLightboxImage(null);
      } else if (e.key === 'ArrowLeft') {
        if (imagenes.length === 0) return;
        const currentIndex = imagenes.findIndex(img => img.id_imagen_equipo === lightboxImage.id_imagen_equipo);
        if (currentIndex === -1) return;
        const newIndex = (currentIndex - 1 + imagenes.length) % imagenes.length;
        setLightboxImage(imagenes[newIndex]);
      } else if (e.key === 'ArrowRight') {
        if (imagenes.length === 0) return;
        const currentIndex = imagenes.findIndex(img => img.id_imagen_equipo === lightboxImage.id_imagen_equipo);
        if (currentIndex === -1) return;
        const newIndex = (currentIndex + 1) % imagenes.length;
        setLightboxImage(imagenes[newIndex]);
      }
    }
    if (lightboxImage) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [lightboxImage, imagenes]);

  function getEstadoBadge(estado) {
    const estados = {
      Bueno: { color: 'var(--success-800)', bg: 'var(--success-50)' },
      Regular: { color: 'var(--warning-600)', bg: '#fef3c7' },
      Malo: { color: 'var(--error-700)', bg: '#fee2e2' },
      Nuevo: { color: '#3b82f6', bg: '#dbeafe' },
      Dañado: { color: 'var(--error-700)', bg: '#fee2e2' },
    };
    const estadoInfo = estados[estado] || { color: '#6b7280', bg: '#f3f4f6' };
    return (
      <span
        style={{
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: estadoInfo.color,
          background: estadoInfo.bg,
          display: 'inline-block',
        }}
      >
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
            <div style={{ padding: '40px', textAlign: 'center' }}>Cargando equipo...</div>
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
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p>Equipo no encontrado</p>
              <button className="btn" onClick={() => navigate('/equipos/consultar')}>
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

          {/* Lightbox para ver imágenes en grande */}
          {lightboxImage && (
            <div
              className="detalle-equipo-lightbox-overlay"
              onClick={closeLightbox}
            >
              <div
                className="detalle-equipo-lightbox-content"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="detalle-equipo-lightbox-close"
                  onClick={closeLightbox}
                  aria-label="Cerrar"
                >
                  <FiX size={24} />
                </button>
                {imagenes.length > 1 && (
                  <>
                    <button
                      className="detalle-equipo-lightbox-nav detalle-equipo-lightbox-nav-prev"
                      onClick={() => navigateLightbox('prev')}
                      aria-label="Imagen anterior"
                    >
                      <FiChevronLeft size={32} />
                    </button>
                    <button
                      className="detalle-equipo-lightbox-nav detalle-equipo-lightbox-nav-next"
                      onClick={() => navigateLightbox('next')}
                      aria-label="Imagen siguiente"
                    >
                      <FiChevronRight size={32} />
                    </button>
                  </>
                )}
                <div className="detalle-equipo-lightbox-image-container">
                  <img
                    src={lightboxImage.ruta_imagen}
                    alt={lightboxImage.descripcion || 'Imagen del equipo'}
                    className="detalle-equipo-lightbox-image"
                    onError={(e) => {
                      console.error('Error al cargar imagen:', lightboxImage.ruta_imagen);
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                <div className="detalle-equipo-lightbox-info">
                  <div className="detalle-equipo-lightbox-info-header">
                    <div className="detalle-equipo-lightbox-title-section">
                      <h4>Tipo: {lightboxImage.tipo_imagen}</h4>
                      {lightboxImage.es_principal && (
                        <span className="detalle-equipo-lightbox-badge">
                          <FiStar size={14} />
                          Principal
                        </span>
                      )}
                    </div>
                  </div>
                  {lightboxImage.descripcion && (
                    <p className="detalle-equipo-lightbox-description">{lightboxImage.descripcion}</p>
                  )}
                  <div className="detalle-equipo-lightbox-meta">
                    <span className="detalle-equipo-lightbox-meta-item">
                      Subida: {formatDate(lightboxImage.fecha_subida)}
                    </span>
                    {imagenes.length > 1 && (
                      <span className="detalle-equipo-lightbox-counter">
                        {imagenes.findIndex(img => img.id_imagen_equipo === lightboxImage.id_imagen_equipo) + 1} / {imagenes.length}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
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
                  <select
                    value={uploadData.tipo_imagen}
                    onChange={(e) => setUploadData({ ...uploadData, tipo_imagen: e.target.value })}
                    disabled={uploading}
                    className="detalle-equipo-modal-select"
                  >
                    <option value="Principal">Principal</option>
                    <option value="Lateral">Lateral</option>
                    <option value="Detalle">Detalle</option>
                    <option value="Serie">Serie</option>
                    <option value="Daño">Daño</option>
                  </select>
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
                    <span style={{ color: 'var(--success-900)' }}>
                      <FiStar size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
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

          <div className="users-panel" style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {/* Header mejorado */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px',
              paddingBottom: '20px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  className="btn" 
                  onClick={() => navigate('/equipos/consultar')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.target.style.background = '#f9fafb'; }}
                  onMouseOut={(e) => { e.target.style.background = '#fff'; }}
                >
                  <FiArrowLeft size={18} />
                  Volver
                </button>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#111827' }}>
                    {equipo.modelo || equipo.tipo || `Equipo #${equipo.codigo_equipo}`}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                    {equipo.codigo_inventario || `ID: ${equipo.codigo_equipo}`}
                  </p>
                </div>
              </div>
              {(user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                <button 
                  className="btn btn-verde" 
                  onClick={() => setShowUploadModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    background: 'var(--success-800)',
                    color: 'white',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                  }}
                  onMouseOver={(e) => { e.target.style.background = 'var(--success-900)'; e.target.style.transform = 'translateY(-1px)'; }}
                  onMouseOut={(e) => { e.target.style.background = 'var(--success-800)'; e.target.style.transform = 'translateY(0)'; }}
                >
                  <FiUpload size={18} />
                  Cargar Imágenes
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              {/* Información del Equipo - Mejorado */}
              <div style={{ 
                background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)', 
                padding: '24px', 
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #e5e7eb' }}>
                  <FiInfo size={20} color="var(--success-800)" />
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Información General</h3>
                </div>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <FiPackage size={18} color="#6b7280" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>CÓDIGO DE INVENTARIO</div>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>{equipo.codigo_inventario || '-'}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>TIPO</div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>{equipo.tipo || '-'}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>MODELO</div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>{equipo.modelo || '-'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>NÚMERO DE SERIE</div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>{equipo.numero_serie || '-'}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>CONSECUTIVO</div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>{equipo.consecutivo || '-'}</div>
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '8px' }}>ESTADO FÍSICO</div>
                    {getEstadoBadge(equipo.estado_fisico)}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <FiCalendar size={18} color="#6b7280" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>FECHA ADQUISICIÓN</div>
                        <div style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>{formatDate(equipo.fecha_adquisicion)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <FiDollarSign size={18} color="#6b7280" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>COSTO</div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{formatCurrency(equipo.costo)}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <FiMapPin size={18} color="#6b7280" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>AMBIENTE</div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>
                        {equipo.nombre_ambiente || '-'} {equipo.codigo_ambiente && `(${equipo.codigo_ambiente})`}
                      </div>
                    </div>
                  </div>

                  {equipo.descripcion && (
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '8px' }}>DESCRIPCIÓN</div>
                      <div style={{ fontSize: '15px', color: '#374151', lineHeight: '1.6' }}>{equipo.descripcion}</div>
                    </div>
                  )}
                  
                  {equipo.specs_completas && (
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '8px' }}>ESPECIFICACIONES</div>
                      <div style={{ fontSize: '14px', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                        {equipo.specs_completas}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Imagen Principal - Mejorado */}
              <div style={{ 
                background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)', 
                padding: '24px', 
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #e5e7eb' }}>
                  <FiImage size={20} color="var(--success-800)" />
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Imagen Principal</h3>
                </div>
                {imagenPrincipal ? (
                  <div>
                    <div style={{
                      width: '100%',
                      height: '400px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#fff',
                      border: '2px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      <img
                        src={imagenPrincipal.ruta_imagen}
                        alt={imagenPrincipal.descripcion || 'Imagen del equipo'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                        onError={(e) => {
                          console.error('Error al cargar imagen:', imagenPrincipal.ruta_imagen);
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div style={{ marginTop: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      {imagenPrincipal.descripcion && (
                        <div style={{ marginBottom: '8px', fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                          {imagenPrincipal.descripcion}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '16px' }}>
                        <span><strong>Tipo:</strong> {imagenPrincipal.tipo_imagen}</span>
                        <span><strong>Subida:</strong> {formatDate(imagenPrincipal.fecha_subida)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '400px',
                      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                      borderRadius: '12px',
                      border: '2px dashed #d1d5db',
                      color: '#9ca3af',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <FiImage size={64} style={{ marginBottom: '16px', opacity: 0.4 }} />
                      <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>No hay imagen principal</div>
                      <div style={{ fontSize: '14px', opacity: 0.7 }}>Sube una imagen para verla aquí</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Galería de Imágenes - Mejorada */}
            <div style={{ 
              background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)', 
              padding: '24px', 
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #e5e7eb' }}>
                <FiImage size={20} style={{ color: 'var(--success-800)' }} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  Galería de Imágenes
                  <span style={{ marginLeft: '12px', fontSize: '16px', fontWeight: 500, color: '#6b7280' }}>
                    ({imagenes.length})
                  </span>
                </h3>
              </div>
              {imagenes.length > 0 ? (
                <div className="detalle-equipo-gallery-thumbnails">
                  {imagenes.map((imagen) => (
                    <div
                      key={imagen.id_imagen_equipo}
                      className="detalle-equipo-gallery-thumbnail"
                      style={{
                        border: imagen.es_principal ? '2px solid var(--success-800)' : '1px solid #e5e7eb',
                      }}
                      onClick={() => openLightbox(imagen)}
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
                <div
                  style={{
                    padding: '60px 40px',
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                    borderRadius: '12px',
                    border: '2px dashed #d1d5db',
                    color: '#9ca3af',
                  }}
                >
                  <FiImage size={64} style={{ marginBottom: '16px', opacity: 0.4 }} />
                  <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#6b7280' }}>
                    No hay imágenes disponibles
                  </div>
                  <div style={{ fontSize: '14px', marginBottom: '20px', opacity: 0.7 }}>
                    Sube imágenes para verlas en la galería
                  </div>
                  {(user?.nombre_rol === 'Administrador' || user?.nombre_rol === 'Instructor') && (
                    <button
                      className="btn btn-verde"
                      style={{ 
                        marginTop: '16px',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onClick={() => setShowUploadModal(true)}
                    >
                      <FiUpload size={18} />
                      Subir Primera Imagen
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

