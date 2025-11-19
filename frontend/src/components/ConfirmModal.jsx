import React from 'react'
import { FiAlertTriangle } from 'react-icons/fi'
import '../styles/confirmModal.css'

export default function ConfirmModal({ open, message, onConfirm, onCancel, title = 'Confirmar acción', confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'danger' }) {
  if (!open) return null;
  
  const typeStyles = {
    danger: {
      iconColor: '#ef4444'
    },
    warning: {
      iconColor: '#f59e0b'
    },
    info: {
      iconColor: '#3b82f6'
    }
  }
  
  const styles = typeStyles[type] || typeStyles.danger
  
  return (
    <div 
      className="confirm-modal-overlay" 
      onClick={onCancel}
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
            className="confirm-modal-btn confirm-modal-btn-secondary"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`confirm-modal-btn confirm-modal-btn-primary ${type}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}