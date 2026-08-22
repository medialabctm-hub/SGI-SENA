import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
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
  ...compat.extends('airbnb-base'),
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Mantener la revisión de errores reales como gate y reportar el estilo
      // heredado como warnings para que el lint sea ejecutable en CI.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'prefer-const': 'warn',
      'prefer-template': 'warn',
      'object-shorthand': 'warn',
      'prefer-destructuring': ['warn', {
        array: false,
        object: true,
      }, {
        enforceForRenamedProperties: false,
      }],
      'no-plusplus': ['warn', { allowForLoopAfterthoughts: true }],
      'no-restricted-globals': ['warn', {
        name: 'isNaN',
        message: 'Use Number.isNaN instead',
      }],
      'no-else-return': 'warn',
      'consistent-return': ['warn', { treatUndefinedAsUnspecified: true }],
      'no-underscore-dangle': ['warn', {
        allow: ['__filename', '__dirname'],
      }],
      'no-empty': 'warn',
      'import/order': 'warn',
      'import/no-duplicates': 'warn',
      'import/no-cycle': 'warn',
      'import/no-named-as-default': 'warn',
      'import/no-named-as-default-member': 'warn',
      'class-methods-use-this': ['warn', {
        exceptMethods: ['decode', 'compare', 'generatePassword', 'getLogLevel', 'formatMessage', 'validate', 'executeSync', 'generateCode'],
      }],
      // Permitir console.warn y console.error (ya configurado en Airbnb)
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Permitir reasignación de propiedades de parámetros (común en Express)
      'no-param-reassign': ['error', { props: false }],
      
      // Permitir extensiones .js en imports (necesario para ES modules)
      'import/extensions': ['error', 'ignorePackages', {
        js: 'always',
        mjs: 'always',
        cjs: 'always',
      }],
      
      // Permitir snake_case para variables que vienen de la base de datos
      'camelcase': ['error', {
        ignoreDestructuring: true,
        properties: 'never',
        allow: ['^[a-z]+_[a-z]+'],
      }],
      
      // Permitir for...of loops (más legible que forEach en algunos casos)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForInStatement',
          message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
        },
        {
          selector: 'LabeledStatement',
          message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
        },
        {
          selector: 'WithStatement',
          message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
        },
      ],
      
      // Permitir await en loops cuando sea necesario (pero con advertencia)
      'no-await-in-loop': 'warn',

      // Permitir múltiples clases por archivo cuando sea necesario (ej: errores, estrategias)
      'max-classes-per-file': ['error', { max: 10 }],

      // Permitir default exports cuando sea apropiado
      'import/prefer-default-export': 'off',

      // Permitir continue en algunos casos
      'no-continue': 'off',

      // Permitir radix en parseInt (pero con advertencia)
      'radix': ['warn', 'always'],

      // Permitir dot-notation más flexible para acceso dinámico
      'dot-notation': ['error', { allowPattern: '^[a-z_]+$' }],
      
      // Permitir imports de devDependencies en archivos de configuración
      'import/no-extraneous-dependencies': ['error', {
        devDependencies: [
          '**/*.config.js',
          '**/*.config.mjs',
          '**/tests/**',
          '**/test/**',
          '**/__tests__/**',
        ],
      }],
      
      // Permitir uso antes de definir en algunos casos
      'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
      
      // Permitir nested ternary en algunos casos
      'no-nested-ternary': 'warn',
      
      // Permitir useless catch cuando se re-lanza el error
      'no-useless-catch': 'off',
      
      // Permitir default case opcional en algunos switch
      'default-case': 'warn',
      
      // Permitir return-await cuando sea necesario
      'no-return-await': 'off',
      
      // Permitir one-var en algunos casos
      'one-var': 'off',
    },
  },
  {
    files: ['tests/**/*.{js,mjs,cjs}', '**/*.test.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  prettier,
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
  },
];
