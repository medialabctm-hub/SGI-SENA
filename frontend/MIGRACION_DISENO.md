# Guía de Migración al Sistema de Diseño Unificado

## ✅ Páginas ya migradas

1. **Usuarios.jsx** - Completamente migrada
   - Tabla usando `.table-wrapper` y `.table`
   - Botones usando clases base (`.btn`, `.btn-primary`, `.btn-secondary`)
   - Modales usando `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer`
   - Formularios usando `.form`, `.form-group`, `.form-label`, `.form-input`, `.form-select`
   - Buscador usando `.search-wrapper` y `.search-input`

2. **Equipos.jsx** - Completamente migrada
   - Formulario usando clases base
   - Card usando `.card`, `.card-header`, `.card-body`
   - Botones usando clases base

## 📋 Páginas pendientes de migración

### Prioridad Alta

1. **ConsultarEquipo.jsx**
   - [ ] Reemplazar `.users-table` por `.table-wrapper` y `.table`
   - [ ] Reemplazar botones por clases base (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`)
   - [ ] Reemplazar inputs de búsqueda por `.search-wrapper` y `.search-input`
   - [ ] Actualizar modales para usar clases base

2. **Ambientes.jsx**
   - [ ] Revisar y actualizar tablas
   - [ ] Actualizar formularios
   - [ ] Actualizar botones
   - [ ] Actualizar modales

3. **Dashboard.jsx**
   - [ ] Actualizar tarjetas de estadísticas para usar `.card`
   - [ ] Actualizar botones de acceso rápido

4. **Novedades.jsx**
   - [ ] Actualizar formularios
   - [ ] Actualizar tablas
   - [ ] Actualizar botones

5. **Mantenimientos.jsx**
   - [ ] Actualizar formularios
   - [ ] Actualizar tablas
   - [ ] Actualizar botones

### Prioridad Media

6. **CrearNovedad.jsx**
7. **CrearMantenimiento.jsx**
8. **CrearReporte.jsx**
9. **Reportes.jsx**
10. **AsignarEquipo.jsx**
11. **AsignarAmbientes.jsx**
12. **VerificarInventario.jsx**
13. **BuscarCuentadante.jsx**
14. **MisEquipos.jsx**
15. **HistorialVerificaciones.jsx**
16. **HistorialVerificacionesGeneral.jsx**
17. **Horarios.jsx**
18. **Asignaciones.jsx**

### Prioridad Baja (Configuración)

19. **Config.jsx**
20. **config/InvitationCodes.jsx**
21. **config/Notifications.jsx**
22. **config/Security.jsx**
23. **config/AppSettings.jsx**
24. **config/RolesAreas.jsx**

## 🔄 Patrones de Migración

### 1. Tablas

**Antes:**
```jsx
<table className="users-table">
  <thead>
    <tr>
      <th>Columna</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Dato</td>
    </tr>
  </tbody>
</table>
```

**Después:**
```jsx
<div className="table-wrapper">
  <table className="table">
    <thead>
      <tr>
        <th>Columna</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Dato</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 2. Botones

**Antes:**
```jsx
<button className="btn-verde">Guardar</button>
<button className="btn btn-view">Ver</button>
<button className="btn btn-edit">Editar</button>
<button className="btn btn-delete">Eliminar</button>
```

**Después:**
```jsx
<button className="btn btn-primary btn-md">Guardar</button>
<button className="table-action-btn">Ver</button>
<button className="table-action-btn">Editar</button>
<button className="table-action-btn table-action-btn-danger">Eliminar</button>
```

### 3. Formularios

**Antes:**
```jsx
<div className="form-row">
  <label>Nombre</label>
  <input value={value} onChange={onChange} />
  {error && <span className="error-text">{error}</span>}
</div>
```

**Después:**
```jsx
<div className="form-group">
  <label className="form-label">Nombre</label>
  <input 
    type="text"
    className="form-input" 
    value={value} 
    onChange={onChange} 
  />
  {error && <div className="form-error">{error}</div>}
</div>
```

### 4. Modales

**Antes:**
```jsx
<div className="modal-overlay">
  <div className="modal-sheet">
    <div className="modal-header">
      <h3>Título</h3>
      <button className="btn" onClick={onClose}>Cerrar</button>
    </div>
    <div className="modal-body">
      Contenido
    </div>
    <div className="modal-footer">
      <button className="btn">Cancelar</button>
      <button className="btn-verde">Guardar</button>
    </div>
  </div>
</div>
```

**Después:**
```jsx
<div className="modal-overlay">
  <div className="modal">
    <div className="modal-header">
      <h3 className="modal-title">Título</h3>
      <button className="modal-close" onClick={onClose}>×</button>
    </div>
    <div className="modal-body">
      Contenido
    </div>
    <div className="modal-footer">
      <button className="btn btn-secondary btn-md">Cancelar</button>
      <button className="btn btn-primary btn-md">Guardar</button>
    </div>
  </div>
</div>
```

### 5. Tarjetas

**Antes:**
```jsx
<div className="users-panel">
  <h2>Título</h2>
  <div>Contenido</div>
</div>
```

**Después:**
```jsx
<div className="card">
  <div className="card-header">
    <h2 className="card-title">Título</h2>
  </div>
  <div className="card-body">
    Contenido
  </div>
</div>
```

### 6. Buscadores

**Antes:**
```jsx
<input 
  className="search-input"
  placeholder="Buscar..."
  value={query}
  onChange={onChange}
/>
```

**Después:**
```jsx
<div className="search-wrapper">
  <div className="search-input-wrapper">
    <input 
      type="text"
      className="search-input"
      placeholder="Buscar..."
      value={query}
      onChange={onChange}
    />
    <span className="search-icon">🔍</span>
  </div>
  <button className="btn btn-primary btn-md">Buscar</button>
</div>
```

### 7. Estados Vacíos

**Antes:**
```jsx
<div className="users-empty">
  <strong>No hay datos</strong>
  <p>Mensaje</p>
</div>
```

**Después:**
```jsx
<div className="empty-state">
  <div className="empty-icon-wrapper">📋</div>
  <h3>No hay datos</h3>
  <p>Mensaje</p>
</div>
```

### 8. Estados de Carga

**Antes:**
```jsx
{loading ? <div>Cargando...</div> : <Content />}
```

**Después:**
```jsx
{loading ? (
  <div className="loading-state">
    <div className="loading-spinner"></div>
    <p>Cargando...</p>
  </div>
) : (
  <Content />
)}
```

## 📝 Checklist de Migración por Página

Para cada página, verificar:

- [ ] Tablas usan `.table-wrapper` y `.table`
- [ ] Botones usan clases base (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`)
- [ ] Formularios usan `.form`, `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-textarea`
- [ ] Modales usan `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer`
- [ ] Tarjetas usan `.card`, `.card-header`, `.card-body`, `.card-footer`
- [ ] Buscadores usan `.search-wrapper` y `.search-input`
- [ ] Estados vacíos usan `.empty-state`
- [ ] Estados de carga usan `.loading-state`
- [ ] Badges usan `.badge` con variantes
- [ ] Espaciados usan variables CSS (--spacing-*)
- [ ] Se eliminaron estilos inline innecesarios
- [ ] Se eliminaron clases CSS personalizadas que duplican funcionalidad base

## 🎯 Prioridades

1. **Primero**: Páginas más usadas (ConsultarEquipo, Ambientes, Dashboard)
2. **Segundo**: Páginas de creación/edición (Novedades, Mantenimientos, Reportes)
3. **Tercero**: Páginas de configuración y administración
4. **Cuarto**: Páginas de visualización y reportes

## ⚠️ Notas Importantes

- NO eliminar estilos CSS existentes hasta verificar que todo funciona
- Mantener funcionalidad existente
- Probar cada página después de migrar
- Los estilos base están en `frontend/src/styles/base.css`
- Las variables de espaciado están definidas en `base.css`

