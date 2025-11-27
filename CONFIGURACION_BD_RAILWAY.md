# Configuración de Base de Datos en Railway

## Error: Access denied for user 'root'

Este error indica que las credenciales de la base de datos no están configuradas correctamente en Railway.

## Solución

### Opción 1: Usar MySQL Plugin de Railway (Recomendado)

1. En Railway, ve a tu proyecto
2. Haz clic en **"+ New"** → **"Database"** → **"MySQL"**
3. Railway creará automáticamente un servicio MySQL
4. Las variables de entorno se configurarán automáticamente con el formato `${{MySQL.*}}`

### Opción 2: Configurar Variables Manualmente

Si usas una base de datos externa o el plugin no funciona, configura estas variables manualmente:

1. Ve a **Settings** → **Variables** en Railway
2. Agrega las siguientes variables:

```env
DB_HOST=tu-host-mysql
DB_PORT=3306
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=GestionEquipo
```

**Importante**: 
- NO uses `root` como usuario a menos que sea específicamente necesario
- Si usas el plugin MySQL de Railway, el usuario NO será `root`
- Railway genera credenciales automáticamente

### Opción 3: Verificar Variables del Plugin MySQL

Si ya tienes el plugin MySQL instalado, verifica que las variables estén configuradas así:

```env
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```

**Nota**: Railway reemplaza automáticamente `${{MySQL.*}}` con los valores reales.

## Verificar Configuración

1. Ve a **Settings** → **Variables** en Railway
2. Verifica que todas las variables de base de datos estén configuradas
3. Si usas el plugin, deberías ver variables como:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`

## Inicializar Base de Datos

Una vez configuradas las credenciales:

1. Obtén las credenciales de MySQL desde Railway
2. Conecta usando un cliente MySQL (MySQL Workbench, DBeaver, etc.)
3. Ejecuta el script SQL: `BD/GestionEquipo.sql`

## Troubleshooting

### Error: "Access denied for user 'root'"

- Verifica que `DB_USER` no sea `root` (a menos que sea necesario)
- Si usas el plugin MySQL de Railway, usa `${{MySQL.MYSQLUSER}}`
- Verifica que `DB_PASSWORD` sea correcta

### Error: "Can't connect to MySQL server"

- Verifica que `DB_HOST` sea correcto
- Verifica que `DB_PORT` sea `3306` (o el puerto correcto)
- Asegúrate de que el servicio MySQL esté corriendo en Railway

### Las variables ${{MySQL.*}} no funcionan

- Asegúrate de que el plugin MySQL esté instalado en el mismo proyecto
- Verifica que el servicio MySQL esté desplegado
- Railway solo reemplaza estas variables en el mismo proyecto

