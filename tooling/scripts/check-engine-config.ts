import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

type Json = Readonly<Record<string, unknown>>

const MOD_CONFIG = 'tooling/tsconfig/mod.json'
// MOD_CONFIG sets these differently from the engine on purpose.
const OWN_OPTIONS = new Set(['typeRoots', 'types', 'skipLibCheck'])

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(path: string): Json {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isRecord(value)) {
    throw new Error(`${path} does not hold a JSON object`)
  }
  return value
}

function objectAt(record: Json, key: string): Json {
  const value = record[key]
  return isRecord(value) ? value : {}
}

function folders(record: Json, prefix: string): string[] {
  const value = record['include']
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map(entry => (typeof entry === 'string' ? entry.replace(prefix, '') : ''))
    .sort((a, b) => a.localeCompare(b))
}

function modOptions(path: string): Json {
  const mod = readJson(path)
  const base = mod['extends']
  const inherited =
    typeof base === 'string'
      ? objectAt(readJson(join(dirname(path), base)), 'compilerOptions')
      : {}
  return { ...inherited, ...objectAt(mod, 'compilerOptions') }
}

function optionDrift(engine: Json, mod: Json): string[] {
  return Object.entries(engine)
    .filter(([key]) => !OWN_OPTIONS.has(key))
    .filter(
      ([key, value]) => JSON.stringify(mod[key]) !== JSON.stringify(value),
    )
    .map(
      ([key, value]) =>
        `compilerOptions.${key}: the engine sets ${JSON.stringify(value)}, ${MOD_CONFIG} ${JSON.stringify(mod[key])}`,
    )
}

function includeDrift(engine: Json, mod: Json): string[] {
  const engineFolders = folders(engine, '../../')
  const modFolders = folders(mod, '${configDir}/')
  return JSON.stringify(engineFolders) === JSON.stringify(modFolders)
    ? []
    : [
        `include: the engine checks ${engineFolders.join(', ')}, ${MOD_CONFIG} ${modFolders.join(', ')}`,
      ]
}

function pluginsWithDependencies(): string[] {
  return readdirSync('harnesses', { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry =>
      join('harnesses', entry.name, '.claude-plugin', 'plugin.json'),
    )
    .filter(path => existsSync(path) && 'dependencies' in readJson(path))
    .map(
      path =>
        `${path} lists dependencies, whose types tooling/types/ does not carry`,
    )
}

const enginePath = process.argv[2]
if (enginePath === undefined) {
  throw new Error(
    'usage: bun tooling/scripts/check-engine-config.ts <engine tsconfig>',
  )
}
const engine = readJson(enginePath)
const problems = [
  ...optionDrift(objectAt(engine, 'compilerOptions'), modOptions(MOD_CONFIG)),
  ...includeDrift(engine, readJson(MOD_CONFIG)),
  ...pluginsWithDependencies(),
]
if (problems.length > 0) {
  process.stderr.write(
    `The root config no longer fits the engine's mod setup:\n${problems.map(problem => `  ${problem}\n`).join('')}`,
  )
  process.exit(1)
}
