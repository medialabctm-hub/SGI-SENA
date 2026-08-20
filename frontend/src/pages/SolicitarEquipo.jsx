import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiHash, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import Toast from '../components/Toast';
import InteractiveBackground from '../components/InteractiveBackground';
import { buildErrorMessage, parseApiResponse } from '../utils/api';
import {
  createLoanRequestOptions,
  createRequestGuard,
  isRequestTimeout,
  normalizeLoanResponse,
} from '../utils/loanRequest';
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
  const requestGuardRef = useRef(createRequestGuard());
  const loanRequestIdentityRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => requestGuardRef.current.cancel(), []);

  const cancelarSolicitudPendiente = () => {
    requestGuardRef.current.cancel();
    setLoading(false);
  };

  const limpiarIdentidadPrestamo = () => {
    loanRequestIdentityRef.current = null;
  };

  const handleVerificarDocumento = async (e) => {
    e.preventDefault();
    setErrores({});
    setToast(null);

    if (!documento.trim()) {
      setErrores({ documento: 'El documento es obligatorio' });
      return;
    }
    if (documento.trim().length > 50) {
      setErrores({ documento: 'El documento no puede superar 50 caracteres' });
      return;
    }

    const request = requestGuardRef.current.start();
    setLoading(true);
    try {
      const res = await fetch(`/api/aprendices/verificar/${encodeURIComponent(documento.trim())}`, {
        signal: request.signal,
      });
      const data = await parseApiResponse(res, 'No se pudo verificar el documento');
      if (!requestGuardRef.current.isCurrent(request.id)) return;
      const aprendizData = data?.data?.aprendiz || data?.aprendiz || data;
      setAprendiz(aprendizData);
      setPaso(PASO_PLACA);
    } catch (err) {
      if (isRequestTimeout(err, request)) {
        setToast({
          message: buildErrorMessage(new Error('timeout'), 'No se pudo verificar el documento'),
          type: 'error'
        });
        return;
      }
      if (err?.name === 'AbortError' || !requestGuardRef.current.isCurrent(request.id)) return;
      setToast({
        message: buildErrorMessage(err, 'No se pudo verificar el documento'),
        type: 'error'
      });
    } finally {
      if (requestGuardRef.current.isCurrent(request.id) || isRequestTimeout(null, request)) {
        setLoading(false);
        requestGuardRef.current.finish(request.id);
      }
    }
  };

  const handleSolicitarEquipo = async (e) => {
    e.preventDefault();
    setErrores({});
    setToast(null);

    if (!placa.trim()) {
      setErrores({ placa: 'La placa del equipo es obligatoria' });
      return;
    }
    if (placa.trim().length > 100) {
      setErrores({ placa: 'La placa no puede superar 100 caracteres' });
      return;
    }

    const request = requestGuardRef.current.start({ identity: loanRequestIdentityRef.current || undefined });
    loanRequestIdentityRef.current = request.identity;
    setLoading(true);
    try {
      const res = await fetch('/api/equipos/autoservicio/iniciar-uso', {
        ...createLoanRequestOptions(documento.trim(), placa.trim(), request.identity),
        signal: request.signal,
      });
      const data = await parseApiResponse(res, 'No se pudo registrar el préstamo del equipo');
      const loan = normalizeLoanResponse(data);
      if (!requestGuardRef.current.isCurrent(request.id)) return;
      setPrestamo(loan);
      setPaso(PASO_CONFIRMACION);
    } catch (err) {
      if (isRequestTimeout(err, request)) {
        setToast({
          message: buildErrorMessage(new Error('timeout'), 'No se pudo registrar el préstamo del equipo'),
          type: 'error'
        });
        return;
      }
      if (err?.name === 'AbortError' || !requestGuardRef.current.isCurrent(request.id)) return;
      setToast({
        message: buildErrorMessage(err, 'No se pudo registrar el préstamo del equipo'),
        type: 'error'
      });
    } finally {
      if (requestGuardRef.current.isCurrent(request.id) || isRequestTimeout(null, request)) {
        setLoading(false);
        requestGuardRef.current.finish(request.id);
      }
    }
  };

  const reiniciar = () => {
    cancelarSolicitudPendiente();
    limpiarIdentidadPrestamo();
    setPaso(PASO_DOCUMENTO);
    setDocumento('');
    setPlaca('');
    setAprendiz(null);
    setPrestamo(null);
    setErrores({});
    setToast(null);
  };

  const pedirOtroEquipo = () => {
    cancelarSolicitudPendiente();
    limpiarIdentidadPrestamo();
    setPaso(PASO_PLACA);
    setPlaca('');
    setPrestamo(null);
    setErrores({});
    setToast(null);
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
                name="placa"
                maxLength={100}
                required
                value={placa}
                onChange={(e) => {
                  setPlaca(e.target.value);
                  limpiarIdentidadPrestamo();
                  if (errores.placa) setErrores((prev) => ({ ...prev, placa: undefined }));
                }}
                autoFocus
              />
            </label>
            {errores.placa && <div className="error-msg">{errores.placa}</div>}

            <button className="btn primary btn-full-width" type="submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Solicitando...' : 'Solicitar equipo'}
            </button>
          </form>

          <div className="links links-with-margin">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); if (!loading) reiniciar(); }}
              aria-disabled={loading}
              tabIndex={loading ? -1 : 0}
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
              name="documento"
              inputMode="numeric"
              maxLength={50}
              required
              value={documento}
              onChange={(e) => {
                setDocumento(e.target.value);
                if (errores.documento) setErrores((prev) => ({ ...prev, documento: undefined }));
              }}
              autoFocus
            />
          </label>
          {errores.documento && <div className="error-msg">{errores.documento}</div>}

          <button className="btn primary btn-full-width" type="submit" disabled={loading} aria-busy={loading}>
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
