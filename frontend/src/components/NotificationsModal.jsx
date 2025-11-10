import React from 'react'
import { FiCircle } from 'react-icons/fi'

const notifications = [
  { id: 1, title: 'Nuevo equipo registrado', body: 'Se ha registrado una nueva laptop Dell', time: '2 min' },
  { id: 2, title: 'Mantenimiento programado', body: 'Equipo ID: 001 necesita mantenimiento', time: '15 min' },
  { id: 3, title: 'Usuario registrado', body: 'Nuevo aprendiz se ha registrado en el sistema', time: '1 hora' },
]

export default function NotificationsModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>Notificaciones</h4>
          <button className="lect_btn">Marcar como leídas</button>
        </div>
        <div className="modal-list">
          {notifications.map((n) => (
            <div key={n.id} className="notif-item">
              <div className="notif-left"><FiCircle style={{ color: '#28a745', fontSize: '18px' }} /></div>
              <div className="notif-body">
                <div className="notif-title">{n.title}</div>
                <div className="notif-text">{n.body}</div>
              </div>
              <div className="notif-time">{n.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
