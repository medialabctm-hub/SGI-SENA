import React, { useState, useEffect } from 'react'
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
  loading = false 
}) {
  const [inputValue, setInputValue] = useState('')
  const [isValid, setIsValid] = useState(false)

  // Resetear el input cuando se abre/cierra el modal
  useEffect(() => {
    if (open) {
      setInputValue('')
      setIsValid(false)
    }
  }, [open])

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

  return (
    <div 
      className="destructive-confirm-modal-overlay" 
      onClick={loading ? undefined : onCancel}
    >
      <div 
        className="destructive-confirm-modal-sheet" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="destructive-confirm-modal-header">
          <div className="destructive-confirm-modal-title-wrapper">
            <div className="destructive-confirm-modal-icon danger">
              <FiAlertTriangle size={24} color="var(--error-600)" />
            </div>
            <h3 className="destructive-confirm-modal-title">
              {title}
            </h3>
          </div>
          <p className="destructive-confirm-modal-message">
            {message}
          </p>
        </div>
        
        <div className="destructive-confirm-modal-body">
          <div className="destructive-confirm-modal-input-wrapper">
            <label className="destructive-confirm-modal-label">
              Escribe <strong>"{confirmationPhrase}"</strong> para confirmar:
            </label>
            <input
              type="text"
              className={`destructive-confirm-modal-input ${!isValid && inputValue ? 'destructive-confirm-modal-input-error' : ''}`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={confirmationPhrase}
              disabled={loading}
              autoFocus
            />
            {!isValid && inputValue && (
              <p className="destructive-confirm-modal-hint">
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
  )
}

