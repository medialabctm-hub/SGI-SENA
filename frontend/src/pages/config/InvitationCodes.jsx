import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiCopy, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import { parseApiResponse, buildErrorMessage } from '../../utils/api';
import '../../styles/equipos.css';

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
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: 600,
        background: badge.bg,
        color: badge.color
      }}>
        {estado}
      </span>
    );
  }

  return (
    <div className="form-equipos" style={{ maxWidth: 1000 }}>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--neutral-800)' }}>Códigos de Seguridad</h3>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Genera códigos para que los instructores se registren en el sistema
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <FiPlus size={18} />
          {showForm ? 'Cancelar' : 'Nuevo Código'}
        </button>
      </div>

      {showForm && (
        <div style={{
          background: 'var(--neutral-50)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          border: '1px solid var(--neutral-200)'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Crear Nuevo Código</h4>
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
                <small style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
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
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
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
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Cargando códigos...</p>
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
        <div style={{ overflowX: 'auto' }}>
          <table className="consulta-table" style={{ marginTop: '1rem' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {code.codigo}
                      </strong>
                      <button
                        onClick={() => copyToClipboard(code.codigo)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
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
                      className="btn danger"
                      onClick={() => setDeleteConfirm({ open: true, id: code.id_codigo })}
                      style={{ padding: '6px 12px', fontSize: '0.9rem' }}
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

