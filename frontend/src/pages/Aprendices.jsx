import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiDownload,
  FiUpload,
  FiEdit3,
  FiTrash2,
  FiPlus,
  FiX,
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import ImportarAprendices from '../components/ImportarAprendices';
import CustomSelect from '../components/CustomSelect';
import {
  parseApiResponse,
  buildErrorMessage,
  getAuthHeaders,
} from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import '../styles/pages/equipos.css';
import '../styles/pages/usuarios.css';

const TIPOS_APRENDIZ = ['Regular', 'Practicante', 'Semillero'];
const JORNADAS_REGULAR = ['Mañana', 'Tarde', 'Noche'];
const INITIAL_APRENDIZ_FORM = {
  nombre: '',
  documento: '',
  tipo_documento: 'CC',
  tipo_documento_otro: '',
  ficha: '',
  tipo_aprendiz: 'Regular',
  jornada: 'Mañana',
  dias_semana: '',
  hora_inicio: '',
  hora_fin: '',
};

function getTipoAprendiz(aprendiz) {
  return TIPOS_APRENDIZ.includes(aprendiz?.tipo_aprendiz)
    ? aprendiz.tipo_aprendiz
    : 'Regular';
}

function getJornadaForTipo(tipoAprendiz, jornada) {
  if (tipoAprendiz === 'Practicante') return 'Completa';
  if (tipoAprendiz === 'Semillero') return 'Flexible';
  return JORNADAS_REGULAR.includes(jornada) ? jornada : 'Mañana';
}

function getPracticanteScheduleError(form) {
  if (form.tipo_aprendiz !== 'Practicante') return null;

  const timePattern = /^(\d{2}):(\d{2})$/;
  const inicioMatch = form.hora_inicio.match(timePattern);
  const finMatch = form.hora_fin.match(timePattern);

  if (!inicioMatch || !finMatch) {
    return 'Para un practicante, ingresa una hora de inicio y una hora de fin válidas.';
  }

  const inicioMinutos =
    Number(inicioMatch[1]) * 60 + Number(inicioMatch[2]);
  const finMinutos = Number(finMatch[1]) * 60 + Number(finMatch[2]);

  if (
    Number(inicioMatch[1]) > 23 ||
    Number(inicioMatch[2]) > 59 ||
    Number(finMatch[1]) > 23 ||
    Number(finMatch[2]) > 59
  ) {
    return 'Para un practicante, ingresa una hora de inicio y una hora de fin válidas.';
  }

  if (finMinutos <= inicioMinutos) {
    return 'Para un practicante, la hora de fin debe ser posterior a la hora de inicio.';
  }

  if (finMinutos - inicioMinutos < 8 * 60) {
    return 'Para un practicante, la jornada debe durar al menos 8 horas.';
  }

  return null;
}

function AprendizContextFields({ form, onChange, onTipoChange }) {
  const isRegular = form.tipo_aprendiz === 'Regular';
  const isPracticante = form.tipo_aprendiz === 'Practicante';

  return (
    <>
      <div className="form-row">
        <label>Tipo de aprendiz</label>
        <CustomSelect
          name="tipo_aprendiz"
          value={form.tipo_aprendiz}
          onChange={event => onTipoChange(event.target.value)}
          options={TIPOS_APRENDIZ}
          placeholder="Seleccionar tipo de aprendiz"
        />
      </div>

      {isRegular ? (
        <>
          <div className="form-row">
            <label>Ficha</label>
            <input
              type="text"
              name="ficha"
              value={form.ficha}
              onChange={onChange}
              required
            />
          </div>
          <div className="form-row">
            <label>Jornada</label>
            <CustomSelect
              name="jornada"
              value={form.jornada}
              onChange={onChange}
              options={JORNADAS_REGULAR}
              placeholder="Seleccionar jornada"
            />
          </div>
          <p className="aprendiz-form-info">
            El aula del aprendiz regular se asigna desde las clases asociadas a
            su ficha.
          </p>
        </>
      ) : (
        <>
          <p className="aprendiz-form-info">
            Jornada: <strong>{isPracticante ? 'Completa' : 'Flexible'}</strong>
            {isPracticante && ' (mínimo ocho horas diarias).'}
          </p>
          <div className="form-row form-row-full">
            <label>Días de asistencia</label>
            <input
              type="text"
              name="dias_semana"
              value={form.dias_semana}
              onChange={onChange}
              placeholder="Ej.: Lunes a viernes"
              required
            />
          </div>
          <div className="form-row">
            <label>Hora de inicio</label>
            <input
              type="time"
              name="hora_inicio"
              value={form.hora_inicio}
              onChange={onChange}
              required
            />
          </div>
          <div className="form-row">
            <label>Hora de fin</label>
            <input
              type="time"
              name="hora_fin"
              value={form.hora_fin}
              onChange={onChange}
              required
            />
          </div>
        </>
      )}
    </>
  );
}

function AprendizBaseFields({ form, onChange, onDocumentTypeChange }) {
  return (
    <>
      <div className="form-row form-row-full">
        <label>Nombre completo</label>
        <input
          type="text"
          name="nombre"
          value={form.nombre}
          onChange={onChange}
          required
        />
      </div>
      <div className="form-row">
        <label>Tipo de documento</label>
        <CustomSelect
          name="tipo_documento"
          value={form.tipo_documento}
          onChange={event => onDocumentTypeChange(event.target.value)}
          options={['TI', 'CC', 'CE', 'PPT', 'Otro']}
          placeholder="Seleccionar tipo de documento"
        />
      </div>
      {form.tipo_documento === 'Otro' && (
        <div className="form-row form-row-full">
          <label>Especificar tipo de documento</label>
          <input
            type="text"
            name="tipo_documento_otro"
            value={form.tipo_documento_otro}
            onChange={onChange}
            placeholder="Especificar tipo de documento"
            maxLength={50}
            required
          />
        </div>
      )}
      <div className="form-row">
        <label>Documento</label>
        <input
          type="text"
          name="documento"
          value={form.documento}
          onChange={onChange}
          required
        />
      </div>
    </>
  );
}

export default function Aprendices() {
  const [currentUser, setCurrentUser] = useState(null);
  const [aprendices, setAprendices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAprendiz, setSelectedAprendiz] = useState(null);
  const [createForm, setCreateForm] = useState(INITIAL_APRENDIZ_FORM);
  const [editForm, setEditForm] = useState(INITIAL_APRENDIZ_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {
      // No se muestra un error de sesión para no bloquear el acceso público de la página.
    }
  }, []);

  const canView = ['Administrador', 'Instructor'].includes(
    currentUser?.nombre_rol || ''
  );
  const isAdministrador = currentUser?.nombre_rol === 'Administrador';

  const fetchAprendices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/aprendices', { headers: getAuthHeaders() });
      const data = await parseApiResponse(
        res,
        'No se pudo obtener la lista de aprendices'
      );
      setAprendices(Array.isArray(data.aprendices) ? data.aprendices : []);
    } catch (err) {
      setAprendices([]);
      setToast({
        message: buildErrorMessage(
          err,
          'No se pudo obtener la lista de aprendices'
        ),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) fetchAprendices();
  }, [canView, fetchAprendices]);

  const { subscribe } = useSocket();
  useEffect(() => {
    if (!subscribe || !canView) return undefined;
    const unsubscribeUpdated = subscribe('aprendiz:updated', fetchAprendices);
    const unsubscribeDeleted = subscribe('aprendiz:deleted', fetchAprendices);
    return () => {
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, [subscribe, canView, fetchAprendices]);

  const filteredAprendices = useMemo(() => {
    if (!query.trim()) return aprendices;
    const q = query.toLowerCase();
    return aprendices.filter(item =>
      [
        item.nombre,
        item.documento,
        item.ficha,
        item.jornada,
        item.tipo_aprendiz,
      ].some(value => value?.toLowerCase().includes(q))
    );
  }, [aprendices, query]);

  const formatDate = value => {
    if (!value) return '-';
    const fecha = new Date(value);
    if (Number.isNaN(fecha.getTime())) return value;
    return fecha.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExportExcel = () => {
    if (aprendices.length === 0) {
      setToast({ message: 'No hay aprendices para exportar', type: 'info' });
      return;
    }
    const headers = [
      'Nombre',
      'Tipo de aprendiz',
      'Tipo Documento',
      'Documento',
      'Ficha',
      'Jornada',
      'Días',
      'Hora Inicio',
      'Hora Fin',
      'Registrado',
    ];
    const rows = aprendices.map(item => [
      item.nombre || '-',
      getTipoAprendiz(item),
      (item.tipo_documento || 'CC') +
        (item.tipo_documento === 'Otro' && item.tipo_documento_otro
          ? ` (${item.tipo_documento_otro})`
          : ''),
      item.documento || '-',
      item.ficha || '-',
      item.jornada || '-',
      item.dias_semana || '-',
      item.hora_inicio || '-',
      item.hora_fin || '-',
      formatDate(item.fecha_creacion),
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Aprendices');
    XLSX.writeFile(
      wb,
      `aprendices_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const normalizePayload = form => ({
    ...form,
    nombre: form.nombre.trim(),
    documento: form.documento.trim(),
    ficha: form.ficha.trim() || null,
    tipo_documento: form.tipo_documento || 'CC',
    tipo_documento_otro:
      form.tipo_documento === 'Otro'
        ? form.tipo_documento_otro.trim() || null
        : null,
    jornada: getJornadaForTipo(form.tipo_aprendiz, form.jornada),
    dias_semana: form.dias_semana.trim() || null,
    hora_inicio: form.hora_inicio || null,
    hora_fin: form.hora_fin || null,
  });

  const updateDocumentType = setter => tipoDocumento => {
    setter(prev => ({
      ...prev,
      tipo_documento: tipoDocumento,
      tipo_documento_otro:
        tipoDocumento === 'Otro' ? prev.tipo_documento_otro : '',
    }));
  };

  const updateTipoAprendiz = setter => tipoAprendiz => {
    setter(prev => ({
      ...prev,
      tipo_aprendiz: tipoAprendiz,
      jornada: getJornadaForTipo(tipoAprendiz, prev.jornada),
    }));
  };

  const openCreateModal = () => {
    setCreateForm(INITIAL_APRENDIZ_FORM);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm(INITIAL_APRENDIZ_FORM);
  };

  const handleCreateSubmit = async event => {
    event.preventDefault();
    const scheduleError = getPracticanteScheduleError(createForm);
    if (scheduleError) {
      setToast({ message: scheduleError, type: 'error' });
      return;
    }
    setSavingCreate(true);
    try {
      const res = await fetch('/api/aprendices', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(normalizePayload(createForm)),
      });
      await parseApiResponse(res, 'No se pudo registrar el aprendiz');
      setToast({
        message: 'Aprendiz registrado correctamente',
        type: 'success',
      });
      setCreateForm(INITIAL_APRENDIZ_FORM);
      setShowCreateModal(false);
      fetchAprendices();
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo registrar el aprendiz'),
        type: 'error',
      });
    } finally {
      setSavingCreate(false);
    }
  };

  const openEditModal = aprendiz => {
    const tipoAprendiz = getTipoAprendiz(aprendiz);
    setSelectedAprendiz(aprendiz);
    setEditForm({
      nombre: aprendiz.nombre || '',
      documento: aprendiz.documento || '',
      tipo_documento: aprendiz.tipo_documento || 'CC',
      tipo_documento_otro: aprendiz.tipo_documento_otro || '',
      ficha: aprendiz.ficha || '',
      tipo_aprendiz: tipoAprendiz,
      jornada: getJornadaForTipo(tipoAprendiz, aprendiz.jornada),
      dias_semana: aprendiz.dias_semana || '',
      hora_inicio: aprendiz.hora_inicio?.slice(0, 5) || '',
      hora_fin: aprendiz.hora_fin?.slice(0, 5) || '',
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedAprendiz(null);
    setEditForm(INITIAL_APRENDIZ_FORM);
  };

  const handleEditSubmit = async event => {
    event.preventDefault();
    if (!selectedAprendiz) return;
    const scheduleError = getPracticanteScheduleError(editForm);
    if (scheduleError) {
      setToast({ message: scheduleError, type: 'error' });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/aprendices/${selectedAprendiz.id_aprendiz}`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(normalizePayload(editForm)),
        }
      );
      await parseApiResponse(res, 'No se pudo actualizar el aprendiz');
      setToast({
        message: 'Aprendiz actualizado correctamente',
        type: 'success',
      });
      closeEditModal();
      fetchAprendices();
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo actualizar el aprendiz'),
        type: 'error',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async aprendiz => {
    if (
      !isAdministrador ||
      !window.confirm(`¿Seguro que deseas eliminar a ${aprendiz.nombre}?`)
    )
      return;
    setDeletingId(aprendiz.id_aprendiz);
    try {
      const res = await fetch(`/api/aprendices/${aprendiz.id_aprendiz}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      await parseApiResponse(res, 'No se pudo eliminar el aprendiz');
      setToast({
        message: 'Aprendiz eliminado correctamente',
        type: 'success',
      });
      fetchAprendices();
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo eliminar el aprendiz'),
        type: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const renderForm = (
    form,
    setter,
    onSubmit,
    saving,
    title,
    onClose,
    submitText
  ) => (
    <div className="modal-overlay">
      <div className="modal-sheet form-modal">
        <div className="form-equipos aprendiz-modal-form">
          <div className="modal-header aprendiz-modal-header">
            <h3>{title}</h3>
            <button
              type="button"
              className="aprendiz-modal-close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <FiX size={22} />
            </button>
          </div>
          <form className="modal-form" onSubmit={onSubmit}>
            <div className="form-grid">
              <AprendizBaseFields
                form={form}
                onChange={event =>
                  setter(prev => ({
                    ...prev,
                    [event.target.name]: event.target.value,
                  }))
                }
                onDocumentTypeChange={updateDocumentType(setter)}
              />
              <AprendizContextFields
                form={form}
                onChange={event =>
                  setter(prev => ({
                    ...prev,
                    [event.target.name]: event.target.value,
                  }))
                }
                onTipoChange={updateTipoAprendiz(setter)}
              />
            </div>
            <div className="modal-form-actions">
              <button type="button" className="btn" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-verde" disabled={saving}>
                {saving ? 'Guardando...' : submitText}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page simple-page">
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
              <div>
                <h2>Aprendices</h2>
                <p className="users-toolbar-description">
                  Registra las fichas, documentos y jornadas para llevar el
                  control académico de cada aprendiz.
                </p>
              </div>
              {canView && (
                <div className="users-toolbar-actions">
                  <input
                    className="search-input"
                    placeholder="Buscar por nombre, documento, ficha, tipo o jornada..."
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                  />
                  <button
                    className="btn-import-users"
                    onClick={handleExportExcel}
                  >
                    <FiDownload size={16} />
                    Exportar a Excel
                  </button>
                  {isAdministrador && (
                    <>
                      <button
                        className="btn-import-users"
                        onClick={openCreateModal}
                      >
                        <FiPlus size={16} />
                        Nuevo aprendiz
                      </button>
                      <button
                        className="btn-import-users"
                        onClick={() => setShowImport(true)}
                      >
                        <FiUpload size={16} />
                        Importar aprendices
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="users-content">
              {!canView ? (
                <div className="users-empty">
                  <div>
                    <strong>No tienes permiso para ver aprendices</strong>
                    <div className="users-empty-message">
                      Solo administradores o instructores pueden acceder a esta
                      sección.
                    </div>
                  </div>
                </div>
              ) : loading ? (
                <div className="users-empty">
                  <div>
                    <strong>Cargando aprendices...</strong>
                  </div>
                </div>
              ) : filteredAprendices.length === 0 ? (
                <div className="users-empty">
                  <div>
                    <strong>No hay aprendices registrados</strong>
                    <div className="users-empty-message">
                      Registra un aprendiz, importa un archivo Excel o ajusta el
                      filtro de búsqueda.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="users-table-wrapper">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Tipo de aprendiz</th>
                        <th>Tipo documento</th>
                        <th>Documento</th>
                        <th>Ficha</th>
                        <th>Jornada</th>
                        <th>Registrado</th>
                        {isAdministrador && <th>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAprendices.map(aprendiz => {
                        const jornadaClass = aprendiz.jornada
                          ? aprendiz.jornada
                              .toLowerCase()
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                          : 'sin-definir';
                        return (
                          <tr key={aprendiz.id_aprendiz}>
                            <td>
                              <strong>{aprendiz.nombre}</strong>
                            </td>
                            <td>{getTipoAprendiz(aprendiz)}</td>
                            <td>
                              {aprendiz.tipo_documento || 'CC'}
                              {aprendiz.tipo_documento === 'Otro' &&
                              aprendiz.tipo_documento_otro
                                ? ` (${aprendiz.tipo_documento_otro})`
                                : ''}
                            </td>
                            <td>{aprendiz.documento}</td>
                            <td>{aprendiz.ficha || '-'}</td>
                            <td>
                              <span className={`jornada-badge ${jornadaClass}`}>
                                {aprendiz.jornada || 'Sin definir'}
                              </span>
                            </td>
                            <td>{formatDate(aprendiz.fecha_creacion)}</td>
                            {isAdministrador && (
                              <td>
                                <div className="users-actions users-actions-compact">
                                  <button
                                    className="btn btn-edit"
                                    onClick={() => openEditModal(aprendiz)}
                                  >
                                    <FiEdit3 size={16} />
                                    Editar
                                  </button>
                                  <button
                                    className="btn btn-delete"
                                    disabled={
                                      deletingId === aprendiz.id_aprendiz
                                    }
                                    onClick={() => handleDelete(aprendiz)}
                                  >
                                    <FiTrash2 size={16} />
                                    {deletingId === aprendiz.id_aprendiz
                                      ? 'Eliminando...'
                                      : 'Eliminar'}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      {showImport && isAdministrador && (
        <div className="modal-overlay">
          <div className="modal-sheet form-modal-large">
            <div className="form-equipos aprendiz-modal-form">
              <div className="modal-header aprendiz-modal-header">
                <h3>Importar aprendices</h3>
                <button
                  type="button"
                  className="aprendiz-modal-close"
                  onClick={() => setShowImport(false)}
                  aria-label="Cerrar"
                >
                  <FiX size={22} />
                </button>
              </div>
              <ImportarAprendices
                onImportComplete={resultados => {
                  setToast({
                    message: `Importación completada: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`,
                    type: resultados.fallidos === 0 ? 'success' : 'warning',
                  });
                  if (resultados.exitosos > 0) fetchAprendices();
                }}
              />
            </div>
          </div>
        </div>
      )}
      {showCreateModal &&
        isAdministrador &&
        renderForm(
          createForm,
          setCreateForm,
          handleCreateSubmit,
          savingCreate,
          'Nuevo aprendiz',
          closeCreateModal,
          'Registrar aprendiz'
        )}
      {showEditModal &&
        selectedAprendiz &&
        isAdministrador &&
        renderForm(
          editForm,
          setEditForm,
          handleEditSubmit,
          savingEdit,
          'Editar aprendiz',
          closeEditModal,
          'Guardar cambios'
        )}
    </div>
  );
}
