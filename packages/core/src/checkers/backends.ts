import { MACOS_SCRIPT } from '../assets'
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
