import React, { useEffect, useRef, useState } from 'react'
import '../styles/components/toast.css'
import { createToastCloseController } from '../utils/toastLifecycle'

export default function Toast({ message, type = 'info', onClose }) {
  const [isClosing, setIsClosing] = useState(false)
  const closeControllerRef = useRef(null)

  useEffect(() => {
    const controller = createToastCloseController({ onClose, setIsClosing })
    closeControllerRef.current = controller
    const timer = setTimeout(controller.close, 5000)

    return () => {
      clearTimeout(timer)
      controller.cleanup()
    }
  }, [message, onClose])

  const handleClose = () => {
    closeControllerRef.current?.close()
  }

  return (
    <div
      className={`toast toast-${type} ${isClosing ? 'toast-closing' : ''}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <span className="toast-message">{message}</span>
      <button className="toast-close" type="button" onClick={handleClose} aria-label="Cerrar notificación">×</button>
    </div>
  )
}
