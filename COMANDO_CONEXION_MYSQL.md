# Comando Rápido para Conectarse a MySQL de Railway

## Conectar desde Línea de Comandos

```bash
mysql -h shuttle.proxy.rlwy.net -P 48922 -u root -p railway
```

Cuando te pida la contraseña, pega:
```
TkAWILndokrxg0JDbFjmObWNBjFoxXPj
```

## Comandos Útiles Una Vez Conectado

```sql
-- Ver todas las tablas
SHOW TABLES;

-- Ver estructura de una tabla específica
DESCRIBE nombre_tabla;

-- Ver todos los datos de una tabla (primeros 100 registros)
SELECT * FROM nombre_tabla LIMIT 100;

-- Contar cuántos registros hay en una tabla
SELECT COUNT(*) FROM nombre_tabla;

-- Ver las últimas inserciones
SELECT * FROM nombre_tabla ORDER BY id DESC LIMIT 10;

-- Ver columnas de una tabla
SHOW COLUMNS FROM nombre_tabla;
```

## Ejemplo Completo

```bash
# 1. Conectarse
mysql -h shuttle.proxy.rlwy.net -P 48922 -u root -p railway

# 2. Una vez dentro, ejecutar:
SHOW TABLES;

# 3. Ver datos de una tabla (ejemplo: usuarios)
SELECT * FROM usuarios LIMIT 10;
```

## Si Tienes Problemas de Conexión

1. Verifica que el puerto 48922 no esté bloqueado por tu firewall
2. Asegúrate de que las credenciales sean correctas
3. Railway puede requerir conexiones SSL, prueba agregando `--ssl-mode=REQUIRED`

