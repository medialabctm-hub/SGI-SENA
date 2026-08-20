# Migración de cierre de autoservicio

Desde `backend`, ejecute:

```powershell
node scripts/migrate-autoservicio-cierre-clase.js
```

Use credenciales MySQL de administrador mediante las variables `DB_*` o
`MYSQL*` ya configuradas para el backend. No ejecute
`migrate-autoservicio-cierre-clase.sql` directamente con el cliente `mysql`:
es la definición que el runner mysql2 envía como un único `CREATE PROCEDURE`.

El runner consulta `ROUTINE_COMMENT`. Si ya encuentra
`AUTOSERVICIO_CIERRE_V1`, no modifica nada. Si debe reemplazar la rutina,
primero crea y elimina una rutina temporal de validación; después guarda el
resultado de `SHOW CREATE PROCEDURE`, crea la nueva versión y restaura ese
respaldo si la creación falla tras el `DROP`. MySQL no ofrece reemplazo atómico
de procedimientos, así que una desconexión del servidor durante ese intervalo
requiere intervención administrativa; el runner no declara esa ventana como
transaccional.
