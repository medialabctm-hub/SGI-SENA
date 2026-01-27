# SGE-SENA

Sistema de Gestión de Equipos Tecnológicos y Mobiliarios del SENA

## Descripción

SGE-SENA es un software de gestión de equipos tecnológicos y mobiliarios que pertenecen a las instalaciones del SENA, diseñado para facilitar el inventariado, mantenimiento y control de estos recursos.

## Estructura del Proyecto

```
SGE-SENA/
├── backend/                    # API REST con Node.js y Express
│   ├── src/
│   │   ├── config/            # Configuraciones (DB, permisos, etc.)
│   │   ├── controller/        # Controladores (orquestación)
│   │   ├── services/          # Lógica de negocio
│   │   ├── repositories/      # Acceso a datos
│   │   ├── routes/            # Definición de rutas
│   │   ├── middleware/        # Middlewares personalizados
│   │   ├── validators/        # Validadores con Zod
│   │   ├── utils/             # Utilidades (errores, logger, etc.)
│   │   ├── di/                # Inyección de dependencias
│   │   ├── factories/         # Factories para servicios
│   │   ├── builders/          # Builders para entidades
│   │   ├── facades/           # Facades para simplificar APIs
│   │   ├── strategies/       # Patrón Strategy
│   │   └── observers/         # Patrón Observer
│   ├── tests/                 # Tests unitarios e integración
│   ├── examples/              # Ejemplos de uso
│   ├── server.js              # Punto de entrada
│   └── package.json
├── frontend/                   # Aplicación React con Vite
│   ├── src/
│   │   ├── components/         # Componentes reutilizables
│   │   ├── pages/             # Páginas/vistas
│   │   ├── styles/            # Estilos CSS
│   │   ├── App.jsx            # Componente principal
│   │   └── main.jsx          # Punto de entrada
│   └── package.json
├── BD/                        # Scripts SQL de base de datos
│   └── SGI_SENA.sql
├── docker-compose.yml         # Configuración Docker
├── Dockerfile                 # Dockerfile para producción
└── README.md                  # Este archivo
```

## Requisitos Previos

- **Node.js**: Versión 18.x o superior
- **MySQL**: Versión 8.x o superior
- **npm**: Incluido con Node.js
- **Git**: Para clonar el repositorio

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/gabriel-durango/SGI-SENA.git
cd SGE-SENA
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 3. Instalar dependencias del frontend

```bash
cd ../frontend
npm install
```

### 4. Configurar variables de entorno

#### Backend

Copia el archivo de ejemplo y configura tus variables:

```bash
cd backend
cp env.example .env
```

Edita el archivo `.env` con tus configuraciones. Consulta `backend/env.example` para ver todas las variables disponibles y sus descripciones.

**Variables mínimas requeridas:**

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=GestionEquipo
JWT_SECRET=tu-secreto-jwt-seguro
COOKIE_SECRET=tu-secreto-cookie-seguro
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

#### Base de datos

Importa el esquema de la base de datos:

```bash
mysql -u tu_usuario -p GestionEquipo < BD/SGI_SENA.sql
```

## Ejecución del Proyecto

### Desarrollo

#### Backend

```bash
cd backend
npm run dev
```

El servidor se ejecutará en `http://localhost:3000`

#### Frontend

```bash
cd frontend
npm run dev
```

La aplicación se ejecutará en `http://localhost:5173`

### Producción

#### Con Docker

```bash
docker-compose up -d
```

#### Sin Docker

```bash
# Backend
cd backend
npm start

# Frontend (en otra terminal)
cd frontend
npm run build
npm run preview
```

## Tecnologías Utilizadas

### Backend

- **Node.js** y **Express.js** - Framework web
- **MySQL** - Base de datos relacional
- **JWT** - Autenticación basada en tokens
- **Zod** - Validación de esquemas
- **Socket.io** - Comunicación en tiempo real
- **Multer** - Manejo de archivos
- **Brevo** - Servicio de correo electrónico
- **Jest** - Framework de testing
- **ESLint** + **Prettier** - Linting y formateo

### Frontend

- **React 18** - Biblioteca de UI
- **Vite** - Build tool y dev server
- **React Router** - Enrutamiento
- **Socket.io Client** - Cliente WebSocket
- **jsPDF** - Generación de PDFs
- **XLSX** - Manejo de archivos Excel

## Scripts Disponibles

### Backend

```bash
npm start              # Inicia el servidor en producción
npm run dev            # Inicia el servidor en modo desarrollo con nodemon
npm test               # Ejecuta los tests
npm run test:watch     # Ejecuta los tests en modo watch
npm run test:coverage  # Ejecuta los tests con cobertura
npm run lint           # Verifica el código con ESLint
npm run lint:fix       # Corrige errores de ESLint automáticamente
npm run format         # Formatea el código con Prettier
npm run format:check   # Verifica el formato del código
```

### Frontend

```bash
npm run dev            # Inicia el servidor de desarrollo
npm run build          # Construye la aplicación para producción
npm run preview        # Previsualiza la build de producción
npm run lint           # Verifica el código con ESLint
npm run lint:fix       # Corrige errores de ESLint automáticamente
npm run format         # Formatea el código con Prettier
npm run format:check   # Verifica el formato del código
```

## Testing

El proyecto incluye tests unitarios e integración usando Jest. Los tests se encuentran en `backend/tests/`.

Para más información sobre cómo escribir y ejecutar tests, consulta [backend/tests/README.md](./backend/tests/README.md).

## Documentación Adicional

- **[CORE_PRINCIPLES.md](./CORE_PRINCIPLES.md)** - Principios fundamentales de arquitectura
- **[CODING_STANDARDS.md](./CODING_STANDARDS.md)** - Estándares de código del proyecto
- **[backend/ARCHITECTURE.md](./backend/ARCHITECTURE.md)** - Arquitectura del backend
- **[backend/RBAC_DOCUMENTATION.md](./backend/RBAC_DOCUMENTATION.md)** - Documentación del sistema de roles y permisos

## Configuración de CORS

El backend está configurado para aceptar peticiones desde el frontend. En desarrollo, el frontend corre en `http://localhost:5173`. Para producción, configura `CORS_ORIGIN` y `FRONTEND_URL` en el archivo `.env`.

## Despliegue en Railway

Este proyecto está configurado para desplegarse en Railway. Para más información:

- **Configuración de variables de entorno**: Consulta `backend/env.example` para ver todas las variables necesarias.
- **Archivos de configuración**: `railway.json` y `railway.toml` contienen la configuración de despliegue.

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

**Importante**: Antes de contribuir, lee [CORE_PRINCIPLES.md](./CORE_PRINCIPLES.md) y [CODING_STANDARDS.md](./CODING_STANDARDS.md) para entender los principios y estándares del proyecto.

## Licencia

Este proyecto está bajo la Licencia ISC.
