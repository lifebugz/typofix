import { MACOS_SCRIPT } from '../assets'
import { maskCode } from '../text/mask'
import type { Checked } from '../types'
import { parseIspell, toIspellInput } from './ispell'
import { parseMacResult } from './macos'

export interface Backend {
  readonly name: string
  readonly argv: (root: string, language: string) => string[]
  readonly input: (text: string) => string
  readonly parse: (stdout: string, text: string) => Checked | undefined
}

export const CHECK_DELAY_MS = 400

export const SPELL_TIMEOUT_MS = 5000
export const MAX_HUNSPELL_MISSES = 3

const withLanguage = (language: string): string[] =>
  language === '' ? [] : ['-d', language]

const hunspellArgv = (language: string): string[] => [
  'hunspell',
  '-a',
  '-i',
  'utf-8',
  ...withLanguage(language),
]

const parseIspellChecked = (stdout: string, text: string): Checked => ({
  spans: parseIspell(stdout, text),
})

export const extraBackend = (dictionary: string): Backend => ({
  name: 'hunspell',
  argv: () => hunspellArgv(dictionary),
  input: toIspellInput,
  parse: parseIspellChecked,
})

export const BACKENDS: readonly Backend[] = [
  {
    name: 'osascript',
    argv: (root, language) => [
      'osascript',
      '-l',
      'JavaScript',
      `${root}/${MACOS_SCRIPT}`,
      language,
    ],
    input: text => text,
    parse: parseMacResult,
  },
  {
    name: 'enchant-2',
    argv: (_, language) => ['enchant-2', '-a', ...withLanguage(language)],
    input: toIspellInput,
    parse: parseIspellChecked,
  },
  {
    name: 'hunspell',
    argv: (_, language) => hunspellArgv(language),
    input: toIspellInput,
    parse: parseIspellChecked,
  },
]

export function chooseCandidates(
  chosen: Backend | null | undefined,
): readonly Backend[] {
  if (chosen === undefined) {
    return BACKENDS
  }
  return chosen === null ? [] : [chosen]
}

export function checkerInput(backend: Backend, text: string): string {
  return backend.input(maskCode(text))
}

export function isRefusedRun(exitCode: number, stdout: string): boolean {
  return exitCode !== 0 && stdout.trim() === ''
}
