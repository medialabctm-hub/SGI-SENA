import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiHash, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import Toast from '../components/Toast';
import InteractiveBackground from '../components/InteractiveBackground';
import { buildErrorMessage, parseApiResponse } from '../utils/api';
import {
  createRequestGuard,
  isRequestTimeout,
  submitLoanRequest,
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
    const result = await submitLoanRequest({
      guard: requestGuardRef.current,
      identity: loanRequestIdentityRef.current || undefined,
      documento: documento.trim(),
      placa: placa.trim(),
      onLoading: setLoading,
    });
    loanRequestIdentityRef.current = result.request.identity;
    if (result.kind === 'success') {
      setPrestamo(result.loan);
      setPaso(PASO_CONFIRMACION);
      return;
    }
    if (result.kind === 'timeout') {
      setToast({
        message: buildErrorMessage(new Error('timeout'), 'No se pudo registrar el préstamo del equipo'),
        type: 'error'
      });
      return;
    }
    if (result.kind === 'error') {
      setToast({
        message: buildErrorMessage(result.error, 'No se pudo registrar el préstamo del equipo'),
        type: 'error'
      });
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
            <label htmlFor="placa">Placa del equipo</label>
            <div className="input">
              <span className="icon"><FiHash /></span>
              <input
                id="placa"
                type="text"
                placeholder="Placa del equipo"
                name="placa"
                value={placa}
                onChange={(e) => {
                  setPlaca(e.target.value);
                  limpiarIdentidadPrestamo();
                  if (errores.placa) setErrores((prev) => ({ ...prev, placa: undefined }));
                }}
                autoFocus
                aria-invalid={Boolean(errores.placa)}
                aria-describedby={errores.placa ? 'placa-error' : undefined}
              />
            </div>
            {errores.placa && <div id="placa-error" className="error-msg" role="alert">{errores.placa}</div>}

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
          <label htmlFor="documento">Número de documento</label>
          <div className="input">
            <span className="icon"><FiUser /></span>
            <input
              id="documento"
              type="text"
              placeholder="Documento"
              name="documento"
              inputMode="numeric"
              value={documento}
              onChange={(e) => {
                setDocumento(e.target.value);
                if (errores.documento) setErrores((prev) => ({ ...prev, documento: undefined }));
              }}
              autoFocus
              aria-invalid={Boolean(errores.documento)}
              aria-describedby={errores.documento ? 'documento-error' : undefined}
            />
          </div>
          {errores.documento && <div id="documento-error" className="error-msg" role="alert">{errores.documento}</div>}

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
