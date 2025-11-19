import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import Toast from '../components/Toast';
import { buildErrorMessage, parseApiResponse } from '../utils/api';
import '../styles/auth.css';

export default function CambiarContrasena() {
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [mostrarActual, setMostrarActual] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errores, setErrores] = useState({});
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar que el usuario esté autenticado
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrores({});

    // Validaciones
    const nuevosErrores = {};
    if (!contrasenaActual) {
      nuevosErrores.contrasenaActual = 'La contraseña actual es obligatoria';
    }
    if (!nuevaContrasena) {
      nuevosErrores.nuevaContrasena = 'La nueva contraseña es obligatoria';
    } else if (nuevaContrasena.length < 6) {
      nuevosErrores.nuevaContrasena = 'La contraseña debe tener al menos 6 caracteres';
    }
    if (!confirmarContrasena) {
      nuevosErrores.confirmarContrasena = 'Debes confirmar la nueva contraseña';
    } else if (nuevaContrasena !== confirmarContrasena) {
      nuevosErrores.confirmarContrasena = 'Las contraseñas no coinciden';
    }
    if (contrasenaActual === nuevaContrasena) {
      nuevosErrores.nuevaContrasena = 'La nueva contraseña debe ser diferente a la actual';
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/cambiar-contrasena', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contrasenaActual,
          nuevaContrasena
        })
      });

      const data = await parseApiResponse(res, 'No se pudo cambiar la contraseña');
      setToast({ message: data.message || 'Contraseña cambiada exitosamente', type: 'success' });
      
      // Redirigir al dashboard después de 1 segundo
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo cambiar la contraseña'),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page login-page animated-bg">
      <div className="bubbles-container">
        {[...Array(50)].map((_, i) => {
          const randomX = (Math.random() * 150 - 75);
          const randomDelay = Math.random() * 25;
          const randomDuration = 12 + Math.random() * 15;
          const randomSize = 8 + Math.random() * 30;
          const randomOpacity = 0.08 + Math.random() * 0.25;
          return (
            <div
              key={i}
              className="bubble"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${randomDelay}s`,
                animationDuration: `${randomDuration}s`,
                width: `${randomSize}px`,
                height: `${randomSize}px`,
                opacity: randomOpacity,
                '--move-x': `${randomX}px`
              }}
            ></div>
          );
        })}
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="login-card">
        <div className="logo-box">
          <div className="logo"><img src='/public/images/logoSena.png' alt="Logo SENA" /></div>
        </div>
        <h1 className="title">Cambiar Contraseña</h1>
        <p className="subtitle">Debes cambiar tu contraseña para continuar</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type={mostrarActual ? 'text' : 'password'}
              placeholder="Contraseña actual"
              value={contrasenaActual}
              onChange={(e) => setContrasenaActual(e.target.value)}
            />
            <span 
              className="eye" 
              onClick={() => setMostrarActual(!mostrarActual)}
            >
              {mostrarActual ? <FiEyeOff /> : <FiEye />}
            </span>
          </label>
          {errores.contrasenaActual && <div className="error-msg">{errores.contrasenaActual}</div>}

          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type={mostrarNueva ? 'text' : 'password'}
              placeholder="Nueva contraseña"
              value={nuevaContrasena}
              onChange={(e) => setNuevaContrasena(e.target.value)}
            />
            <span 
              className="eye" 
              onClick={() => setMostrarNueva(!mostrarNueva)}
            >
              {mostrarNueva ? <FiEyeOff /> : <FiEye />}
            </span>
          </label>
          {errores.nuevaContrasena && <div className="error-msg">{errores.nuevaContrasena}</div>}

          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type={mostrarConfirmar ? 'text' : 'password'}
              placeholder="Confirmar nueva contraseña"
              value={confirmarContrasena}
              onChange={(e) => setConfirmarContrasena(e.target.value)}
            />
            <span 
              className="eye" 
              onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
            >
              {mostrarConfirmar ? <FiEyeOff /> : <FiEye />}
            </span>
          </label>
          {errores.confirmarContrasena && <div className="error-msg">{errores.confirmarContrasena}</div>}

          <button 
            className="btn primary" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}

