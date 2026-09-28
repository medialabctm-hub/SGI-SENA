import React, { useState, useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { FiAlertTriangle } from 'react-icons/fi'
import '../styles/components/modals.css'

export default function DestructiveConfirmModal({ 
  open, 
  message, 
  onConfirm, 
  onCancel, 
  title = 'Confirmar acción destructiva',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmationPhrase = 'confirmar accion',
  loading = false,
  returnFocusRef
}) {
  const [inputValue, setInputValue] = useState('')
  const [isValid, setIsValid] = useState(false)
  const id = useId()
  const titleId = `${id}-title`
  const messageId = `${id}-message`
  const inputId = `${id}-input`
  const hintId = `${id}-hint`
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const previousFocusRef = useRef(null)

  // Resetear el input cuando se abre/cierra el modal
  useEffect(() => {
    if (!open) return undefined

    previousFocusRef.current = document.activeElement
    const fallbackFocus = returnFocusRef?.current
    setInputValue('')
    setIsValid(false)
    inputRef.current?.focus()

    return () => {
      const previousFocus = previousFocusRef.current?.isConnected
        ? previousFocusRef.current
        : fallbackFocus?.isConnected
          ? fallbackFocus
          : null
      previousFocus?.focus()
      previousFocusRef.current = null
    }
  }, [open, returnFocusRef])

  useEffect(() => {
    if (!open || !loading) return
    const focusable = dialogRef.current?.querySelector(
      'input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable) dialogRef.current?.focus()
  }, [open, loading])

  // Validar que el texto coincida exactamente (case-insensitive)
  useEffect(() => {
    const normalizedInput = inputValue.trim().toLowerCase()
    const normalizedPhrase = confirmationPhrase.toLowerCase()
    setIsValid(normalizedInput === normalizedPhrase)
  }, [inputValue, confirmationPhrase])

  if (!open) return null

  const handleConfirm = () => {
    if (isValid && !loading) {
      onConfirm()
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && isValid && !loading) {
      handleConfirm()
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (!loading) onCancel()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = dialogRef.current?.querySelectorAll(
      'input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable?.length) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (document.activeElement === dialogRef.current) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const inputIsInvalid = Boolean(inputValue) && !isValid

  return createPortal((
    <div 
      className="destructive-confirm-modal-overlay" 
      onClick={loading ? undefined : onCancel}
    >
      <div 
        className="destructive-confirm-modal-sheet" 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="destructive-confirm-modal-header">
          <div className="destructive-confirm-modal-title-wrapper">
            <div className="destructive-confirm-modal-icon danger">
              <FiAlertTriangle size={24} color="var(--error-600)" />
            </div>
            <h3 id={titleId} className="destructive-confirm-modal-title">
              {title}
            </h3>
          </div>
          <p id={messageId} className="destructive-confirm-modal-message">
            {message}
          </p>
        </div>
        
        <div className="destructive-confirm-modal-body">
          <div className="destructive-confirm-modal-input-wrapper">
            <label className="destructive-confirm-modal-label" htmlFor={inputId}>
              Escribe <strong>"{confirmationPhrase}"</strong> para confirmar:
            </label>
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              className={`destructive-confirm-modal-input ${!isValid && inputValue ? 'destructive-confirm-modal-input-error' : ''}`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={confirmationPhrase}
              disabled={loading}
              aria-invalid={inputIsInvalid ? 'true' : undefined}
              aria-describedby={inputIsInvalid ? hintId : undefined}
            />
            {inputIsInvalid && (
              <p id={hintId} className="destructive-confirm-modal-hint" aria-live="polite">
                El texto no coincide. Debes escribir exactamente "{confirmationPhrase}"
              </p>
            )}
          </div>
        </div>

        <div className="destructive-confirm-modal-footer">
          <button 
            className={`destructive-confirm-modal-btn destructive-confirm-modal-btn-secondary ${loading ? 'destructive-confirm-modal-btn-disabled' : ''}`}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button 
            className={`destructive-confirm-modal-btn destructive-confirm-modal-btn-primary danger ${!isValid || loading ? 'destructive-confirm-modal-btn-disabled' : ''}`}
            onClick={handleConfirm}
            disabled={!isValid || loading}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  ), document.body)
}

