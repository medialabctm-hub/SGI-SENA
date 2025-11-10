import React from 'react';

export default function ConfirmModal({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" style={{zIndex: 10000}}>
      <div className="modal-sheet" style={{maxWidth: 380, borderRadius: 16, padding: 28, textAlign: 'center'}}>
        <div style={{fontSize: 18, fontWeight: 600, marginBottom: 18}}>{message}</div>
        <div style={{display: 'flex', justifyContent: 'center', gap: 16}}>
          <button className="btn primary" style={{minWidth: 100}} onClick={onConfirm}>Aceptar</button>
          <button className="btn" style={{background: '#eee', color: '#222', minWidth: 100}} onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}