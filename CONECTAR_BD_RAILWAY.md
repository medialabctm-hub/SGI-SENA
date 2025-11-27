# Cómo Conectarse a la Base de Datos MySQL de Railway

## Opción 1: Usar MySQL Workbench (Recomendado - GUI)

### Paso 1: Descargar MySQL Workbench

1. Descarga MySQL Workbench desde: https://dev.mysql.com/downloads/workbench/
2. Instálalo en tu computadora

### Paso 2: Obtener Credenciales de Railway

Ve al servicio **SGE-SENA** → **Variables** y copia estos valores:

```
Host: shuttle.proxy.rlwy.net (o el valor de DB_HOST)
Port: 48922 (o el valor de DB_PORT)
User: root (o el valor de DB_USER)
Password: TkAWILndokrxg0JDbFjmObWNBjFoxXPj (o el valor de DB_PASSWORD)
Database: railway (o el valor de DB_NAME)
```

### Paso 3: Crear Nueva Conexión en MySQL Workbench

1. Abre MySQL Workbench
2. Haz clic en el botón **"+"** junto a "MySQL Connections"
3. Configura la conexión:

```
Connection Name: Railway MySQL
Hostname: shuttle.proxy.rlwy.net
Port: 48922
Username: root
Password: [haz clic en "Store in Keychain" y pega la contraseña]
Default Schema: railway
```

4. Haz clic en **"Test Connection"** para verificar
5. Si funciona, haz clic en **"OK"**

### Paso 4: Conectarse y Ver Tablas

1. Haz doble clic en la conexión "Railway MySQL"
2. En el panel izquierdo, expande **"Schemas"** → **"railway"** → **"Tables"**
3. Verás todas las tablas de tu base de datos
4. Haz clic derecho en una tabla → **"Select Rows - Limit 1000"** para ver los datos

---

## Opción 2: Usar DBeaver (Alternativa - GUI Gratis)

### Paso 1: Descargar DBeaver

1. Descarga DBeaver Community desde: https://dbeaver.io/download/
2. Instálalo en tu computadora

### Paso 2: Crear Nueva Conexión

1. Abre DBeaver
2. Haz clic en **"New Database Connection"** (icono de enchufe)
3. Selecciona **"MySQL"** → **"Next"**
4. Configura la conexión:

```
Server Host: shuttle.proxy.rlwy.net
Port: 48922
Database: railway
Username: root
Password: TkAWILndokrxg0JDbFjmObWNBjFoxXPj
```

5. Haz clic en **"Test Connection"**
6. Si te pide descargar el driver MySQL, haz clic en **"Download"**
7. Haz clic en **"Finish"**

### Paso 3: Ver Tablas

1. Expande la conexión → **"Databases"** → **"railway"** → **"Tables"**
2. Haz doble clic en cualquier tabla para ver los datos

---

## Opción 3: Usar Línea de Comandos (CLI)

### Paso 1: Instalar MySQL Client

**Windows:**
```powershell
# Descarga MySQL desde: https://dev.mysql.com/downloads/installer/
# O usa Chocolatey:
choco install mysql
```

**Mac:**
```bash
brew install mysql-client
```

**Linux:**
```bash
sudo apt-get install mysql-client
```

### Paso 2: Conectarse

```bash
mysql -h shuttle.proxy.rlwy.net -P 48922 -u root -p railway
```

Cuando te pida la contraseña, pega: `TkAWILndokrxg0JDbFjmObWNBjFoxXPj`

### Paso 3: Ver Tablas y Datos

```sql
-- Ver todas las tablas
SHOW TABLES;

-- Ver estructura de una tabla
DESCRIBE nombre_tabla;

-- Ver datos de una tabla
SELECT * FROM nombre_tabla LIMIT 100;

-- Contar registros
SELECT COUNT(*) FROM nombre_tabla;
```

---

## Opción 4: Usar VS Code con Extensión MySQL

### Paso 1: Instalar Extensión

1. Abre VS Code
2. Ve a **Extensions** (Ctrl+Shift+X)
3. Busca e instala **"MySQL"** por Jun Han

### Paso 2: Conectarse

1. Presiona **Ctrl+Shift+P**
2. Escribe **"MySQL: Connect"**
3. Configura la conexión:

```
Host: shuttle.proxy.rlwy.net
Port: 48922
User: root
Password: TkAWILndokrxg0JDbFjmObWNBjFoxXPj
Database: railway
```

4. Expande la conexión en el panel izquierdo para ver las tablas

---

## Opción 5: Crear Endpoint de Administración (Solo para Desarrollo)

Si quieres ver las tablas desde la aplicación web, puedes crear un endpoint temporal:

**⚠️ ADVERTENCIA:** Esto expone información sensible. Solo úsalo en desarrollo y elimínalo en producción.

```javascript
// backend/src/routes/admin.js (crear este archivo)
import express from 'express';
import { pool } from '../config/dbconfig.js';

const router = express.Router();

// Solo para desarrollo - ELIMINAR EN PRODUCCIÓN
router.get('/tables', async (req, res) => {
  try {
    const [tables] = await pool.execute('SHOW TABLES');
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/table/:name', async (req, res) => {
  try {
    const tableName = req.params.name;
    const [rows] = await pool.execute(`SELECT * FROM ${tableName} LIMIT 100`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

Luego agregar en `server.js`:
```javascript
import adminRouter from './routes/admin.js';
app.use('/admin', adminRouter);
```

**Acceso:** `https://sgi-sena.up.railway.app/admin/tables`

---

## Recomendación

**Usa MySQL Workbench o DBeaver** (Opción 1 o 2). Son las más fáciles de usar y te dan una interfaz visual completa para explorar tu base de datos.

## Seguridad

- **Nunca compartas** las credenciales de la base de datos
- **No subas** las credenciales a GitHub
- **Usa conexiones SSL** cuando sea posible (Railway ya las tiene habilitadas)

