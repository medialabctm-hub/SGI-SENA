import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiHash, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import Toast from '../components/Toast';
import InteractiveBackground from '../components/InteractiveBackground';
import { buildErrorMessage, parseApiResponse } from '../utils/api';
import '../styles/auth.css';

const PASO_DOCUMENTO = 'documento';
const PASO_PLACA = 'placa';
const PASO_CONFIRMACION = 'confirmacion';

export default function SolicitarEquipo() {
  const [paso, setPaso] = useState(PASO_DOCUMENTO);
  const [documento, setDocumento] = useState('');
  const [placa, setPlaca] = useState('');
  const [aprendiz, setAprendiz] = useState(null);
  const [prestamo, setPrestamo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errores, setErrores] = useState({});
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const handleVerificarDocumento = async (e) => {
    e.preventDefault();
    setErrores({});

    if (!documento.trim()) {
      setErrores({ documento: 'El documento es obligatorio' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/aprendices/verificar/${encodeURIComponent(documento.trim())}`);
      const data = await parseApiResponse(res, 'No se pudo verificar el documento');
      const aprendizData = data?.data?.aprendiz || data?.aprendiz || data;
      setAprendiz(aprendizData);
      setPaso(PASO_PLACA);
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo verificar el documento'),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSolicitarEquipo = async (e) => {
    e.preventDefault();
    setErrores({});

    if (!placa.trim()) {
      setErrores({ placa: 'La placa del equipo es obligatoria' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/equipos/autoservicio/iniciar-uso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: documento.trim(), placa: placa.trim() })
      });
      const data = await parseApiResponse(res, 'No se pudo registrar el préstamo del equipo');
      setPrestamo(data?.data || data);
      setPaso(PASO_CONFIRMACION);
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo registrar el préstamo del equipo'),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const reiniciar = () => {
    setPaso(PASO_DOCUMENTO);
    setDocumento('');
    setPlaca('');
    setAprendiz(null);
    setPrestamo(null);
    setErrores({});
  };

  const pedirOtroEquipo = () => {
    setPaso(PASO_PLACA);
    setPlaca('');
    setPrestamo(null);
    setErrores({});
  };

  if (paso === PASO_CONFIRMACION) {
    return (
      <div className="page login-page animated-bg">
        <InteractiveBackground />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="login-card">
          <div className="logo-box">
            <div className="logo"><img src="/images/logoSena.png" alt="Logo SENA" /></div>
          </div>
          <FiCheckCircle size={48} style={{ color: 'var(--success, #16a34a)', margin: '0 auto 12px', display: 'block' }} />
          <h1 className="title">Equipo asignado</h1>
          <p className="subtitle subtitle-centered">
            Placa <strong>{prestamo?.equipo?.placa}</strong> ({prestamo?.equipo?.tipo} {prestamo?.equipo?.modelo}) asignada a{' '}
            <strong>{prestamo?.aprendiz?.nombre}</strong>.
            <br /><br />
            Se liberará automáticamente cuando termine la clase{prestamo?.clase?.nombre_clase ? ` "${prestamo.clase.nombre_clase}"` : ''}.
          </p>
          <button className="btn primary btn-full-width" onClick={pedirOtroEquipo}>
            Solicitar otro equipo
          </button>
          <div className="links links-with-margin">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); reiniciar(); }}
              className="back-to-login-link"
            >
              <FiArrowLeft /> Ingresar otro documento
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (paso === PASO_PLACA) {
    return (
      <div className="page login-page animated-bg">
        <InteractiveBackground />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="login-card">
          <div className="logo-box">
            <div className="logo"><img src="/images/logoSena.png" alt="Logo SENA" /></div>
          </div>
          <h1 className="title">Hola, {aprendiz?.nombre}</h1>
          <p className="subtitle">Escribe la placa del equipo que vas a usar</p>

          <form onSubmit={handleSolicitarEquipo} className="form">
            <label className="input">
              <span className="icon"><FiHash /></span>
              <input
                type="text"
                placeholder="Placa del equipo"
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                autoFocus
              />
            </label>
            {errores.placa && <div className="error-msg">{errores.placa}</div>}

            <button className="btn primary btn-full-width" type="submit" disabled={loading}>
              {loading ? 'Solicitando...' : 'Solicitar equipo'}
            </button>
          </form>

          <div className="links links-with-margin">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); reiniciar(); }}
              className="back-to-login-link"
            >
              <FiArrowLeft /> No soy yo, cambiar documento
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page login-page animated-bg">
      <InteractiveBackground />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="login-card">
        <div className="logo-box">
          <div className="logo"><img src="/images/logoSena.png" alt="Logo SENA" /></div>
        </div>
        <h1 className="title">Solicitar Equipo</h1>
        <p className="subtitle">Ingresa tu número de documento para continuar</p>

        <form onSubmit={handleVerificarDocumento} className="form">
          <label className="input">
            <span className="icon"><FiUser /></span>
            <input
              type="text"
              placeholder="Documento"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              autoFocus
            />
          </label>
          {errores.documento && <div className="error-msg">{errores.documento}</div>}

          <button className="btn primary btn-full-width" type="submit" disabled={loading}>
            {loading ? 'Verificando...' : 'Continuar'}
          </button>
        </form>

        <div className="links links-with-margin">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); navigate('/login'); }}
            className="back-to-login-link"
          >
            <FiArrowLeft /> Volver al inicio de sesión
          </a>
        </div>
      </div>
    </div>
  );
}
