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
      // Permitir console.warn y console.error (ya configurado en Airbnb)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      // Airbnb permite parámetros sin usar si empiezan con _
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      
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
      
      // Permitir ++ y -- en algunos contextos
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      
      // Permitir await en loops cuando sea necesario (pero con advertencia)
      'no-await-in-loop': 'warn',
      
      // Permitir múltiples clases por archivo cuando sea necesario (ej: errores, estrategias)
      'max-classes-per-file': ['error', { max: 10 }],
      
      // Permitir métodos de clase sin usar 'this' (ej: métodos estáticos)
      'class-methods-use-this': ['error', {
        exceptMethods: ['decode', 'compare', 'generatePassword', 'getLogLevel', 'formatMessage', 'validate', 'executeSync', 'generateCode'],
      }],
      
      // Permitir default exports cuando sea apropiado
      'import/prefer-default-export': 'off',
      
      // Permitir consistent-return en algunos casos (middlewares, validators)
      'consistent-return': ['error', { treatUndefinedAsUnspecified: true }],
      
      // Permitir __filename y __dirname (necesarios para ES modules)
      'no-underscore-dangle': ['error', {
        allow: ['__filename', '__dirname'],
      }],
      
      // Permitir continue en algunos casos
      'no-continue': 'off',
      
      // Permitir radix en parseInt (pero con advertencia)
      'radix': ['warn', 'always'],
      
      // Permitir isNaN global (pero preferir Number.isNaN)
      'no-restricted-globals': ['error', {
        name: 'isNaN',
        message: 'Use Number.isNaN instead',
      }],
      
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
      
      // Permitir prefer-destructuring más flexible
      'prefer-destructuring': ['error', {
        array: false,
        object: true,
      }, {
        enforceForRenamedProperties: false,
      }],
    },
  },
  prettier,
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
  },
];
