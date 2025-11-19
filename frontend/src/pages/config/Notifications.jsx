import React, { useState } from 'react'

export default function Notifications(){
  const [email, setEmail] = useState(() => JSON.parse(localStorage.getItem('pref_notifications')||'{}').email ?? true)
  const [sms, setSms] = useState(() => JSON.parse(localStorage.getItem('pref_notifications')||'{}').sms ?? false)
  const [inApp, setInApp] = useState(() => JSON.parse(localStorage.getItem('pref_notifications')||'{}').inApp ?? true)

  function save() {
    localStorage.setItem('pref_notifications', JSON.stringify({ email, sms, inApp }))
    alert('Preferencias guardadas (local)')
  }

  return (
    <div className="form-equipos" style={{maxWidth:700}}>
      <h3>Notificaciones</h3>
      <p style={{color:'#666'}}>Configura cómo recibir notificaciones: correo, SMS o notificaciones internas.</p>
      <div style={{marginTop:12, display:'grid', gap:8}}>
        <label><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /> Correo electrónico</label>
        <label><input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} /> SMS (pendiente de integración)</label>
        <label><input type="checkbox" checked={inApp} onChange={e => setInApp(e.target.checked)} /> Notificaciones en la app</label>
      </div>
      <div style={{marginTop:12}}>
        <button className="btn-verde" onClick={save}>Guardar preferencias</button>
      </div>
    </div>
  )
}
