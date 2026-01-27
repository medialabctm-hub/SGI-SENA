import React, { useState, useEffect } from 'react'
import Toast from '../../components/Toast'
import { parseApiResponse, buildErrorMessage } from '../../utils/api'
import '../../styles/pages/config.css'

export default function Security() {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [errors, setErrors] = useState({})
  const [passwordStrength, setPasswordStrength] = useState({ level: 0, feedback: '' })

  // Validar fortaleza de contraseña
  function validatePasswordStrength(password) {
    if (!password || password.length === 0) {
      return { level: 0, label: '', color: '', feedback: '' }
    }
    
    let strength = 0
    const feedback = []
    
    // Longitud mínima (requisito básico)
    if (password.length < 6) {
      return {
        level: 0,
        label: 'Muy Débil',
        color: 'var(--error-500)',
        feedback: 'Mínimo 6 caracteres'
      }
    }
    
    // Si pasa el mínimo, empezar a contar
    strength = 1 // Mínimo cumplido
    
    // Longitud adicional
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    
    // Complejidad
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++
    
    // Limitar el nivel máximo a 5
    strength = Math.min(strength, 5)
    
    const levels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte', 'Muy Fuerte']
    const colors = ['', 'var(--error-500)', 'var(--warning-500)', 'var(--info-500)', 'var(--success-600)', 'var(--success-800)']
    
    return {
      level: strength,
      label: levels[strength] || 'Muy Débil',
      color: colors[strength] || 'var(--error-500)',
      feedback: feedback.length > 0 ? feedback.join(', ') : ''
    }
  }

  // Validar en tiempo real
  useEffect(() => {
    // Validar fortaleza de contraseña solo si hay texto
    if (newPass && newPass.trim().length > 0) {
      const strength = validatePasswordStrength(newPass)
      setPasswordStrength(strength)
    } else {
      setPasswordStrength({ level: 0, label: '', color: '', feedback: '' })
    }
    
    const newErrors = {}
    
    // Validar nueva contraseña
    if (newPass && newPass.trim().length > 0 && newPass.length < 6) {
      newErrors.newPass = 'La contraseña debe tener al menos 6 caracteres'
    }
    
    if (newPass && current && newPass === current) {
      newErrors.newPass = 'La nueva contraseña debe ser diferente a la actual'
    }
    
    // Validar confirmación
    if (confirm && newPass && newPass !== confirm) {
      newErrors.confirm = 'Las contraseñas no coinciden'
    }
    
    setErrors(newErrors)
  }, [current, newPass, confirm])

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
    
    // Validaciones completas
    const newErrors = {}
    
    if (!current) {
      newErrors.current = 'La contraseña actual es obligatoria'
    }
    
    if (!newPass) {
      newErrors.newPass = 'La nueva contraseña es obligatoria'
    } else if (newPass.length < 6) {
      newErrors.newPass = 'La contraseña debe tener al menos 6 caracteres'
    } else if (newPass === current) {
      newErrors.newPass = 'La nueva contraseña debe ser diferente a la actual'
    }
    
    if (!confirm) {
      newErrors.confirm = 'Debes confirmar la nueva contraseña'
    } else if (newPass !== confirm) {
      newErrors.confirm = 'Las contraseñas no coinciden'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setToast({ message: 'Por favor corrige los errores en el formulario', type: 'error' })
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

      // Manejar errores específicos antes de parseApiResponse
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData?.error || errorData?.message || ''
        
        // Si es un error de contraseña actual incorrecta, mostrarlo específicamente
        if (res.status === 401 && errorMessage.toLowerCase().includes('contraseña actual')) {
          setErrors({ current: errorMessage || 'La contraseña actual es incorrecta' })
          setToast({ message: errorMessage || 'La contraseña actual es incorrecta', type: 'error' })
          setLoading(false)
          return
        }
      }

      const data = await parseApiResponse(res, 'No se pudo cambiar la contraseña')
      setToast({ message: data.message || 'Contraseña cambiada exitosamente', type: 'success' })
      setCurrent('')
      setNewPass('')
      setConfirm('')
      setErrors({})
      setPasswordStrength({ level: 0, label: '', color: '', feedback: '' })
    } catch (err) {
      // Verificar si es un error de contraseña actual
      const errorMessage = err?.message || ''
      if (errorMessage.toLowerCase().includes('contraseña actual') || 
          errorMessage.toLowerCase().includes('la contraseña actual es incorrecta')) {
        setErrors({ current: errorMessage || 'La contraseña actual es incorrecta' })
        setToast({ message: errorMessage || 'La contraseña actual es incorrecta', type: 'error' })
      } else {
        setToast({ message: buildErrorMessage(err, 'Error al cambiar la contraseña'), type: 'error' })
      }
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
              className={`form-input ${errors.current ? 'form-input-error' : ''}`}
              value={current}
              onChange={e => {
                setCurrent(e.target.value)
                if (errors.current) {
                  setErrors(prev => ({ ...prev, current: '' }))
                }
              }}
              disabled={loading}
              required
            />
            {errors.current && (
              <small className="security-error" style={{ color: 'var(--error-500)', marginTop: '0.5rem', display: 'block' }}>
                {errors.current}
              </small>
            )}
          </div>
          <div className="form-row">
            <label>Nueva contraseña</label>
            <input
              type="password"
              className={`form-input ${errors.newPass ? 'form-input-error' : ''} ${passwordStrength.level >= 3 && !errors.newPass ? 'form-input-success' : ''}`}
              value={newPass}
              onChange={e => {
                setNewPass(e.target.value)
                if (errors.newPass) {
                  setErrors(prev => ({ ...prev, newPass: '' }))
                }
              }}
              disabled={loading}
              minLength={6}
              required
            />
            {errors.newPass && (
              <small className="security-error" style={{ color: 'var(--error-500)', marginTop: '0.5rem', display: 'block' }}>
                {errors.newPass}
              </small>
            )}
            {newPass && newPass.trim().length > 0 && !errors.newPass && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: passwordStrength.color || 'var(--neutral-600)' }}>
                    Fortaleza: {passwordStrength.label || 'Muy Débil'}
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: '4px', 
                  height: '6px', 
                  borderRadius: '3px', 
                  overflow: 'hidden',
                  background: 'var(--neutral-200)'
                }}>
                  {[1, 2, 3, 4, 5].map(level => (
                    <div
                      key={level}
                      style={{
                        flex: 1,
                        background: level <= passwordStrength.level ? passwordStrength.color : 'var(--neutral-200)',
                        transition: 'background 0.3s ease'
                      }}
                    />
                  ))}
                </div>
                {passwordStrength.feedback && (
                  <small className="security-help" style={{ marginTop: '0.5rem', display: 'block' }}>
                    {passwordStrength.feedback}
                  </small>
                )}
                {!passwordStrength.feedback && passwordStrength.level > 0 && (
                  <small className="security-help" style={{ marginTop: '0.5rem', display: 'block' }}>
                    Mínimo 6 caracteres. Incluye mayúsculas, números y símbolos para mayor seguridad.
                  </small>
                )}
              </div>
            )}
            {!newPass && (
              <small className="security-help">
                Mínimo 6 caracteres. Recomendado: mayúsculas, números y símbolos.
              </small>
            )}
          </div>
          <div className="form-row">
            <label>Confirmar nueva contraseña</label>
            <input
              type="password"
              className={`form-input ${errors.confirm ? 'form-input-error' : ''} ${confirm && newPass === confirm && !errors.confirm ? 'form-input-success' : ''}`}
              value={confirm}
              onChange={e => {
                setConfirm(e.target.value)
                if (errors.confirm) {
                  setErrors(prev => ({ ...prev, confirm: '' }))
                }
              }}
              disabled={loading}
              required
            />
            {errors.confirm && (
              <small className="security-error" style={{ color: 'var(--error-500)', marginTop: '0.5rem', display: 'block' }}>
                {errors.confirm}
              </small>
            )}
            {confirm && newPass === confirm && !errors.confirm && (
              <small style={{ color: 'var(--success-600)', marginTop: '0.5rem', display: 'block', fontWeight: 500 }}>
                ✓ Las contraseñas coinciden
              </small>
            )}
          </div>
        </div>
        <div className="security-submit">
          <button className="btn btn-verde" type="submit" disabled={loading}>
            {loading ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>

      <div className="security-generator">
        <h4 className="security-generator-title">Generador de contraseñas</h4>
        <p className="security-generator-description">
          Genera una contraseña segura aleatoria
        </p>
        <button className="btn btn-secondary" onClick={handleGenerate} disabled={loading}>
          Generar contraseña segura
        </button>
      </div>
    </div>
  )
}
