import React, { useEffect, useState } from 'react';
import {
  FiCalendar,
  FiClock,
  FiInbox,
  FiMapPin,
  FiMonitor,
  FiRefreshCw,
  FiUser,
} from 'react-icons/fi';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import { useSocket } from '../contexts/SocketContext';
import { parseApiResponse, buildErrorMessage } from '../utils/api';
import '../styles/pages/equipos.css';
import '../styles/equiposPrestados.css';
import { LoadingScreen } from './LoadingDemo';

function parseDays(days) {
  if (Array.isArray(days)) return days;
  if (typeof days !== 'string' || !days.trim()) return [];

  try {
    const parsed = JSON.parse(days);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatTime(time) {
  if (!time) return null;
  return typeof time === 'string' ? time.slice(0, 5) : String(time).slice(0, 5);
}

function formatDate(date) {
  if (!date) return null;
  const dateValue =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? `${date}T00:00:00`
      : date;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTime(date) {
  if (!date) return '-';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatElapsed(minutes) {
  const totalMinutes = Number(minutes);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 1)
    return 'Hace unos minutos';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const remainingMinutes = totalMinutes % 60;
  const parts = [];

  if (days) parts.push(`${days} d`);
  if (hours) parts.push(`${hours} h`);
  if (!days && remainingMinutes) parts.push(`${remainingMinutes} min`);
  return parts.join(' ');
}

function ScheduleDetails({ session }) {
  const days = parseDays(session.dias_semana);
  const startTime = formatTime(
    session.hora_inicio || session.clase_hora_inicio
  );
  const endTime = formatTime(session.hora_fin || session.clase_hora_fin);
  const classDate = formatDate(session.fecha_clase);

  return (
    <div className="prestados-schedule">
      {session.nombre_clase && (
        <div className="prestados-schedule-class">
          <FiCalendar size={14} />
          {session.nombre_clase}
          {session.ficha_clase ? ` · Ficha ${session.ficha_clase}` : ''}
        </div>
      )}
      {(days.length > 0 || classDate) && (
        <div>{days.length > 0 ? days.join(', ') : classDate}</div>
      )}
      {startTime && endTime ? (
        <div>
          {startTime} – {endTime}
        </div>
      ) : !session.nombre_clase && days.length === 0 ? (
        <span className="prestados-muted">Sin horario registrado</span>
      ) : null}
    </div>
  );
}

export default function EquiposPrestados() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) setUser(JSON.parse(userData));
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
    }
  }, []);

  async function fetchSessions(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/equipos/uso/activas', {
        credentials: 'include',
      });
      const data = await parseApiResponse(
        res,
        'No se pudieron cargar los equipos prestados'
      );
      setSessions(Array.isArray(data.sesiones) ? data.sesiones : []);
    } catch (err) {
      setToast({
        message: buildErrorMessage(
          err,
          'No se pudieron cargar los equipos prestados'
        ),
        type: 'error',
      });
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchSessions();
  }, []);

  const { subscribe } = useSocket();
  useEffect(() => {
    if (!subscribe) return undefined;

    const refreshSessions = () => fetchSessions(true);
    const unsubscribeAutoservicio = subscribe(
      'equipo:autoservicio_iniciado',
      refreshSessions
    );
    const unsubscribeAsignacionCreated = subscribe(
      'asignacion:created',
      refreshSessions
    );
    const unsubscribeAsignacionDeleted = subscribe(
      'asignacion:deleted',
      refreshSessions
    );

    return () => {
      unsubscribeAutoservicio();
      unsubscribeAsignacionCreated();
      unsubscribeAsignacionDeleted();
    };
  }, [subscribe]);

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
          <div className="form-equipos form-modern prestados-page">
            <div className="form-header">
              <div className="form-icon-wrapper prestados-header-icon">
                <FiMonitor size={28} color="#fff" />
              </div>
              <div className="form-header-content">
                <h2 className="form-header-title">Equipos prestados</h2>
                <p className="form-header-subtitle">
                  Consulta los equipos que están en uso, el ambiente y la
                  programación asociada.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary btn-modern prestados-refresh-button"
                onClick={() => fetchSessions(true)}
                disabled={loading || refreshing}
              >
                <FiRefreshCw
                  size={16}
                  className={refreshing ? 'prestados-spin' : ''}
                />
                Actualizar
              </button>
            </div>

            <div className="prestados-summary">
              <FiClock size={18} />
              <strong>{sessions.length}</strong>
              {sessions.length === 1
                ? ' equipo está prestado actualmente'
                : ' equipos están prestados actualmente'}
            </div>

            {loading ? (
              <div className="loading-state">
                <LoadingScreen message="Cargando equipos prestados" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrapper">
                  <FiInbox size={48} />
                </div>
                <h3>No hay equipos prestados</h3>
                <p>En este momento no hay equipos registrados como en uso.</p>
              </div>
            ) : (
              <div className="prestados-table-wrapper">
                <table className="consulta-table prestados-table">
                  <thead>
                    <tr>
                      <th scope="col">Equipo</th>
                      <th scope="col">Ambiente</th>
                      <th scope="col">Quién lo tiene</th>
                      <th scope="col">Horario y días</th>
                      <th scope="col">En préstamo desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(session => (
                      <tr key={session.id_historial}>
                        <td data-label="Equipo">
                          <strong>
                            {session.codigo_inventario ||
                              `Equipo ${session.codigo_equipo}`}
                          </strong>
                          <div className="prestados-muted">
                            {[session.equipo_tipo, session.equipo_modelo]
                              .filter(Boolean)
                              .join(' · ') || '-'}
                          </div>
                        </td>
                        <td data-label="Ambiente">
                          <div className="prestados-icon-text">
                            <FiMapPin size={15} />
                            {session.nombre_ambiente || 'Sin ambiente asignado'}
                          </div>
                          {session.codigo_ambiente && (
                            <div className="prestados-muted">
                              {session.codigo_ambiente}
                            </div>
                          )}
                        </td>
                        <td data-label="Quién lo tiene">
                          <div className="prestados-icon-text">
                            <FiUser size={15} />
                            {session.usuario_nombre ||
                              'Usuario no identificado'}
                          </div>
                          {session.usuario_cedula && (
                            <div className="prestados-muted">
                              Documento: {session.usuario_cedula}
                            </div>
                          )}
                        </td>
                        <td data-label="Horario y días">
                          <ScheduleDetails session={session} />
                        </td>
                        <td data-label="En préstamo desde">
                          <div>{formatDateTime(session.fecha_hora_inicio)}</div>
                          <div className="prestados-elapsed">
                            Hace {formatElapsed(session.minutos_transcurridos)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
