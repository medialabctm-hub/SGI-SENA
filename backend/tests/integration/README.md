# Integración MySQL de MDL-71

La prueba usa una base efímera y fixtures no personales:

```powershell
npm run test:mysql
```

El runner intenta levantar `mysql:8.0` con Docker y elimina el contenedor al terminar. También acepta una instancia efímera ya iniciada mediante `MYSQL_TEST_HOST`, `MYSQL_TEST_PORT`, `MYSQL_TEST_USER`, `MYSQL_TEST_PASSWORD` y `MYSQL_TEST_DATABASE`; en CI se puede usar ese modo para conectar el servicio MySQL del job.
