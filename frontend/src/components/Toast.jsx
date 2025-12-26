import React, { useEffect, useState } from 'react'
import '../styles/toast.css'

export default function Toast({ message, type = 'info', onClose }) {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    // Auto-cerrar después de 5 segundos
    const timer = setTimeout(() => {
      setIsClosing(true)
      // Esperar a que termine la animación antes de llamar onClose
      setTimeout(() => {
        if (onClose) onClose()
      }, 300) // Duración de la animación de salida
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      if (onClose) onClose()
    }, 300)
  }

  return (
    <div className={`toast toast-${type} ${isClosing ? 'toast-closing' : ''}`}> 
      <span>{message}</span>
      <button className="toast-close" onClick={handleClose}>×</button>
    </div>
  )
}
