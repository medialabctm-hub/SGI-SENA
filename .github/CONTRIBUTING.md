# Guía de Contribución

¡Gracias por tu interés en contribuir a SGE-SENA!

## Proceso de Contribución

### 1. Fork y Clone

1. Haz fork del repositorio
2. Clona tu fork localmente:
```bash
git clone https://github.com/TU_USUARIO/SGE-SENA.git
cd SGE-SENA
```

### 2. Crear una Rama

Crea una rama para tu feature o fix:
```bash
git checkout -b feature/nombre-de-tu-feature
# o
git checkout -b fix/nombre-del-fix
```

### 3. Desarrollo

- Sigue los estándares de código definidos en [CODING_STANDARDS.md](../CODING_STANDARDS.md)
- Asegúrate de que tu código pase el linter:
  ```bash
  # Backend
  cd backend
  npm run lint
  
  # Frontend
  cd frontend
  npm run lint
  ```

- Ejecuta los tests antes de hacer commit:
  ```bash
  cd backend
  npm test
  ```

- Verifica el formato del código:
  ```bash
  npm run format:check
  ```

### 4. Commit

Usa [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: agregar nueva funcionalidad
fix: corregir bug en autenticación
docs: actualizar documentación
refactor: reorganizar servicios
test: agregar tests para nueva feature
```

### 5. Push y Pull Request

1. Push a tu fork:
```bash
git push origin feature/nombre-de-tu-feature
```

2. Abre un Pull Request en GitHub
3. Asegúrate de que todos los checks de CI pasen
4. Espera la revisión del código

## Estándares de Código

- Lee [CODING_STANDARDS.md](../CODING_STANDARDS.md) antes de contribuir
- El proyecto usa el estilo de código de Airbnb/Facebook
- Todos los archivos deben pasar ESLint y Prettier

## Tests

- Escribe tests para nuevas funcionalidades
- Asegúrate de que todos los tests pasen
- Mantén o mejora la cobertura de código

## Preguntas

Si tienes preguntas, abre un issue en GitHub.

