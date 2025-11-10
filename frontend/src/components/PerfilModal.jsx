import React from 'react';

export default function PerfilModal({ open, user, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" style={{zIndex: 10000}}>
      <div className="modal-sheet" style={{maxWidth: 400, borderRadius: 16, padding: 28}}>
        <h3 style={{marginBottom: 16}}>Perfil de Usuario</h3>
        <div style={{marginBottom: 10}}><b>Nombre:</b> {user?.nombre_usuario || '-'}</div>
        <div style={{marginBottom: 10}}><b>Correo:</b> {user?.correo || '-'}</div>
        <div style={{marginBottom: 10}}><b>Rol:</b> {user?.rol || user?.nombre_rol || '-'}</div>
        <div style={{marginBottom: 10}}><b>Área:</b> {user?.area || '-'}</div>
        <div style={{marginBottom: 10}}><b>Usuario:</b> {user?.usuario_login || '-'}</div>
        <button className="btn primary" style={{marginTop: 18}} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
