import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  js.configs.recommended,
  ...compat.extends('airbnb'),
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
      // Permitir console.warn y console.error
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      // Airbnb permite variables sin usar si empiezan con _
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      
      // Permitir reasignación de propiedades de parámetros
      'no-param-reassign': ['error', { props: false }],
      
      // Permitir extensiones .js y .jsx en imports (necesario para ES modules)
      'import/extensions': ['error', 'ignorePackages', {
        js: 'always',
        jsx: 'always',
      }],
      
      // React: Desactivar prop-types (opcional, según preferencia del proyecto)
      'react/prop-types': 'off',
      
      // React: No requiere importar React en archivos JSX (React 17+)
      'react/react-in-jsx-scope': 'off',
      
      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // JSX: Permitir .js y .jsx extensiones
      'react/jsx-filename-extension': ['error', { extensions: ['.js', '.jsx'] }],
      
      // Permitir arrow-body-style más flexible
      'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
      
      // Permitir default exports cuando sea apropiado
      'import/prefer-default-export': 'off',
      
      // Permitir imports de devDependencies en archivos de configuración
      'import/no-extraneous-dependencies': ['error', {
        devDependencies: [
          '**/*.config.js',
          '**/*.config.mjs',
          '**/vite.config.*',
          '**/tests/**',
          '**/test/**',
          '**/__tests__/**',
        ],
      }],
      
      // Permitir prefer-destructuring más flexible
      'prefer-destructuring': ['error', {
        array: false,
        object: true,
      }, {
        enforceForRenamedProperties: false,
      }],
      
      // Permitir object-shorthand más flexible
      'object-shorthand': ['error', 'always', {
        avoidQuotes: true,
      }],
    },
  },
  prettier,
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
  },
];

