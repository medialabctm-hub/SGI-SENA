# Solución: Variables MYSQL* Faltantes

## Problema

El servicio **MySQL** está pidiendo estas variables:
- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`
- `MYSQL_URL`

Estas variables **deberían generarse automáticamente** cuando creas un servicio MySQL en Railway.

## Solución

### Opción 1: Verificar si las Variables Existen (Recomendado)

1. Ve al servicio **MySQL** → **Variables**
2. Busca si existen estas variables (pueden estar ocultas o al final de la lista):
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`
   - `MYSQL_URL`

3. Si **NO existen**, Railway puede estar teniendo problemas generándolas. Prueba:
   - Hacer clic en **"Configure Variables"** (botón morado que aparece en la pestaña Database)
   - O esperar unos minutos y recargar la página

### Opción 2: Crear las Variables Manualmente

Si las variables no se generan automáticamente, créalas manualmente en el servicio **MySQL**:

1. Ve al servicio **MySQL** → **Variables**
2. Haz clic en **"+ New Variable"**
3. Agrega estas variables con los valores que ya tienes en **SGE-SENA**:

```
MYSQLHOST = shuttle.proxy.rlwy.net
MYSQLPORT = 48922
MYSQLUSER = root
MYSQLPASSWORD = TkAWILndokrxg0JDbFjmObWNBjFoxXPj
MYSQLDATABASE = railway
```

**Nota:** El valor de `MYSQL_URL` se genera automáticamente, pero si lo necesitas, puedes crearlo así:
```
MYSQL_URL = mysql://root:TkAWILndokrxg0JDbFjmObWNBjFoxXPj@shuttle.proxy.rlwy.net:48922/railway
```

### Opción 3: Recrear el Servicio MySQL (Último Recurso)

Si nada funciona, puedes recrear el servicio MySQL:

1. **Crea un backup** de tus datos (si tienes datos importantes)
2. Elimina el servicio MySQL actual
3. Crea un nuevo servicio MySQL en Railway
4. Railway generará automáticamente todas las variables `MYSQL*`
5. Luego, actualiza las variables `DB_*` en **SGE-SENA** con los nuevos valores

## Verificación

Después de configurar las variables en MySQL:

1. Ve a **MySQL** → **Database**
2. Deberías ver un ✅ verde en "Required Variables"
3. El error "Access denied" debería desaparecer

## Importante

**NO elimines las variables `DB_*` del servicio SGE-SENA.** Esas son las que usa tu aplicación.

Las variables `MYSQL*` son para el servicio MySQL mismo y para que otros servicios puedan referenciarlas con `${{MySQL.MYSQLHOST}}`, etc.

## Estructura Correcta

```
Servicio MySQL:
  ├── MYSQLHOST (generada por Railway)
  ├── MYSQLPORT (generada por Railway)
  ├── MYSQLUSER (generada por Railway)
  ├── MYSQLPASSWORD (generada por Railway)
  ├── MYSQLDATABASE (generada por Railway)
  └── MYSQL_URL (generada por Railway)

Servicio SGE-SENA:
  ├── DB_HOST = shuttle.proxy.rlwy.net (o ${{MySQL.MYSQLHOST}})
  ├── DB_PORT = 48922 (o ${{MySQL.MYSQLPORT}})
  ├── DB_USER = root (o ${{MySQL.MYSQLUSER}})
  ├── DB_PASSWORD = TkAWILndokrxg0JDbFjmObWNBjFoxXPj (o ${{MySQL.MYSQLPASSWORD}})
  └── DB_NAME = railway (o ${{MySQL.MYSQLDATABASE}})
```

