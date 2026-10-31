import { defineConfig } from 'eslint/config'

export const boundaries = defineConfig(
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/)',
              message:
                'Core runs in every harness: it imports only its own files, never a package or a host API.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['harnesses/**/*.ts', 'harnesses/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)core(/(?!index$)|$)',
              message: 'Import core only through core/index, its public API.',
            },
          ],
        },
      ],
    },
  },
)
