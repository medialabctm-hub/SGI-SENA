import React from 'react'
import { FiAlertTriangle, FiX } from 'react-icons/fi'

export default function ConfirmModal({ open, message, onConfirm, onCancel, title = 'Confirmar acción', confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'danger' }) {
  if (!open) return null;
  
  const typeStyles = {
    danger: {
      iconColor: '#ef4444',
      iconBg: '#fee2e2',
      confirmBg: '#ef4444',
      confirmHover: '#dc2626'
    },
    warning: {
      iconColor: '#f59e0b',
      iconBg: '#fef3c7',
      confirmBg: '#f59e0b',
      confirmHover: '#d97706'
    },
    info: {
      iconColor: '#3b82f6',
      iconBg: '#dbeafe',
      confirmBg: '#3b82f6',
      confirmHover: '#2563eb'
    }
  }
  
  const styles = typeStyles[type] || typeStyles.danger
  
  return (
    <div 
      className="modal-overlay" 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onCancel}
    >
      <div 
        className="modal-sheet" 
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          padding: 0,
          maxWidth: '420px',
          width: '90%',
          overflow: 'hidden',
          animation: 'modal-in 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '24px 24px 20px 24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: styles.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <FiAlertTriangle size={20} color={styles.iconColor} />
            </div>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: '#1a2a3a'
            }}>
              {title}
            </h3>
          </div>
          <p style={{
            margin: 0,
            fontSize: '15px',
            color: '#4b5563',
            lineHeight: '1.5',
            paddingLeft: '52px'
          }}>
            {message}
          </p>
        </div>
        
        <div style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: '#f9fafb'
        }}>
          <button 
            className="btn-secondary btn-modern"
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              border: '1.5px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.background = '#f3f4f6'
              e.target.style.borderColor = '#9ca3af'
            }}
            onMouseOut={(e) => {
              e.target.style.background = '#fff'
              e.target.style.borderColor = '#d1d5db'
            }}
          >
            {cancelText}
          </button>
          <button 
            className="btn-primary btn-modern"
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              background: styles.confirmBg,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: `0 2px 8px ${styles.confirmBg}40`
            }}
            onMouseOver={(e) => {
              e.target.style.background = styles.confirmHover
            }}
            onMouseOut={(e) => {
              e.target.style.background = styles.confirmBg
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}