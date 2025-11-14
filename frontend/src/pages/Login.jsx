import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiMail, FiLock, FiEye } from 'react-icons/fi'
import Toast from '../components/Toast'
import { buildErrorMessage, parseApiResponse } from '../utils/api'


export default function Login() {
  const [cedula, setCedula] = useState('')
  const [contrasena, setPassword] = useState('')
  const [errores, setErrores] = useState({})
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    const datos = {
      cedula_usuario: cedula,
      contraseña_usuario: contrasena
    }
    // Validación mínima
    const nuevosErrores = {}
    if (!cedula) nuevosErrores.cedula_usuario = 'La cédula es obligatoria'
    if (!contrasena) nuevosErrores.contraseña_usuario = 'La contraseña es obligatoria'
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    // Llamada real al backend
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, contrasena })
      })
      const data = await parseApiResponse(res, 'No se pudo iniciar sesión')
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setToast({ message: 'Inicio de sesión exitoso', type: 'success' })
      navigate('/dashboard')
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo iniciar sesión'), type: 'error' })
    }
  }

  return (
    
    <div className="page login-page" style={{
      backgroundImage: "url('public/images/fondo.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      minHeight: '100vh'
    }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="login-card">
        <div className="logo-box">
          <div className="logo"><img src='/public/images/logoSena.png' alt="Logo SENA" /></div>
        </div>
        <h1 className="title">Gestión de Equipos</h1>
        <p className="subtitle">SGE SENA</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="input">
            <span className="icon"><FiMail /></span>
            <input
              type="text"
              placeholder="Cédula"
              value={cedula}
              onChange={e => setCedula(e.target.value)}
            />
          </label>
          {errores.cedula_usuario && <div className="error-msg">{errores.cedula_usuario}</div>}
          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type="password"
              placeholder="Contraseña"
              value={contrasena}
              onChange={e => setPassword(e.target.value)}
            />
            <span className="eye"><FiEye /></span>
          </label>
          {errores.contraseña_usuario && <div className="error-msg">{errores.contraseña_usuario}</div>}
          <button className="btn primary" type="submit">Iniciar Sesión</button>
        </form>

        <div className="links">
          <a href="#">¿Olvidaste tu contraseña?</a>
          <div>
            ¿No tienes cuenta?{' '}
            <a href="#" onClick={e => {e.preventDefault();navigate('/register')}}>Regístrate</a>
          </div>
        </div>
      </div>
    </div>
  )
}
