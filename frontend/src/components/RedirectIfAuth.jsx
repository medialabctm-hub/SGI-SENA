import React from 'react'
import { Navigate } from 'react-router-dom'

export default function RedirectIfAuth({ children }) {
  // MDL-127: no hay JWT en el navegador; "user" (perfil no sensible cacheado
  // por Login.jsx) es el único indicador local de que hubo un login previo.
  const user = localStorage.getItem('user')
  if (user) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
