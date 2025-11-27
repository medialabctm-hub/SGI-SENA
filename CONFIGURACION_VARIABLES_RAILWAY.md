# Configuración de Variables de Entorno en Railway

## Estructura de Variables

Tienes **DOS servicios** en Railway:
1. **SGE-SENA** (tu aplicación principal)
2. **MySQL** (base de datos)

Cada servicio tiene sus propias variables. Necesitas **conectar** las variables del MySQL al servicio SGE-SENA.

## Opción 1: Usar Referencias de Variables (Recomendado)

En el servicio **SGE-SENA**, configura las variables así:

```env
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```

**Cómo hacerlo:**

1. Ve al servicio **SGE-SENA** → **Variables**
2. Para cada variable `DB_*`, haz clic en **"+ New Variable"** o edita la existente
3. En lugar de poner un valor directo, usa la sintaxis `${{MySQL.NOMBRE_VARIABLE}}`
4. Railway reemplazará automáticamente estos valores con los del servicio MySQL

**Ejemplo:**
- Variable: `DB_HOST`
- Valor: `${{MySQL.MYSQLHOST}}` ← Railway lo reemplazará automáticamente

## Opción 2: Copiar Valores Directamente

Si las referencias no funcionan, copia los valores manualmente:

1. Ve al servicio **MySQL** → **Variables**
2. Copia los valores de:
   - `MYSQLHOST` → úsalo en `DB_HOST`
   - `MYSQLPORT` → úsalo en `DB_PORT`
   - `MYSQLUSER` → úsalo en `DB_USER`
   - `MYSQLPASSWORD` → úsalo en `DB_PASSWORD`
   - `MYSQLDATABASE` → úsalo en `DB_NAME`

3. Ve al servicio **SGE-SENA** → **Variables**
4. Pega estos valores directamente en las variables `DB_*`

## Mapeo de Variables

| Variable en MySQL | Variable en SGE-SENA | Ejemplo de Valor |
|-------------------|---------------------|------------------|
| `MYSQLHOST` | `DB_HOST` | `containers-us-west-xxx.railway.app` |
| `MYSQLPORT` | `DB_PORT` | `3306` |
| `MYSQLUSER` | `DB_USER` | `railway` (NO es `root`) |
| `MYSQLPASSWORD` | `DB_PASSWORD` | `*******` (contraseña generada) |
| `MYSQLDATABASE` | `DB_NAME` | `railway` o el nombre que configuraste |

## Variables que NO debes copiar

**NO uses estas variables del MySQL:**
- `MYSQL_ROOT_PASSWORD` ← Esta es solo para administración
- `MYSQL_DATABASE` ← Usa `MYSQLDATABASE` en su lugar
- `MYSQL_URL` ← Esta es una URL completa, no la necesitas

## Verificación

Después de configurar, verifica que:

1. En el servicio **SGE-SENA**, las variables `DB_*` tienen valores (no están vacías)
2. `DB_USER` NO es `root` (debería ser algo como `railway` o similar)
3. `DB_HOST` es una URL de Railway (no `localhost`)

## Troubleshooting

### Las variables ${{MySQL.*}} no funcionan

1. Verifica que el servicio MySQL se llame exactamente **"MySQL"** (con mayúscula M)
2. Si se llama diferente, ajusta la referencia:
   - Si se llama `mysql` (minúscula): `${{mysql.MYSQLHOST}}`
   - Si se llama `database`: `${{database.MYSQLHOST}}`

### Sigue intentando conectarse como 'root'

- Verifica que `DB_USER` tenga el valor correcto (debería ser `${{MySQL.MYSQLUSER}}` o el valor copiado)
- NO uses `root` como valor manual

### Error: "Access denied"

- Verifica que `DB_PASSWORD` tenga el valor correcto
- Asegúrate de que las variables estén configuradas en el servicio **SGE-SENA**, no solo en MySQL

