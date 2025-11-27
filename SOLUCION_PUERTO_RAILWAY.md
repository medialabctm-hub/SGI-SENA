# Solución: Problema de Puerto en Railway

## Problema Actual

La página muestra JSON de error del backend en lugar del frontend. Esto significa que Railway está exponiendo el puerto **3000** (backend) en lugar del puerto **80** (nginx).

## Solución

### Paso 1: Verificar Puerto en Railway

1. Ve a tu servicio **SGE-SENA** en Railway
2. Ve a **Settings** → **Networking**
3. Verifica el puerto público:
   - Debe ser **80** (nginx)
   - NO debe ser **3000** (backend)

### Paso 2: Cambiar Puerto si es Necesario

Si el puerto está en 3000:

1. En **Settings** → **Networking**
2. Busca la sección de **Public Networking**
3. Verifica que el puerto sea **80**
4. Si no puedes cambiarlo directamente, Railway debería detectar automáticamente el `EXPOSE 80` en el Dockerfile

### Paso 3: Verificar Variables de Entorno

Asegúrate de que NO tengas una variable `PORT=3000` que esté forzando el puerto:

1. Ve a **Settings** → **Variables**
2. Busca `PORT`
3. Si existe y es `3000`, cámbialo a `80` o elimínalo (el Dockerfile ya tiene `EXPOSE 80`)

### Paso 4: Reiniciar Servicio

1. Ve a **Deployments**
2. Haz clic en **"Redeploy"** o espera a que Railway redesplegue automáticamente

## Verificación

Después de corregir el puerto:

1. Accede a `https://sgi-sena.up.railway.app/`
   - Debe mostrar la aplicación React (página de login)
   - NO debe mostrar JSON de error

2. Accede a `https://sgi-sena.up.railway.app/api/health`
   - Debe devolver: `{"status":"ok",...}`

3. Accede a `https://sgi-sena.up.railway.app:3000`
   - NO debe ser accesible (puerto interno)

## Arquitectura Correcta

```
Internet → Railway (Puerto 80) → Nginx (Puerto 80) → Frontend (HTML/JS)
                                    ↓
                              Backend (Puerto 3000, interno)
```

## Si el Problema Persiste

Si después de verificar el puerto sigue mostrando JSON:

1. Verifica los logs de Railway para ver si nginx está iniciando
2. Verifica que los archivos del frontend se estén copiando (deberías ver en logs: "✓ Archivos del frontend encontrados")
3. Revisa si hay errores de nginx en los logs

