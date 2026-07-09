import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCamera, FiX, FiStar, FiImage, FiPackage, FiCheckCircle, FiAlertCircle, FiTrendingDown, FiDollarSign, FiMapPin, FiUsers, FiInfo, FiEdit2, FiClock, FiCalendar, FiUser } from 'react-icons/fi';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import CustomSelect from '../components/CustomSelect';
import { parseApiResponse, buildErrorMessage, handleError, getAuthHeaders } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import '../styles/pages/equipos.css';
import '../styles/pages/usuarios.css';
import '../styles/components/modals.css';
import '../styles/layout/sidebar.css';
import '../styles/pages/ambientes.css';
import { LoadingScreen } from './LoadingDemo';

const TIPOS_AMBIENTE = ['Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega'];
const ESTADOS_AMBIENTE = ['Activo', 'Inactivo', 'En Mantenimiento'];

const INITIAL_FORM = {
  codigo_ambiente: '',
  nombre_ambiente: '',
  tipo_ambiente: 'Aula',
  capacidad_personas: '',
  piso: '',
  edificio: '',
  descripcion: '',
  estado_ambiente: 'Activo',
};

export default function Ambientes() {
  const navigate = useNavigate();
  const [ambientes, setAmbientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAmbiente, setEditingAmbiente] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errores, setErrores] = useState({});
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [currentUser, setCurrentUser] = useState(null);
  const [filtros, setFiltros] = useState({
    estado: '',
    tipo: '',
  });

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch {
    }
  }, []);

  const isAdmin = currentUser?.nombre_rol === 'Administrador';

  const fetchAmbientes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.estado) params.append('estado_ambiente', filtros.estado);
      if (filtros.tipo) params.append('tipo_ambiente', filtros.tipo);

      const url = `/api/ambientes${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      const data = await parseApiResponse(res, 'No se pudo obtener el listado de ambientes');
      setAmbientes(Array.isArray(data) ? data : []);
    } catch (err) {
      setAmbientes([]);
      setToast({
        message: buildErrorMessage(err, 'No se pudo obtener el listado de ambientes'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmbientes();
  }, [filtros]);

  // Suscribirse a actualizaciones en tiempo real de ambientes
  const { subscribe } = useSocket();
  useEffect(() => {
    if (!subscribe) return;
    
    const unsubscribe = subscribe('ambiente:created', () => {
      fetchAmbientes();
    });
    
    const unsubscribeUpdated = subscribe('ambiente:updated', () => {
      fetchAmbientes();
    });
    
    const unsubscribeDeleted = subscribe('ambiente:deleted', () => {
      fetchAmbientes();
    });
    
    return () => {
      unsubscribe();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, [subscribe, fetchAmbientes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errores[name]) {
      setErrores((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errs = {};
    if (!form.codigo_ambiente.trim()) errs.codigo_ambiente = 'El código es obligatorio';
    if (!form.nombre_ambiente.trim()) errs.nombre_ambiente = 'El nombre es obligatorio';
    if (!form.tipo_ambiente) errs.tipo_ambiente = 'El tipo es obligatorio';
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const preparePayload = (src) => {
    const payload = { ...src };
    if (payload.capacidad_personas === '' || payload.capacidad_personas === null) {
      payload.capacidad_personas = null;
    } else {
      const n = Number(payload.capacidad_personas);
      payload.capacidad_personas = Number.isNaN(n) ? null : n;
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const url = editingAmbiente
        ? `/api/ambientes/${editingAmbiente.id_ambiente}`
        : '/api/ambientes';
      const method = editingAmbiente ? 'PUT' : 'POST';

      const payload = preparePayload(form);

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      await parseApiResponse(
        res,
        editingAmbiente ? 'No se pudo actualizar el ambiente' : 'No se pudo crear el ambiente'
      );

      setToast({
        message: editingAmbiente
          ? 'Ambiente actualizado correctamente'
          : 'Ambiente creado correctamente',
        type: 'success',
      });

      setShowForm(false);
      setEditingAmbiente(null);
      setForm(INITIAL_FORM);
      setErrores({});
      fetchAmbientes();
    } catch (err) {
      setToast({
        message: buildErrorMessage(
          err,
          editingAmbiente ? 'Error al actualizar ambiente' : 'Error al crear ambiente'
        ),
        type: 'error',
      });
    }
  };

  const handleEdit = (amb) => {
    setEditingAmbiente(amb);
    setEditingRowId(amb.id_ambiente);
    setForm({
      ...INITIAL_FORM,
      codigo_ambiente: amb.codigo_ambiente || '',
      nombre_ambiente: amb.nombre_ambiente || '',
      tipo_ambiente: amb.tipo_ambiente || INITIAL_FORM.tipo_ambiente,
      capacidad_personas: amb.capacidad_personas || '',
      piso: amb.piso || '',
      edificio: amb.edificio || '',
      descripcion: amb.descripcion || '',
      estado_ambiente: amb.estado_ambiente || INITIAL_FORM.estado_ambiente,
    });
    setShowForm(false);
    setViewAmbiente(null);
  };

  const handleCancelInline = () => {
    setEditingRowId(null);
    setEditingAmbiente(null);
    setErrores({});
    setForm(INITIAL_FORM);
  };

  const handleInlineSave = async () => {
    if (!validateForm()) return;
    try {
      const id = editingRowId || (editingAmbiente && editingAmbiente.id_ambiente);
      if (!id) return;
      const payload = preparePayload(form);
      const res = await fetch(`/api/ambientes/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      await parseApiResponse(res, 'No se pudo actualizar el ambiente');
      setToast({ message: 'Ambiente actualizado correctamente', type: 'success' });
      setEditingRowId(null);
      setEditingAmbiente(null);
      setForm(INITIAL_FORM);
      setErrores({});
      fetchAmbientes();
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar ambiente'), type: 'error' });
    }
  };

  const handleDelete = async () => {
    const id = confirm.id;
    setConfirm({ open: false, id: null });
    if (!id) return;

    try {
      const res = await fetch(`/api/ambientes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      await parseApiResponse(res, 'No se pudo eliminar el ambiente');
      setToast({ message: 'Ambiente eliminado correctamente', type: 'success' });
      fetchAmbientes();
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'Error al eliminar ambiente'),
        type: 'error',
      });
    }
  };

  const filteredAmbientes = ambientes.filter((amb) => {
    const searchTerm = query.toLowerCase();
    return (
      amb.codigo_ambiente?.toLowerCase().includes(searchTerm) ||
      amb.nombre_ambiente?.toLowerCase().includes(searchTerm) ||
      amb.edificio?.toLowerCase().includes(searchTerm) ||
      amb.piso?.toLowerCase().includes(searchTerm)
    );
  });

  return (
    <div className="page simple-page ambientes-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={currentUser} />
        <main className="dashboard-main">
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}

          <div className="users-panel">
            <div className="users-toolbar">
              <h2>Gestión de Ambientes</h2>
              <div className="users-toolbar-actions">
                <input
                  className="search-input"
                  placeholder="Buscar por código, nombre, edificio o piso..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {isAdmin && (
                  <button
                    className="btn-import-users"
                    onClick={() => {
                      setShowForm(true);
                      setEditingAmbiente(null);
                      setViewAmbiente(null);
                      setForm(INITIAL_FORM);
                      setErrores({});
                    }}
                  >
                    + Nuevo Ambiente
                  </button>
                )}
              </div>
            </div>

            <div className="users-content ambientes-content">
              <div className="ambientes-filters-row">
                <CustomSelect
                  name="estado"
                  className="filter-control"
                  value={filtros.estado}
                  onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                  options={['', ...ESTADOS_AMBIENTE]}
                  placeholder="Todos los estados"
                />
                <CustomSelect
                  name="tipo"
                  className="filter-control"
                  value={filtros.tipo}
                  onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
                  options={['', ...TIPOS_AMBIENTE]}
                  placeholder="Todos los tipos"
                />
              </div>
            </div>

            {showForm && (
    <div className="card ambiente-form-card ambientes-form-card">
        <h3>{editingAmbiente ? 'Editar Ambiente' : 'Nuevo Ambiente'}</h3>
        <form onSubmit={handleSubmit}>
            {/* INICIO: Estructura del formulario mejorada */}
            <div className="form-grid-columns">
                {/* Columna 1 */}
                <div className="form-group-column">
                    <div className="form-row">
                        <label>Código Ambiente *</label>
                        <input
                            className="form-control"
                            name="codigo_ambiente"
                            value={form.codigo_ambiente}
                            onChange={handleChange}
                            disabled={!!editingAmbiente}
                            aria-required="true"
                        />
                        {errores.codigo_ambiente && (
                            <span className="error-text">{errores.codigo_ambiente}</span>
                        )}
                    </div>
                    
                    <div className="form-row">
                        <label>Nombre Ambiente *</label>
                        <input
                            className="form-control"
                            name="nombre_ambiente"
                            value={form.nombre_ambiente}
                            onChange={handleChange}
                            aria-required="true"
                        />
                        {errores.nombre_ambiente && (
                            <span className="error-text">{errores.nombre_ambiente}</span>
                        )}
                    </div>

                    <div className="form-row">
                        <label>Tipo Ambiente *</label>
                        <CustomSelect
                            name="tipo_ambiente"
                            className="form-control"
                            value={form.tipo_ambiente}
                            onChange={handleChange}
                            options={TIPOS_AMBIENTE}
                            placeholder="Seleccionar tipo"
                            required
                        />
                        {errores.tipo_ambiente && (
                            <span className="error-text">{errores.tipo_ambiente}</span>
                        )}
                    </div>
                </div>

                {/* Columna 2 */}
                <div className="form-group-column">
                    <div className="form-row">
                        <label>Capacidad de Personas</label>
                        <input
                            className="form-control"
                            type="number"
                            name="capacidad_personas"
                            value={form.capacidad_personas}
                            onChange={handleChange}
                            min="1"
                        />
                    </div>
                    
                    <div className="form-row">
                        <label>Piso</label>
                        <input
                            className="form-control"
                            name="piso"
                            value={form.piso}
                            onChange={handleChange}
                        />
                    </div>
                  
                    <div className="form-row">
                        <label>Estado</label>
                        <CustomSelect
                            name="estado_ambiente"
                            className="form-control"
                            value={form.estado_ambiente}
                            onChange={handleChange}
                            options={ESTADOS_AMBIENTE}
                            placeholder="Seleccionar estado"
                        />
                    </div>
                </div>
            </div>

            {/* Fila de Descripción a ancho completo */}
            <div className="form-row form-full-width">
                <label>Descripción</label>
                <textarea
                    className="form-control"
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    rows="3"
                />
            </div>
                <div className="ambientes-form-actions">
                  <button type="submit" className="btn-primary">
                    {editingAmbiente ? 'Actualizar' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowForm(false);
                      setEditingAmbiente(null);
                      setErrores({});
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}


          {loading ? (
            <LoadingScreen message="Cargando ambientes" />
          ) : filteredAmbientes.length === 0 ? (
            <p>No se encontraron ambientes</p>
          ) : (
            <div className="users-table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Edificio</th>
                    <th>Piso</th>
                    <th>Equipos</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAmbientes.map((amb) => (
                    <tr key={amb.id_ambiente}>
                      {editingRowId === amb.id_ambiente ? (
                        <>
                          <td>
                            <input className="cell-input-edit" name="codigo_ambiente" value={form.codigo_ambiente} disabled />
                          </td>
                          <td>
                            <input className="cell-input-edit" name="nombre_ambiente" value={form.nombre_ambiente} onChange={handleChange} />
                            {errores.nombre_ambiente && <div className="error-text-inline">{errores.nombre_ambiente}</div>}
                          </td>
                          <td>
                            <CustomSelect
                              name="tipo_ambiente"
                              className="cell-select-edit"
                              value={form.tipo_ambiente}
                              onChange={handleChange}
                              options={TIPOS_AMBIENTE}
                              placeholder="Tipo"
                            />
                          </td>
                          <td>
                            <input className="cell-input-edit" name="edificio" value={form.edificio} onChange={handleChange} placeholder="Edificio" />
                          </td>
                          <td>
                            <input className="cell-input-edit" name="piso" value={form.piso} onChange={handleChange} placeholder="Piso" />
                          </td>
                          <td>
                            <span className="equip-count">{amb.total_equipos || 0}</span>
                          </td>
                          <td>
                            <CustomSelect
                              name="estado_ambiente"
                              className="cell-select-edit"
                              value={form.estado_ambiente}
                              onChange={handleChange}
                              options={ESTADOS_AMBIENTE}
                              placeholder="Estado"
                            />
                          </td>
                          <td>
                            <div className="row-actions-edit">
                              <button type="button" className="btn-save-inline" onClick={handleInlineSave}>
                                <FiEdit2 size={14} />
                                Guardar
                              </button>
                              <button type="button" className="btn-cancel-inline" onClick={handleCancelInline}>
                                <FiX size={14} />
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{amb.codigo_ambiente}</td>
                          <td>{amb.nombre_ambiente}</td>
                          <td>{amb.tipo_ambiente}</td>
                          <td>{amb.edificio || '-'}</td>
                          <td>{amb.piso || '-'}</td>
                          <td>
                            <span className="equip-count">{amb.total_equipos || 0}</span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                amb.estado_ambiente === 'Activo'
                                  ? 'badge-success'
                                  : amb.estado_ambiente === 'En Mantenimiento'
                                  ? 'badge-warning'
                                  : 'badge-error'
                              }`}
                            >
                              {amb.estado_ambiente}
                            </span>
                          </td>
                          <td>
                            <div className="users-actions">
                              <button className="btn btn-view" onClick={() => navigate(`/ambientes/${amb.id_ambiente}`)}>Ver</button>
                              {isAdmin && (
                                <>
                                  <button className="btn btn-edit" onClick={() => handleEdit(amb)}>Editar</button>
                                  <button className="btn btn-delete" onClick={() => setConfirm({ open: true, id: amb.id_ambiente })}>Eliminar</button>
                                </>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          </div>

          <ConfirmModal
            open={confirm.open}
            title="Eliminar Ambiente"
            message="¿Está seguro de que desea eliminar este ambiente? Esta acción no se puede deshacer."
            onConfirm={handleDelete}
            onCancel={() => setConfirm({ open: false, id: null })}
          />
        </main>
      </div>
    </div>
  );
}

