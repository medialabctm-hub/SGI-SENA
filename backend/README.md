# Backend SGE-SENA

Backend del Sistema de Gestión de Equipos del SENA.

## Estructura del Proyecto

```
backend/
├── src/
│   ├── config/          # Configuraciones (DB, permisos, etc.)
│   ├── controller/      # Controladores (solo orquestación)
│   ├── services/        # Lógica de negocio
│   ├── routes/          # Definición de rutas REST
│   ├── middleware/      # Middlewares personalizados
│   ├── validators/      # Validadores con Zod
│   └── utils/           # Utilidades (errores, logger)
├── server.js            # Punto de entrada
└── package.json
```

## Instalación

```bash
npm install
```

## Configuración

1. Copia `.env.example` a `.env`
2. Configura las variables de entorno necesarias

```bash
cp .env.example .env
```

## Scripts Disponibles

```bash
npm run dev          # Desarrollo con nodemon
npm run start        # Producción
npm run lint         # Verificar código con ESLint
npm run lint:fix     # Corregir código automáticamente
npm run format       # Formatear código con Prettier
npm run format:check # Verificar formato
```

## Estándares de Código

Ver [CODING_STANDARDS.md](../CODING_STANDARDS.md) para la guía completa de estándares.

### Resumen

- ✅ Usa `const` y `let`, nunca `var`
- ✅ Sangría de 2 espacios
- ✅ `camelCase` para variables/funciones
- ✅ `PascalCase` para clases
- ✅ Funciones pequeñas y específicas
- ✅ `async/await` para asincronía
- ✅ Manejo de errores con clases personalizadas
- ✅ Logging con el sistema de logger
- ✅ Validación con Zod

## Arquitectura

### Flujo de Request

```
Request → Middleware → Route → Validator → Controller → Service → Database
                                                              ↓
Response ← Error Handler ← Controller ← Service ← Database
```

### Separación de Responsabilidades

- **Controllers**: Solo orquestación HTTP, delegan a servicios
- **Services**: Contienen toda la lógica de negocio
- **Validators**: Validación de datos con Zod
- **Middleware**: Autenticación, autorización, logging, etc.
- **Utils**: Utilidades compartidas (errores, logger)

## Seguridad

- ✅ Helmet para headers de seguridad
- ✅ CORS configurado
- ✅ XSS protection
- ✅ HPP protection
- ✅ Rate limiting en endpoints sensibles
- ✅ Validación y sanitización de inputs

## Logging

El proyecto usa un sistema de logging personalizado con niveles:

- `logger.error()` - Errores críticos
- `logger.warn()` - Advertencias
- `logger.info()` - Información general
- `logger.debug()` - Información de depuración

Configura el nivel con la variable de entorno `LOG_LEVEL`.

## Manejo de Errores

El proyecto usa clases de error personalizadas:

- `AppError` - Error base
- `ValidationError` - Errores de validación (400)
- `AuthenticationError` - Errores de autenticación (401)
- `AuthorizationError` - Errores de autorización (403)
- `NotFoundError` - Recurso no encontrado (404)
- `ConflictError` - Conflictos (409)
- `DatabaseError` - Errores de base de datos (500)

## API Endpoints

Ver documentación de la API para más detalles sobre los endpoints disponibles.

## Desarrollo

1. Instala las dependencias: `npm install`
2. Configura `.env`
3. Inicia el servidor: `npm run dev`
4. El servidor estará disponible en `http://localhost:3000`

## Testing

Los tests están pendientes de implementar. Se recomienda usar Jest o Vitest.

