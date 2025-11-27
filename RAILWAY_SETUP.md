# Configuración de Railway - Solución de Problemas

## Error: npm error enoent Could not read package.json

Este error ocurre cuando Railway intenta usar npm en lugar del Dockerfile.

## Solución

### Paso 1: Configurar Railway para usar Dockerfile

En la interfaz de Railway:

1. Ve a **Settings** → **Build**
2. En **Build Command**, deja el campo **VACÍO** o elimina cualquier comando npm
3. En **Dockerfile Path**, asegúrate de que diga: `Dockerfile`
4. En **Root Directory**, deja el campo **VACÍO** (raíz del proyecto)

### Paso 2: Configurar Start Command

1. Ve a **Settings** → **Deploy**
2. En **Custom Start Command**, pon: `/start.sh`
   - O déjalo **VACÍO** (el Dockerfile ya tiene el CMD configurado)

### Paso 3: Verificar que no haya package.json en la raíz

Railway detecta automáticamente `package.json` y puede intentar hacer un build con npm. Asegúrate de que:
- ✅ NO hay `package.json` en la raíz del proyecto
- ✅ Solo hay `package.json` en `backend/` y `frontend/`

### Paso 4: Forzar uso de Dockerfile

Si Railway sigue intentando usar npm:

1. En **Settings** → **Build**
2. Cambia el **Builder** a **Dockerfile**
3. Asegúrate de que **Dockerfile Path** sea: `Dockerfile`

## Configuración Correcta

```
Build Command: (vacío)
Dockerfile Path: Dockerfile
Root Directory: (vacío)
Start Command: /start.sh (o vacío)
```

## Verificación

Después de configurar, Railway debería:
1. Detectar el `Dockerfile` en la raíz
2. Construir la imagen Docker
3. Ejecutar `/start.sh` que inicia backend y nginx

## Si el problema persiste

1. Elimina el servicio en Railway
2. Crea un nuevo servicio
3. Conecta el repositorio
4. Railway debería detectar automáticamente el Dockerfile

