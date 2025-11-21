import React from 'react';
import '../styles/perfilModal.css';

export default function PerfilModal({ open, user, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-overlay perfil-modal-overlay">
      <div className="modal-sheet perfil-modal-sheet">
        <h3 className="perfil-modal-title">Perfil de Usuario</h3>
        <div className="perfil-modal-field"><b>Nombre:</b> {user?.nombre_usuario || user?.nombre || '-'}</div>
        <div className="perfil-modal-field"><b>Correo:</b> {user?.correo || '-'}</div>
        <div className="perfil-modal-field"><b>Rol:</b> {user?.nombre_rol || (Number(user?.rol)===1?'Administrador':Number(user?.rol)===2?'Instructor':Number(user?.rol)===3?'Aprendiz':user?.rol || '-')}</div>
        <div className="perfil-modal-field"><b>Usuario:</b> {user?.usuario_login || '-'}</div>
        <button className="btn primary perfil-modal-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
