import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...(reactHooks.configs['recommended-latest']?.rules ?? {}),
      // El repositorio usa componentes preexistentes con estilos distintos;
      // mantener estos checks como señales de QA sin bloquear el build.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'prefer-destructuring': ['warn', {
        array: false,
        object: true,
      }, {
        enforceForRenamedProperties: false,
      }],
      'object-shorthand': ['warn', 'always', {
        avoidQuotes: true,
      }],
      'arrow-body-style': ['warn', 'as-needed', { requireReturnForObjectLiteral: false }],
      'react/no-unescaped-entities': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      // Permitir console.warn y console.error
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Permitir reasignación de propiedades de parámetros
      'no-param-reassign': ['error', { props: false }],

      // React: Desactivar prop-types (opcional, según preferencia del proyecto)
      'react/prop-types': 'off',

      // React: No requiere importar React en archivos JSX (React 17+)
      'react/react-in-jsx-scope': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // JSX: Permitir .js y .jsx extensiones
      'react/jsx-filename-extension': ['error', { extensions: ['.js', '.jsx'] }],

      // Permitir default exports cuando sea apropiado
      'import/prefer-default-export': 'off',
    },
  },
  prettier,
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
  },
];

