import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiShield, FiCamera, FiArrowLeft, FiCreditCard, FiPhone, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { parseApiResponse, buildErrorMessage, handleError } from '../utils/api';
import Toast from '../components/Toast';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import DestructiveConfirmModal from '../components/DestructiveConfirmModal';
import '../styles/perfil.css';

export default function Perfil() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nombre_usuario: '', correo: '', telefono: '', cedula: '' });
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Funciones helper (definidas antes de los hooks que las usan)
  const getInitials = useCallback((name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }, []);

  const getImageUrl = useCallback((path) => {
    if (!path) return null;
    // Si ya es una URL completa, devolverla tal cual
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Si empieza con /, usar ruta relativa (funciona con el proxy de nginx)
    // El backend sirve los archivos estáticos desde /uploads
    if (path.startsWith('/')) {
      return path;
    }
    // Si no tiene /, agregarlo
    return `/${path}`;
  }, []);

  const fetchUserData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setUserData(data.user);
          setForm({
            nombre_usuario: data.user.nombre_usuario || '',
            correo: data.user.correo || '',
            telefono: data.user.telefono || '',
            cedula: data.user.cedula || ''
          });
          // Actualizar localStorage
          try {
            localStorage.setItem('user', JSON.stringify(data.user));
            setCurrentUser(data.user);
          } catch (e) {
            // Ignorar errores de localStorage
          }
        }
      }
    } catch (err) {
      console.error('Error al obtener datos del usuario:', err);
      setToast({ message: 'Error al cargar el perfil', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setToast({ message: 'Tipo de archivo no válido. Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)', type: 'error' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: 'El archivo es demasiado grande. Tamaño máximo: 2MB', type: 'error' });
      return;
    }

    setUploading(true);
    setToast(null);

    try {
      const token = localStorage.getItem('token');
      const userId = userData?.id_usuario || userData?.id;
      
      if (!token || !userId) {
        throw new Error('No autorizado');
      }

      const formData = new FormData();
      formData.append('foto', file);

      const res = await fetch(`/api/auth/user/${userId}/foto-perfil`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await parseApiResponse(res, 'Error al subir foto de perfil');
      
      if (data.user) {
        setUserData(data.user);
        try {
          localStorage.setItem('user', JSON.stringify(data.user));
          setCurrentUser(data.user);
        } catch (e) {
          // Ignorar errores de localStorage
        }
      }
      
      setToast({ message: data.message || 'Foto de perfil actualizada correctamente', type: 'success' });
    } catch (err) {
      handleError(err, setToast, 'No se pudo actualizar la foto de perfil');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    if (!token) return setToast({ message: 'No autorizado', type: 'error' });
    const id = userData?.id_usuario || userData?.id;
    if (!id) return setToast({ message: 'ID de usuario no disponible', type: 'error' });
    
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/user/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre: form.nombre_usuario,
          cedula: form.cedula,
          correo: form.correo,
          telefono: form.telefono,
          rol: userData?.nombre_rol || 'Aprendiz'
        })
      });
      const data = await parseApiResponse(res, 'No se pudo actualizar el perfil');
      setToast({ message: data.message || 'Perfil actualizado', type: 'success' });
      setEditing(false);
      await fetchUserData();
    } catch (err) {
      handleError(err, setToast, 'No se pudo actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDeleteAccount = async () => {
    const token = localStorage.getItem('token');
    if (!token) return setToast({ message: 'No autorizado', type: 'error' });
    const id = userData?.id_usuario || userData?.id;
    if (!id) return setToast({ message: 'ID de usuario no disponible', type: 'error' });
    
    setDeletingAccount(true);
    try {
      const res = await fetch(`/api/auth/user/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await parseApiResponse(res, 'No se pudo eliminar la cuenta');
      setToast({ message: 'Tu cuenta ha sido eliminada correctamente', type: 'success' });
      // Cerrar sesión y redirigir al login
      setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }, 1500);
    } catch (err) {
      handleError(err, setToast, 'No se pudo eliminar la cuenta');
      setShowDeleteAccountConfirm(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  // TODOS LOS HOOKS DEBEN ESTAR AQUÍ, ANTES DE CUALQUIER RETURN CONDICIONAL
  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
    }
    fetchUserData();
  }, [fetchUserData]);

  // Debug: Log para verificar la ruta de la imagen
  useEffect(() => {
    if (userData?.foto_perfil) {
      const imageUrl = getImageUrl(userData.foto_perfil);
      console.log('Foto de perfil detectada:', userData.foto_perfil);
      console.log('URL construida:', imageUrl);
    }
  }, [userData?.foto_perfil, getImageUrl]);

  // Return condicional para estado de carga - DEBE estar DESPUÉS de todos los hooks
  if (loading && !userData) {
    return (
      <div className="page simple-page">
        <Header />
        <div className="dashboard-layout">
          <Sidebar user={currentUser} />
          <main className="dashboard-main">
            <div className="perfil-avatar-container">
              <div>Cargando perfil...</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Variables derivadas (después del return condicional está bien)
  const fotoPerfil = userData?.foto_perfil;
  const nombreCompleto = userData?.nombre_usuario || userData?.nombre || 'Usuario';
  const correo = userData?.correo || '-';
  const rol = userData?.nombre_rol || '-';
  const cedula = userData?.cedula || '-';
  const telefono = userData?.telefono || '-';

  return (
    <div className="page simple-page perfil-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <DestructiveConfirmModal
        open={showDeleteAccountConfirm}
        title="Eliminar Cuenta"
        message="¿Estás seguro de que quieres eliminar tu cuenta? Esta acción es destructiva e irreversible. Perderás acceso a todos tus datos y no podrás recuperarlos."
        confirmText="Eliminar Cuenta"
        cancelText="Cancelar"
        confirmationPhrase="confirmar accion"
        loading={deletingAccount}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteAccountConfirm(false)}
      />
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={currentUser} />
        <main className="dashboard-main">
          <div className="perfil-page-container">
            {/* Header de la página */}
            <div className="perfil-page-header">
              <button className="perfil-back-btn" onClick={() => navigate(-1)}>
                <FiArrowLeft size={20} />
                Volver
              </button>
              <div>
                <h1 className="perfil-page-title">Mi Perfil</h1>
                <p className="perfil-page-subtitle">Gestiona tu información personal y foto de perfil</p>
              </div>
              {!editing ? (
                <button className="btn-edit-perfil" onClick={() => setEditing(true)}>
                  <FiEdit2 size={16} className="perfil-edit-btn-icon" />
                  Editar Perfil
                </button>
              ) : (
                <div className="perfil-actions-inline">
                  <button className="btn" onClick={() => { setEditing(false); fetchUserData(); }}>
                    Cancelar
                  </button>
                  <button className="btn-verde" onClick={handleSave} disabled={loading}>
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              )}
            </div>

            <div className="perfil-page-content">
              {/* Sección de foto de perfil */}
              <div className="perfil-photo-section">
                <div className="perfil-photo-card">
                  <div className="perfil-photo-container">
                    {fotoPerfil && (
                      <img
                        src={getImageUrl(fotoPerfil)}
                        alt={nombreCompleto}
                        className="perfil-photo"
                        onError={(e) => {
                          console.error('Error al cargar imagen de perfil:', fotoPerfil, 'URL:', getImageUrl(fotoPerfil));
                          e.target.style.display = 'none';
                          const placeholder = e.target.nextElementSibling;
                          if (placeholder) {
                            placeholder.style.display = 'flex';
                          }
                        }}
                        onLoad={() => {
                          console.log('Imagen de perfil cargada correctamente:', fotoPerfil);
                        }}
                      />
                    )}
                    <div 
                      className="perfil-photo-placeholder"
                      className={fotoPerfil ? 'perfil-avatar-upload-hidden' : 'perfil-avatar-placeholder-visible'}
                    >
                      {getInitials(nombreCompleto)}
                    </div>
                    {!uploading && (
                      <div className="perfil-photo-overlay">
                        <button
                          className="perfil-photo-upload-btn"
                          onClick={() => fileInputRef.current?.click()}
                          title="Cambiar foto de perfil"
                        >
                          <FiCamera size={20} />
                        </button>
                      </div>
                    )}
                    {uploading && (
                      <div className="perfil-photo-uploading">
                        <div className="perfil-photo-spinner"></div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handlePhotoUpload}
                    className="perfil-avatar-upload-hidden"
                  />
                  <h3 className="perfil-photo-name">{nombreCompleto}</h3>
                  <p className="perfil-photo-role">{rol}</p>
                  <p className="perfil-photo-hint">Haz clic en la cámara para cambiar tu foto</p>
                </div>
              </div>

              {/* Sección de información */}
              <div className="perfil-info-section">
                <div className="perfil-info-card">
                  <h3 className="perfil-info-card-title">Información Personal</h3>
                  
                  <div className="perfil-form-grid">
                    <div className="perfil-form-row">
                      <label>
                        <FiUser size={18} />
                        Nombre completo
                      </label>
                      <input
                        name="nombre_usuario"
                        value={form.nombre_usuario}
                        onChange={onChange}
                        readOnly={!editing}
                        className={!editing ? 'readonly' : ''}
                      />
                    </div>

                    <div className="perfil-form-row">
                      <label>
                        <FiCreditCard size={18} />
                        Documento
                      </label>
                      <input
                        name="cedula"
                        value={form.cedula}
                        onChange={onChange}
                        readOnly={!editing}
                        className={!editing ? 'readonly' : ''}
                      />
                    </div>

                    <div className="perfil-form-row">
                      <label>
                        <FiMail size={18} />
                        Correo electrónico
                      </label>
                      <input
                        name="correo"
                        value={form.correo}
                        onChange={onChange}
                        readOnly={!editing}
                        className={!editing ? 'readonly' : ''}
                      />
                    </div>

                    <div className="perfil-form-row">
                      <label>
                        <FiPhone size={18} />
                        Teléfono
                      </label>
                      <input
                        name="telefono"
                        value={form.telefono}
                        onChange={onChange}
                        readOnly={!editing}
                        className={!editing ? 'readonly' : ''}
                      />
                    </div>

                    <div className="perfil-form-row">
                      <label>
                        <FiShield size={18} />
                        Rol
                      </label>
                      <div className="perfil-role-badge">{rol}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección de eliminación de cuenta */}
              <div className="perfil-info-section">
                <div className="perfil-info-card perfil-danger-zone">
                  <h3 className="perfil-info-card-title perfil-danger-title">Zona de Peligro</h3>
                  <p className="perfil-danger-description">
                    Una vez que elimines tu cuenta, no hay vuelta atrás. Por favor, ten cuidado.
                  </p>
                  <button
                    className="btn btn-delete perfil-delete-account-btn"
                    onClick={() => setShowDeleteAccountConfirm(true)}
                    disabled={deletingAccount}
                  >
                    <FiTrash2 size={16} />
                    Eliminar Mi Cuenta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
