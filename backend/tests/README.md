# Tests - Sistema de Gestión de Inventario SENA

Este directorio contiene los tests del proyecto.

## Estructura

```
tests/
├── setup.js                    # Configuración global de tests
├── controllers/                # Tests de controladores
│   └── webhookController.test.js
├── services/                   # Tests de servicios
│   └── authService.test.js
└── README.md                   # Este archivo
```

## Instalación

Las dependencias de testing ya están incluidas en `package.json`. Para instalar:

```bash
cd backend
npm install
```

## Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con cobertura
npm run test:coverage
```

## Escribir Nuevos Tests

### Ejemplo de Test de Servicio

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { MiService } from '../../src/services/miService.js';

describe('MiService', () => {
  let service;

  beforeEach(() => {
    // Configurar mocks y servicio
  });

  it('debe hacer algo correctamente', async () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = await service.miMetodo(input);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

### Ejemplo de Test de Controlador

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { miControlador } from '../../src/controller/miController.js';

describe('miControlador', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, user: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('debe retornar 400 si faltan datos', async () => {
    await miControlador(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
```

## Cobertura de Tests

El objetivo es alcanzar al menos:
- **70%** de cobertura en servicios críticos
- **60%** de cobertura en controladores
- **80%** de cobertura en utilidades

## Notas

- Los tests usan Jest con soporte para ES modules
- Se configuran variables de entorno de prueba automáticamente
- Los mocks se limpian después de cada test


