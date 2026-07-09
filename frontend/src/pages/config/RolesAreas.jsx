import React, { useState, useEffect, useCallback } from 'react'
import Toast from '../../components/Toast'
import DestructiveConfirmModal from '../../components/DestructiveConfirmModal'
import { parseApiResponse, buildErrorMessage, getAuthHeaders } from '../../utils/api'
import { FiPlus, FiEdit2, FiTrash2, FiChevronDown, FiChevronRight, FiCheck, FiX } from 'react-icons/fi'
import '../../styles/rolesAreas.css'

export default function RolesAreas() {
  const [roles, setRoles] = useState([])
  const [permisos, setPermisos] = useState([])
  const [permisosPorModulo, setPermisosPorModulo] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [expandedRoles, setExpandedRoles] = useState({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState({ open: false, roleName: null })
  const [editingRole, setEditingRole] = useState(null)
  const [formData, setFormData] = useState({
    nombre_rol: '',
    descripcion: '',
    permisos: []
  })

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/permissions/roles', { headers: getAuthHeaders() })
      const data = await parseApiResponse(res, 'No se pudieron cargar los roles')
      setRoles(data.roles || [])
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar roles'), type: 'error' })
      setRoles([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPermisos = useCallback(async () => {
    try {
      const res = await fetch('/api/permissions/permisos', { headers: getAuthHeaders() })
      const data = await parseApiResponse(res, 'No se pudieron cargar los permisos')
      setPermisos(data.permisos || [])
      setPermisosPorModulo(data.permisosPorModulo || {})
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar permisos'), type: 'error' })
      setPermisos([])
      setPermisosPorModulo({})
    }
  }, [])

  useEffect(() => {
    fetchRoles()
    fetchPermisos()
  }, [fetchRoles, fetchPermisos])

  const toggleRoleExpanded = (roleName) => {
    setExpandedRoles(prev => ({
      ...prev,
      [roleName]: !prev[roleName]
    }))
  }

  const handleCreateRole = () => {
    setFormData({
      nombre_rol: '',
      descripcion: '',
      permisos: []
    })
    setShowCreateModal(true)
  }

  const handleEditRole = (role) => {
    setEditingRole(role)
    setFormData({
      nombre_rol: role.rol,
      descripcion: role.descripcion || '',
      permisos: role.permisos || []
    })
    setShowEditModal(true)
  }

  const handleDeleteRole = (roleName) => {
    setShowDeleteConfirm({ open: true, roleName })
  }

  const confirmDelete = async () => {
    if (!showDeleteConfirm.roleName) return

    try {
      setLoading(true)
      const res = await fetch(`/api/permissions/roles/${encodeURIComponent(showDeleteConfirm.roleName)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      await parseApiResponse(res, 'No se pudo eliminar el rol')
      setToast({ message: 'Rol eliminado exitosamente', type: 'success' })
      setShowDeleteConfirm({ open: false, roleName: null })
      fetchRoles()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al eliminar el rol'), type: 'error' })
      setShowDeleteConfirm({ open: false, roleName: null })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRole = async () => {
    if (!formData.nombre_rol.trim()) {
      setToast({ message: 'El nombre del rol es obligatorio', type: 'error' })
      return
    }

    try {
      if (showCreateModal) {
        // Crear nuevo rol
        const res = await fetch('/api/permissions/roles', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        })
        await parseApiResponse(res, 'No se pudo crear el rol')
        setToast({ message: 'Rol creado exitosamente', type: 'success' })
        setShowCreateModal(false)
      } else {
        // Actualizar rol existente
        const res = await fetch(`/api/permissions/roles/${encodeURIComponent(editingRole.rol)}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nombre_rol: formData.nombre_rol,
            descripcion: formData.descripcion,
            estado: editingRole.estado
          })
        })
        await parseApiResponse(res, 'No se pudo actualizar el rol')
        
        // Actualizar permisos si cambiaron
        if (JSON.stringify(formData.permisos.sort()) !== JSON.stringify((editingRole.permisos || []).sort())) {
          const resPermisos = await fetch(`/api/permissions/roles/${encodeURIComponent(formData.nombre_rol)}/permisos`, {
            method: 'PUT',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ permisos: formData.permisos })
          })
          await parseApiResponse(resPermisos, 'No se pudieron actualizar los permisos')
        }
        
        setToast({ message: 'Rol actualizado exitosamente', type: 'success' })
        setShowEditModal(false)
      }
      
      setFormData({ nombre_rol: '', descripcion: '', permisos: [] })
      setEditingRole(null)
      fetchRoles()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al guardar el rol'), type: 'error' })
    }
  }

  const togglePermiso = (permisoCode) => {
    setFormData(prev => {
      const permisos = prev.permisos || []
      if (permisos.includes(permisoCode)) {
        return { ...prev, permisos: permisos.filter(p => p !== permisoCode) }
      } else {
        return { ...prev, permisos: [...permisos, permisoCode] }
      }
    })
  }

  const togglePermisoRol = async (roleName, permisoCode, activo) => {
    try {
      const res = await fetch(`/api/permissions/roles/${encodeURIComponent(roleName)}/permisos/${encodeURIComponent(permisoCode)}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activo })
      })
      await parseApiResponse(res, 'No se pudo actualizar el permiso')
      setToast({ message: `Permiso ${activo ? 'activado' : 'desactivado'} exitosamente`, type: 'success' })
      fetchRoles()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar el permiso'), type: 'error' })
    }
  }

  const handleToggleEstado = async (roleName, nuevoEstado) => {
    try {
      const res = await fetch(`/api/permissions/roles/${encodeURIComponent(roleName)}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      await parseApiResponse(res, 'No se pudo actualizar el estado del rol')
      setToast({ message: `Rol ${nuevoEstado === 'Activo' ? 'activado' : 'desactivado'} exitosamente`, type: 'success' })
      fetchRoles()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al actualizar el estado'), type: 'error' })
    }
  }

  return (
    <div className="form-equipos roles-areas-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <DestructiveConfirmModal
        open={showDeleteConfirm.open}
        title="Eliminar Rol"
        message={`¿Estás seguro de que quieres eliminar el rol "${showDeleteConfirm.roleName}"? Esta acción es destructiva e irreversible.`}
        confirmText="Eliminar Rol"
        cancelText="Cancelar"
        confirmationPhrase="confirmar accion"
        loading={loading}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm({ open: false, roleName: null })}
      />
      
      <div className="roles-areas-header">
        <div className="roles-areas-header-content">
          <h3 className="roles-areas-title">Roles y Áreas</h3>
          <p className="roles-areas-description">
            Gestiona los roles del sistema y sus permisos asignados
          </p>
        </div>
        <button 
          className="btn btn-verde roles-areas-create-btn"
          onClick={handleCreateRole}
        >
          <FiPlus size={18} />
          Nuevo Rol
        </button>
      </div>

      {loading ? (
        <div className="roles-areas-loading">
          <div className="loading-spinner"></div>
          <p className="roles-areas-loading-text">Cargando información...</p>
        </div>
      ) : (
        <div className="roles-areas-content">
          <div className="roles-areas-section roles-section-full">
            <h4 className="roles-areas-section-title">Roles del Sistema</h4>
            <p className="roles-areas-section-description">
              Gestiona los roles y sus permisos. Puedes crear, editar, eliminar roles y activar/desactivar permisos.
            </p>
            {roles.length === 0 ? (
              <p className="roles-areas-empty">No hay roles disponibles</p>
            ) : (
              <div className="roles-list">
                {roles.map((role) => (
                  <div key={role.id_rol || role.rol} className="role-item">
                    <div className="role-header">
                      <div className="role-info">
                        <div className="role-name-wrapper">
                          <strong className="role-name">{role.rol}</strong>
                          {role.estado && (
                            <span className={`role-status-badge ${role.estado === 'Activo' ? 'active' : 'inactive'}`}>
                              {role.estado}
                            </span>
                          )}
                        </div>
                        <p className="role-permissions">
                          {role.rol === 'Administrador' 
                            ? 'Todos los permisos del sistema'
                            : `${role.totalPermisos} permiso${role.totalPermisos !== 1 ? 's' : ''} activo${role.totalPermisos !== 1 ? 's' : ''}`
                          }
                        </p>
                        {role.descripcion && (
                          <p className="role-description">{role.descripcion}</p>
                        )}
                      </div>
                      <div className="role-actions">
                        <button
                          className="btn-icon role-action-btn"
                          onClick={() => toggleRoleExpanded(role.rol)}
                          title="Ver/ocultar permisos"
                        >
                          {expandedRoles[role.rol] ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
                        </button>
                        <button
                          className="btn-icon role-action-btn role-edit-btn"
                          onClick={() => handleEditRole(role)}
                          title="Editar rol"
                        >
                          <FiEdit2 size={18} />
                        </button>
                        {role.estado && (
                          <button
                            className="btn-icon role-action-btn role-toggle-btn"
                            onClick={() => handleToggleEstado(role.rol, role.estado === 'Activo' ? 'Inactivo' : 'Activo')}
                            title={role.estado === 'Activo' ? 'Desactivar rol' : 'Activar rol'}
                          >
                            {role.estado === 'Activo' ? <FiX size={18} /> : <FiCheck size={18} />}
                          </button>
                        )}
                        <button
                          className="btn-icon role-action-btn role-delete-btn"
                          onClick={() => handleDeleteRole(role.rol)}
                          title="Eliminar rol"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </div>
                    
                    {expandedRoles[role.rol] && (
                      <div className="role-permissions-detail">
                        <h5 className="role-permissions-detail-title">Permisos del Rol</h5>
                        {Object.keys(permisosPorModulo).length > 0 ? (
                          <div className="permissions-by-module">
                            {Object.entries(permisosPorModulo).map(([modulo, permisosModulo]) => (
                              <div key={modulo} className="permission-module-group">
                                <h6 className="permission-module-title">{modulo}</h6>
                                <div className="permissions-grid">
                                  {permisosModulo.map(permiso => {
                                    // Verificar si el permiso está activo en el rol
                                    const tienePermiso = role.permisosDetalle 
                                      ? role.permisosDetalle.find(p => p.codigo_permiso === permiso.codigo_permiso)?.activo === 1
                                      : (role.permisos && role.permisos.includes(permiso.codigo_permiso))
                                    
                                    // El Administrador no puede desactivar permisos
                                    const isAdmin = role.rol === 'Administrador'
                                    
                                    return (
                                      <label key={permiso.id_permiso} className="permission-item">
                                        <input
                                          type="checkbox"
                                          checked={tienePermiso || isAdmin}
                                          onChange={(e) => {
                                            if (!isAdmin) {
                                              togglePermisoRol(role.rol, permiso.codigo_permiso, e.target.checked)
                                            }
                                          }}
                                          disabled={isAdmin}
                                          className="permission-checkbox"
                                        />
                                        <span className="permission-label">
                                          {permiso.descripcion || permiso.accion}
                                        </span>
                                        <span className="permission-code">{permiso.codigo_permiso}</span>
                                        {isAdmin && (
                                          <span className="permission-admin-badge" title="El Administrador siempre tiene todos los permisos">
                                            Admin
                                          </span>
                                        )}
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="permissions-list-simple">
                            {role.permisos && role.permisos.length > 0 ? (
                              role.permisos.map((permiso, idx) => (
                                <span key={idx} className="permission-badge">{permiso}</span>
                              ))
                            ) : (
                              <p className="roles-areas-empty">Este rol no tiene permisos asignados</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para crear/editar rol */}
      {(showCreateModal || showEditModal) && (
        <div className="role-modal-overlay" onClick={() => {
          setShowCreateModal(false)
          setShowEditModal(false)
          setFormData({ nombre_rol: '', descripcion: '', permisos: [] })
          setEditingRole(null)
        }}>
          <div className="role-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-header">
              <h3 className="role-modal-title">
                {showCreateModal ? 'Crear Nuevo Rol' : 'Editar Rol'}
              </h3>
              <button
                className="role-modal-close"
                onClick={() => {
                  setShowCreateModal(false)
                  setShowEditModal(false)
                  setFormData({ nombre_rol: '', descripcion: '', permisos: [] })
                  setEditingRole(null)
                }}
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="role-modal-body">
              <div className="role-form-group">
                <label className="role-form-label">
                  Nombre del Rol *
                </label>
                <input
                  type="text"
                  className="role-form-input"
                  value={formData.nombre_rol}
                  onChange={(e) => setFormData({ ...formData, nombre_rol: e.target.value })}
                  placeholder="Ej: Supervisor, Coordinador..."
                  disabled={showEditModal}
                />
              </div>

              <div className="role-form-group">
                <label className="role-form-label">
                  Descripción
                </label>
                <textarea
                  className="role-form-textarea"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Describe las responsabilidades de este rol..."
                  rows="3"
                />
              </div>

              <div className="role-form-group">
                <label className="role-form-label">
                  Permisos
                </label>
                <div className="permissions-selector">
                  {Object.keys(permisosPorModulo).length > 0 ? (
                    Object.entries(permisosPorModulo).map(([modulo, permisosModulo]) => (
                      <div key={modulo} className="permission-module-group">
                        <h6 className="permission-module-title">{modulo}</h6>
                        <div className="permissions-grid">
                          {permisosModulo.map(permiso => (
                            <label key={permiso.id_permiso} className="permission-item">
                              <input
                                type="checkbox"
                                checked={formData.permisos.includes(permiso.codigo_permiso)}
                                onChange={() => togglePermiso(permiso.codigo_permiso)}
                                className="permission-checkbox"
                              />
                              <span className="permission-label">
                                {permiso.descripcion || permiso.accion}
                              </span>
                              <span className="permission-code">{permiso.codigo_permiso}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="roles-areas-empty">Cargando permisos...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="role-modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateModal(false)
                  setShowEditModal(false)
                  setFormData({ nombre_rol: '', descripcion: '', permisos: [] })
                  setEditingRole(null)
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-verde"
                onClick={handleSaveRole}
              >
                {showCreateModal ? 'Crear Rol' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
