# Sistema de Diseño Unificado - SGI SENA

## 📋 Guía de Uso

Este documento describe el sistema de diseño unificado que debe aplicarse a TODO el proyecto para mantener coherencia visual.

## 🎨 Componentes Base

Todos los componentes base están definidos en `frontend/src/styles/base.css` y deben usarse consistentemente en todo el proyecto.

### Botones

**Clases disponibles:**
- `.btn` - Clase base para todos los botones
- `.btn-sm`, `.btn-md`, `.btn-lg` - Tamaños
- `.btn-primary` - Botón principal (verde)
- `.btn-secondary` - Botón secundario (blanco con borde)
- `.btn-danger` - Botón de peligro (rojo)
- `.btn-ghost` - Botón sin fondo
- `.btn-full-width` - Botón de ancho completo

**Ejemplo:**
```jsx
<button className="btn btn-primary btn-md">Guardar</button>
<button className="btn btn-secondary btn-sm">Cancelar</button>
<button className="btn btn-danger btn-md">Eliminar</button>
```

**Reglas:**
- ✅ SIEMPRE usar las clases base
- ❌ NO crear variaciones personalizadas
- ✅ Mantener el mismo tamaño en toda la app
- ✅ Usar `btn-primary` para acciones principales

### Inputs y Formularios

**Clases disponibles:**
- `.form-group` - Contenedor de campo
- `.form-label` - Etiqueta del campo
- `.form-input` - Input de texto
- `.form-select` - Select/Dropdown
- `.form-textarea` - Textarea
- `.form-input-with-icon` - Input con icono
- `.form-error` - Mensaje de error

**Ejemplo:**
```jsx
<div className="form-group">
  <label className="form-label">Nombre</label>
  <input type="text" className="form-input" />
  <div className="form-error">Este campo es requerido</div>
</div>
```

**Reglas:**
- ✅ Todos los inputs deben tener altura: 44px
- ✅ Todos los inputs deben tener padding: 12px 14px
- ✅ Todos los inputs deben tener border-radius: 10px
- ✅ Las etiquetas siempre arriba del input
- ✅ Espaciado entre campos: 16px

### Tablas

**Clases disponibles:**
- `.table-wrapper` - Contenedor de tabla
- `.table` - Tabla base
- `.table-actions` - Contenedor de botones de acción
- `.table-action-btn` - Botón de acción en tabla

**Ejemplo:**
```jsx
<div className="table-wrapper">
  <table className="table">
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Juan</td>
        <td>
          <div className="table-actions">
            <button className="table-action-btn">Editar</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

**Reglas:**
- ✅ Todas las tablas deben usar `.table-wrapper`
- ✅ Headers: font-size 13px, font-weight 700, uppercase
- ✅ Celdas: padding 14px 16px
- ✅ Mismo estilo de borde y sombra

### Tarjetas (Cards)

**Clases disponibles:**
- `.card` - Tarjeta base
- `.card-header` - Encabezado de tarjeta
- `.card-title` - Título de tarjeta
- `.card-body` - Cuerpo de tarjeta
- `.card-footer` - Pie de tarjeta

**Ejemplo:**
```jsx
<div className="card">
  <div className="card-header">
    <h3 className="card-title">Título</h3>
  </div>
  <div className="card-body">
    Contenido
  </div>
  <div className="card-footer">
    <button className="btn btn-primary">Acción</button>
  </div>
</div>
```

**Reglas:**
- ✅ Padding: 20px
- ✅ Border-radius: 12px
- ✅ Sombra: 0 2px 8px rgba(0, 0, 0, 0.08)
- ✅ Mismo estilo en todas las tarjetas

### Modales

**Clases disponibles:**
- `.modal-overlay` - Overlay del modal
- `.modal` - Contenedor del modal
- `.modal-header` - Encabezado
- `.modal-title` - Título
- `.modal-body` - Cuerpo
- `.modal-footer` - Pie
- `.modal-close` - Botón cerrar

**Ejemplo:**
```jsx
<div className="modal-overlay">
  <div className="modal">
    <div className="modal-header">
      <h3 className="modal-title">Título</h3>
      <button className="modal-close">×</button>
    </div>
    <div className="modal-body">
      Contenido
    </div>
    <div className="modal-footer">
      <button className="btn btn-secondary">Cancelar</button>
      <button className="btn btn-primary">Guardar</button>
    </div>
  </div>
</div>
```

**Reglas:**
- ✅ Border-radius: 16px
- ✅ Padding: 24px
- ✅ Misma estructura en todos los modales

### Buscadores

**Clases disponibles:**
- `.search-wrapper` - Contenedor del buscador
- `.search-input-wrapper` - Contenedor del input
- `.search-input` - Input de búsqueda
- `.search-icon` - Icono de búsqueda

**Ejemplo:**
```jsx
<div className="search-wrapper">
  <div className="search-input-wrapper">
    <input type="text" className="search-input" placeholder="Buscar..." />
    <span className="search-icon">🔍</span>
  </div>
  <button className="btn btn-primary">Buscar</button>
</div>
```

## 📏 Espaciados

Usar siempre las variables de espaciado definidas:

- `--spacing-xs`: 4px
- `--spacing-sm`: 8px
- `--spacing-md`: 12px
- `--spacing-lg`: 16px
- `--spacing-xl`: 20px
- `--spacing-2xl`: 24px
- `--spacing-3xl`: 32px
- `--spacing-4xl`: 40px

**Reglas:**
- ✅ NO inventar valores nuevos
- ✅ Usar solo estos espaciados
- ✅ Mantener consistencia entre pantallas

## 🎯 Reglas Generales

### 1. Reutilización
- ✅ SIEMPRE usar los componentes base
- ❌ NO crear versiones nuevas del mismo componente
- ✅ Revisar si ya existe un componente similar antes de crear uno nuevo

### 2. Estructura Uniforme
- ✅ Mismos tamaños de inputs (44px altura)
- ✅ Mismas alturas de botones (36px, 44px, 52px)
- ✅ Mismos espaciados internos
- ✅ Mismas sombras y bordes

### 3. Jerarquía Visual
Títulos → Subtítulos → Secciones → Contenido

- **Títulos principales**: 24px, font-weight 700
- **Subtítulos**: 18px, font-weight 700
- **Secciones**: 16px, font-weight 600
- **Contenido**: 14-15px, font-weight 400-500

### 4. Formularios
- ✅ Etiqueta siempre arriba del input
- ✅ Mismo tamaño de input en toda la app
- ✅ Distancia consistente entre campos (16px)
- ✅ Validaciones con mismo formato

### 5. Tablas
- ✅ Misma tipografía
- ✅ Misma estructura y separación
- ✅ Mismo estilo de encabezado
- ✅ Misma alineación de botones

### 6. Tarjetas
- ✅ Misma curva de borde (12px)
- ✅ Mismo tamaño de sombra
- ✅ Misma estructura (ícono → título → datos)

### 7. Iconografía
- ✅ Tamaño uniforme: 16px, 18px, 20px, 24px
- ✅ Mismo grosor y proporción
- ✅ Botones con mismo tamaño y padding

## 🚫 Errores Comunes a Evitar

1. ❌ Crear variaciones de botones sin usar las clases base
2. ❌ Usar diferentes alturas de inputs
3. ❌ Cambiar espaciados entre pantallas
4. ❌ Mezclar estilos de bordes o sombras
5. ❌ Crear estilos alternos sin razón
6. ❌ Inventar valores de espaciado nuevos

## ✅ Checklist de Consistencia

Antes de crear o modificar un componente, verificar:

- [ ] ¿Ya existe un componente similar?
- [ ] ¿Estoy usando las clases base?
- [ ] ¿Los tamaños coinciden con el sistema?
- [ ] ¿Los espaciados son consistentes?
- [ ] ¿La estructura es uniforme?
- [ ] ¿Los colores usan las variables CSS?
- [ ] ¿El diseño se siente parte del mismo sistema?

## 📝 Notas Finales

**Prioridad: Coherencia Visual**

Cada pantalla debe verse como parte del mismo sistema. No cambiar estilos, tamaños, espaciados ni estructura entre formularios, tablas o componentes. Si detectas inconsistencias, ajusta automáticamente y unifica el diseño.

