import React from 'react'
import { FiAlertTriangle } from 'react-icons/fi'
import '../styles/components/modals.css'

export default function ConfirmModal({ open, message, onConfirm, onCancel, title = 'Confirmar acción', confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'danger', loading = false }) {
  if (!open) return null;
  
  const typeStyles = {
    danger: {
      iconColor: 'var(--error-700)'
    },
    warning: {
      iconColor: 'var(--warning-600)'
    },
    info: {
      iconColor: '#3b82f6'
    }
  }
  
  const styles = typeStyles[type] || typeStyles.danger
  
  return (
    <div 
      className="confirm-modal-overlay" 
      onClick={loading ? undefined : onCancel}
    >
      <div 
        className="confirm-modal-sheet" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-modal-header">
          <div className="confirm-modal-title-wrapper">
            <div className={`confirm-modal-icon ${type}`}>
              <FiAlertTriangle size={20} color={styles.iconColor} />
            </div>
            <h3 className="confirm-modal-title">
              {title}
            </h3>
          </div>
          <p className="confirm-modal-message">
            {message}
          </p>
        </div>
        
        <div className="confirm-modal-footer">
          <button 
            className={`confirm-modal-btn confirm-modal-btn-secondary ${loading ? 'confirm-modal-btn-disabled' : ''}`}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button 
            className={`confirm-modal-btn confirm-modal-btn-primary ${type} ${loading ? 'confirm-modal-btn-disabled' : ''}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}