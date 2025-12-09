# SGE-SENA
Repositorio en el cual se aloja el software SGISENA

## Descripción
SGE-SENA es un software de gestion de equipos tecnologicos y mobiliarios que pertenecen a las instalaciones del sena, para facilitar el inventariado de este mismo


## Estructura del proyecto
```
backend/
├── src/
│   ├── config/     # Configuraciones de la aplicación
│   ├── controllers/# Controladores de la lógica 
│   ├── models/     # Modelos de datos
│   └── routes/     # Rutas de la API
│       ├── authRoutes.js    # Rutas de autenticación
├── server.js        # Punto de entrada de la aplicación
└── package.json    # Dependencias y scripts
```
## Requisitos Previos
Node.js (versión recomendada: 18.x o superior)
MySQL (versión recomendada: 8.x o superior)

## Instalación
1. Clonar el repositorio:
   
```bash
git clone [URL_DEL_REPOSITORIO]
cd SGISENA
```

2. Instalar dependencias:
   
```bash
cd backend
npm install
```
3. Configurar variables de entorno: Crear un archivo `.env` en la raíz del proyecto backend con las siguientes variables:

```
PORT=3000
DB_HOST=localhost
DB_USER=tu_cliente
DB_PASSWORD=tu_contraseña
DB_NAME=GestionEquipo
JWT_SECRET=tu_secreto_jwt
SESSION_SECRET=secret_key
```

## Ejecución del Proyecto
Para iniciar el servidor en modo desarrollo:


```bash
npm run dev
```
El servidor se ejecutará en `http://localhost:3000`

## Tecnologías Utilizadas

## Backend

- Node.js y Express.js como framework principal
- MySQL como base de datos
- JWT para autenticación
- Express Session para manejo de sesiones
- CORS configurado para desarrollo local (puerto 5173)
- Cookie Parser para manejo de cookies
- Morgan para logging
- Validator para validación de datos

## Endpoints de la API

### Autenticación

- `POST /api/auth/login` - Inicio de sesión
- `POST /api/auth/register` - Registro de clientes
- `POST /api/auth/logout` - Cierre de sesión

## Scripts Disponibles

- `npm run dev`: Inicia el servidor en modo desarrollo con nodemon
- `npm test`: Ejecuta las pruebas (pendiente de implementar)

## Configuración de CORS

El backend está configurado para aceptar peticiones desde `http://localhost:5173` (frontend de desarrollo). Para producción, actualizar la configuración CORS en `server.js`.

## Despliegue en Railway

Este proyecto está configurado para desplegarse en Railway. Para más información sobre:

- **Configuración de volúmenes persistentes**: Ver [RAILWAY_VOLUMES.md](./RAILWAY_VOLUMES.md) para configurar volúmenes que persistan las imágenes entre deploys.
- **Configuración de variables de entorno**: Consulta `backend/env.example` para ver todas las variables necesarias.

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia ISC.
