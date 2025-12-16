import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ImportarUsuarios from '../components/ImportarUsuarios';
import { FiUpload, FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { parseApiResponse, buildErrorMessage, getAuthHeaders } from '../utils/api';
import '../styles/equipos.css';
import '../styles/usuarios.css';
import '../styles/modal.css';
import '../styles/sidebar.css';

export default function Usuarios() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    nombre: '',
    cedula: '',
    correo: '',
    telefono: '',
    rol: 'Aprendiz',
    contrasena: '',
  });
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [currentUser, setCurrentUser] = useState(null);
  const [showImport, setShowImport] = useState(false);

  // Obtener rol del usuario actual
  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      // Error silencioso: si falla, simplemente no se carga el usuario
    }
  }, []);

  const isAdmin = currentUser?.nombre_rol === 'Administrador';
  const isInstructor = currentUser?.nombre_rol === 'Instructor';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/users', { headers: getAuthHeaders() });
      const data = await parseApiResponse(
        res,
        'No se pudo obtener el listado de usuarios'
      );
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setUsers([]);
      setToast({
        message: buildErrorMessage(
          err,
          'No se pudo obtener el listado de usuarios'
        ),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async () => {
    const id = confirm.id;
    setConfirm({ open: false, id: null });
    if (!id) {
      setToast({ message: 'No se seleccionó usuario', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/auth/user/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await parseApiResponse(res, 'No se pudo eliminar el usuario');
      setUsers((prev) => prev.filter((u) => u.id_usuario !== id));
      setToast({ message: data.message || 'Usuario eliminado', type: 'success' });
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo eliminar el usuario'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const displayedUsers = users.filter((u) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (u.nombre_usuario || '').toLowerCase().includes(q) ||
      (u.cedula || '').toLowerCase().includes(q) ||
      (u.nombre_rol || '').toLowerCase().includes(q)
    );
  });

  const openEdit = async (u) => {
    // fetch latest details before editing to ensure data is current
    try {
      const res = await fetch(`/api/auth/user/${u.id_usuario}`, {
        headers: getAuthHeaders(),
      });
      const data = await parseApiResponse(res, 'No se pudo obtener usuario');
      const user = data.user || data;
      setEditingUser(user);
      setForm({
        nombre: user.nombre_usuario || '',
        cedula: user.cedula || '',
        correo: user.correo || '',
        telefono: user.telefono || '',
        rol: user.nombre_rol || 'Aprendiz',
        contrasena: '',
      });
      setShowForm(true);
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo cargar la información del usuario'),
        type: 'error',
      });
    }
  };

  const submitForm = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    try {
      if (!editingUser) {
        setToast({
          message: 'Selecciona primero un usuario para editar',
          type: 'error',
        });
        return;
      }
      // update only
      const res = await fetch(`/api/auth/user/${editingUser.id_usuario}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          nombre: form.nombre,
          cedula: form.cedula,
          correo: form.correo,
          telefono: form.telefono,
          rol: form.rol,
        }),
      });
      const data = await parseApiResponse(res, 'No se pudo actualizar el usuario');
      setToast({ message: data.message || 'Usuario actualizado', type: 'success' });
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo actualizar el usuario'),
        type: 'error',
      });
    }
  };

  const openView = async (u) => {
    try {
      const res = await fetch(`/api/auth/user/${u.id_usuario}`, {
        headers: getAuthHeaders(),
      });
      const data = await parseApiResponse(res, 'No se pudo obtener detalle');
      setViewUser(data);
    } catch (err) {
      setToast({
        message: buildErrorMessage(err, 'No se pudo obtener detalle del usuario'),
        type: 'error',
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      
      // Obtener todos los usuarios
      const res = await fetch('/api/auth/users', { headers: getAuthHeaders() });
      const usuarios = await parseApiResponse(res, 'No se pudieron cargar los usuarios para exportar');

      if (!Array.isArray(usuarios) || usuarios.length === 0) {
        setToast({ message: 'No hay usuarios para exportar', type: 'info' });
        return;
      }

      // Función para formatear fechas
      const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
          const date = new Date(dateString);
          return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch {
          return dateString;
        }
      };

      // Función para formatear booleanos
      const formatBoolean = (value) => {
        if (value === null || value === undefined) return 'No';
        if (typeof value === 'boolean') return value ? 'Sí' : 'No';
        if (value === 1 || value === '1' || value === true) return 'Sí';
        return 'No';
      };

      // Preparar datos para Excel
      const datosExcel = usuarios.map(user => ({
        'ID Usuario': user.id_usuario || '-',
        'Documento': user.cedula || '-',
        'Nombre Completo': user.nombre_usuario || '-',
        'Correo Electrónico': user.correo || '-',
        'Teléfono': user.telefono || '-',
        'Rol': user.nombre_rol || '-',
        'Estado': user.estado || '-',
        'Fecha de Registro': formatDate(user.fecha_registro),
        'Último Acceso': formatDate(user.ultimo_acceso),
        'Requiere Cambio Contraseña': formatBoolean(user.requiere_cambio_contrasena),
        'Creado Por': user.creado_por_nombre || '-',
        'Equipos Asignados': user.equipos_asignados || 0
      }));

      // Crear workbook
      const wb = XLSX.utils.book_new();
      
      // Preparar fila de título con información
      const fechaExportacion = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const numColumnas = Object.keys(datosExcel[0] || {}).length;
      const filaTitulo = Array(numColumnas).fill('');
      filaTitulo[0] = `LISTADO DE USUARIOS - SENA - Exportado el ${fechaExportacion} - Total de usuarios: ${usuarios.length}`;
      
      // Crear array de arrays: título + encabezados + datos
      const headers = Object.keys(datosExcel[0] || {});
      const datosArray = [
        filaTitulo, // Fila 0: Título
        headers,    // Fila 1: Encabezados
        ...datosExcel.map(row => headers.map(key => row[key] || '-')) // Filas 2+: Datos
      ];
      
      // Crear worksheet desde array de arrays
      const ws = XLSX.utils.aoa_to_sheet(datosArray);
      
      // Combinar celdas de la fila de título (desde A1 hasta la última columna)
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({
        s: { r: 0, c: 0 },
        e: { r: 0, c: numColumnas - 1 }
      });
      
      // Ajustar altura de las filas
      if (!ws['!rows']) ws['!rows'] = [];
      ws['!rows'][0] = { hpt: 25 }; // Título
      ws['!rows'][1] = { hpt: 20 }; // Encabezados
      
      // Ajustar ancho de columnas
      const colWidths = [
        { wch: 12 }, // ID Usuario
        { wch: 15 }, // Documento
        { wch: 30 }, // Nombre Completo
        { wch: 30 }, // Correo Electrónico
        { wch: 15 }, // Teléfono
        { wch: 15 }, // Rol
        { wch: 12 }, // Estado
        { wch: 20 }, // Fecha de Registro
        { wch: 20 }, // Último Acceso
        { wch: 25 }, // Requiere Cambio Contraseña
        { wch: 20 }, // Creado Por
        { wch: 18 }  // Equipos Asignados
      ];
      ws['!cols'] = colWidths;
      
      // Configurar vista: congelar fila de encabezados (fila 2, índice 1) y primera columna
      ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
      
      // Agregar filtros automáticos (autofilter) en la fila de encabezados
      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        range.s.r = 1; // Empezar desde la fila de encabezados
        ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
      }
      
      // Agregar worksheet al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
      
      // Generar archivo Excel
      const nombreArchivo = `usuarios_sena_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo);
      
      setToast({ message: `Archivo Excel descargado exitosamente: ${nombreArchivo}`, type: 'success' });
    } catch (err) {
      console.error('Error al generar Excel:', err);
      setToast({ message: buildErrorMessage(err, 'Error al generar el archivo Excel'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={currentUser} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="users-panel">
          <div className="users-toolbar">
            <h2>Usuarios</h2>
            <div className="users-toolbar-actions">
              <input
                className="search-input"
                placeholder="Buscar por nombre, Documento o rol..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="btn-import-users"
                onClick={handleExportExcel}
                disabled={loading}
                title="Exportar todos los usuarios a Excel"
              >
                <FiDownload size={16} />
                Exportar a Excel
              </button>
              {isAdmin && (
                <button
                  className="btn-import-users"
                  onClick={() => setShowImport(true)}
                >
                  <FiUpload size={16} />
                  Importar Usuarios
                </button>
              )}
            </div>
          </div>

          <div className="users-content">
            {loading ? <div>Cargando usuarios...</div> : (
              displayedUsers.length ? (
                <div className="users-table-wrapper">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Documento</th>
                        <th>Rol</th>
                        <th>Equipos</th>
                        <th className="users-actions-header">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedUsers.map((u) => (
                        <tr key={u.id_usuario}>
                          <td>{u.nombre_usuario}</td>
                          <td>{u.cedula}</td>
                          <td>{u.nombre_rol}</td>
                          <td>
                            <span className="equip-count">
                              {u.equipos_asignados || 0}
                            </span>
                          </td>
                          <td className="users-actions">
                            <button
                              className="btn btn-view"
                              onClick={() => openView(u)}
                            >
                              Ver
                            </button>
                            {/* Editar y Eliminar: Solo Administrador */}
                            {isAdmin && (
                              <>
                                <button
                                  className="btn btn-edit"
                                  onClick={() => openEdit(u)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="btn btn-delete"
                                  onClick={() =>
                                    setConfirm({ open: true, id: u.id_usuario })
                                  }
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="users-empty">
                  <div>
                    <strong>No hay usuarios para mostrar</strong>
                    <div className="users-empty-message">No se encontraron registros. Si los usuarios se registraron vía la aplicación, revisa la base de datos o el proceso de registro.</div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </main>

      {/* View modal */}
      {viewUser && (
        <div className="modal-overlay">
          <div className="modal-sheet form-modal">
            <div className="form-equipos">
              <div className="modal-header">
                <h3>Detalle: {viewUser.user.nombre_usuario}</h3>
                <button className="btn" onClick={() => setViewUser(null)}>Cerrar</button>
              </div>
              <div className="user-detail-content">
                <div className="user-detail-grid">
                  <div><strong>Documento:</strong> {viewUser.user.cedula}</div>
                  <div><strong>Rol:</strong> {viewUser.user.nombre_rol}</div>
                  <div><strong>Correo:</strong> {viewUser.user.correo}</div>
                  <div><strong>Teléfono:</strong> {viewUser.user.telefono}</div>
                </div>
              </div>
              <hr />
              <h4>Equipos asignados</h4>
              {viewUser.equipos && viewUser.equipos.length ? (
                <table className="users-table">
                  <thead><tr><th>Equipo</th><th>Consecutivo</th><th>Ambiente</th><th>Asignado (días)</th></tr></thead>
                  <tbody>
                    {viewUser.equipos.map(eq => (
                      <tr key={eq.codigo_equipo}><td className="equipo-detail-cell">{eq.tipo} {eq.marca} {eq.modelo}</td><td>{eq.consecutivo}</td><td>{eq.nombre_ambiente}</td><td>{eq.dias_asignado}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : (<div>No hay equipos asignados</div>)}
            </div>
          </div>
        </div>
      )}

      {/* Form modal add/edit */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-sheet form-modal-small">
            <div className="form-equipos">
              <div className="modal-header">
                <h3>Editar usuario</h3>
                <button className="btn" onClick={() => setShowForm(false)}>Cerrar</button>
              </div>
              <form onSubmit={submitForm} className="modal-form">
                <div className="form-grid">
                  <div className="form-row">
                    <label>Nombre completo</label>
                    <input
                      value={form.nombre}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, nombre: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Documento</label>
                    <input
                      value={form.cedula}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, cedula: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Correo</label>
                    <input
                      value={form.correo}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, correo: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Teléfono</label>
                    <input
                      value={form.telefono}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          telefono: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label>Rol</label>
                    <select
                      value={form.rol}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, rol: e.target.value }))
                      }
                    >
                      <option>Administrador</option>
                      <option>Instructor</option>
                      <option>Aprendiz</option>
                    </select>
                  </div>
                  {/* No se permite crear usuarios aquí; edición solamente. */}
                </div>
                <div className="modal-form-actions">
                  <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button className="btn-verde" type="submit">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirm.open}
        message="¿Eliminar este usuario?"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ open: false, id: null })}
      />

      {/* Modal de Importación */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal-sheet form-modal-large">
            <div className="modal-header">
              <h3>Importar Usuarios</h3>
              <button className="btn" onClick={() => setShowImport(false)}>Cerrar</button>
            </div>
            <ImportarUsuarios 
              onImportComplete={(resultados) => {
                setToast({
                  message: `Importación completada: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`,
                  type: resultados.fallidos === 0 ? 'success' : 'warning'
                })
                if (resultados.exitosos > 0) {
                  fetchUsers() // Actualizar lista
                }
              }}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
