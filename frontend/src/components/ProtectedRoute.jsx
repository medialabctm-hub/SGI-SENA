import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../pages/LoadingDemo';
import '../styles/components/protectedRoute.css';

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const location = useLocation();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const checkUser = async () => {
      if (!token) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Si ya estamos en la página de cambiar contraseña, permitir acceso
      if (location.pathname === '/cambiar-contrasena') {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      try {
        // Verificar si el usuario requiere cambio de contraseña
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setAuthorized(true);
          if (data.user?.requiere_cambio_contrasena) {
            // Redirigir a cambiar contraseña si es necesario
            window.location.href = '/cambiar-contrasena';
            return;
          }
        } else {
          // Nunca renderizar una ruta protegida con una sesión rechazada.
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.dispatchEvent(new Event('auth:changed'));
          }
          setAuthorized(false);
        }
      } catch (error) {
        console.error('Error verificando usuario:', error);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [token, location.pathname]);

  if (!token || (!loading && !authorized)) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <LoadingScreen fullPage />;
  }

  return children;
}
