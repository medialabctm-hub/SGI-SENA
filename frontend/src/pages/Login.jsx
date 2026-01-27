import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import Toast from '../components/Toast';
import InteractiveBackground from '../components/InteractiveBackground';
import { buildErrorMessage, parseApiResponse, handleError } from '../utils/api';
import '../styles/auth.css';

export default function Login() {
  const [cedula, setCedula] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [errores, setErrores] = useState({});
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación mínima
    const nuevosErrores = {};
    if (!cedula) {
      nuevosErrores.cedula_usuario = 'La Documento es obligatoria';
    }
    if (!contrasena) {
      nuevosErrores.contraseña_usuario = 'La contraseña es obligatoria';
    }
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      return;
    }

    // Llamada real al backend
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, contrasena }),
      });
      const data = await parseApiResponse(res, 'No se pudo iniciar sesión');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Si requiere cambio de contraseña, redirigir a la página de cambio
      if (data.requiereCambioContrasena) {
        setToast({ message: 'Debes cambiar tu contraseña antes de continuar', type: 'warning' });
        navigate('/cambiar-contrasena');
      } else {
        setToast({ message: 'Inicio de sesión exitoso', type: 'success' });
        navigate('/dashboard');
      }
    } catch (err) {
      handleError(err, setToast, 'No se pudo iniciar sesión');
    }
  };

  return (
    <div className="page login-page animated-bg">
      <InteractiveBackground />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="login-card">
        <div className="logo-box">
          <div className="logo"><img src='/images/logoSena.png' alt="Logo SENA" /></div>
        </div>
        <h1 className="title">Gestión de Inventario</h1>
        <p className="subtitle">SGI SENA</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="input">
            <span className="icon"><FiMail /></span>
            <input
              type="text"
              placeholder="Documento"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
            />
          </label>
          {errores.cedula_usuario && <div className="error-msg">{errores.cedula_usuario}</div>}
          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type={mostrarContrasena ? 'text' : 'password'}
              placeholder="Contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
            <span 
              className="eye eye-clickable" 
              onClick={() => setMostrarContrasena(!mostrarContrasena)}
            >
              {mostrarContrasena ? <FiEyeOff /> : <FiEye />}
            </span>
          </label>
          {errores.contraseña_usuario && <div className="error-msg">{errores.contraseña_usuario}</div>}
          <button className="btn primary" type="submit">Iniciar Sesión</button>
        </form>

        <div className="links">
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              navigate('/olvidar-contrasena');
            }}
          >
            ¿Olvidaste tu contraseña?
          </a>
          <div>
            ¿No tienes cuenta?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate('/register');
              }}
            >
              Regístrate
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
