import React, { useCallback, useEffect, useRef, useState } from 'react';
import {FiBell, FiLogOut, FiUser, FiMenu,} from 'react-icons/fi';
import { Link } from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import logo from '/public/images/logoSena.png';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import NotificationsModal from './NotificationsModal';
import ClassNotificationModal from './ClassNotificationModal';
import { buildErrorMessage, parseApiResponse } from '../utils/api';
import { useSidebar } from '../contexts/SidebarContext';
import { useDuplicados } from '../contexts/DuplicadosContext';
import { useSocket } from '../contexts/SocketContext';
import '../styles/layout/header.css';
import '../styles/components/toast.css';
import '../styles/components/modals.css';
import '../styles/notifications.css';

export default function Header() {
  const { tieneDuplicadosPendientes } = useDuplicados();
  const socketHook = useSocket();
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem('user') || '{}')
  );
  const [toast, setToast] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [classNotificationModal, setClassNotificationModal] = useState(null);
  const nav = useNavigate();
  const notificationsRef = useRef(null);
  const { toggleSidebar } = useSidebar();

  // Obtener rol del usuario
  const userRole = user?.nombre_rol || '';
  const isAdmin = userRole === 'Administrador';
  const isInstructor = userRole === 'Instructor';

  // Funciones helper para foto de perfil
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
    // Si ya es una URL completa, devolverla tal cual
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Si empieza con /, usar ruta relativa (funciona con el proxy de nginx)
    if (path.startsWith('/')) {
      return path;
    }
    // Si no tiene /, agregarlo
    return `/${path}`;
  };

  const fotoPerfil = user?.foto_perfil;
  const nombreCompleto = user?.nombre_usuario || user?.nombre || 'Usuario';

  const handleLogout = () => {
    if (tieneDuplicadosPendientes) {
      setToast({
        message: 'No puedes cerrar sesión mientras haya registros con placas duplicadas pendientes de revisión. Por favor, aprueba o rechaza todos los registros antes de continuar.',
        type: 'error'
      });
      return;
    }
    setShowConfirm(true);
  };

  const confirmLogout = () => {
    setShowConfirm(false);
    localStorage.removeItem('token');
    setToast({ message: 'Sesión cerrada correctamente', type: 'success' });
    setTimeout(() => {
      window.location.href = '/login';
    }, 1200);
  };

  const cancelLogout = () => {
    setShowConfirm(false);
  };

  const fetchNotifications = useCallback(
    async ({ silent = false } = {}) => {
      const token = localStorage.getItem('token');
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      if (!silent) {
        setNotificationsLoading(true);
      }
      try {
        const res = await fetch('/api/notifications?limit=15', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await parseApiResponse(
          res,
          'No se pudieron cargar las notificaciones'
        );
        setNotifications(
          Array.isArray(data.notifications) ? data.notifications : []
        );
        setUnreadCount(
          Number.isFinite(data.unreadCount) ? data.unreadCount : 0
        );
        setLastSync(data.generatedAt || new Date().toISOString());
      } catch (err) {
        if (!silent) {
          setToast({
            message: buildErrorMessage(err, 'Error al consultar notificaciones'),
            type: 'error',
          });
        }
      } finally {
        if (!silent) {
          setNotificationsLoading(false);
        }
      }
    },
    []
  );

  const handleOpenPerfil = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setUser(data.user);
          try {
            localStorage.setItem('user', JSON.stringify(data.user));
          } catch {
            // Error silencioso
          }
        }
      }
    } catch (err) {
      // Silencioso: si falla seguimos mostrando lo que haya en localStorage
    }
    nav('/perfil');
  };

  const handleToggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) {
      fetchNotifications();
    }
  };

  const markNotificationAsRead = useCallback(
    async (id) => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`/api/notifications/${id}/read`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        await parseApiResponse(
          res,
          'No se pudo marcar la notificación como leída'
        );
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === id
              ? { ...notification, leida: true }
              : notification
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        setToast({
          message: buildErrorMessage(err, 'Error al actualizar la notificación'),
          type: 'error',
        });
      }
    },
    []
  );

  const markAllNotificationsAsRead = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await parseApiResponse(res, 'No se pudo marcar todas las notificaciones');
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, leida: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'Error al actualizar las notificaciones'),
        type: 'error',
      });
    }
  }, []);

  useEffect(() => {
    fetchNotifications({ silent: true })
  }, [fetchNotifications])

  // Suscribirse a actualizaciones en tiempo real de notificaciones
  useEffect(() => {
    if (!socketHook || !socketHook.subscribe) return;
    
    const unsubscribe = socketHook.subscribe('notification:new', () => {
      // Recargar notificaciones cuando llegue una nueva
      fetchNotifications({ silent: true });
    });
    
    return unsubscribe;
  }, [socketHook, fetchNotifications])

  // Detectar notificaciones de clases y mostrar modal automáticamente
  useEffect(() => {
    if (notifications.length === 0) return

    // Buscar notificación no leída: consentimiento (Aceptar/Rechazar) o informativa (clase por comenzar para cuentadante principal)
    const notificacionClase = notifications.find(
      (notif) =>
        !notif.leida &&
        notif.metadata &&
        notif.metadata.id_clase &&
        (notif.metadata.tipo === 'consentimiento_inicio' ||
          notif.metadata.tipo === 'clase_proxima_inicio')
    )

    // Verificar estado de la clase antes de mostrar el modal
    async function verificarYMostrarModal() {
      if (!notificacionClase || classNotificationModal) return

      try {
        const token = localStorage.getItem('token')
        if (!token || !notificacionClase.metadata?.id_clase) return

        const res = await fetch(`/api/clases/${notificacionClase.metadata.id_clase}`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (res.ok) {
          const clase = await res.json()
          // Solo mostrar el modal si la clase está en estado "Programada"
          if (clase.estado_clase === 'Programada') {
            setClassNotificationModal(notificacionClase)
          } else {
            // Si la clase ya no está en "Programada", marcar la notificación como leída
            if (markNotificationAsRead && notificacionClase.id) {
              markNotificationAsRead(notificacionClase.id)
            }
          }
        }
      } catch (err) {
        console.error('Error al verificar estado de la clase:', err)
        // En caso de error, no mostrar el modal
      }
    }

    verificarYMostrarModal()
  }, [notifications, classNotificationModal, markNotificationAsRead])

  // Actualizar usuario cuando cambie en localStorage (ej: al actualizar foto de perfil)
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        }
      } catch (error) {
        // Ignorar errores de parsing
      }
    };

    // Escuchar cambios en localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // También verificar periódicamente (para cambios en la misma pestaña)
    const interval = setInterval(() => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          // Solo actualizar si hay cambios en foto_perfil
          if (parsedUser.foto_perfil !== user?.foto_perfil || 
              parsedUser.nombre_usuario !== user?.nombre_usuario) {
            setUser(parsedUser);
          }
        }
      } catch (error) {
        // Ignorar errores
      }
    }, 1000); // Verificar cada segundo

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user?.foto_perfil, user?.nombre_usuario])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!showNotifications) return;
      const node = notificationsRef.current;
      if (node && !node.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <ConfirmModal
        open={showConfirm}
        message="¿Seguro que deseas cerrar sesión?"
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
      />
      {/* Modal de consentimiento para iniciar clase */}
      {classNotificationModal && (
        <ClassNotificationModal
          notification={classNotificationModal}
          onClose={() => {
            setClassNotificationModal(null)
            // Marcar como leída al cerrar
            if (classNotificationModal.id) {
              markNotificationAsRead(classNotificationModal.id)
            }
          }}
          onMarkAsRead={markNotificationAsRead}
        />
      )}
      <header className="app-header-wrapper">
        <div className="app-header">
          <div className="header-left">
            <button
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              type="button"
            >
              <FiMenu />
            </button>
            <div className="app-logo">
              <Link to="/dashboard">
                  <img src={logo} alt="logo" />
                </Link>
            </div>
            <div className="app-title">
              <div className="name">Gestión de Inventario</div>
              <div className="sub">SENA</div>
            </div>
          </div>
          <div className="header-right">
            <div className="notifications-wrapper" ref={notificationsRef}>
              <button
                className="header-icon-btn"
                onClick={handleToggleNotifications}
                aria-label="notificaciones"
                type="button"
              >
                <FiBell />
                {unreadCount > 0 && (
                  <span className="notifications-counter" aria-live="polite">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <NotificationsModal
                  onClose={() => setShowNotifications(false)}
                  notifications={notifications}
                  loading={notificationsLoading}
                  unreadCount={unreadCount}
                  onMarkAsRead={markNotificationAsRead}
                  onMarkAllRead={markAllNotificationsAsRead}
                  lastSync={lastSync}
                />
              )}
            </div>
            <button
              className="header-icon-btn header-profile-btn"
              onClick={handleOpenPerfil}
              aria-label="perfil"
              type="button"
            >
              {fotoPerfil ? (
                <img
                  src={getImageUrl(fotoPerfil)}
                  alt={nombreCompleto}
                  className="header-profile-photo"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const placeholder = e.target.nextElementSibling;
                    if (placeholder) {
                      placeholder.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className={`header-profile-placeholder ${fotoPerfil ? 'header-avatar-placeholder-hidden' : 'header-avatar-placeholder-visible'}`}
              >
                {getInitials(nombreCompleto)}
              </div>
            </button>
            <button
              className="header-icon-btn"
              onClick={handleLogout}
              aria-label="cerrar sesión"
              type="button"
            >
              <FiLogOut />
            </button>
          </div>
        </div>
      </header>
    </>
  )
}
                