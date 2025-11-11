import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiMail, FiLock, FiEye, FiUser, FiCreditCard, FiPhone } from 'react-icons/fi'
import { validarRegistro, validarContraseña, validarEmail, validarTelefono, validarCaracteresEspeciales, validarEspaciosInicioFinalNombre } from '../utils/validaciones';
import Toast from '../components/Toast';


export default function Register() {
  const [name, setName] = useState('')
  const [cedula, setCedula] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [area, setArea] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rol, setRol] = useState('Aprendiz')
  const [errores, setErrores] = useState({})
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const datos = {
      nombre_usuario: name,
      cedula_usuario: cedula,
      correo_usuario: email,
      telefono_usuario: telefono,
      contraseña_usuario: password,
      confirmar_contraseña: confirmPassword,
      rol_usuario: rol
    }
    const nuevosErrores = {}
    if (password !== confirmPassword) {
      nuevosErrores.confirmar_contraseña = 'Las contraseñas no coinciden'
    }
    const val = validarRegistro({
      nombre_usuario: name,
      correo_usuario: email,
      telefono_usuario: telefono,
      contraseña_usuario: password
    })
    // Eliminar error de espacios en blanco para nombre, solo validar inicio/final
    if (val.nombre_usuario && val.nombre_usuario.includes('espacios en blanco')) {
      delete val.nombre_usuario;
    }
    Object.assign(nuevosErrores, val)
    const errorEspaciosNombre = validarEspaciosInicioFinalNombre(name, 'nombre')
    if (errorEspaciosNombre) nuevosErrores.nombre_usuario = errorEspaciosNombre
    if (!cedula) {
      nuevosErrores.cedula_usuario = 'La cédula es obligatoria'
    } else if (validarCaracteresEspeciales(cedula, 'cédula')) {
      nuevosErrores.cedula_usuario = validarCaracteresEspeciales(cedula, 'cédula')
    }
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    // Llamada real al backend
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: name,
          cedula,
          correo: (email || '').trim().toLowerCase(),
          telefono,
          area,
          contrasena: password,
          rol
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data && data.error ? data.error : 'Error al registrar usuario', type: 'error' })
        return
      }
      setToast({ message: 'Registro exitoso, ahora puede iniciar sesión', type: 'success' })
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      alert('Error de red o servidor')
    }
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="page login-page" style={{
      backgroundImage: "url('public/images/fondo.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      minHeight: '100vh'
    }}>
      <div className="login-card">
        <div className="logo-box">
          <div className="logo"><img src='/public/images/logoSena.png' alt="Logo SENA" /></div>
        </div>
        <h1 className="title">Crear cuenta</h1>
        <p className="subtitle">SGE SENA</p>


        <form onSubmit={handleSubmit} className="form">
          <label className="input">
            <span className="icon"><FiUser /></span>
            <input
              type="text"
              placeholder="Nombre completo"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </label>
          {errores.nombre_usuario && <div className="error-msg">{errores.nombre_usuario}</div>}
          <label className="input">
            <span className="icon"><FiCreditCard  /></span>
            <input
              type="text"
              placeholder="Cédula"
              value={cedula}
              onChange={e => setCedula(e.target.value)}
            />
          </label>
          {errores.cedula_usuario && <div className="error-msg">{errores.cedula_usuario}</div>}
          <label className="input">
            <span className="icon"><FiMail /></span>
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>
          {errores.correo_usuario && <div className="error-msg">{errores.correo_usuario}</div>}
          <label className="input">
            <span className="icon"><FiPhone /></span>
            <input
              type="tel"
              placeholder="Número de teléfono"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
            />
          </label>
          {errores.telefono_usuario && <div className="error-msg">{errores.telefono_usuario}</div>}
          <label className="input">
            <span className="icon"><FiUser /></span>
            <input
              type="text"
              placeholder="Área de trabajo"
              value={area}
              onChange={e => setArea(e.target.value)}
            />
          </label>
          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <span className="eye"><FiEye /></span>
          </label>
          {errores.contraseña_usuario && <div className="error-msg">{errores.contraseña_usuario}</div>}
          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
            <span className="eye"><FiEye /></span>
          </label>
          {errores.confirmar_contraseña && <div className="error-msg">{errores.confirmar_contraseña}</div>}
          <label className="input">
            <span className="icon"></span>
            <select value={rol} onChange={e => setRol(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent' }}>
              <option value="Aprendiz">Aprendiz</option>
              <option value="Instructor">Instructor</option>
            </select>
          </label>
          <button className="btn primary" type="submit">Registrarse</button>
        </form>

        <div className="links">
          <a href="#" onClick={e => {e.preventDefault();navigate('/')}}>¿Ya tienes cuenta? Inicia sesión</a>
        </div>
      </div>
    </div>
    </>
  )
}
