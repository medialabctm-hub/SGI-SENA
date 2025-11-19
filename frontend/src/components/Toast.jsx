import React from 'react'
import '../styles/toast.css'

export default function Toast({ message, type = 'info', onClose }) {
  return (
    <div className={`toast toast-${type}`}> 
      <span>{message}</span>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  )
}
