import React, { useState, useEffect, useCallback } from 'react'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage, getAuthHeaders } from '../../utils/api'
import '../../styles/rolesAreas.css'

export default function RolesAreas() {
  const [roles, setRoles] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const fetchRoles = useCallback(async () => {
    try {
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

  const fetchAreas = useCallback(async () => {
    // La columna Area fue eliminada, por lo que no hay áreas que mostrar
    setAreas([])
  }, [])

  useEffect(() => {
    fetchRoles()
    fetchAreas()
  }, [fetchRoles, fetchAreas])

  return (
    <div className="form-equipos roles-areas-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="roles-areas-header">
        <h3 className="roles-areas-title">Roles y Áreas</h3>
        <p className="roles-areas-description">
          Visualiza los roles del sistema y las áreas asignadas a los usuarios
        </p>
      </div>

      {loading ? (
        <div className="roles-areas-loading">
          <div className="loading-spinner"></div>
          <p className="roles-areas-loading-text">Cargando información...</p>
        </div>
      ) : (
        <div className="roles-areas-content">
          <div className="roles-areas-section">
            <h4 className="roles-areas-section-title">Roles del Sistema</h4>
            <p className="roles-areas-section-description">
              Los roles están definidos en el sistema y no se pueden modificar desde aquí.
            </p>
            {roles.length === 0 ? (
              <p className="roles-areas-empty">No hay roles disponibles</p>
            ) : (
              <div className="roles-list">
                {roles.map((role, i) => (
                  <div key={i} className="role-item">
                    <div className="role-header">
                      <div>
                        <strong className="role-name">{role.rol}</strong>
                        <p className="role-permissions">
                          {role.totalPermisos} permiso{role.totalPermisos !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="roles-areas-section">
            <h4 className="roles-areas-section-title">Áreas de Usuarios</h4>
            <p className="roles-areas-section-description">
              Áreas únicas extraídas de los usuarios registrados en el sistema.
            </p>
            {areas.length === 0 ? (
              <p className="roles-areas-empty">No hay áreas registradas</p>
            ) : (
              <div className="areas-list">
                {areas.map((area, i) => (
                  <div key={i} className="area-item">
                    <span className="area-name">{area}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="roles-areas-update-btn-wrapper">
              <button className="btn roles-areas-update-btn" onClick={fetchAreas}>
                Actualizar lista de áreas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
