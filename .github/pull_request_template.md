## Qué cambia

<!-- Resumen corto y issue de Linear (MDL-xxx). -->

## Checklist antes de mergear a `develop` (producción despliega desde `develop`)

- [ ] `backend-unit` y `backend-mysql` en verde.
- [ ] **Esquema de BD:** si el código lee o escribe columnas/tablas nuevas, el PR incluye la migración en `backend/migrations/` (idempotente y aditiva). Si no hay cambio de esquema, escribir «sin migración».
- [ ] Si requiere un paso administrativo manual (p. ej. procedimientos almacenados), está descrito abajo y confirmado con quien administra Railway **antes** del merge.
- [ ] PR con label **Security**: revisión de SECURITY-SGI.
- [ ] Sin secretos ni datos personales en el diff, los logs ni la descripción.

## Migraciones / pasos de despliegue

<!-- «Sin migración», o el nombre del archivo y su efecto esperado en producción. -->
