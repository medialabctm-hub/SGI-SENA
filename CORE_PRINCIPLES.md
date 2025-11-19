# Principios Fundamentales del Proyecto

Estos son los **3 principios fundamentales** que deben aplicarse en **TODAS** las tareas de desarrollo de ahora en adelante.

## 1. Separación de Responsabilidades en Capas

**Principio**: Cada componente debe tener una responsabilidad única y clara, organizado en capas bien definidas.

### Estructura de Capas

```
Request → Controller → Service → Repository → Database
                ↓
            Validator
                ↓
            Middleware
```

### Reglas:

- ✅ **Controllers**: Solo orquestación HTTP (recibir request, extraer datos, llamar servicios, retornar respuesta)
- ✅ **Services**: Solo lógica de negocio (validaciones de negocio, transformaciones, reglas de dominio)
- ✅ **Repositories**: Solo acceso a datos (queries SQL, operaciones CRUD)
- ✅ **Validators**: Solo validación de datos de entrada (Zod, validaciones de formato)
- ✅ **Middlewares**: Solo procesamiento de requests (autenticación, autorización, logging)
- ✅ **Utils**: Solo utilidades compartidas (helpers, formatters, constantes)

### ❌ NO HACER:

- ❌ Lógica de negocio en controladores
- ❌ Queries SQL en servicios o controladores
- ❌ Validaciones de negocio en repositorios
- ❌ Acceso directo a base de datos desde controladores

### Ejemplo Correcto:

```javascript
// ✅ Controller - Solo orquestación
export const createUser = async (req, res, next) => {
  try {
    const userService = ServiceFactory.create('userService');
    const result = await userService.createUser(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

// ✅ Service - Lógica de negocio
export class UserService {
  async createUser(userData) {
    // Validaciones de negocio
    if (await this.userRepository.exists(userData.email)) {
      throw new ConflictError('Usuario ya existe');
    }
    // Transformaciones
    const hashedPassword = await this.passwordService.hash(userData.password);
    // Persistencia delegada al repositorio
    return await this.userRepository.create({ ...userData, password: hashedPassword });
  }
}

// ✅ Repository - Solo acceso a datos
export class UserRepository extends BaseRepository {
  async create(userData) {
    return this.execute(
      'INSERT INTO Usuarios (nombre, email, password) VALUES (?, ?, ?)',
      [userData.nombre, userData.email, userData.password]
    );
  }
}
```

---

## 2. Inyección de Dependencias

**Principio**: Las dependencias deben ser inyectadas, no instanciadas directamente. Usar el contenedor de dependencias para gestionar todas las dependencias.

### Reglas:

- ✅ **SIEMPRE** usar `ServiceFactory.create()` para obtener servicios
- ✅ **SIEMPRE** inyectar dependencias en constructores
- ✅ **NUNCA** instanciar clases directamente con `new` en servicios o controladores
- ✅ **NUNCA** importar e instanciar repositorios directamente
- ✅ **SIEMPRE** registrar nuevas dependencias en `src/di/setup.js`

### ❌ NO HACER:

- ❌ `const db = require('../config/dbconfig.js')` en servicios
- ❌ `const userRepo = new UserRepository()` en servicios
- ❌ `import db from '../config/dbconfig'` en servicios
- ❌ Instanciar servicios con `new` en controladores

### Ejemplo Correcto:

```javascript
// ✅ Service con dependencias inyectadas
export class UserService {
  constructor(userRepository, passwordService, logger) {
    this.userRepository = userRepository; // Inyectado
    this.passwordService = passwordService; // Inyectado
    this.logger = logger; // Inyectado
  }

  async createUser(userData) {
    // Usar dependencias inyectadas
    const exists = await this.userRepository.exists(userData.email);
    const hash = await this.passwordService.hash(userData.password);
    this.logger.info('Creando usuario', { email: userData.email });
    return await this.userRepository.create({ ...userData, password: hash });
  }
}

// ✅ Controller usando ServiceFactory
export const createUser = async (req, res, next) => {
  try {
    const userService = ServiceFactory.create('userService'); // ✅ Factory
    const result = await userService.createUser(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

// ✅ Registro en setup.js
container.register('userService', (c) => {
  return new UserService(
    c.resolve('userRepository'),      // ✅ Inyección
    c.resolve('passwordService'),     // ✅ Inyección
    c.resolve('logger')               // ✅ Inyección
  );
}, true);
```

### Ejemplo Incorrecto:

```javascript
// ❌ Service con dependencias instanciadas directamente
export class UserService {
  constructor() {
    this.userRepository = new UserRepository(); // ❌ NO HACER
    this.db = require('../config/dbconfig');    // ❌ NO HACER
  }
}

// ❌ Controller instanciando servicio directamente
export const createUser = async (req, res) => {
  const userService = new UserService(); // ❌ NO HACER
  // ...
};
```

---

## 3. Funciones Pequeñas y Específicas

**Principio**: Cada función debe hacer una sola cosa, ser pequeña (máximo ~50 líneas), y tener un nombre descriptivo que explique claramente su propósito.

### Reglas:

- ✅ **Máximo 50 líneas** por función
- ✅ **Una sola responsabilidad** por función
- ✅ **Nombres descriptivos** que expliquen qué hace la función
- ✅ **Extraer funciones** cuando una función hace múltiples cosas
- ✅ **Comentarios** solo cuando la lógica no es obvia

### ❌ NO HACER:

- ❌ Funciones de más de 50 líneas
- ❌ Funciones que hacen múltiples cosas
- ❌ Nombres genéricos como `process()`, `handle()`, `doSomething()`
- ❌ Lógica compleja anidada sin extraer

### Ejemplo Correcto:

```javascript
// ✅ Función pequeña y específica
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ✅ Función pequeña y específica
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

// ✅ Función que orquesta otras funciones pequeñas
const createUser = async (userData) => {
  validateUserData(userData);           // Función específica
  await checkUserExists(userData.email); // Función específica
  const hash = await hashPassword(userData.password); // Función específica
  return await saveUser({ ...userData, password: hash }); // Función específica
};
```

### Ejemplo Incorrecto:

```javascript
// ❌ Función grande que hace múltiples cosas
const processUserRegistration = async (req, res) => {
  // Validación (50+ líneas)
  if (!req.body.email) {
    return res.status(400).json({ error: 'Email requerido' });
  }
  // ... más validaciones ...
  
  // Verificar existencia (20+ líneas)
  const [users] = await db.execute('SELECT * FROM Usuarios WHERE email = ?', [req.body.email]);
  if (users.length > 0) {
    return res.status(409).json({ error: 'Usuario existe' });
  }
  
  // Hashear contraseña (10+ líneas)
  const hash = await bcrypt.hash(req.body.password, 10);
  
  // Guardar usuario (30+ líneas)
  await db.execute('INSERT INTO Usuarios ...', [/* muchos parámetros */]);
  
  // Enviar email (40+ líneas)
  // ... lógica de email ...
  
  // Retornar respuesta
  return res.status(201).json({ message: 'Usuario creado' });
}; // ❌ Más de 150 líneas, hace demasiadas cosas
```

### Refactorización Correcta:

```javascript
// ✅ Funciones pequeñas y específicas
const validateEmail = (email) => {
  if (!email) return { valid: false, error: 'Email requerido' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return { valid: emailRegex.test(email), error: null };
};

const checkUserExists = async (email) => {
  const user = await userRepository.findByEmail(email);
  if (user) {
    throw new ConflictError('Usuario ya existe');
  }
};

const hashPassword = async (password) => {
  return await passwordService.hash(password);
};

const saveUser = async (userData) => {
  return await userRepository.create(userData);
};

// ✅ Función orquestadora pequeña
const createUser = async (userData) => {
  const emailValidation = validateEmail(userData.email);
  if (!emailValidation.valid) {
    throw new ValidationError(emailValidation.error);
  }
  
  await checkUserExists(userData.email);
  const hash = await hashPassword(userData.password);
  return await saveUser({ ...userData, password: hash });
};
```

---

## Checklist de Aplicación

Antes de considerar cualquier código como completo, verificar:

### ✅ Separación de Responsabilidades:
- [ ] ¿El controlador solo orquesta y no tiene lógica de negocio?
- [ ] ¿El servicio no tiene queries SQL directas?
- [ ] ¿El repositorio solo maneja acceso a datos?
- [ ] ¿Cada capa tiene una responsabilidad única?

### ✅ Inyección de Dependencias:
- [ ] ¿Las dependencias están inyectadas en el constructor?
- [ ] ¿Se usa `ServiceFactory.create()` para obtener servicios?
- [ ] ¿Las dependencias están registradas en `setup.js`?
- [ ] ¿No hay instanciaciones directas con `new`?

### ✅ Funciones Pequeñas:
- [ ] ¿Cada función tiene menos de 50 líneas?
- [ ] ¿Cada función hace una sola cosa?
- [ ] ¿Los nombres de las funciones son descriptivos?
- [ ] ¿Las funciones complejas están divididas en funciones más pequeñas?

---

## Recordatorio Importante

**Estos 3 principios son OBLIGATORIOS y deben aplicarse en TODAS las tareas de desarrollo.**

Si encuentras código que no cumple con estos principios, debe ser refactorizado antes de considerarse completo.

