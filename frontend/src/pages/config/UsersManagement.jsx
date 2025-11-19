import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function UsersManagement(){
  const nav = useNavigate()
  return (
    <div className="form-equipos" style={{maxWidth:900}}>
      <h3>Gestión de Usuarios</h3>
      <p style={{color:'#666'}}>Listado, creación, edición e inactivación de cuentas. Este panel puede incluir filtros, roles asignables y exportación de usuarios.</p>
      <div style={{marginTop:12}}>
        <button className="btn-verde" onClick={() => nav('/usuarios')}>Ir a Usuarios</button>
        <button className="btn" style={{marginLeft:8}} onClick={async () => {
          try {
            const res = await fetch('/api/auth/users')
            const rows = await res.json()
            const csv = [Object.keys(rows[0]||{}).join(','), ...rows.map(r => Object.values(r).map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = 'usuarios.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
          } catch (err) { alert('No se pudo exportar: '+err.message) }
        }}>Exportar CSV</button>
      </div>
    </div>
  )
}
