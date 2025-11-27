# Verificación de Nginx y Frontend

## Problema: JSON de error en lugar del frontend

Si ves `{"success":false,"error":"Ruta no encontrada","path":"/"}` al acceder a `/`, significa que las peticiones están llegando directamente al backend en lugar de pasar por nginx.

## Soluciones

### 1. Verificar Puerto en Railway

**IMPORTANTE**: Railway debe exponer el puerto **80** (nginx), NO el puerto 3000 (backend).

1. Ve a **Settings** → **Networking** en Railway
2. Verifica que el puerto público sea **80**
3. Si está configurado en 3000, cámbialo a 80

### 2. Verificar que los archivos del frontend existan

El Dockerfile copia los archivos del frontend a `/usr/share/nginx/html`. Verifica en los logs de Railway que no haya errores al copiar estos archivos.

### 3. Verificar configuración de nginx

La configuración de nginx debe:
- Servir archivos estáticos desde `/usr/share/nginx/html`
- Hacer proxy de `/api` al backend
- Hacer proxy de `/uploads` al backend
- Servir `index.html` para todas las demás rutas (SPA)

### 4. Probar endpoints directamente

1. **Frontend**: `https://tu-dominio.railway.app/` → Debe mostrar la aplicación React
2. **API Health**: `https://tu-dominio.railway.app/api/health` → Debe devolver JSON con status
3. **Backend directo** (no debería funcionar): `https://tu-dominio.railway.app:3000` → No debería ser accesible

### 5. Verificar logs de nginx

En los logs de Railway, deberías ver:
- `🚀 Iniciando nginx...`
- `✓ Backend iniciado (PID: X)`
- Logs de nginx iniciando workers

Si ves errores de nginx, compártelos.

## Orden de location blocks en nginx

El orden es importante. Debe ser:
1. `location /api` (más específico primero)
2. `location /uploads` (más específico primero)
3. `location /` (catch-all al final)

## Si el problema persiste

1. Verifica que Railway esté usando el puerto 80
2. Verifica que los archivos del frontend se hayan construido correctamente
3. Revisa los logs completos de Railway para ver si hay errores

