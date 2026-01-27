import React, { useEffect, useState, useRef } from 'react';
import { FiUser, FiMail, FiPhone, FiCreditCard, FiCamera, FiEdit2 } from 'react-icons/fi';
import { parseApiResponse, buildErrorMessage } from '../../utils/api';
import Toast from '../../components/Toast';
import '../../styles/perfil.css';

export default function Profile() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nombre_usuario: '', correo: '', telefono: '', cedula: '' });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchMe();
  }, []);

  async function fetchMe() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
        setForm({
          nombre_usuario: data.user.nombre_usuario || '',
          correo: data.user.correo || '',
          telefono: data.user.telefono || '',
          cedula: data.user.cedula || ''
        });
      }
    } catch (err) {
      console.error('Error al obtener datos del usuario:', err);
    }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    const token = localStorage.getItem('token');
    if (!token) return setToast({ message: 'No autorizado', type: 'error' });
    const id = user?.id_usuario || user?.id;
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
          rol: user?.nombre_rol || 'Aprendiz'
        })
      });
      const data = await parseApiResponse(res, 'No se pudo actualizar el perfil');
      setToast({ message: data.message || 'Perfil actualizado', type: 'success' });
      setEditing(false);
      await fetchMe(); // Recargar datos
      try {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...currentUser, ...user, ...form }));
      } catch (e) {
        // Ignorar errores de localStorage
      }
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }

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
      const userId = user?.id_usuario || user?.id;
      
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
        setUser(data.user);
        try {
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...currentUser, ...data.user }));
        } catch (e) {
          // Ignorar errores de localStorage
        }
      }
      
      setToast({ message: data.message || 'Foto de perfil actualizada correctamente', type: 'success' });
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al subir foto de perfil'), type: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    // Usar URL relativa en producción (mismo dominio) o variable de entorno
    const baseUrl = import.meta.env.VITE_API_URL || '';
    return baseUrl ? `${baseUrl}${path}` : path;
  };

  return (
    <div className="form-equipos profile-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="profile-header">
        <div>
          <div className="profile-title">Perfil</div>
          <div className="profile-subtitle">Revisa y actualiza tu información personal y foto de perfil.</div>
        </div>
        <div className="profile-actions">
          {!editing ? (
            <button className="btn btn-verde" onClick={() => setEditing(true)}>
              <FiEdit2 size={16} className="perfil-edit-icon" />
              Editar
            </button>
          ) : (
            <>
              <button className="btn btn-verde" onClick={handleSave} disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="btn btn-secondary profile-cancel-btn" onClick={() => { 
                setEditing(false);
                fetchMe();
              }}>
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="profile-content">
        {/* Sección de foto de perfil */}
        <div className="profile-photo-section">
          <div className="profile-photo-container">
            {user?.foto_perfil ? (
              <img
                src={getImageUrl(user.foto_perfil)}
                alt={user.nombre_usuario || 'Usuario'}
                className="profile-photo"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`profile-photo-placeholder ${user?.foto_perfil ? 'perfil-avatar-upload-hidden' : 'perfil-avatar-upload-visible'}`}
            >
              {getInitials(user?.nombre_usuario || 'Usuario')}
            </div>
            {!uploading && (
              <div className="profile-photo-overlay">
                <button
                  className="profile-photo-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Cambiar foto de perfil"
                >
                  <FiCamera size={18} />
                </button>
              </div>
            )}
            {uploading && (
              <div className="profile-photo-uploading">
                <div className="profile-photo-spinner"></div>
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
          <p className="profile-photo-hint">Haz clic en la cámara para cambiar tu foto de perfil</p>
        </div>

        {/* Formulario de información */}
        <form className="profile-form">
          <div className="form-grid">
            <div className="form-row profile-form-row">
              <label>
                <FiUser size={16} className="perfil-form-icon" />
                Nombre completo
              </label>
              <input
                name="nombre_usuario"
                className={`form-input ${!editing ? 'readonly' : ''}`}
                value={form.nombre_usuario}
                onChange={onChange}
                readOnly={!editing}
              />
            </div>
            <div className="form-row profile-form-row">
              <label>
                <FiMail size={16} className="perfil-form-icon" />
                Correo
              </label>
              <input
                name="correo"
                className={`form-input ${!editing ? 'readonly' : ''}`}
                value={form.correo}
                onChange={onChange}
                readOnly={!editing}
              />
            </div>
            <div className="form-row profile-form-row">
              <label>
                <FiPhone size={16} className="perfil-form-icon" />
                Teléfono
              </label>
              <input
                name="telefono"
                className={`form-input ${!editing ? 'readonly' : ''}`}
                value={form.telefono}
                onChange={onChange}
                readOnly={!editing}
              />
            </div>
            <div className="form-row profile-form-row">
              <label>
                <FiCreditCard size={16} className="perfil-form-icon" />
                Documento
              </label>
              <input
                name="cedula"
                className={`form-input ${!editing ? 'readonly' : ''}`}
                value={form.cedula}
                onChange={onChange}
                readOnly={!editing}
              />
            </div>
            <div className="form-row profile-form-row">
              <label>
                <FiUser size={16} className="perfil-form-icon" />
                Rol
              </label>
              <input
                className="form-input readonly"
                value={user?.nombre_rol || '-'}
                readOnly
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
