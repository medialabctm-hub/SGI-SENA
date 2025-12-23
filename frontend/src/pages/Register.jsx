import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiCreditCard, FiPhone } from 'react-icons/fi'
import { validarRegistro, validarContraseña, validarEmail, validarTelefono, validarCaracteresEspeciales, validarEspaciosInicioFinalNombre } from '../utils/validaciones';
import Toast from '../components/Toast';
import InteractiveBackground from '../components/InteractiveBackground';
import CustomSelect from '../components/CustomSelect';
import { parseApiResponse, buildErrorMessage } from '../utils/api';
import '../styles/auth.css';


export default function Register() {
  const [name, setName] = useState('')
  const [cedula, setCedula] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false)
  const [rol, setRol] = useState('Aprendiz')
  const [codigoInvitacion, setCodigoInvitacion] = useState('')
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
      nuevosErrores.cedula_usuario = 'La Documento es obligatoria'
    } else if (validarCaracteresEspeciales(cedula, 'Documento')) {
      nuevosErrores.cedula_usuario = validarCaracteresEspeciales(cedula, 'Documento')
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
          contrasena: password,
          rol,
          codigo_invitacion: (rol === 'Instructor' || rol === 'Administrador' || rol === 'Cuentadante') ? codigoInvitacion.trim() : null
        })
      })
      const data = await parseApiResponse(res, 'No se pudo completar el registro')
      setToast({ message: 'Registro exitoso, ahora puede iniciar sesión', type: 'success' })
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo completar el registro'), type: 'error' })
    }
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="page login-page animated-bg">
        <InteractiveBackground />
      <div className="login-card">
        <div className="logo-box">
          <div className="logo"><img src='/images/logoSena.png' alt="Logo SENA" /></div>
        </div>
        <h1 className="title">Crear cuenta</h1>
        <p className="subtitle">SGISENA</p>


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
              placeholder="Documento"
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
  
          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type={mostrarPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <span 
              className="eye auth-eye-icon" 
              onClick={() => setMostrarPassword(!mostrarPassword)}
            >
              {mostrarPassword ? <FiEyeOff /> : <FiEye />}
            </span>
          </label>
          {errores.contraseña_usuario && <div className="error-msg">{errores.contraseña_usuario}</div>}
          <label className="input">
            <span className="icon"><FiLock /></span>
            <input
              type={mostrarConfirmPassword ? 'text' : 'password'}
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
            <span 
              className="eye auth-eye-icon" 
              onClick={() => setMostrarConfirmPassword(!mostrarConfirmPassword)}
            >
              {mostrarConfirmPassword ? <FiEyeOff /> : <FiEye />}
            </span>
          </label>
          {errores.confirmar_contraseña && <div className="error-msg">{errores.confirmar_contraseña}</div>}
          <label className="input">
            <span className="icon"></span>
            <CustomSelect
              name="rol"
              value={rol}
              onChange={e => {
                setRol(e.target.value);
                if (e.target.value === 'Aprendiz') {
                  setCodigoInvitacion('');
                }
              }}
              options={['Aprendiz', 'Instructor', 'Administrador', 'Cuentadante']}
              placeholder="Seleccionar rol"
              className="auth-select-input"
            />
          </label>
          {(rol === 'Instructor' || rol === 'Administrador' || rol === 'Cuentadante') && (
            <>
              <label className="input">
                <span className="icon"><FiLock /></span>
                <input
                  type="text"
                  placeholder={`Código de Seguridad (requerido para ${rol === 'Instructor' ? 'Instructores' : rol === 'Administrador' ? 'Administradores' : 'Cuentadantes'})`}
                  value={codigoInvitacion}
                  onChange={e => setCodigoInvitacion(e.target.value)}
                  className="auth-select-uppercase"
                />
              </label>
              {errores.codigo_invitacion && <div className="error-msg">{errores.codigo_invitacion}</div>}
              <p className="auth-help-text">
                Necesitas un código de invitación válido para registrarte como {rol}
              </p>
            </>
          )}
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
