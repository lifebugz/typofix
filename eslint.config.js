import prettier from 'eslint-config-prettier'
import { defineConfig } from 'eslint/config'

import { base } from './tooling/eslint/base.js'
import { boundaries } from './tooling/eslint/boundaries.js'
import { jxa } from './tooling/eslint/jxa.js'

export default defineConfig(
  {
    ignores: [
      '.claude/',
      'tooling/types/',
      'harnesses/*/.claude-plugin/types/',
      // Generated from packages/core, and linted there.
      'harnesses/*/hooks/core/',
      'harnesses/claude-code/scripts/spell-macos.js',
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
  boundaries,
  prettier,
  // eslint-config-prettier turns curly off; 'all' cannot conflict with Prettier.
  { rules: { curly: ['error', 'all'] } },
)
