import React from 'react'

export default function RolesAreas(){
  const [roles, setRoles] = React.useState(() => JSON.parse(localStorage.getItem('app_roles')||'[]'))
  const [areas, setAreas] = React.useState(() => JSON.parse(localStorage.getItem('app_areas')||'[]'))
  const [roleName, setRoleName] = React.useState('')
  const [areaName, setAreaName] = React.useState('')

  function saveRoles(r) { setRoles(r); localStorage.setItem('app_roles', JSON.stringify(r)) }
  function saveAreas(a) { setAreas(a); localStorage.setItem('app_areas', JSON.stringify(a)) }

  return (
    <div className="form-equipos" style={{maxWidth:900}}>
      <h3>Roles y Áreas</h3>
      <p style={{color:'#666'}}>Crear/editar roles y áreas (local). Estos datos se guardan en localStorage como demo; para producción necesitarás endpoints backend.</p>
      <div style={{display:'flex', gap:20}}>
        <div style={{flex:1}}>
          <strong>Roles</strong>
          <ul>
            {roles.map((r, i) => <li key={i}>{r} <button className="btn" style={{marginLeft:8}} onClick={() => { const nr = roles.slice(); nr.splice(i,1); saveRoles(nr) }}>Eliminar</button></li>)}
          </ul>
          <div style={{display:'flex', gap:8}}>
            <input placeholder="Nuevo rol" value={roleName} onChange={e=>setRoleName(e.target.value)} />
            <button className="btn-verde" onClick={() => { if(!roleName) return; saveRoles([...roles, roleName]); setRoleName('') }}>Agregar</button>
          </div>
        </div>
        <div style={{flex:1}}>
          <strong>Áreas</strong>
          <ul>
            {areas.map((a,i) => <li key={i}>{a} <button className="btn" style={{marginLeft:8}} onClick={() => { const na = areas.slice(); na.splice(i,1); saveAreas(na) }}>Eliminar</button></li>)}
          </ul>
          <div style={{display:'flex', gap:8}}>
            <input placeholder="Nueva área" value={areaName} onChange={e=>setAreaName(e.target.value)} />
            <button className="btn-verde" onClick={() => { if(!areaName) return; saveAreas([...areas, areaName]); setAreaName('') }}>Agregar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
