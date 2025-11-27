# Verificación de Variables de Base de Datos

## Error Actual

```
ERROR 1045 (28000): Access denied for user ''@'localhost' (using password: YES)
```

Este error indica que:
- El usuario de la base de datos está vacío (`''`)
- Las variables `DB_USER`, `DB_PASSWORD`, etc. no están configuradas correctamente

## Verificación en Railway

### Paso 1: Verificar Variables en el Servicio SGE-SENA

Ve a **Settings** → **Variables** en tu servicio **SGE-SENA** (no en MySQL) y verifica que tengas:

```env
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```

### Paso 2: Verificar que las Referencias Funcionen

1. En Railway, ve al servicio **SGE-SENA** → **Variables**
2. Verifica que las variables `DB_*` muestren valores (no `${{MySQL.*}}` literalmente)
3. Si ves `${{MySQL.*}}` como texto literal, significa que Railway no está reemplazando las variables

### Paso 3: Si las Referencias No Funcionan

Si `${{MySQL.*}}` no se reemplaza automáticamente:

1. Ve al servicio **MySQL** → **Variables**
2. Copia los valores reales de:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`

3. Ve al servicio **SGE-SENA** → **Variables**
4. Agrega o edita estas variables con los valores copiados:
   ```env
   DB_HOST=<valor de MYSQLHOST>
   DB_PORT=<valor de MYSQLPORT>
   DB_USER=<valor de MYSQLUSER>
   DB_PASSWORD=<valor de MYSQLPASSWORD>
   DB_NAME=<valor de MYSQLDATABASE>
   ```

### Paso 4: Verificar Nombre del Servicio MySQL

Si tu servicio MySQL se llama diferente a "MySQL" (ej: "mysql", "database"), ajusta las referencias:

```env
DB_HOST=${{mysql.MYSQLHOST}}  # minúsculas si el servicio se llama "mysql"
```

## Variables Requeridas

Asegúrate de tener TODAS estas variables en el servicio **SGE-SENA**:

```env
# Base de datos (CRÍTICAS)
DB_HOST=<host de MySQL>
DB_PORT=<puerto de MySQL>
DB_USER=<usuario de MySQL>
DB_PASSWORD=<contraseña de MySQL>
DB_NAME=<nombre de la base de datos>

# Seguridad
JWT_SECRET=<secreto>
COOKIE_SECRET=<secreto>

# Email
EMAIL_USER=<email>
EMAIL_PASSWORD=<contraseña>

# URLs
CORS_ORIGIN=https://sgi-sena.up.railway.app
FRONTEND_URL=https://sgi-sena.up.railway.app
```

## Verificación Post-Configuración

Después de configurar las variables:

1. Railway redesplegará automáticamente
2. En los logs deberías ver:
   - `[INFO] Servidor corriendo en puerto 3000`
   - NO deberías ver errores de "Access denied"

3. Prueba el login:
   - Debe funcionar sin error 502
   - Debe conectarse a la base de datos correctamente

## Troubleshooting

### Error: "Access denied for user ''"

- Verifica que `DB_USER` tenga un valor (no esté vacío)
- Verifica que `DB_PASSWORD` tenga un valor
- Verifica que las variables estén en el servicio **SGE-SENA**, no solo en MySQL

### Error 502 Bad Gateway

- Verifica que el backend esté corriendo (deberías ver logs del backend)
- Verifica que nginx pueda conectarse al backend en localhost:3000
- Revisa los logs completos para ver si hay errores de inicio

