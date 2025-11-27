# Solución Rápida: Error de Base de Datos en Railway

## Problema Actual

```
Error: Access denied for user 'root'@'100.64.0.4' (using password: YES)
```

Esto significa que las variables de entorno de la base de datos no están configuradas correctamente.

## Solución Paso a Paso

### Paso 1: Verificar si tienes servicio MySQL en Railway

1. Ve a tu proyecto en Railway
2. Verifica si hay un servicio MySQL (debería aparecer en la lista de servicios)
3. Si NO hay servicio MySQL, ve al **Paso 2**
4. Si SÍ hay servicio MySQL, ve al **Paso 3**

### Paso 2: Crear Servicio MySQL

1. En Railway, haz clic en **"+ New"**
2. Selecciona **"Database"** → **"MySQL"**
3. Railway creará automáticamente un servicio MySQL
4. Espera a que se despliegue (puede tomar unos minutos)

### Paso 3: Configurar Variables de Entorno

1. Ve a **Settings** → **Variables** en tu servicio principal (no en el MySQL)
2. Busca o agrega estas variables:

```env
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```

**Importante**: 
- Reemplaza `MySQL` con el nombre exacto de tu servicio MySQL si es diferente
- Railway reemplaza automáticamente `${{MySQL.*}}` con los valores reales
- NO uses valores literales como `root` o `localhost`

### Paso 4: Verificar Variables

1. Después de agregar las variables, Railway debería mostrar los valores reales
2. Verifica que `DB_USER` NO sea `root` (Railway genera un usuario diferente)
3. Verifica que `DB_HOST` sea una URL de Railway (ej: `containers-us-west-xxx.railway.app`)

### Paso 5: Reiniciar el Servicio

1. Ve a **Deployments**
2. Haz clic en **"Redeploy"** o espera a que Railway redespiegue automáticamente
3. Verifica los logs para confirmar que el error desapareció

## Si el Error Persiste

### Opción A: Verificar Nombre del Servicio MySQL

Si tu servicio MySQL se llama diferente (ej: `mysql`, `database`, etc.), ajusta las variables:

```env
DB_HOST=${{mysql.MYSQLHOST}}  # minúsculas si el servicio se llama "mysql"
DB_PORT=${{mysql.MYSQLPORT}}
DB_USER=${{mysql.MYSQLUSER}}
DB_PASSWORD=${{mysql.MYSQLPASSWORD}}
DB_NAME=${{mysql.MYSQLDATABASE}}
```

### Opción B: Usar Variables Manuales

Si las variables `${{MySQL.*}}` no funcionan:

1. Ve al servicio MySQL en Railway
2. Ve a **Settings** → **Variables**
3. Copia los valores de:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`
4. Pega estos valores directamente en las variables `DB_*` de tu servicio principal

## Inicializar Base de Datos

Una vez que el error desaparezca:

1. Obtén las credenciales de MySQL desde Railway
2. Conecta usando un cliente MySQL
3. Ejecuta el script: `BD/GestionEquipo.sql`

## Verificación

Después de configurar, deberías ver en los logs:
- ✅ `Servidor corriendo en puerto 3000`
- ✅ `Scheduler iniciado`
- ❌ NO deberías ver más errores de "Access denied"

