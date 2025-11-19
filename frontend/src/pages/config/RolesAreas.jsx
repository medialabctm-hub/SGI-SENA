import React, { useState, useEffect } from 'react'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage } from '../../utils/api'

export default function RolesAreas() {
  const [roles, setRoles] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchRoles()
    fetchAreas()
  }, [])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }
  }

  async function fetchRoles() {
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
  }

  async function fetchAreas() {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const res = await fetch('/api/auth/users', { headers: getAuthHeaders() })
      const users = await parseApiResponse(res, 'No se pudieron cargar las áreas')
      
      // Extraer áreas únicas de los usuarios
      const areasSet = new Set()
      if (Array.isArray(users)) {
        users.forEach(user => {
          if (user.area_usuarios || user.area) {
            const area = user.area_usuarios || user.area
            if (area && area.trim()) {
              areasSet.add(area.trim())
            }
          }
        })
      }
      
      setAreas(Array.from(areasSet).sort())
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cargar áreas'), type: 'error' })
      setAreas([])
    }
  }

  return (
    <div className="form-equipos" style={{ maxWidth: 1000 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--neutral-800)' }}>Roles y Áreas</h3>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
          Visualiza los roles del sistema y las áreas asignadas a los usuarios
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem', color: '#666' }}>Cargando información...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Roles del Sistema</h4>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Los roles están definidos en el sistema y no se pueden modificar desde aquí.
            </p>
            {roles.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>No hay roles disponibles</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {roles.map((role, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '1rem', color: '#111827' }}>{role.rol}</strong>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.85rem' }}>
                          {role.totalPermisos} permiso{role.totalPermisos !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '300px' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Áreas de Usuarios</h4>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Áreas únicas extraídas de los usuarios registrados en el sistema.
            </p>
            {areas.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>No hay áreas registradas</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {areas.map((area, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.75rem 1rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ color: '#111827' }}>{area}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '1rem' }}>
              <button className="btn" onClick={fetchAreas} style={{ fontSize: '0.9rem' }}>
                Actualizar lista de áreas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
