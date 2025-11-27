# Despliegue en la Misma Instancia - Railway

Este documento explica cómo desplegar el backend y frontend en la misma instancia de Railway.

## Configuración

Se ha creado un `Dockerfile` principal en la raíz del proyecto que:
1. Construye el frontend (React/Vite)
2. Construye el backend (Node.js/Express)
3. Ejecuta ambos servicios en el mismo contenedor:
   - Backend en el puerto 3000 (interno)
   - Nginx en el puerto 80 (público) que sirve el frontend y hace proxy al backend

## Arquitectura

```
┌─────────────────────────────────────┐
│     Contenedor Docker               │
│                                     │
│  ┌──────────────┐                  │
│  │   Nginx      │  Puerto 80        │
│  │   (Frontend) │  (Público)        │
│  └──────┬───────┘                    │
│         │ Proxy /api →               │
│  ┌──────▼───────┐                   │
│  │   Backend    │  Puerto 3000       │
│  │   (Node.js)  │  (Interno)        │
│  └──────────────┘                   │
└─────────────────────────────────────┘
```

## Variables de Entorno

Configura estas variables en Railway:

```env
NODE_ENV=production
PORT=3000
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
JWT_SECRET=<genera-un-secreto-seguro>
COOKIE_SECRET=<genera-otro-secreto-seguro>
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=tu_contraseña_de_aplicacion
CORS_ORIGIN=https://sgi-sena.up.railway.app
FRONTEND_URL=https://sgi-sena.up.railway.app
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=gse-app
JWT_AUDIENCE=gse-users
LOG_LEVEL=info
```

**Importante**: 
- `CORS_ORIGIN` y `FRONTEND_URL` deben apuntar al mismo dominio de Railway (`https://sgi-sena.up.railway.app`)
- No necesitas configurar `API_URL` porque el backend corre en el mismo contenedor

## Configuración en Railway

1. **Source**: Asegúrate de que el Root Directory esté vacío (o sea la raíz del proyecto)
2. **Dockerfile**: Railway usará automáticamente el `Dockerfile` en la raíz
3. **Start Command**: Se ejecuta automáticamente `/start.sh` que inicia ambos servicios

## Flujo de Peticiones

1. Usuario accede a `https://sgi-sena.up.railway.app`
2. Nginx sirve los archivos estáticos del frontend (React)
3. Cuando el frontend hace peticiones a `/api/*`, nginx hace proxy a `http://localhost:3000`
4. El backend procesa las peticiones y responde
5. Nginx devuelve la respuesta al frontend

## Ventajas

- ✅ Un solo servicio en Railway (más económico)
- ✅ Configuración más simple
- ✅ No hay problemas de CORS entre servicios
- ✅ Menor latencia entre frontend y backend

## Desventajas

- ⚠️ Menos escalable (no puedes escalar frontend y backend independientemente)
- ⚠️ Si un servicio falla, ambos se detienen

## Troubleshooting

### El backend no inicia

- Verifica los logs en Railway
- Asegúrate de que todas las variables de entorno estén configuradas
- Verifica que la base de datos esté accesible

### Nginx no puede conectarse al backend

- Verifica que el backend esté escuchando en `localhost:3000`
- Revisa los logs del script `start.sh`

### Errores de CORS

- Asegúrate de que `CORS_ORIGIN` apunte exactamente al dominio de Railway
- Verifica que no haya espacios extra en la variable de entorno

