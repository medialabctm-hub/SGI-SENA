import React, { useEffect, useRef, useState } from 'react'
import '../styles/components/toast.css'
import { createToastCloseController } from '../utils/toastLifecycle'

export default function Toast({ message, type = 'info', onClose }) {
  const toastCycle = `${type}:${message}`
  const [closingCycle, setClosingCycle] = useState(null)
  const closeControllerRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const isClosing = closingCycle === toastCycle

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const controller = createToastCloseController({
      onClose: () => onCloseRef.current?.(),
      setIsClosing: () => setClosingCycle(toastCycle),
    })
    closeControllerRef.current = controller
    const timer = setTimeout(controller.close, 5000)

    return () => {
      clearTimeout(timer)
      controller.cleanup()
    }
  }, [toastCycle])

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
