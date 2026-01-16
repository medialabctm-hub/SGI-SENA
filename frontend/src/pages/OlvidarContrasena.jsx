import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import Toast from '../components/Toast';
import InteractiveBackground from '../components/InteractiveBackground';
import { buildErrorMessage, parseApiResponse } from '../utils/api';
import '../styles/auth.css';

export default function OlvidarContrasena() {
  const [cedula, setCedula] = useState('');
  const [correo, setCorreo] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errores, setErrores] = useState({});
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrores({});

    // Validaciones
    const nuevosErrores = {};
    if (!cedula) {
      nuevosErrores.cedula = 'La Documento es obligatoria';
    }
    if (!correo) {
      nuevosErrores.correo = 'El correo es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      nuevosErrores.correo = 'El correo no es válido';
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/recuperar-contrasena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, correo })
      });

      await parseApiResponse(res, 'No se pudo procesar la solicitud');
      setEnviado(true);
      setToast({
        message: 'Si la cuenta está registrada, recibirás un correo con las instrucciones para restablecer tu contraseña.',
        type: 'success'
      });
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo procesar la solicitud'),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  if (enviado) {
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
          <h1 className="title">Correo Enviado</h1>
          <p className="subtitle subtitle-centered">
            Si el usuario existe, se ha enviado un correo electrónico con las instrucciones para restablecer tu contraseña.
            <br /><br />
            Por favor, revisa tu bandeja de entrada y sigue las instrucciones del correo.
            <br /><br />
            El enlace expirará en 1 hora.
          </p>
          <button
            className="btn primary btn-full-width"
            onClick={() => navigate('/login')}
          >
            Volver al Login
          </button>
        </div>
      </div>
    );
  }

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
        <h1 className="title">Recuperar Contraseña</h1>
        <p className="subtitle">Ingresa tu Documento y correo para recibir un enlace de recuperación</p>

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
          {errores.cedula && <div className="error-msg">{errores.cedula}</div>}

          <label className="input">
            <span className="icon"><FiMail /></span>
            <input
              type="email"
              placeholder="Correo electrónico"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </label>
          {errores.correo && <div className="error-msg">{errores.correo}</div>}

          <button
            className="btn primary btn-full-width"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Enviando...' : 'Enviar Correo de Recuperación'}
          </button>
        </form>

        <div className="links links-with-margin">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('/login');
            }}
            className="back-to-login-link"
          >
            <FiArrowLeft /> Volver al inicio de sesión
          </a>
        </div>
      </div>
    </div>
  );
}

