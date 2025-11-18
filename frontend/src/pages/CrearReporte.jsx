import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Esta página redirige a la vista unificada de reportes
export default function CrearReporte() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redirigir a la página unificada con la pestaña "crear" activa
    navigate('/reportes?tab=crear', { replace: true })
  }, [navigate])

  return null
}
