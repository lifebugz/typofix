import { defineConfig } from 'eslint/config'
import jsdoc from 'eslint-plugin-jsdoc'

export const jxa = defineConfig({
  files: ['packages/core/assets/macos/*.js'],
  languageOptions: {
    sourceType: 'script',
    globals: {
      Application: 'readonly',
      delay: 'readonly',
      $: 'readonly',
      ObjC: 'readonly',
    },
  },
  plugins: { jsdoc },
  rules: {
    // A .js file cannot carry a `: Type` annotation; checkJs reads JSDoc instead.
    '@typescript-eslint/explicit-function-return-type': 'off',
    'jsdoc/require-jsdoc': [
      'error',
      {
        require: {
          FunctionDeclaration: true,
          FunctionExpression: true,
          MethodDefinition: true,
        },
        contexts: ['VariableDeclarator > ArrowFunctionExpression'],
      },
    ],
    'jsdoc/require-param': 'error',
    'jsdoc/require-param-name': 'error',
    'jsdoc/require-param-type': 'error',
    'jsdoc/require-returns': ['error', { forceRequireReturn: true }],
    'jsdoc/require-returns-type': 'error',
    'jsdoc/require-returns-check': 'error',
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/valid-types': 'error',
    'jsdoc/no-defaults': 'error',
    'jsdoc/empty-tags': 'error',
    'jsdoc/reject-any-type': 'error',
    'jsdoc/reject-function-type': 'error',
  },
})
