import React, { useEffect, useState } from 'react'

export default function Profile() {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ nombre_usuario: '', correo: '', telefono: '', cedula: '', area: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    async function fetchMe() {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        if (data?.user) setForm({ nombre_usuario: data.user.nombre_usuario || '', correo: data.user.correo || '', telefono: data.user.telefono || '', cedula: data.user.cedula || '', area: data.user.area || '' })
      } catch (err) { /* ignore */ }
    }
    fetchMe()
  }, [])

  function onChange(e) { const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value })) }

  async function handleSave() {
    const token = localStorage.getItem('token')
    if (!token) return setMsg({ type: 'error', text: 'No autorizado' })
    const id = JSON.parse(localStorage.getItem('user') || '{}').id_usuario
    if (!id) return setMsg({ type: 'error', text: 'ID de usuario no disponible' })
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/user/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ nombre: form.nombre_usuario, cedula: form.cedula, correo: form.correo, telefono: form.telefono, rol: JSON.parse(localStorage.getItem('user') || '{}').nombre_rol || 'Aprendiz' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error al actualizar')
      setMsg({ type: 'success', text: data.message || 'Perfil actualizado' })
      setEditing(false)
      try { localStorage.setItem('user', JSON.stringify({ ...(JSON.parse(localStorage.getItem('user')||'{}')), nombre_usuario: form.nombre_usuario, correo: form.correo, telefono: form.telefono, cedula: form.cedula, area: form.area })) } catch {}
    } catch (err) { setMsg({ type: 'error', text: err.message || 'Error' }) } finally { setLoading(false) }
  }

  return (
    <div className="form-equipos" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Perfil</div>
          <div style={{ color: '#666', fontSize: 13 }}>Revisa y actualiza tu información personal.</div>
        </div>
        <div>
          {!editing ? (
            <button className="btn-verde" onClick={() => setEditing(true)}>Editar</button>
          ) : (
            <>
              <button className="btn-verde" onClick={handleSave} disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
              <button className="btn" onClick={() => { setEditing(false); setForm(prev => ({ ...prev })); }} style={{ marginLeft: 8 }}>Cancelar</button>
            </>
          )}
        </div>
      </div>

      {msg && <div style={{ marginBottom: 12, color: msg.type === 'error' ? '#c00' : '#138000' }}>{msg.text}</div>}

      <form>
        <div className="form-grid">
          <div className="form-row">
            <label>Nombre completo</label>
            <input name="nombre_usuario" value={form.nombre_usuario} onChange={onChange} readOnly={!editing} />
          </div>
          <div className="form-row">
            <label>Correo</label>
            <input name="correo" value={form.correo} onChange={onChange} readOnly={!editing} />
          </div>
          <div className="form-row">
            <label>Teléfono</label>
            <input name="telefono" value={form.telefono} onChange={onChange} readOnly={!editing} />
          </div>
          <div className="form-row">
            <label>Cédula</label>
            <input name="cedula" value={form.cedula} onChange={onChange} readOnly={!editing} />
          </div>
          <div className="form-row">
            <label>Área</label>
            <input name="area" value={form.area} onChange={onChange} readOnly={!editing} />
          </div>
        </div>
      </form>
    </div>
  )
}
