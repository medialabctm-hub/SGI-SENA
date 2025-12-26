import { FiAlertTriangle, FiX } from 'react-icons/fi'
import '../styles/bloqueoModal.css'

export default function BloqueoModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="bloqueo-modal-overlay" onClick={onClose}>
      <div className="bloqueo-modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="bloqueo-modal-close" onClick={onClose} aria-label="Cerrar">
          <FiX size={24} />
        </button>
        
        <div className="bloqueo-modal-icon">
          <FiAlertTriangle size={64} />
        </div>
        
        <h2 className="bloqueo-modal-title">Acción Bloqueada</h2>
        
        <div className="bloqueo-modal-content">
          <p className="bloqueo-modal-message">
            No puedes cambiar de página mientras haya registros con placas duplicadas pendientes de revisión.
          </p>
          <p className="bloqueo-modal-instruction">
            Por favor, aprueba o rechaza todos los registros duplicados antes de continuar.
          </p>
        </div>
        
        <button className="bloqueo-modal-button" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  )
}

