import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiCopy, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import { parseApiResponse, buildErrorMessage } from '../../utils/api';
import '../../styles/equipos.css';
import '../../styles/invitationCodes.css';

export default function InvitationCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    rol_destinado: 'Instructor',
    fecha_expiracion: '',
    max_usos: 1
  });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchCodes();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  };

  async function fetchCodes() {
    setLoading(true);
    try {
      const res = await fetch('/api/invitation-codes', { headers: getAuthHeaders() });
      const response = await parseApiResponse(res, 'No se pudo cargar los códigos');
      // El backend devuelve { success: true, data: [...] }
      const codesList = response?.data || response;
      setCodes(Array.isArray(codesList) ? codesList : []);
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar códigos'), type: 'error' });
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        rol_destinado: form.rol_destinado,
        max_usos: parseInt(form.max_usos) || 1
      };

      if (form.fecha_expiracion) {
        // Convertir fecha local a ISO string
        const date = new Date(form.fecha_expiracion);
        body.fecha_expiracion = date.toISOString();
      }

      const res = await fetch('/api/invitation-codes', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });

      const data = await parseApiResponse(res, 'No se pudo crear el código');
      setToast({ message: 'Código creado exitosamente', type: 'success' });
      setShowForm(false);
      setForm({ rol_destinado: 'Instructor', fecha_expiracion: '', max_usos: 1 });
      fetchCodes();
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al crear código'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/invitation-codes/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await parseApiResponse(res, 'No se pudo eliminar el código');
      setToast({ message: 'Código eliminado exitosamente', type: 'success' });
      setDeleteConfirm({ open: false, id: null });
      fetchCodes();
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al eliminar código'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(codigo) {
    navigator.clipboard.writeText(codigo);
    setCopiedCode(codigo);
    setToast({ message: 'Código copiado al portapapeles', type: 'success' });
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function formatDate(dateString) {
    if (!dateString) return 'Sin expiración';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getStatusBadge(estado) {
    const badges = {
      'Activo': { bg: '#d1fae5', color: '#065f46' },
      'Inactivo': { bg: '#f3f4f6', color: '#374151' },
      'Expirado': { bg: '#fee2e2', color: '#991b1b' },
      'Agotado': { bg: '#fef3c7', color: '#92400e' }
    };
    const badge = badges[estado] || badges['Inactivo'];
    return (
      <span className="invitation-codes-status-badge" style={{
        background: badge.bg,
        color: badge.color
      }}>
        {estado}
      </span>
    );
  }

  return (
    <div className="form-equipos invitation-codes-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal
        open={deleteConfirm.open}
        title="Eliminar Código"
        message="¿Estás seguro de que deseas eliminar este código de seguridad? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />

      <div className="invitation-codes-header">
        <div>
          <h3 className="invitation-codes-title">Códigos de Seguridad</h3>
          <p className="invitation-codes-description">
            Genera códigos para que los instructores se registren en el sistema
          </p>
        </div>
        <button
          className="btn primary invitation-codes-new-btn"
          onClick={() => setShowForm(!showForm)}
        >
          <FiPlus size={18} />
          {showForm ? 'Cancelar' : 'Nuevo Código'}
        </button>
      </div>

      {showForm && (
        <div className="invitation-codes-form">
          <h4 className="invitation-codes-form-title">Crear Nuevo Código</h4>
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <div className="form-group">
                <label>Rol Destinado</label>
                <select
                  value={form.rol_destinado}
                  onChange={e => setForm({ ...form, rol_destinado: e.target.value })}
                  required
                >
                  <option value="Instructor">Instructor</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Aprendiz">Aprendiz</option>
                </select>
              </div>
              <div className="form-group">
                <label>Máximo de Usos</label>
                <input
                  type="number"
                  min="0"
                  value={form.max_usos}
                  onChange={e => setForm({ ...form, max_usos: e.target.value })}
                  required
                />
                <small className="invitation-codes-form-help">
                  Número de veces que se puede usar el código (0 = ilimitado)
                </small>
              </div>
              <div className="form-group">
                <label>Fecha de Expiración (Opcional)</label>
                <input
                  type="datetime-local"
                  value={form.fecha_expiracion}
                  onChange={e => setForm({ ...form, fecha_expiracion: e.target.value })}
                />
              </div>
            </div>
            <div className="invitation-codes-form-actions">
              <button className="btn primary" type="submit" disabled={loading}>
                Crear Código
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm({ rol_destinado: 'Instructor', fecha_expiracion: '', max_usos: 1 });
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && codes.length === 0 ? (
        <div className="invitation-codes-loading">
          <div className="loading-spinner"></div>
          <p className="invitation-codes-loading-text">Cargando códigos...</p>
        </div>
      ) : codes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <FiAlertCircle size={48} color="#9ca3af" />
          </div>
          <h3>No hay códigos de seguridad</h3>
          <p>Crea un código para comenzar</p>
        </div>
      ) : (
        <div className="invitation-codes-table-wrapper">
          <table className="consulta-table invitation-codes-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Rol</th>
                <th>Usos</th>
                <th>Estado</th>
                <th>Expiración</th>
                <th>Creado Por</th>
                <th>Fecha Creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code.id_codigo}>
                  <td>
                    <div className="invitation-codes-code-cell">
                      <strong className="invitation-codes-code-text">
                        {code.codigo}
                      </strong>
                      <button
                        onClick={() => copyToClipboard(code.codigo)}
                        className="invitation-codes-copy-btn"
                        title="Copiar código"
                      >
                        {copiedCode === code.codigo ? (
                          <FiCheck size={16} color="var(--success-800)" />
                        ) : (
                          <FiCopy size={16} color="var(--neutral-600)" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td>{code.rol_destinado}</td>
                  <td>
                    {code.max_usos > 0
                      ? `${code.usos_actuales} / ${code.max_usos}`
                      : `${code.usos_actuales} / ∞`}
                  </td>
                  <td>{getStatusBadge(code.estado)}</td>
                  <td>{formatDate(code.fecha_expiracion)}</td>
                  <td>{code.creado_por_nombre || 'Sistema'}</td>
                  <td>{formatDate(code.fecha_creacion)}</td>
                  <td>
                    <button
                      className="btn danger invitation-codes-delete-btn"
                      onClick={() => setDeleteConfirm({ open: true, id: code.id_codigo })}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

