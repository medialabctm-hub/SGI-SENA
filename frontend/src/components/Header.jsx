import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiBell,
  FiLogOut,
  FiUser,
  FiHome,
  FiSettings,
  FiUsers,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import logo from '/public/images/logoSena.png';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import PerfilModal from './PerfilModal';
import NotificationsModal from './NotificationsModal';
import { buildErrorMessage, parseApiResponse } from '../utils/api';

export default function Header() {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem('user') || '{}')
  );
  const [toast, setToast] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const nav = useNavigate();
  const notificationsRef = useRef(null);

  // Obtener rol del usuario
  const userRole = user?.nombre_rol || '';
  const isAdmin = userRole === 'Administrador';
  const isInstructor = userRole === 'Instructor';

  const handleLogout = () => {
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

  const go = (ruta) => {
    nav(ruta);
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
    setShowPerfil(true);
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
      <PerfilModal
        open={showPerfil}
        user={user}
        onClose={() => setShowPerfil(false)}
      />
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo">
            <img src={logo} alt="logo" />
          </div>
          <div className="app-title">
            <div className="name">Gestión de Equipos</div>
            <div className="sub">SENA</div>
          </div>
        </div>
        <nav className="header-nav">
          <button
            className="nav-btn"
            onClick={() => go('/dashboard')}
            title="Inicio"
          >
            <FiHome /> <span>Inicio</span>
          </button>
          {/* Usuarios: Admin e Instructor */}
          {(isAdmin || isInstructor) && (
            <button
              className="nav-btn"
              onClick={() => go('/usuarios')}
              title="Usuarios"
            >
              <FiUsers /> <span>Usuarios</span>
            </button>
          )}
          <button
            className="nav-btn"
            onClick={() => go('/config')}
            title="Configuración"
          >
            <FiSettings /> <span>Config</span>
          </button>
        </nav>
        <div className="header-right">
          <div className="notifications-wrapper" ref={notificationsRef}>
            <button
              className="nav-btn nav-btn--icon"
              onClick={handleToggleNotifications}
              aria-label="notificaciones"
              type="button"
            >
              <FiBell />
            </button>
            {unreadCount > 0 && (
              <span className="notifications-counter" aria-live="polite">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
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
            className="nav-btn nav-btn--icon"
            onClick={handleOpenPerfil}
            aria-label="perfil"
            type="button"
          >
            <FiUser />
          </button>
          <button
            className="nav-btn nav-btn--icon"
            onClick={handleLogout}
            aria-label="cerrar sesión"
            type="button"
          >
            <FiLogOut />
          </button>
        </div>
      </header>
    </>
  );
}
