import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

import {
  MACOS_SCRIPT,
  SHIPPED_WORDS_FILE,
} from '../../packages/core/src/assets.ts'

interface Copy {
  readonly path: string
  readonly text: string
}

const CORE = 'packages/core'
const HARNESS = 'harnesses/claude-code'
// The engine type-checks and bundles only a mod's hooks/, types/ and tests/,
// and a git-subdir install carries only the harness folder.
const CODE_COPY = join(HARNESS, 'hooks', 'core')
const NOTICE =
  'GENERATED from packages/core - edit there, run `bun run core:sync`'
const SKIPPED = new Set(['.DS_Store'])

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && !SKIPPED.has(entry.name))
    .map(entry => join(entry.parentPath, entry.name))
    .sort((a, b) => a.localeCompare(b))
}

function copyOf(source: string, path: string, comment: string): Copy {
  return { path, text: `${comment} ${NOTICE}\n${readFileSync(source, 'utf8')}` }
}

function expectedCopies(): Copy[] {
  const src = join(CORE, 'src')
  return [
    ...filesUnder(src).map(source =>
      copyOf(source, join(CODE_COPY, relative(src, source)), '//'),
    ),
    copyOf(
      join(CORE, 'assets', 'macos', 'spell-macos.js'),
      join(HARNESS, MACOS_SCRIPT),
      '//',
    ),
    // A word list reads everything after # as a comment.
    copyOf(
      join(CORE, 'assets', 'words.txt'),
      join(HARNESS, SHIPPED_WORDS_FILE),
      '#',
    ),
  ]
}

function problems(copies: readonly Copy[]): string[] {
  const wanted = new Set(copies.map(copy => copy.path))
  const stray = existsSync(CODE_COPY)
    ? filesUnder(CODE_COPY).filter(path => !wanted.has(path))
    : []
  return [
    ...copies.flatMap(copy => {
      if (!existsSync(copy.path)) {
        return [`${copy.path} is missing`]
      }
      return readFileSync(copy.path, 'utf8') === copy.text
        ? []
        : [`${copy.path} differs from its source`]
    }),
    ...stray.map(path => `${path} has no source in ${CORE}`),
  ]
}

function write(copies: readonly Copy[]): void {
  rmSync(CODE_COPY, { recursive: true, force: true })
  for (const copy of copies) {
    mkdirSync(dirname(copy.path), { recursive: true })
    writeFileSync(copy.path, copy.text)
  }
}

const copies = expectedCopies()
if (process.argv[2] === '--check') {
  const found = problems(copies)
  if (found.length > 0) {
    process.stderr.write(
      `The copies of ${CORE} are out of date:\n${found.map(problem => `  ${problem}\n`).join('')}Run 'bun run core:sync'.\n`,
    )
    process.exit(1)
  }
  process.stdout.write(`${String(copies.length)} copies match ${CORE}.\n`)
} else {
  write(copies)
  process.stdout.write(
    `Copied ${String(copies.length)} files from ${CORE} into ${HARNESS}.\n`,
  )
}
