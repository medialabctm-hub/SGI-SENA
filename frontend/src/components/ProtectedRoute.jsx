import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import '../styles/protectedRoute.css';

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const checkUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      // Si ya estamos en la página de cambiar contraseña, permitir acceso
      if (location.pathname === '/cambiar-contrasena') {
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
          if (data.user?.requiere_cambio_contrasena) {
            // Redirigir a cambiar contraseña si es necesario
            window.location.href = '/cambiar-contrasena';
            return;
          }
        }
      } catch (error) {
        console.error('Error verificando usuario:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [token, location.pathname]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="protected-route-loading">
        Cargando...
      </div>
    );
  }

  return children;
}
