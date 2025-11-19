# Arquitectura del Proyecto - Principios SOLID y Patrones de Diseño

Este documento describe la arquitectura del proyecto, los principios SOLID aplicados y los patrones de diseño implementados.

## Estructura de Capas

```
backend/src/
├── config/          # Configuración del sistema
├── controllers/     # Capa de presentación (HTTP)
├── services/        # Capa de lógica de negocio
├── repositories/    # Capa de acceso a datos
├── middleware/      # Middlewares de Express
├── routes/          # Definición de rutas
├── validators/      # Validadores de datos
├── utils/           # Utilidades compartidas
├── di/              # Dependency Injection Container
├── factories/       # Factory Pattern
├── builders/        # Builder Pattern
├── strategies/      # Strategy Pattern
├── facades/         # Facade Pattern
└── observers/       # Observer Pattern
```

## Principios SOLID Aplicados

### 1. Single Responsibility Principle (SRP)

**Cada clase tiene una única razón para cambiar:**

- **Repositories**: Solo se encargan del acceso a datos
- **Services**: Solo contienen lógica de negocio
- **Controllers**: Solo manejan requests/responses HTTP
- **Validators**: Solo validan datos de entrada

**Ejemplo:**
```javascript
// ✅ Correcto: UserRepository solo maneja acceso a datos
export class UserRepository extends BaseRepository {
  async findById(userId) { /* ... */ }
  async create(userData) { /* ... */ }
}

// ✅ Correcto: AuthService solo maneja lógica de autenticación
export class AuthService {
  async registerUser(userData) { /* ... */ }
  async loginUser(cedula, contrasena) { /* ... */ }
}
```

### 2. Open/Closed Principle (OCP)

**Abierto para extensión, cerrado para modificación:**

- **Strategy Pattern**: Permite agregar nuevas estrategias de validación sin modificar el código existente
- **Observer Pattern**: Permite agregar nuevos observadores sin modificar el sujeto
- **Factory Pattern**: Permite agregar nuevos tipos de servicios sin modificar la factory

**Ejemplo:**
```javascript
// ✅ Se pueden agregar nuevas estrategias sin modificar ValidationContext
export class EmailValidationStrategy extends ValidationStrategy {
  validate(value) { /* ... */ }
}

export class PasswordValidationStrategy extends ValidationStrategy {
  validate(value) { /* ... */ }
}
```

### 3. Liskov Substitution Principle (LSP)

**Las subclases deben ser sustituibles por sus clases base:**

- **BaseRepository**: Todas las subclases pueden ser usadas donde se espera un BaseRepository
- **ValidationStrategy**: Todas las estrategias pueden ser usadas donde se espera una ValidationStrategy

**Ejemplo:**
```javascript
// ✅ Cualquier repositorio puede ser usado donde se espera BaseRepository
const userRepo = new UserRepository(db);
const roleRepo = new RoleRepository(db);

// Ambos pueden usar métodos de BaseRepository
await userRepo.execute(query, params);
await roleRepo.execute(query, params);
```

### 4. Interface Segregation Principle (ISP)

**Los clientes no deben depender de interfaces que no usan:**

- **Repositories**: Cada repositorio solo expone métodos relevantes para su entidad
- **Services**: Servicios específicos (PasswordService, JwtService) en lugar de un servicio monolítico

**Ejemplo:**
```javascript
// ✅ Servicios específicos en lugar de un servicio grande
export class PasswordService {
  async hash(password) { /* ... */ }
  async compare(password, hash) { /* ... */ }
}

export class JwtService {
  sign(payload) { /* ... */ }
  verify(token) { /* ... */ }
}
```

### 5. Dependency Inversion Principle (DIP)

**Depender de abstracciones, no de concreciones:**

- **Dependency Injection Container**: Los servicios dependen de interfaces (repositorios) no de implementaciones concretas
- **ServiceFactory**: Centraliza la creación de servicios, permitiendo cambiar implementaciones fácilmente

**Ejemplo:**
```javascript
// ✅ AuthService depende de interfaces, no de implementaciones concretas
export class AuthService {
  constructor(userRepository, roleRepository, passwordService, jwtService, logger) {
    // Dependencias inyectadas, no instanciadas directamente
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    // ...
  }
}
```

## Patrones de Diseño Implementados

### 1. Repository Pattern

**Propósito**: Abstraer el acceso a datos, permitiendo cambiar la implementación sin afectar la lógica de negocio.

**Ubicación**: `src/repositories/`

**Ejemplo:**
```javascript
export class UserRepository extends BaseRepository {
  async findById(userId) {
    return this.findOne(
      'SELECT * FROM Usuarios WHERE id_usuario = ?',
      [userId]
    );
  }
}
```

**Beneficios**:
- Separación de responsabilidades
- Facilita testing (mock de repositorios)
- Permite cambiar la fuente de datos sin modificar servicios

### 2. Dependency Injection

**Propósito**: Invertir el control de dependencias, haciendo el código más testeable y flexible.

**Ubicación**: `src/di/`

**Ejemplo:**
```javascript
// Contenedor de dependencias
container.register('authService', (c) => {
  return new AuthService(
    c.resolve('userRepository'),
    c.resolve('roleRepository'),
    // ...
  );
}, true);
```

**Beneficios**:
- Bajo acoplamiento
- Facilita testing
- Centraliza la gestión de dependencias

### 3. Factory Pattern

**Propósito**: Centralizar la creación de objetos, permitiendo agregar nuevos tipos sin modificar código existente.

**Ubicación**: `src/factories/`

**Ejemplo:**
```javascript
export class ServiceFactory {
  static create(serviceName) {
    return container.resolve(serviceName);
  }
}
```

**Beneficios**:
- Encapsula la lógica de creación
- Facilita la extensión
- Centraliza la creación de instancias

### 4. Builder Pattern

**Propósito**: Construir objetos complejos paso a paso, validando en cada paso.

**Ubicación**: `src/builders/`

**Ejemplo:**
```javascript
const user = new UserBuilder()
  .withNombre('Juan')
  .withCedula('1234567890')
  .withCorreo('juan@example.com')
  .withContrasena('password123')
  .withIdRol(1)
  .build();
```

**Beneficios**:
- Construcción fluida y legible
- Validación en cada paso
- Permite construir objetos complejos de forma clara

### 5. Strategy Pattern

**Propósito**: Definir una familia de algoritmos intercambiables.

**Ubicación**: `src/strategies/`

**Ejemplo:**
```javascript
const emailValidator = new ValidationContext(new EmailValidationStrategy());
const passwordValidator = new ValidationContext(new PasswordValidationStrategy(6));

const emailResult = emailValidator.validate(email);
const passwordResult = passwordValidator.validate(password);
```

**Beneficios**:
- Algoritmos intercambiables
- Facilita agregar nuevas estrategias
- Cumple con OCP

### 6. Facade Pattern

**Propósito**: Proporcionar una interfaz simplificada para un subsistema complejo.

**Ubicación**: `src/facades/`

**Ejemplo:**
```javascript
export class AuthFacade {
  async register(userData) {
    // Simplifica operaciones complejas de autenticación
    return await this.authService.registerUser(userData);
  }
}
```

**Beneficios**:
- Simplifica interfaces complejas
- Oculta la complejidad del subsistema
- Facilita el uso del sistema

### 7. Observer Pattern

**Propósito**: Notificar a múltiples objetos sobre cambios en el estado de otro objeto.

**Ubicación**: `src/observers/`

**Ejemplo:**
```javascript
const notificationObserver = new NotificationObserver(notificationService);
subject.subscribe(notificationObserver);

// Cuando ocurre un evento
subject.notify('user.registered', { id: 1, nombre: 'Juan' });
```

**Beneficios**:
- Desacoplamiento entre sujeto y observadores
- Permite agregar nuevos observadores fácilmente
- Cumple con OCP

### 8. Singleton Pattern

**Propósito**: Asegurar que una clase tenga solo una instancia.

**Ubicación**: `src/di/Container.js`

**Ejemplo:**
```javascript
// El contenedor mantiene instancias singleton
container.register('authService', factory, true); // true = singleton
```

**Beneficios**:
- Controla el número de instancias
- Ahorra recursos
- Acceso global controlado

## Flujo de Datos

```
Request → Controller → Service → Repository → Database
                ↓
            Validator
                ↓
            Builder/Strategy
                ↓
            Observer (si aplica)
```

## Ejemplo Completo: Registro de Usuario

1. **Controller** recibe el request
2. **Validator** valida los datos de entrada (Zod)
3. **Controller** llama a **AuthService**
4. **AuthService** usa **ValidationStrategy** para validar campos
5. **AuthService** usa **UserBuilder** para construir el objeto usuario
6. **AuthService** usa **PasswordService** para hashear la contraseña
7. **AuthService** usa **UserRepository** para persistir
8. **UserRepository** usa **BaseRepository** para ejecutar queries
9. **Observer** notifica a administradores (si está suscrito)
10. **Controller** retorna la respuesta

## Testing

La arquitectura facilita el testing:

- **Repositories**: Se pueden mockear fácilmente
- **Services**: Se pueden testear con repositorios mockeados
- **Controllers**: Se pueden testear con servicios mockeados
- **Dependency Injection**: Permite inyectar mocks fácilmente

## Extensibilidad

Para agregar nuevas funcionalidades:

1. **Nuevo Repository**: Extender `BaseRepository`
2. **Nuevo Service**: Inyectar dependencias necesarias
3. **Nueva Strategy**: Extender `ValidationStrategy`
4. **Nuevo Observer**: Extender `Observer` y suscribirse al Subject
5. **Nuevo Builder**: Crear nueva clase Builder siguiendo el patrón

## Conclusión

Esta arquitectura proporciona:

- ✅ **Mantenibilidad**: Código organizado y fácil de entender
- ✅ **Testabilidad**: Componentes desacoplados y fáciles de testear
- ✅ **Escalabilidad**: Fácil agregar nuevas funcionalidades
- ✅ **Flexibilidad**: Cambiar implementaciones sin afectar otras partes
- ✅ **Reutilización**: Componentes reutilizables en diferentes contextos

