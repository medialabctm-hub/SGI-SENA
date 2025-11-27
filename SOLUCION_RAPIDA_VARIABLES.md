# 🔧 Solución Rápida: Error 502 y Access Denied

## Problema

- **Error 502 Bad Gateway**: El backend no puede conectarse a la base de datos
- **Error "Access denied for user ''"**: Las variables `DB_*` no están configuradas

## Solución en 3 Pasos

### Paso 1: Ir al Servicio MySQL → Variables

1. En Railway, haz clic en el servicio **MySQL** (el de la izquierda)
2. Ve a la pestaña **Variables**
3. Anota estos valores (haz clic en el ojo 👁️ para verlos):
   - `MYSQLHOST` → Copia el valor
   - `MYSQLPORT` → Copia el valor
   - `MYSQLUSER` → Copia el valor (NO uses `root`)
   - `MYSQLPASSWORD` → Copia el valor
   - `MYSQLDATABASE` → Copia el valor

### Paso 2: Ir al Servicio SGE-SENA → Variables

1. En Railway, haz clic en el servicio **SGE-SENA** (tu aplicación principal)
2. Ve a la pestaña **Variables**
3. Agrega o edita estas variables:

```
DB_HOST = <pega el valor de MYSQLHOST>
DB_PORT = <pega el valor de MYSQLPORT>
DB_USER = <pega el valor de MYSQLUSER>
DB_PASSWORD = <pega el valor de MYSQLPASSWORD>
DB_NAME = <pega el valor de MYSQLDATABASE>
```

**Ejemplo:**
```
DB_HOST = containers-us-west-xxx.railway.app
DB_PORT = 3306
DB_USER = railway
DB_PASSWORD = abc123xyz
DB_NAME = railway
```

### Paso 3: Verificar Otras Variables Requeridas

Asegúrate de tener también estas variables en **SGE-SENA**:

```
JWT_SECRET = <tu-secreto-jwt>
COOKIE_SECRET = <tu-secreto-cookie>
EMAIL_USER = <tu-email@gmail.com>
EMAIL_PASSWORD = <tu-contraseña-de-aplicación>
CORS_ORIGIN = https://sgi-sena.up.railway.app
FRONTEND_URL = https://sgi-sena.up.railway.app
```

## Después de Configurar

1. Railway redesplegará automáticamente
2. Espera 1-2 minutos
3. Verifica los logs:
   - Deberías ver: `[INFO] Servidor corriendo en puerto 3000`
   - NO deberías ver: "Access denied"
4. Prueba el login nuevamente

## Alternativa: Usar Referencias (Más Avanzado)

Si prefieres que Railway actualice las variables automáticamente cuando cambien en MySQL, usa referencias:

En **SGE-SENA** → **Variables**, usa:

```
DB_HOST = ${{MySQL.MYSQLHOST}}
DB_PORT = ${{MySQL.MYSQLPORT}}
DB_USER = ${{MySQL.MYSQLUSER}}
DB_PASSWORD = ${{MySQL.MYSQLPASSWORD}}
DB_NAME = ${{MySQL.MYSQLDATABASE}}
```

**Nota:** Asegúrate de que el servicio MySQL se llame exactamente **"MySQL"** (con mayúscula M).

