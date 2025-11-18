import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Esta página redirige a la vista unificada de asignaciones
export default function Asignaciones() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redirigir a la página unificada con la pestaña "ver" activa
    navigate('/equipos/asignar?tab=ver', { replace: true })
  }, [navigate])

  return null
}
