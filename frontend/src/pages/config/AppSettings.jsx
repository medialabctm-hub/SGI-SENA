import React from 'react'

export default function AppSettings(){
  const [lang, setLang] = React.useState(() => localStorage.getItem('app_lang') || 'es')
  const [tz, setTz] = React.useState(() => localStorage.getItem('app_tz') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

  function save() { localStorage.setItem('app_lang', lang); localStorage.setItem('app_tz', tz); alert('Ajustes guardados (local)') }

  return (
    <div className="form-equipos" style={{maxWidth:900}}>
      <h3>Ajustes de la App</h3>
      <p style={{color:'#666'}}>Preferencias globales: idioma, zona horaria, opciones de exportación e integraciones externas.</p>
      <div style={{display:'grid', gap:12, maxWidth:480}}>
        <div>
          <label>Idioma</label>
          <select value={lang} onChange={e=>setLang(e.target.value)} style={{display:'block', marginTop:6}}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label>Zona horaria</label>
          <input value={tz} onChange={e=>setTz(e.target.value)} style={{display:'block', marginTop:6}} />
        </div>
        <div>
          <button className="btn-verde" onClick={save}>Guardar ajustes</button>
        </div>
      </div>
    </div>
  )
}
