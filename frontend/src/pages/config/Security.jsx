import React, { useState } from 'react'

export default function Security() {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)

  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
    let s = ''
    for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)]
    return s
  }

  async function handleGenerate() {
    const pwd = generatePassword()
    try { await navigator.clipboard.writeText(pwd); setMsg({ type: 'success', text: 'Contraseña generada y copiada al portapapeles (temporal).' }) } catch { setMsg({ type: 'info', text: `Contraseña: ${pwd}` }) }
  }

  return (
    <div className="form-equipos" style={{ maxWidth: 700 }}>
      <h3>Cambiar contraseña</h3>
      <p style={{ color: '#666' }}>Este backend no expone un endpoint para cambiar contraseñas. Puedes generar una contraseña temporal y comunicarla al administrador para que la actualice manualmente, o pedir que se implemente el endpoint.</p>
      {msg && <div style={{ marginBottom: 12, color: msg.type === 'success' ? '#138000' : '#666' }}>{msg.text}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-verde" onClick={handleGenerate}>Generar contraseña temporal</button>
        <button className="btn" onClick={() => setMsg(null)}>Limpiar</button>
      </div>
    </div>
  )
}
