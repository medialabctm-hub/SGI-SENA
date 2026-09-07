import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import { FiPackage, FiInbox } from 'react-icons/fi';
import { parseApiResponse, buildErrorMessage } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import '../styles/pages/equipos.css';
import '../styles/misEquipos.css';
import { LoadingScreen } from './LoadingDemo';

export default function MisEquipos() {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchMisEquipos();
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
    }
  }, []);

  // Suscribirse a actualizaciones en tiempo real de equipos y asignaciones
  const { subscribe } = useSocket();
  useEffect(() => {
    if (!subscribe) return;

    const unsubscribeEquipo = subscribe('equipo:updated', () => {
      fetchMisEquipos();
    });

    const unsubscribeEquipoDeleted = subscribe('equipo:deleted', () => {
      fetchMisEquipos();
    });

    const unsubscribeAsignacionCreated = subscribe('asignacion:created', () => {
      fetchMisEquipos();
    });

    const unsubscribeAsignacionDeleted = subscribe('asignacion:deleted', () => {
      fetchMisEquipos();
    });

    return () => {
      unsubscribeEquipo();
      unsubscribeEquipoDeleted();
      unsubscribeAsignacionCreated();
      unsubscribeAsignacionDeleted();
    };
  }, [subscribe]);

  async function fetchMisEquipos() {
    setLoading(true);
    try {
      const res = await fetch('/api/equipos/mis-equipos/asignados', {
        credentials: 'include',
      });
      const data = await parseApiResponse(
        res,
        'No se pudieron cargar tus equipos habilitados'
      );
      setEquipos(Array.isArray(data) ? data : []);
    } catch (err) {
      setToast({
        message: buildErrorMessage(
          err,
          'No se pudieron cargar tus equipos habilitados'
        ),
        type: 'error',
      });
      setEquipos([]);
    } finally {
      setLoading(false);
    }
  }

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
          <div className="form-equipos form-modern">
            <div className="form-header">
              <div className="form-icon-wrapper mis-equipos-header-icon">
                <FiPackage size={28} color="#fff" />
              </div>
              <div>
                <h2 className="mis-equipos-title">Mis Equipos</h2>
                <p className="mis-equipos-subtitle">
                  Inventario y equipos bajo tu responsabilidad actualmente
                </p>
              </div>
            </div>

            <div className="form-divider"></div>

            {loading ? (
              <div className="loading-state">
                <LoadingScreen message="Cargando equipos" />
              </div>
            ) : equipos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrapper">
                  <FiInbox size={48} color="#adb5bd" />
                </div>
                <h3>No tienes equipos asignados</h3>
                <p>Actualmente no hay equipos bajo tu responsabilidad</p>
              </div>
            ) : (
              <div className="mis-equipos-table-wrapper">
                <table className="consulta-table mis-equipos-table">
                  <thead>
                    <tr>
                      <th>Código Inventario</th>
                      <th>Tipo</th>
                      <th>Modelo</th>
                      <th>Consecutivo</th>
                      <th>Estado</th>
                      <th>Ambiente</th>
                      <th>Responsabilidad</th>
                      <th>Fecha de Registro</th>
                      <th>Días Habilitado</th>
                      <th>Asignado Por</th>
                      <th>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map(eq => (
                      <tr key={eq.codigo_equipo}>
                        <td data-label="Código de inventario">
                          {eq.codigo_inventario || '-'}
                        </td>
                        <td data-label="Tipo">{eq.tipo}</td>
                        <td data-label="Modelo">{eq.modelo || '-'}</td>
                        <td data-label="Consecutivo">
                          {eq.consecutivo || '-'}
                        </td>
                        <td data-label="Estado">
                          <span
                            className={`badge ${
                              eq.estado_fisico === 'Nuevo'
                                ? 'badge-success'
                                : eq.estado_fisico === 'Bueno'
                                  ? 'badge-info'
                                  : eq.estado_fisico === 'Regular'
                                    ? 'badge-warning'
                                    : eq.estado_fisico === 'Malo'
                                      ? 'badge-warning'
                                      : eq.estado_fisico === 'Dañado'
                                        ? 'badge-error'
                                        : 'badge-info'
                            }`}
                          >
                            {eq.estado_fisico}
                          </span>
                        </td>
                        <td data-label="Ambiente">
                          {eq.nombre_ambiente || 'Sin ambiente'}
                          {eq.codigo_ambiente && (
                            <div className="mis-equipos-info-text">
                              ({eq.codigo_ambiente})
                            </div>
                          )}
                        </td>
                        <td data-label="Responsabilidad">
                          <span
                            className={
                              eq.tipo_responsabilidad === 'Principal'
                                ? 'mis-equipos-responsabilidad-badge'
                                : 'mis-equipos-responsabilidad-secundario'
                            }
                          >
                            {eq.tipo_responsabilidad}
                          </span>
                        </td>
                        <td data-label="Fecha de registro">
                          {eq.fecha_asignacion || eq.fecha_adquisicion
                            ? new Date(
                                eq.fecha_asignacion || eq.fecha_adquisicion
                              ).toLocaleDateString('es-CO')
                            : '-'}
                        </td>
                        <td data-label="Días habilitado">
                          <span className="mis-equipos-responsabilidad-badge">
                            {eq.dias_asignado ?? '-'}
                          </span>
                        </td>
                        <td data-label="Asignado por">
                          {eq.origen_responsabilidad ===
                          'inventario_cuentadante'
                            ? 'Inventario a cargo'
                            : eq.asignado_por_nombre || 'Sistema'}
                        </td>
                        <td
                          data-label="Observaciones"
                          className="mis-equipos-observaciones"
                        >
                          {eq.observaciones || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="form-actions mis-equipos-actions">
              <button
                className="btn-secondary btn-modern"
                onClick={() => window.history.back()}
              >
                Volver
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
