import prettier from 'eslint-config-prettier'
import { defineConfig } from 'eslint/config'

import { base } from './tooling/eslint/base.js'
import { jxa } from './tooling/eslint/jxa.js'

export default defineConfig(
  {
    ignores: [
      '.claude/',
      'tooling/types/',
      'harnesses/*/.claude-plugin/types/',
    ],
  },
  base,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  jxa,
  prettier,
  // eslint-config-prettier turns curly off; 'all' cannot conflict with Prettier.
  { rules: { curly: ['error', 'all'] } },
)
