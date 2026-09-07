import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../pages/LoadingDemo';
import { parseApiResponse, buildErrorMessage } from '../utils/api';
import Toast from './Toast';
import '../styles/components/protectedRoute.css';

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [toast, setToast] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const checkUser = async () => {
      // Si ya estamos en la página de cambiar contraseña, permitir acceso
      if (location.pathname === '/cambiar-contrasena') {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      try {
        // Verificar si el usuario requiere cambio de contraseña.
        // La cookie httpOnly de sesión viaja automáticamente con credentials
        // incluidas; no se envía (ni existe) un secreto leído del navegador.
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        const data = await parseApiResponse(res, 'No se pudo verificar la sesión');

        setAuthorized(true);
        if (data.user?.requiere_cambio_contrasena) {
          // Redirigir a cambiar contraseña si es necesario
          window.location.href = '/cambiar-contrasena';
        }
      } catch (error) {
        if (error?.status === 401) {
          // parseApiResponse ya disparó handleSessionExpiration: limpió la sesión y
          // programó el hard-redirect a /login en 1.5s. Mostramos el mismo toast que
          // ve el resto de la app y mantenemos la pantalla de carga (no loading=false,
          // no <Navigate>) para no adelantarnos a ese redirect y que el toast alcance
          // a verse.
          setToast({ message: buildErrorMessage(error), type: 'error' });
          return;
        }
        // 403 (autenticado pero sin permiso) u otro error: no es sesión inválida,
        // solo se deniega esta ruta sin tocar la sesión guardada.
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setLoading(false);
    };

    checkUser();
  }, [location.pathname]);

  if (!loading && !authorized) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <LoadingScreen fullPage />
      </>
    );
  }

  return children;
}
