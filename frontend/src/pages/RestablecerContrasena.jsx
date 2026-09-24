import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle } from 'react-icons/fi';
import Toast from '../components/Toast';
import { buildErrorMessage, parseApiResponse } from '../utils/api';
import { getPasswordError, PASSWORD_POLICY_HELP } from '../utils/passwordPolicy';
import '../styles/auth.css';

/**
 * Lee el token de recuperación desde el fragmento (#token=...), nunca desde
 * query/path (MDL-232): así no viaja en Referer ni en access logs de path.
 */
function readResetTokenFromHash() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleaned);
  return params.get('token');
}

export default function RestablecerContrasena() {
  const [token, setToken] = useState(null);
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validando, setValidando] = useState(true);
  const [tokenValido, setTokenValido] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [errores, setErrores] = useState({});
  const [toast, setToast] = useState(null);
  const [exitoso, setExitoso] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const tokenFromHash = readResetTokenFromHash();
    setToken(tokenFromHash);

    // Quitar el fragmento de la barra de direcciones para que no quede en historial.
    if (tokenFromHash && typeof window !== 'undefined') {
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', `${pathname}${search}`);
    }

    const validarToken = async () => {
      if (!tokenFromHash) {
        setTokenValido(false);
        setValidando(false);
        setToast({
          message: 'Token no proporcionado',
          type: 'error'
        });
        return;
      }

      try {
        // POST body: el token no debe ir en path ni query (MDL-232).
        const res = await fetch('/api/auth/validar-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenFromHash }),
        });
        const data = await parseApiResponse(res, 'Token inválido');
        setTokenValido(true);
        setUsuario(data);
      } catch (err) {
        setTokenValido(false);
        setToast({
          message: buildErrorMessage(err, 'Token inválido o expirado'),
          type: 'error'
        });
      } finally {
        setValidando(false);
      }
    };

    validarToken();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrores({});

    // Validaciones
    const nuevosErrores = {};
    if (!nuevaContrasena) {
      nuevosErrores.nuevaContrasena = 'La nueva contraseña es obligatoria';
    } else {
      const passwordError = getPasswordError(nuevaContrasena);
      if (passwordError) {
        nuevosErrores.nuevaContrasena = passwordError;
      }
    }
    if (!confirmarContrasena) {
      nuevosErrores.confirmarContrasena = 'Debes confirmar la nueva contraseña';
    } else if (nuevaContrasena !== confirmarContrasena) {
      nuevosErrores.confirmarContrasena = 'Las contraseñas no coinciden';
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/restablecer-contrasena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nuevaContrasena })
      });

      await parseApiResponse(res, 'No se pudo restablecer la contraseña');
      setExitoso(true);
      setToast({
        message: 'Contraseña restablecida exitosamente',
        type: 'success'
      });

      // Redirigir al login después de 3 segundos
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo restablecer la contraseña'),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  if (validando) {
    return (
      <div className="page login-page animated-bg">
        <div className="login-card">
          <div className="logo-box">
            <div className="logo"><img src='/images/logoSena.png' alt="Logo SENA" /></div>
          </div>
          <h1 className="title">Validando...</h1>
          <p className="subtitle">Por favor espera</p>
        </div>
      </div>
    );
  }

  if (!tokenValido) {
    return (
      <div className="page login-page animated-bg">
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
          <h1 className="title">Token Inválido</h1>
          <p className="subtitle subtitle-centered">
            El enlace de recuperación no es válido o ha expirado.
            <br /><br />
            Por favor, solicita un nuevo enlace de recuperación.
          </p>
          <button
            className="btn primary btn-full-width btn-with-margin"
            onClick={() => navigate('/olvidar-contrasena')}
          >
            Solicitar Nuevo Enlace
          </button>
          <button
            className="btn btn-full-width"
            onClick={() => navigate('/login')}
          >
            Volver al Login
          </button>
        </div>
      </div>
    );
  }

  if (exitoso) {
    return (
      <div className="page login-page animated-bg">
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
          <div className="success-container">
            <FiCheckCircle size={64} className="success-icon auth-success-icon" />
            <h1 className="title">¡Contraseña Restablecida!</h1>
            <p className="subtitle">
              Tu contraseña ha sido restablecida exitosamente.
              <br />
              Serás redirigido al login en unos segundos...
            </p>
          </div>
          <button
            className="btn primary btn-full-width"
            onClick={() => navigate('/login')}
          >
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

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
          <div className="logo"><img src='/images/logoSena.png' alt="Logo SENA" /></div>
        </div>
        <h1 className="title">Restablecer Contraseña</h1>
        {usuario && (
          <p className="subtitle">
            Hola {usuario.nombre_usuario}, ingresa tu nueva contraseña
          </p>
        )}

        <form onSubmit={handleSubmit} className="form">
          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type={mostrarNueva ? 'text' : 'password'}
              placeholder="Nueva contraseña"
              value={nuevaContrasena}
              onChange={(e) => setNuevaContrasena(e.target.value)}
            />
            <small className="security-help" style={{ display: 'block', marginTop: '0.5rem' }}>
              {PASSWORD_POLICY_HELP}
            </small>
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
            className="btn primary btn-full-width"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Restableciendo...' : 'Restablecer Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}

