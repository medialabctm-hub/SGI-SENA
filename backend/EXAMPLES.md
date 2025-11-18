# Ejemplos de Uso - Arquitectura Refactorizada

Este documento contiene ejemplos prácticos de cómo usar los diferentes patrones y componentes de la arquitectura refactorizada.

## 1. Uso del Repository Pattern

```javascript
import { ServiceFactory } from './factories/ServiceFactory.js';

// Obtener repositorio desde el contenedor
const userRepository = ServiceFactory.create('userRepository');

// Usar métodos del repositorio
const user = await userRepository.findById(1);
const users = await userRepository.findAll();
const newUser = await userRepository.create({
  nombre: 'Juan',
  cedula: '1234567890',
  correo: 'juan@example.com',
  // ...
});
```

## 2. Uso del Builder Pattern

```javascript
import { UserBuilder } from './builders/UserBuilder.js';

// Construir usuario paso a paso con validación
const user = new UserBuilder()
  .withNombre('Juan Pérez')
  .withCedula('1234567890')
  .withCorreo('juan@example.com')
  .withTelefono('3001234567')
  .withArea('Tecnología')
  .withContrasena('password123')
  .withIdRol(1)
  .build(); // Valida y retorna el objeto

// Si falta algún campo requerido, lanza error
try {
  const invalidUser = new UserBuilder()
    .withNombre('Juan')
    .build(); // Error: Faltan campos requeridos
} catch (error) {
  console.error(error.message);
}
```

## 3. Uso del Strategy Pattern

```javascript
import {
  EmailValidationStrategy,
  PasswordValidationStrategy,
  ValidationContext,
} from './strategies/ValidationStrategy.js';

// Crear contextos con diferentes estrategias
const emailValidator = new ValidationContext(new EmailValidationStrategy());
const passwordValidator = new ValidationContext(new PasswordValidationStrategy(8));

// Validar valores
const emailResult = emailValidator.validate('juan@example.com');
if (!emailResult.valid) {
  console.error(emailResult.error);
}

const passwordResult = passwordValidator.validate('password123');
if (!passwordResult.valid) {
  console.error(passwordResult.error);
}

// Cambiar estrategia dinámicamente
passwordValidator.setStrategy(new PasswordValidationStrategy(12));
```

## 4. Uso del Service Layer

```javascript
import { ServiceFactory } from './factories/ServiceFactory.js';

// Obtener servicio desde el contenedor
const authService = ServiceFactory.create('authService');

// Registrar usuario
const result = await authService.registerUser({
  nombre: 'Juan Pérez',
  cedula: '1234567890',
  correo: 'juan@example.com',
  telefono: '3001234567',
  contrasena: 'password123',
  rol: 'Aprendiz',
  area: 'Tecnología',
});

// Login
const loginResult = await authService.loginUser('1234567890', 'password123');
console.log(loginResult.token); // Token JWT
console.log(loginResult.user); // Datos del usuario

// Obtener perfil
const profile = await authService.getCurrentUser(1);
```

## 5. Uso del Dependency Injection Container

```javascript
import { container } from './di/Container.js';

// Registrar un nuevo servicio
container.register('myService', (c) => {
  const logger = c.resolve('logger');
  const db = c.resolve('db');
  return new MyService(logger, db);
}, true); // true = singleton

// Resolver dependencias
const myService = container.resolve('myService');

// Verificar si existe
if (container.has('myService')) {
  const service = container.resolve('myService');
}
```

## 6. Uso del Observer Pattern

```javascript
import { Subject } from './observers/NotificationObserver.js';
import { NotificationObserver } from './observers/NotificationObserver.js';
import { ServiceFactory } from './factories/ServiceFactory.js';

// Crear sujeto observable
const eventSubject = new Subject();

// Crear y suscribir observador
const notificationService = ServiceFactory.create('notificationService');
const notificationObserver = new NotificationObserver(notificationService);
eventSubject.subscribe(notificationObserver);

// Notificar eventos
eventSubject.notify('user.registered', {
  id: 1,
  nombre: 'Juan Pérez',
});

eventSubject.notify('equipo.created', {
  codigo_equipo: 'EQ001',
  tipo: 'Computador',
  marca: 'Dell',
  modelo: 'OptiPlex',
  ambiente: 'Aula 101',
  creadoPor: 1,
});

// Desuscribir observador
eventSubject.unsubscribe(notificationObserver);
```

## 7. Uso del Facade Pattern

```javascript
import { AuthFacade } from './facades/AuthFacade.js';

// Crear facade
const authFacade = new AuthFacade();

// Usar métodos simplificados
const registerResult = await authFacade.register({
  nombre: 'Juan Pérez',
  cedula: '1234567890',
  correo: 'juan@example.com',
  contrasena: 'password123',
  rol: 'Aprendiz',
});

const loginResult = await authFacade.login('1234567890', 'password123');
const profile = await authFacade.getProfile(1);
```

## 8. Uso en un Controller Completo

```javascript
import { ServiceFactory } from '../factories/ServiceFactory.js';
import { logger } from '../utils/logger.js';

export const registerUser = async (req, res, next) => {
  try {
    // Obtener servicio desde el factory
    const authService = ServiceFactory.create('authService');
    
    // Llamar al servicio (toda la lógica está en el servicio)
    const result = await authService.registerUser(req.body);
    
    // Retornar respuesta
    return res.status(201).json(result);
  } catch (error) {
    // El error handler centralizado manejará el error
    logger.error('Error en registerUser', { error: error.message });
    return next(error);
  }
};
```

## 9. Testing con Mocks

```javascript
// Ejemplo de test con mocks
import { AuthService } from '../services/AuthService.js';

describe('AuthService', () => {
  let authService;
  let mockUserRepository;
  let mockRoleRepository;
  let mockPasswordService;
  let mockJwtService;
  let mockLogger;

  beforeEach(() => {
    // Crear mocks
    mockUserRepository = {
      findByCedulaOrEmail: jest.fn(),
      create: jest.fn(),
    };
    
    mockRoleRepository = {
      findByName: jest.fn(),
    };
    
    mockPasswordService = {
      hash: jest.fn(),
    };
    
    mockJwtService = {
      sign: jest.fn(),
    };
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    // Crear servicio con mocks inyectados
    authService = new AuthService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordService,
      mockJwtService,
      mockLogger
    );
  });

  it('debe registrar un usuario correctamente', async () => {
    // Configurar mocks
    mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
    mockRoleRepository.findByName.mockResolvedValue({ id_rol: 1 });
    mockPasswordService.hash.mockResolvedValue('hashed_password');

    // Ejecutar
    const result = await authService.registerUser({
      nombre: 'Juan',
      cedula: '1234567890',
      correo: 'juan@example.com',
      contrasena: 'password123',
      rol: 'Aprendiz',
    });

    // Verificar
    expect(mockUserRepository.create).toHaveBeenCalled();
    expect(result.message).toBe('Usuario registrado correctamente');
  });
});
```

## 10. Transacciones con Repository

```javascript
import { ServiceFactory } from './factories/ServiceFactory.js';

const userRepository = ServiceFactory.create('userRepository');

// Ejecutar operaciones en una transacción
await userRepository.transaction(async (connection) => {
  // Todas las operaciones usan la misma conexión
  await connection.execute('INSERT INTO Usuarios ...', [data1]);
  await connection.execute('INSERT INTO Roles ...', [data2]);
  // Si algo falla, se hace rollback automáticamente
});
```

## 11. Extender la Arquitectura

### Agregar un Nuevo Repository

```javascript
import { BaseRepository } from './BaseRepository.js';

export class EquipoRepository extends BaseRepository {
  async findByCodigo(codigo) {
    return this.findOne(
      'SELECT * FROM Elementos WHERE codigo_equipo = ?',
      [codigo]
    );
  }

  async findAll() {
    return this.execute('SELECT * FROM Elementos');
  }
}

// Registrar en setup.js
container.register('equipoRepository', (c) => {
  return new EquipoRepository(c.resolve('db'));
}, true);
```

### Agregar una Nueva Strategy

```javascript
import { ValidationStrategy } from './ValidationStrategy.js';

export class TelefonoValidationStrategy extends ValidationStrategy {
  validate(value) {
    if (!value) {
      return { valid: false, error: 'El teléfono es requerido' };
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(value)) {
      return { valid: false, error: 'El teléfono debe tener 10 dígitos' };
    }

    return { valid: true, error: null };
  }
}

// Usar
const phoneValidator = new ValidationContext(new TelefonoValidationStrategy());
const result = phoneValidator.validate('3001234567');
```

### Agregar un Nuevo Observer

```javascript
import { Observer } from './NotificationObserver.js';

export class AuditObserver extends Observer {
  async update(event, data) {
    // Registrar evento en auditoría
    console.log(`Evento: ${event}`, data);
    // Guardar en base de datos de auditoría
  }
}

// Suscribir
const auditObserver = new AuditObserver();
eventSubject.subscribe(auditObserver);
```

## Conclusión

Esta arquitectura proporciona:

- ✅ **Flexibilidad**: Fácil agregar nuevas funcionalidades
- ✅ **Testabilidad**: Componentes fáciles de testear con mocks
- ✅ **Mantenibilidad**: Código organizado y claro
- ✅ **Escalabilidad**: Preparado para crecer
- ✅ **Reutilización**: Componentes reutilizables

