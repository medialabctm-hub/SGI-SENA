import React, { useState } from 'react'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage } from '../../utils/api'
import '../../styles/security.css'

export default function Security() {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
    let s = ''
    for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)]
    return s
  }

  async function handleGenerate() {
    const pwd = generatePassword()
    try {
      await navigator.clipboard.writeText(pwd)
      setToast({ message: 'Contraseña generada y copiada al portapapeles', type: 'success' })
    } catch {
      setToast({ message: `Contraseña generada: ${pwd}`, type: 'info' })
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    
    if (!current || !newPass || !confirm) {
      setToast({ message: 'Por favor completa todos los campos', type: 'error' })
      return
    }

    if (newPass.length < 6) {
      setToast({ message: 'La nueva contraseña debe tener al menos 6 caracteres', type: 'error' })
      return
    }

    if (newPass !== confirm) {
      setToast({ message: 'Las contraseñas no coinciden', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setToast({ message: 'No autorizado. Por favor inicia sesión nuevamente', type: 'error' })
        return
      }

      const res = await fetch('/api/auth/cambiar-contrasena', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          contrasenaActual: current,
          nuevaContrasena: newPass
        })
      })

      const data = await parseApiResponse(res, 'No se pudo cambiar la contraseña')
      setToast({ message: data.message || 'Contraseña cambiada exitosamente', type: 'success' })
      setCurrent('')
      setNewPass('')
      setConfirm('')
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'Error al cambiar la contraseña'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-equipos security-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="security-header">
        <h3 className="security-title">Seguridad</h3>
        <p className="security-description">
          Cambia tu contraseña para mantener tu cuenta segura
        </p>
      </div>

      <form onSubmit={handleChangePassword}>
        <div className="form-grid">
          <div className="form-row">
            <label>Contraseña actual</label>
            <input
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-row">
            <label>Nueva contraseña</label>
            <input
              type="password"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              disabled={loading}
              minLength={6}
              required
            />
            <small className="security-help">
              Mínimo 6 caracteres
            </small>
          </div>
          <div className="form-row">
            <label>Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </div>
        <div className="security-submit">
          <button className="btn-verde" type="submit" disabled={loading}>
            {loading ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>

      <div className="security-generator">
        <h4 className="security-generator-title">Generador de contraseñas</h4>
        <p className="security-generator-description">
          Genera una contraseña segura aleatoria
        </p>
        <button className="btn" onClick={handleGenerate} disabled={loading}>
          Generar contraseña segura
        </button>
      </div>
    </div>
  )
}
