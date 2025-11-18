# Guía de Estándares de Código - SGE-SENA

Esta guía establece los estándares de código que deben seguirse en el proyecto SGE-SENA.

## ⚠️ PRINCIPIOS FUNDAMENTALES

**IMPORTANTE**: Antes de continuar, lee [CORE_PRINCIPLES.md](../CORE_PRINCIPLES.md) que establece los **3 principios fundamentales** que deben aplicarse en TODAS las tareas de desarrollo:

1. **Separación de Responsabilidades en Capas**
2. **Inyección de Dependencias**
3. **Funciones Pequeñas y Específicas**

Estos principios son **OBLIGATORIOS** y tienen prioridad sobre cualquier otra regla.

## 1. Estructura del Proyecto

### Backend
```
backend/
├── src/
│   ├── config/          # Configuraciones
│   ├── controller/      # Controladores (solo orquestación)
│   ├── services/        # Lógica de negocio
│   ├── routes/          # Definición de rutas
│   ├── middleware/      # Middlewares personalizados
│   ├── validators/      # Validadores con Zod
│   ├── utils/           # Utilidades (errores, logger, etc.)
│   └── models/          # Modelos de datos (si se implementan)
├── server.js            # Punto de entrada
└── package.json
```

### Frontend
```
frontend/
├── src/
│   ├── components/      # Componentes reutilizables
│   ├── pages/           # Páginas/vistas
│   ├── utils/           # Utilidades
│   ├── styles/          # Estilos CSS
│   ├── App.jsx          # Componente principal
│   └── main.jsx         # Punto de entrada
└── package.json
```

## 2. Estilo de Código

### Variables y Funciones
- ✅ Usa `const` y `let`, **nunca** `var`
- ✅ Usa `camelCase` para variables y funciones
- ✅ Usa `PascalCase` para clases y componentes
- ✅ Usa `UPPER_CASE` para constantes globales

```javascript
// ✅ Correcto
const userName = 'Juan';
const getUserData = () => {};
class UserService {}
const MAX_RETRIES = 3;

// ❌ Incorrecto
var userName = 'Juan';
const get_user_data = () => {};
```

### Sangría
- ✅ Usa **2 espacios** para la sangría
- ✅ No uses tabs

### Imports
- ✅ Usa ES Modules (`import`/`export`)
- ✅ Agrupa imports: externos, internos, relativos

```javascript
// ✅ Correcto
import express from 'express';
import { config } from '../config/config.js';
import { authService } from '../services/authService.js';
```

## 3. Funciones

### Reglas Generales
- ✅ Funciones pequeñas y específicas (máximo ~50 líneas)
- ✅ Usa funciones flecha por defecto
- ✅ Un solo propósito por función

```javascript
// ✅ Correcto
const calculateTotal = (items) => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

// ❌ Incorrecto
const doEverything = () => {
  // 200 líneas de código...
};
```

## 4. Asincronía

- ✅ Usa `async/await` en lugar de `.then()/.catch()`
- ✅ Maneja errores con `try/catch`
- ✅ No uses `await` dentro de loops innecesariamente

```javascript
// ✅ Correcto
const fetchUser = async (id) => {
  try {
    const user = await db.getUser(id);
    return user;
  } catch (error) {
    logger.error('Error fetching user', { error });
    throw error;
  }
};

// ❌ Incorrecto
const fetchUser = (id) => {
  return db.getUser(id).then(user => user).catch(err => console.log(err));
};
```

## 5. Manejo de Errores

- ✅ Usa clases de error personalizadas (`AppError`, `ValidationError`, etc.)
- ✅ Propaga errores correctamente
- ✅ No captures errores sin manejarlos

```javascript
// ✅ Correcto
import { NotFoundError } from '../utils/errors.js';

const getUser = async (id) => {
  const user = await db.getUser(id);
  if (!user) {
    throw new NotFoundError('Usuario');
  }
  return user;
};
```

## 6. Logs

- ✅ Usa el sistema de logging (`logger.info`, `logger.error`, etc.)
- ✅ No uses `console.log` en producción
- ✅ Incluye contexto relevante en los logs

```javascript
// ✅ Correcto
logger.info('Usuario autenticado', { userId: user.id, cedula: user.cedula });
logger.error('Error al procesar pago', { error: err.message, orderId });

// ❌ Incorrecto
console.log('Usuario autenticado');
console.error(err);
```

## 7. Variables de Entorno

- ✅ No subas `.env` al repositorio
- ✅ Usa valores por defecto cuando sea apropiado
- ✅ Valida variables de entorno requeridas al inicio

```javascript
// ✅ Correcto
const port = process.env.PORT || 3000;
const dbHost = process.env.DB_HOST || 'localhost';
```

## 8. Rutas y Controladores

### Rutas
- ✅ Sigue buenas prácticas REST
- ✅ Usa nombres descriptivos
- ✅ Agrupa rutas relacionadas

```javascript
// ✅ Correcto
router.get('/users', authenticate, listUsers);
router.get('/users/:id', authenticate, getUserDetails);
router.post('/users', authenticate, validate(createUserSchema), createUser);
```

### Controladores
- ✅ Solo orquestación, sin lógica de negocio
- ✅ Delega a servicios
- ✅ Maneja respuestas HTTP

```javascript
// ✅ Correcto
export const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
};
```

## 9. Servicios

- ✅ Contienen la lógica de negocio
- ✅ No dependen de Express (req, res)
- ✅ Lanzan errores personalizados

```javascript
// ✅ Correcto
export const getUserById = async (userId) => {
  const user = await db.getUser(userId);
  if (!user) {
    throw new NotFoundError('Usuario');
  }
  return user;
};
```

## 10. Validación

- ✅ Usa Zod para validación
- ✅ Valida en las rutas antes de llegar al controlador
- ✅ Proporciona mensajes de error claros

```javascript
// ✅ Correcto
import { z } from 'zod';

export const createUserSchema = z.object({
  nombre: z.string().min(2).max(100),
  correo: z.string().email(),
});

router.post('/users', validate(createUserSchema), createUser);
```

## 11. Middlewares

- ✅ Usa `next()` correctamente
- ✅ No olvides pasar errores a `next(error)`
- ✅ Mantén middlewares pequeños y específicos

```javascript
// ✅ Correcto
export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
```

## 12. Seguridad

- ✅ Usa Helmet para headers de seguridad
- ✅ Sanitiza inputs (Zod, xss-clean)
- ✅ Valida y escapa datos de usuario
- ✅ No expongas información sensible en errores

## 13. Git

- ✅ Usa Conventional Commits
- ✅ Commits atómicos y descriptivos
- ✅ Mensajes claros

```
feat: agregar autenticación JWT
fix: corregir validación de email
refactor: reorganizar servicios de usuario
docs: actualizar README
```

## 14. Testing (Futuro)

- ✅ Usa Jest, Vitest o Supertest
- ✅ Escribe tests para lógica crítica
- ✅ Mantén buena cobertura

## 15. Organización General

```
Controllers → Services → Models → Utils
```

- **Controllers**: Orquestación HTTP
- **Services**: Lógica de negocio
- **Models**: Acceso a datos (si se implementan)
- **Utils**: Utilidades compartidas

## Scripts Disponibles

```bash
# Backend
npm run dev          # Desarrollo con nodemon
npm run start        # Producción
npm run lint         # Verificar código
npm run lint:fix     # Corregir código automáticamente
npm run format       # Formatear código
npm run format:check # Verificar formato
```

## Recursos

- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Zod Documentation](https://zod.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)

