import React from 'react'
import { FiCheckCircle, FiInfo, FiAlertCircle } from 'react-icons/fi'
import '../styles/components/modals.css'

export default function InfoModal({ 
  open, 
  message, 
  onClose, 
  title, 
  type = 'success',
  icon: CustomIcon 
}) {
  if (!open) return null;

  const getIcon = () => {
    if (CustomIcon) return <CustomIcon size={24} />
    
    switch (type) {
      case 'success':
        return <FiCheckCircle size={24} />
      case 'info':
        return <FiInfo size={24} />
      case 'warning':
        return <FiAlertCircle size={24} />
      default:
        return <FiInfo size={24} />
    }
  }

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return 'var(--success-800)'
      case 'info':
        return '#3b82f6'
      case 'warning':
        return 'var(--warning-600)'
      default:
        return '#3b82f6'
    }
  }

  return (
    <div 
      className="info-modal-overlay" 
      onClick={onClose}
    >
      <div 
        className="info-modal-sheet" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="info-modal-header">
          <div className="info-modal-icon" style={{ color: getIconColor() }}>
            {getIcon()}
          </div>
          {title && (
            <h3 className="info-modal-title">
              {title}
            </h3>
          )}
        </div>
        
        <div className="info-modal-body">
          <p className="info-modal-message">
            {message}
          </p>
        </div>
        
        <div className="info-modal-footer">
          <button 
            className="info-modal-btn"
            onClick={onClose}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

