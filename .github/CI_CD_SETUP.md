# Configuración de CI/CD con GitHub Actions

Este documento explica cómo está configurado el CI/CD en este proyecto y qué pasos adicionales puedes realizar.

## ✅ Lo que ya está configurado

### Workflows de GitHub Actions

1. **`.github/workflows/ci.yml`** - Workflow principal que ejecuta:
   - Tests del backend
   - Linting en backend y frontend
   - Verificación de formato (Prettier)
   - Build del frontend
   - Auditoría de seguridad

2. **`.github/workflows/backend-ci.yml`** - Workflow específico para backend:
   - Tests con múltiples versiones de Node.js (18.x, 20.x)
   - Linting y formato
   - Generación de reportes de cobertura
   - Integración opcional con Codecov

3. **`.github/workflows/frontend-ci.yml`** - Workflow específico para frontend:
   - Linting y formato
   - Build del proyecto
   - Pruebas con múltiples versiones de Node.js

## 🚀 Pasos para activar CI/CD

### 1. Actualizar badges en README.md

Reemplaza `TU_USUARIO` con tu usuario/organización de GitHub en el README.md:

```markdown
[![CI Completo](https://github.com/TU_USUARIO/SGE-SENA/actions/workflows/ci.yml/badge.svg)](https://github.com/TU_USUARIO/SGE-SENA/actions/workflows/ci.yml)
```

### 2. Hacer push de los workflows

```bash
git add .github/
git commit -m "ci: agregar workflows de GitHub Actions"
git push origin develop
```

### 3. Verificar que funcionen

1. Ve a la pestaña "Actions" en tu repositorio de GitHub
2. Los workflows deberían ejecutarse automáticamente
3. Verifica que todos los jobs pasen correctamente

## 🔧 Configuraciones adicionales recomendadas

### 1. Proteger ramas principales

En GitHub, ve a Settings → Branches y agrega reglas de protección:

- **Branch name pattern**: `main` y `develop`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - Selecciona: `Backend Tests & Lint`, `Frontend Lint & Build`
- ✅ Require branches to be up to date before merging

### 2. Configurar Codecov (Opcional)

Para reportes de cobertura más detallados:

1. Ve a [codecov.io](https://codecov.io) y conecta tu repositorio
2. Obtén el token de Codecov
3. Agrega el token como secret en GitHub:
   - Settings → Secrets and variables → Actions
   - New repository secret: `CODECOV_TOKEN`

### 3. Agregar dependabot (Recomendado)

Crea `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

### 4. Agregar tests de frontend (Futuro)

Si decides agregar tests al frontend (Vitest, React Testing Library):

1. Instala las dependencias:
```bash
cd frontend
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

2. Agrega script en `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

3. Actualiza `.github/workflows/frontend-ci.yml` para incluir tests.

### 5. Notificaciones (Opcional)

Puedes configurar notificaciones cuando los workflows fallen:

1. Settings → Notifications → Actions
2. Selecciona cómo quieres recibir notificaciones

### 6. Cache de dependencias

Los workflows ya incluyen cache de `node_modules` para acelerar las ejecuciones. Esto está configurado automáticamente.

## 📊 Monitoreo

### Ver resultados de CI/CD

- **Actions tab**: Ve todos los workflows ejecutados
- **Badges**: Se actualizan automáticamente en el README
- **Pull Requests**: Los checks aparecen automáticamente

### Métricas útiles

- Tiempo de ejecución de workflows
- Tasa de éxito de tests
- Cobertura de código (si usas Codecov)

## 🔍 Troubleshooting

### Los workflows no se ejecutan

1. Verifica que los archivos estén en `.github/workflows/`
2. Verifica la sintaxis YAML (puedes usar un validador online)
3. Asegúrate de que el repositorio tenga Actions habilitado

### Tests fallan en CI pero pasan localmente

1. Verifica las variables de entorno
2. Asegúrate de que las dependencias estén actualizadas
3. Revisa los logs en la pestaña Actions

### Build del frontend falla

1. Verifica que todas las dependencias estén en `package.json`
2. Revisa si hay errores de TypeScript/ESLint
3. Verifica que el Node.js version sea compatible

## 📚 Recursos adicionales

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Documentation](https://jestjs.io/)
- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)

## 🎯 Próximos pasos sugeridos

1. ✅ Configurar protección de ramas
2. ✅ Agregar Dependabot para actualizaciones automáticas
3. ⏳ Agregar tests de frontend
4. ⏳ Configurar Codecov para cobertura
5. ⏳ Agregar deployment automático (si aplica)
6. ⏳ Configurar releases automáticos con changelog

