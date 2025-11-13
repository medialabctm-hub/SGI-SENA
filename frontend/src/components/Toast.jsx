import React from 'react'

export default function Toast({ message, type = 'info', onClose }) {
  return (
    <div className={`toast toast-${type}`}> 
      <span>{message}</span>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  )
}
