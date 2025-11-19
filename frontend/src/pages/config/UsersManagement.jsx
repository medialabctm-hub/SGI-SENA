import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage } from '../../utils/api'

export default function UsersManagement() {
  const nav = useNavigate()
  const [toast, setToast] = useState(null)
  const [exporting, setExporting] = useState(false)

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }
  }

  function formatDate(dateString) {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  function formatBoolean(value) {
    if (value === null || value === undefined) return 'No'
    if (typeof value === 'boolean') return value ? 'Sí' : 'No'
    if (value === 1 || value === '1' || value === true) return 'Sí'
    return 'No'
  }

  async function handleExportCSV() {
    setExporting(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setToast({ message: 'No autorizado. Por favor inicia sesión nuevamente', type: 'error' })
        return
      }

      const res = await fetch('/api/auth/users', { headers: getAuthHeaders() })
      const rows = await parseApiResponse(res, 'No se pudieron cargar los usuarios')

      if (!Array.isArray(rows) || rows.length === 0) {
        setToast({ message: 'No hay usuarios para exportar', type: 'info' })
        return
      }

      // Definir columnas en orden específico con nombres amigables
      const columnMapping = [
        { key: 'id_usuario', label: 'ID Usuario' },
        { key: 'cedula', label: 'Cédula' },
        { key: 'nombre_usuario', label: 'Nombre Completo' },
        { key: 'correo', label: 'Correo Electrónico' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'area', label: 'Área' },
        { key: 'nombre_rol', label: 'Rol' },
        { key: 'estado', label: 'Estado' },
        { key: 'fecha_registro', label: 'Fecha de Registro', formatter: formatDate },
        { key: 'ultimo_acceso', label: 'Último Acceso', formatter: formatDate },
        { key: 'requiere_cambio_contrasena', label: 'Requiere Cambio Contraseña', formatter: formatBoolean },
        { key: 'creado_por_nombre', label: 'Creado Por' },
        { key: 'equipos_asignados', label: 'Equipos Asignados' }
      ]

      // Preparar datos para CSV con formato
      const headers = columnMapping.map(col => col.label)
      const csvRows = [
        headers.join(','),
        ...rows.map(row => {
          return columnMapping
            .map(col => {
              let value = row[col.key] ?? ''
              
              // Aplicar formateo si existe
              if (col.formatter && value !== '') {
                value = col.formatter(value)
              }
              
              // Escapar comillas y envolver en comillas
              return `"${String(value).replace(/"/g, '""')}"`
            })
            .join(',')
        })
      ]

      const csv = csvRows.join('\n')
      // Agregar BOM para Excel UTF-8
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setToast({ message: `Se exportaron ${rows.length} usuario(s) correctamente`, type: 'success' })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al exportar usuarios'), type: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="form-equipos" style={{ maxWidth: 900 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--neutral-800)' }}>Gestión de Usuarios</h3>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
          Administra usuarios del sistema: listado, creación, edición e inactivación de cuentas
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div
          style={{
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>
            Acceso a Gestión de Usuarios
          </h4>
          <p style={{ margin: '0 0 1rem 0', color: '#666', fontSize: '0.9rem' }}>
            Accede al módulo completo de gestión de usuarios donde podrás ver, crear, editar e inactivar cuentas.
          </p>
          <button className="btn-verde" onClick={() => nav('/usuarios')}>
            Ir a Gestión de Usuarios
          </button>
        </div>

        <div
          style={{
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>
            Exportar Usuarios
          </h4>
          <p style={{ margin: '0 0 1rem 0', color: '#666', fontSize: '0.9rem' }}>
            Exporta la lista completa de usuarios a un archivo CSV para análisis o respaldo.
          </p>
          <button
            className="btn"
            onClick={handleExportCSV}
            disabled={exporting}
            style={{ background: '#6366f1', color: 'white' }}
          >
            {exporting ? 'Exportando...' : 'Exportar a CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}
